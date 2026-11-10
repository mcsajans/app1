import { reminderService, type Reminder } from '../api/modules';
import { removeMine, upsertEvent } from '../calendar/deviceCalendar';
import { getDeviceId } from '../device/deviceId';
import { rawOccurrences } from './quietHours';

/**
 * Hatırlatıcıların cihaz takvimi kaydı (modules_doc/bildirimler.md).
 *
 * Görevlerdeki (`taskAlarms.ts`) akışın hatırlatıcı karşılığı, iki farkla:
 *
 *  - Hatırlatıcı **tekrar eder**. "Her gün" biçiminde takvime yinelenen bir
 *    etkinlik yazılır; tek tek yazılsaydı ya yüzlerce etkinlik ya da bir hafta
 *    sonra biten bir uyarı olurdu. Gün seçimli ve tek seferlik biçimlerde
 *    yalnızca bir sonraki tekrar yazılır — gerekçesi `calendarPlan`'da.
 *  - Yalnızca `fixed_times` modundakiler yazılır. `interval` modunun ("3
 *    saatte bir") takvimde karşılığı yok: başlangıcı son kayda göre kayıyor,
 *    yani sabit bir saate oturmuyor. Böyle bir hatırlatıcıyı takvime yazmak
 *    kullanıcıya **yanlış** bir saat göstermek olurdu.
 */

/** Bu cihazın bu hatırlatıcıya yazdığı takvim kaydı. */
async function myAlarm(reminder: Reminder) {
  const me = await getDeviceId();
  return reminder.device_alarm_ids.find((a) => a.device_uuid === me) ?? null;
}

/** 'YYYY-AA-GG' → o günün yerel gece yarısı; geçersizse null. */
function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Takvim etkinliğinin başlangıcı ve yinelenme biçimi.
 *
 * **`daysOfTheWeek` yalnızca iOS'ta destekleniyor** (expo-calendar SDK 58).
 * Android'de yok sayılıyor ve haftalık bir kural, başlangıç gününün haftanın
 * gününde tekrarlıyor — "Pzt/Çar/Cum" seçen kullanıcı takvimde yalnızca
 * Pazartesileri görürdü, üstelik sessizce.
 *
 * Bu yüzden "belirli günler" ve "haftalık" için takvime **yinelenme kuralı
 * hiç yazılmıyor**; yalnızca bir sonraki tekrar tek seferlik etkinlik olarak
 * konuyor. Uygulama her ön plana gelişte yeniden eşitlendiği için bir
 * sonraki tekrar yerine geçiyor. Yerel bildirimler ufku zaten tam olarak
 * kapsıyor (scheduler.ts); takvim buradaki ikinci güvence.
 */
function calendarPlan(reminder: Reminder): {
  startAt: Date;
  repeatsDaily: boolean;
  repeatUntil: Date | null;
} | null {
  const recurrence = reminder.recurrence_type ?? 'daily';
  const firstTime = reminder.fixed_times?.[0];
  if (!firstTime) return null;

  if (recurrence === 'daily') {
    const start = parseDay(reminder.start_date) ?? new Date();
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(firstTime);
    if (!m) return null;
    start.setHours(Number(m[1]), Number(m[2]), 0, 0);
    // Bitiş gününün SONU alınır; gün içindeki son tekrar da kapsansın.
    const end = parseDay(reminder.end_date);
    if (end) end.setHours(23, 59, 59, 0);
    return { startAt: start, repeatsDaily: true, repeatUntil: end };
  }

  /*
   * Tek seferlik ve gün seçimli biçimlerde bir sonraki gerçek tekrar
   * bulunur. Hesap `quietHours.rawOccurrences` ile yapılıyor: tekrar
   * kuralları zaten orada ve burada ikinci kez yazılsaydı iki uygulama
   * zamanla ayrışırdı.
   */
  const upcoming = rawOccurrences(reminder, new Date(), 370);
  const next = upcoming[0];
  return next ? { startAt: next, repeatsDaily: false, repeatUntil: null } : null;
}

/**
 * Hatırlatıcı oluşturulduktan ya da güncellendikten sonra çağrılır.
 *
 * Takvim kimliğini sunucuya yazma işi **sessizce başarısız olabilir**: alarm
 * kurmak kaydın kendisinden daha az önemli ve ağ hatası yüzünden kullanıcıya
 * "hatırlatıcı kaydedilemedi" demek yanlış olurdu.
 */
export async function onReminderSaved(reminder: Reminder): Promise<void> {
  const previous = await myAlarm(reminder);

  const plan =
    reminder.is_active
    && reminder.enable_device_alarm
    && reminder.schedule_mode === 'fixed_times'
      ? calendarPlan(reminder)
      : null;

  if (!plan) {
    if (previous) {
      const kept = await removeMine(reminder.device_alarm_ids);
      await reminderService
        .update(reminder.id, { device_alarm_ids: kept })
        .catch(() => undefined);
    }
    return;
  }

  const created = await upsertEvent({
    title: reminder.title,
    // Etkinlik açıklaması takvim kaydının notuna da geçer: kullanıcı telefonun
    // takvim uygulamasından baktığında "yanına ne alacağım" bilgisi orada olsun.
    notes: reminder.description ?? null,
    startAt: plan.startAt,
    offsets: reminder.notification_offsets,
    previous,
    repeatsDaily: plan.repeatsDaily,
    repeatUntil: plan.repeatUntil,
  });
  if (!created) return;

  const others = reminder.device_alarm_ids.filter((a) => a.device_uuid !== created.device_uuid);
  await reminderService
    .update(reminder.id, { device_alarm_ids: [...others, created] })
    .catch(() => undefined);
}

/**
 * Hatırlatıcı kapatıldığında ya da silindiğinde çağrılır.
 *
 * `persist` yalnızca hatırlatıcı hâlâ varken anlamlı: silinmiş bir kaydın
 * alanını güncellemeye çalışmak 404 döndürürdü.
 */
export async function onReminderClosed(reminder: Reminder, persist = true): Promise<void> {
  if (reminder.device_alarm_ids.length === 0) return;
  const kept = await removeMine(reminder.device_alarm_ids);
  if (!persist) return;
  await reminderService.update(reminder.id, { device_alarm_ids: kept }).catch(() => undefined);
}
