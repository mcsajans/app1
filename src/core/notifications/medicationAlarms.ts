import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { medicationService } from '../api/modules';
import type { Id } from '../api/endpoints';
import { CHANNEL_ID, cancelMedicationAlarms, ensureChannel, getPermission } from './scheduler';
import { ALERTS } from './soundCatalog';

/**
 * İlaç uyarıları (Modül 16, `modules_doc/ilac-takibi.md` §6).
 *
 * Diğer planlayıcılardan üç farkı var ve üçü de kasıtlı:
 *
 *  1. **Tek kayıt değil, tüm plan yeniden kurulur.** "Sıradaki doz" son doza
 *     bağlı: bir doz yazıldığında o ilacın bütün gelecek uyarıları kayar.
 *     Sunucu bu hesabı zaten yapıyor (`GET /medications/due`), istemci onu
 *     okuyup uyarıları yeniden diziyor.
 *  2. **Kür bitince uyarı kendiliğinden susar.** Biten/durdurulan kür `due`
 *     listesinde hiç görünmez; istemcinin ayrıca "bitti mi" diye bakmasına
 *     gerek yok.
 *  3. **Sessiz saat UYGULANMAZ.** Hatırlatıcılarda gece saatleri kaydırılıyor
 *     (`quietHours.ts`); burada bilerek kaydırılmıyor, çünkü gece 02:00
 *     dozu tam da bastırılmaması gereken uyarıdır. Bu, sessiz saat kuralının
 *     belgelenmiş tek istisnası.
 *
 * Kanal yeni açılmadı: hatırlatıcı kanalı (`CHANNEL_ID`) kullanılıyor. Ayrı
 * bir kanal, kullanıcıya ayarlanacak bir şey daha demek ve ilaç uyarısı
 * zaten hatırlatıcıyla aynı aciliyette.
 */

/** Kaç gün ileriye uyarı kurulur — bütçe `MAX_SCHEDULED` ile paylaşılıyor. */
const HORIZON_DAYS = 3;

/** Şu ana çok yakın bir uyarı kurulmaz: kullanıcı ekranda zaten görüyor. */
const MIN_LEAD_SEC = 60;

/**
 * Bebeğin aktif kürleri için sıradaki doz uyarılarını yeniden kurar.
 *
 * Kurulan uyarı sayısını döndürür (sıfır da geçerli bir sonuç: yalnızca
 * "gerektikçe" kullanılan ilaçların sıradaki dozu yoktur).
 */
export async function syncMedicationAlarms(babyId: Id | null): Promise<number> {
  await cancelMedicationAlarms();
  if (babyId === null) return 0;
  if ((await getPermission()) !== 'granted') return 0;

  let due;
  try {
    due = (await medicationService.due(babyId)).due;
  } catch {
    /*
     * Ağ hatası uyarıları siler ama yenisini kuramaz. Bu bilinçli bir
     * tercih: elde kalan eski plan, son dozdan sonra yanlış saati gösterir
     * ve yanlış saatte çalan bir ilaç uyarısı hiç çalmayandan kötüdür.
     */
    return 0;
  }

  await ensureChannel();

  const now = Date.now();
  const horizon = now + HORIZON_DAYS * 86_400_000;
  let planned = 0;

  for (const item of due) {
    const at = Date.parse(item.next_due_at);
    if (!Number.isFinite(at)) continue;
    if (at < now + MIN_LEAD_SEC * 1000 || at > horizon) continue;

    const amount = item.amount === null
      ? ''
      : ` · ${String(Math.round(item.amount * 100) / 100).replace('.', ',')} ${item.amount_unit}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        // Bildirim metni işletim sistemine düz metin gidiyor; ikon bileşeni
        // çizdiremediğimiz için emoji kalıyor (bkz. components/Icon.tsx).
        title: `💊 ${item.name}`,
        body: `İlaç zamanı${amount}`,
        data: { kind: 'medication', medicationId: item.medication_id },
        sound: ALERTS.reminder.file,
        ...(Platform.OS === 'android' ? { vibrate: [0, 250, 250, 250] } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(at),
        channelId: CHANNEL_ID,
      },
    });
    planned += 1;
  }

  return planned;
}
