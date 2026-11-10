import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import { getDeviceId } from '../device/deviceId';

/**
 * Cihaz takvimi entegrasyonu (modules_doc/bildirimler.md).
 *
 * Görev ve hatırlatıcılar istenirse **telefonun kendi takvimine** de yazılır.
 * Yerel bildirimden farkı, uygulama silinse ya da hiç açılmasa bile uyarının
 * durmasıdır: takvim etkinliği işletim sisteminin kendi verisidir.
 *
 * **Alarm değil takvim etkinliği** kullanılıyor. Android'in alarm uygulamasına
 * yazmanın tek yolu `AlarmClock` intent'idir; o da kullanıcıyı saat
 * uygulamasına atar, her görev için elle onay ister ve oluşan alarmın
 * kimliğini geri vermez — yani sonradan silinemez. Takvim etkinliğinin
 * kimliği dönüyor, hatırlatıcısı (`alarms`) var ve sessizce silinebiliyor;
 * şartnamedeki "alarm ID'lerini sakla, tamamlanınca sil" akışını ancak bu
 * karşılıyor. iOS'ta zaten üçüncü taraf uygulamalar saat alarmı kuramaz.
 *
 * SDK 58 ile `expo-calendar` nesne tabanlı API'ye geçti: `createEventAsync`
 * gibi eski işlevler `expo-calendar/legacy`'den alınmadıkça **çalışma
 * zamanında hata fırlatıyor**. Burada yalnızca yeni API kullanılır.
 */

/** Etkinliklerin yazıldığı kendi takvimimizin adı. */
const CALENDAR_TITLE = 'Bebiqa';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

function readStatus(res: Calendar.PermissionResponse): PermissionState {
  if (res.granted) return 'granted';
  return res.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Durumu **istem göstermeden** okur. `requestCalendarPermissions` ile
 * karıştırmamak kritik: durum sorgusu sistem diyaloğu açarsa kullanıcı
 * uygulamayı her açtığında izin istemiyle karşılaşır.
 */
export async function getCalendarPermission(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'denied';
  try {
    return readStatus(await Calendar.getCalendarPermissions(true));
  } catch {
    return 'denied';
  }
}

/**
 * Takvim iznini ister.
 *
 * `writeOnly: true` geçilir: uygulamanın kullanıcının randevularını **okumaya**
 * ihtiyacı yok, yalnızca kendi etkinliğini yazıyor. iOS 17+ bunu ayrı ve çok
 * daha az rahatsız edici bir izin olarak sunuyor; Android'de fark yok.
 */
export async function requestCalendarPermission(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'denied';
  try {
    const current = await Calendar.getCalendarPermissions(true);
    if (current.granted) return 'granted';
    if (!current.canAskAgain) return 'denied';
    return readStatus(await Calendar.requestCalendarPermissions(true));
  } catch {
    return 'denied';
  }
}

/**
 * Yazılabilir bir takvim bulur, yoksa kendi takvimimizi oluşturur.
 *
 * Kullanıcının asıl takvimine yazmak yerine ayrı bir takvim açmak bilinçli:
 * ebeveyn bebek uyarılarını tek hamlede gizleyebilsin ya da silebilsin
 * istiyoruz. Android'de sistem tarafından yönetilen bir "varsayılan takvim"
 * kavramı yok, bu yüzden her iki platformda da aynı yol izlenir.
 */
async function ensureCalendar(): Promise<Calendar.ExpoCalendar | null> {
  try {
    const calendars = await Calendar.getCalendars();
    const mine = calendars.find((c) => c.title === CALENDAR_TITLE && c.allowsModifications);
    if (mine) return mine;

    /*
     * Yeni takvim bir **kaynağa** (hesap) bağlanmak zorunda. Var olan
     * yazılabilir bir takvimin kaynağı varsa ödünç alınır; yoksa Android'in
     * yerel hesabı kullanılır.
     *
     * Yerel hesap yolu şart: cihaza hiç Google hesabı eklenmemişse
     * `getCalendars()` boş döner ve "ödünç alınacak kaynak" bulunamaz. O
     * durumda takvim özelliği hiç çalışmıyordu — emülatörde ve yeni kurulan
     * telefonlarda tam olarak böyle.
     */
    const writable = calendars.find((c) => c.allowsModifications);
    const source = writable?.source ?? { isLocalAccount: true, name: CALENDAR_TITLE, type: '' };

    return await Calendar.createCalendar({
      title: CALENDAR_TITLE,
      color: '#5B8DEF',
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: writable?.source?.id,
      source,
      name: CALENDAR_TITLE,
      ownerAccount: writable?.ownerAccount ?? CALENDAR_TITLE,
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
  } catch {
    return null;
  }
}

export type DeviceAlarm = { device_uuid: string; event_id: string; calendar_id?: string | null };

/**
 * Takvime bir uyarı etkinliği yazar ve kimliğini döndürür.
 *
 * Etkinlik `durationMin` kadar sürer (varsayılan 15 dk): sıfır uzunluklu
 * etkinlikler bazı takvim uygulamalarında hiç görünmüyor.
 *
 * `offsets` doğrudan etkinliğin kendi hatırlatıcılarına çevrilir — böylece
 * uygulama hiç açılmasa bile 30/15/5/0 uyarıları takvim tarafından verilir.
 * Yerel bildirimlerle çakışma pahasına: ikisi birden açıkken kullanıcı aynı
 * uyarıyı iki kez alır, ama hangisinin çalışacağını garanti edemediğimiz için
 * (uygulama silinmiş, bildirim izni geri alınmış olabilir) ikisi de kurulur.
 */
export async function upsertEvent(opts: {
  title: string;
  notes?: string | null;
  startAt: Date;
  offsets: number[] | null | undefined;
  durationMin?: number;
  /** Varsa önce bu etkinlik silinir — güncelleme yerine yeniden yazılır. */
  previous?: DeviceAlarm | null;
  /**
   * Her gün tekrar etsin mi (sabit saatli hatırlatıcılar için).
   *
   * Görevler tek seferliktir; hatırlatıcı "her gün 08:00" demektir ve takvime
   * tek tek yazılsaydı ya 365 etkinlik ya da bir hafta sonra biten bir uyarı
   * olurdu. Yinelenme kuralı bunu takvimin kendi işi hâline getiriyor.
   */
  repeatsDaily?: boolean;
  /**
   * Günlük yinelenmenin bittiği gün (dahil). `repeatsDaily` olmadan anlamsız.
   *
   * `RecurrenceRule.endDate` iki platformda da destekleniyor; `daysOfTheWeek`
   * ise **yalnızca iOS**'ta (expo-calendar SDK 58). Bu yüzden "belirli
   * günler" kuralı takvime hiç yazılmıyor — çağıranın notuna bakın
   * (reminderAlarms.ts).
   */
  repeatUntil?: Date | null;
}): Promise<DeviceAlarm | null> {
  if (Platform.OS === 'web') return null;
  if ((await getCalendarPermission()) !== 'granted') return null;

  if (opts.previous) await removeEvent(opts.previous);

  const calendar = await ensureCalendar();
  if (!calendar) return null;

  const end = new Date(opts.startAt.getTime() + (opts.durationMin ?? 15) * 60_000);

  try {
    const event = await calendar.createEvent({
      title: opts.title,
      notes: opts.notes ?? undefined,
      startDate: opts.startAt,
      endDate: end,
      // `relativeOffset` dakikadır ve negatif değer "başlangıçtan önce"
      // demektir; 0 tam zamanında çalar.
      alarms: (opts.offsets ?? []).map((m) => ({ relativeOffset: -m })),
      recurrenceRule: opts.repeatsDaily
        ? {
            frequency: Calendar.Frequency.DAILY,
            interval: 1,
            ...(opts.repeatUntil ? { endDate: opts.repeatUntil } : {}),
          }
        : null,
    });
    return {
      device_uuid: await getDeviceId(),
      event_id: event.id,
      calendar_id: calendar.id,
    };
  } catch {
    return null;
  }
}

/**
 * Etkinliği cihazdan siler.
 *
 * **Yalnızca bu cihazın** yazdığı kayıt silinir: kimlikler cihaza özgü olduğu
 * için başka bir cihazın kimliğiyle silmeye çalışmak ya hata verir ya da
 * (daha kötüsü) aynı kimliğe sahip alakasız bir etkinliği silerdi.
 */
export async function removeEvent(alarm: DeviceAlarm): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (alarm.device_uuid !== (await getDeviceId())) return false;

  try {
    const event = await Calendar.ExpoCalendarEvent.get(alarm.event_id);
    await event.delete();
    return true;
  } catch {
    // Etkinlik kullanıcı tarafından çoktan silinmiş olabilir; bu bir hata
    // değil, istenen son durum.
    return false;
  }
}

/** Listedeki tüm kayıtlardan bu cihaza ait olanları siler, kalanları döndürür. */
export async function removeMine(alarms: DeviceAlarm[]): Promise<DeviceAlarm[]> {
  const me = await getDeviceId();
  const mine = alarms.filter((a) => a.device_uuid === me);
  await Promise.all(mine.map((a) => removeEvent(a)));
  return alarms.filter((a) => a.device_uuid !== me);
}
