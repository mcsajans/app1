import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { vaccineService, type Vaccine } from '../api/modules';
import { removeMine, upsertEvent } from '../calendar/deviceCalendar';
import { getDeviceId } from '../device/deviceId';
import { vaccineInstant } from '../../modules/vaccines/vaccineFormat';
import { alarmSlots, offsetLabel } from './alarmPlan';
import { ALERTS } from './soundCatalog';
import {
  VACCINE_CHANNEL_ID, cancelVaccineAlarms, ensureChannel, getPermission,
} from './scheduler';

/**
 * Bir aşının alarmlarının yaşam döngüsü (modules_doc/asilar.md, Adım 3).
 *
 * `taskAlarms.ts` kalıbının aşı karşılığı; iki kanal birden kurulur:
 *
 *  - **Yerel bildirim** — uygulama kurulu olduğu sürece çalışır.
 *  - **Takvim etkinliği** — uygulama hiç açılmasa, hatta silinse bile durur.
 *
 * Hangisinin elde kalacağını garanti edemeyiz (bildirim izni geri alınabilir,
 * takvim izni verilmemiş olabilir), bu yüzden ikisi birden kurulur. Aşıda bu
 * ikili güvence görevden daha da önemli: uyarı ayda bir çalıyor ve kaçırılan
 * bir doz telafisi zor.
 *
 * Takvim etkinliği **1 saat** sürer (görevde 15 dakika): aşı randevusu sağlık
 * ocağında geçen süreyi de kapsıyor ve takvimde "09:00–09:15" görmek ebeveyni
 * o saate başka bir şey koymaya davet ederdi.
 */
const EVENT_MINUTES = 60;

/** Aşı kapalı mı — yapılmış ya da atlanmış aşının alarmı olmaz. */
function isClosed(vaccine: Vaccine): boolean {
  return vaccine.status !== 'pending';
}

/** Bildirim ve takvim başlığı: "Aşı: KKK (1. doz)". */
function titleOf(vaccine: Vaccine): string {
  const dose = vaccine.dose_number ? ` (${vaccine.dose_number}. doz)` : '';
  return `Aşı: ${vaccine.name}${dose}`;
}

/**
 * Tek bir aşının yerel bildirimlerini yeniden planlar.
 *
 * Tam eşitleme (`syncReminders`) yerine tek kayıt hedeflenir: kullanıcı
 * "Kaydet"e bastığı anda diğer tüm alarmların yeniden yazılması gereksiz bir
 * gecikme olurdu. Bütçe kırpması bir sonraki tam eşitlemede uygulanır.
 */
async function scheduleLocal(vaccine: Vaccine): Promise<number> {
  await cancelVaccineAlarms(vaccine.id);
  if (isClosed(vaccine)) return 0;
  if ((await getPermission()) !== 'granted') return 0;

  const at = vaccineInstant(vaccine);
  if (!at) return 0;

  await ensureChannel();
  const slots = alarmSlots(at, vaccine.notification_offsets);
  const where = vaccine.location ? ` · ${vaccine.location}` : '';

  for (const slot of slots) {
    await Notifications.scheduleNotificationAsync({
      content: {
        // Bildirim metni işletim sistemine düz metin olarak gidiyor; orada bir
        // ikon bileşeni çizdiremeyiz, bu yüzden emoji kalıyor (Icon.tsx notu).
        title: `💉 ${vaccine.name}${vaccine.dose_number ? ` (${vaccine.dose_number}. doz)` : ''}`,
        body: `${offsetLabel(slot.offsetMin)}${where}`,
        data: { kind: 'vaccine', vaccineId: vaccine.id, offsetMin: slot.offsetMin },
        // Özel ses dosya **adıyla** verilir (soundCatalog.ts); `'default'`
        // yazmak Android'de "o adda ses dosyası yok" hatası üretiyordu.
        sound: ALERTS.vaccine.file,
        ...(Platform.OS === 'android' ? { vibrate: [0, 250, 250, 250] } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: slot.at,
        channelId: VACCINE_CHANNEL_ID,
      },
    });
  }
  return slots.length;
}

/** Bu cihazın bu aşıya yazdığı takvim kaydı. */
async function myAlarm(vaccine: Vaccine) {
  const me = await getDeviceId();
  return vaccine.device_alarm_ids.find((a) => a.device_uuid === me) ?? null;
}

/**
 * Aşı eklendikten, randevusu girildikten ya da güncellendikten sonra çağrılır.
 *
 * Takvim kimliği sunucuya yazılır — ama bu yazma **sessizce başarısız
 * olabilir**: alarm kurmak kaydın kendisinden daha az önemli ve ağ hatası
 * yüzünden kullanıcıya "aşı kaydedilemedi" demek yanlış olurdu. Kimlik
 * kaybolursa en kötü ihtimalle takvimde sahipsiz bir etkinlik kalır.
 */
export async function onVaccineSaved(vaccine: Vaccine): Promise<void> {
  await scheduleLocal(vaccine);

  const previous = await myAlarm(vaccine);
  const at = vaccineInstant(vaccine);

  if (isClosed(vaccine) || !vaccine.enable_device_alarm || !at) {
    if (previous) {
      const kept = await removeMine(vaccine.device_alarm_ids);
      await vaccineService.update(vaccine.id, { device_alarm_ids: kept }).catch(() => undefined);
    }
    return;
  }

  const created = await upsertEvent({
    title: titleOf(vaccine),
    // Takvimde yer ve not bir arada: etkinliğe bakan ebeveyn nereye gideceğini
    // uygulamayı açmadan görsün.
    notes: [vaccine.location, vaccine.note].filter(Boolean).join(' · ') || null,
    startAt: at,
    offsets: vaccine.notification_offsets,
    durationMin: EVENT_MINUTES,
    previous,
  });
  if (!created) return;

  const others = vaccine.device_alarm_ids.filter((a) => a.device_uuid !== created.device_uuid);
  await vaccineService
    .update(vaccine.id, { device_alarm_ids: [...others, created] })
    .catch(() => undefined);
}

/**
 * Aşı yapıldığında, atlandığında ya da silindiğinde çağrılır.
 *
 * `persist` yalnızca kayıt hâlâ varken anlamlı: silinmiş bir aşının
 * `device_alarm_ids` alanını güncellemeye çalışmak 404 döndürürdü.
 */
export async function onVaccineClosed(vaccine: Vaccine, persist = true): Promise<void> {
  await cancelVaccineAlarms(vaccine.id);
  if (vaccine.device_alarm_ids.length === 0) return;

  const kept = await removeMine(vaccine.device_alarm_ids);
  if (!persist) return;
  await vaccineService.update(vaccine.id, { device_alarm_ids: kept }).catch(() => undefined);
}
