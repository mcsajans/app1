import * as Notifications from 'expo-notifications';
// `AndroidImportance` pakette `export *` zinciriyle yeniden dışa açıldığı için
// ad alanı üzerinden erişimi eslint çözemiyor; adlandırılmış import net.
import {
  AndroidAudioContentType, AndroidAudioUsage, AndroidImportance,
  AndroidNotificationPriority, AndroidNotificationVisibility,
} from 'expo-notifications';
import { Platform } from 'react-native';

import type { QuietHour, Reminder, Task, Vaccine } from '../api/modules';
/*
 * `vaccineInstant` modül klasöründe duruyor ama React'siz ve bağımlılıksız
 * bir saf işlev; düz Node ile test edilebilmesi için orada kaldı
 * (`scratchpad/vaccine_format_test.mjs`). Buraya kopyalamak, "gün + saat →
 * alarm anı" kuralını iki yerde tutmak demekti.
 */
import { vaccineInstant } from '../../modules/vaccines/vaccineFormat';
import { alarmSlots, eventInstant, offsetLabel } from './alarmPlan';
import { ALERTS } from './soundCatalog';
import {
  canRepeat, coveringWindow, escapeQuiet, rawOccurrences, toMinutes,
} from './quietHours';

/**
 * Yerel bildirim planlama (Modül 8).
 *
 * Bildirimler **cihazda** planlanır; sunucuda push altyapısı yoktur. Bu, uygulama
 * çevrimdışıyken de alarmın çalması anlamına gelir ve FCM/APNs kurulumu
 * gerektirmez (`enableRemoteNotifications: false`, app.json).
 *
 * Planlama iki biçimden birini kullanır:
 *
 *  - **Tekrar eden tetikleyici** (`DAILY` / `TIME_INTERVAL`): işletim sistemi
 *    süresiz tekrarlar, uygulama hiç açılmasa bile çalar. Yalnızca hiçbir
 *    sessiz saat penceresi araya girmediğinde kullanılabilir, çünkü tekrar eden
 *    bir tetikleyici güne göre değişemez.
 *  - **Açık tarihli tetikleyiciler** (`DATE`): sessiz saat devredeyken her
 *    tekrar tek tek hesaplanır, böylece `days_mask` ve `quiet_behavior` tam
 *    olarak uygulanır. Bedeli, ufuk (`HORIZON_DAYS`) kadar ileriye
 *    planlanmasıdır; uygulama bu süre boyunca hiç açılmazsa alarmlar tükenir.
 *    Uygulama her ön plana geldiğinde yeniden planlandığı için pratikte
 *    sorun olmaz (ebeveyn gün içinde zaten kayıt giriyor).
 */

/*
 * ───────────────────────── kanal kimlikleri ─────────────────────────
 *
 * **`_v2` eki şart.** Android'de bir kanalın sesi, önemi ve titreşimi
 * oluşturulduktan sonra **uygulama tarafından değiştirilemiyor**; yalnızca adı
 * ve açıklaması güncellenebiliyor (Expo belgesi,
 * `setNotificationChannelAsync`). Şartnamenin istediği özel sesler
 * (`notification-voice.md` §2.1) eski kimliklere yazılsaydı, uygulamayı daha
 * önce kurmuş hiç kimse onları duymayacaktı — kanal zaten sistem varsayılan
 * sesiyle oluşmuş durumda. Kimlik değişince Android yeni bir kanal yaratıyor
 * ve ses uygulanıyor.
 *
 * Eski kanallar cihazda **kalıyor** ve kullanıcının bildirim ayarlarında
 * görünüyor; onları silmek kullanıcının o kanalda yaptığı ayarı (sustur,
 * önemi düşür) da silerdi ve ayarı sessizce geri almak kabul edilemez.
 * Eski kanallara artık hiçbir bildirim gönderilmiyor, bu yüzden sessiz
 * kalıyorlar.
 *
 * Bu kuralı ileride yine değiştirmek gerekirse **kimlik de artmalı** (`_v3`).
 */

/**
 * Hatırlatıcılar.
 *
 * `app.json` → `expo-notifications` → `defaultChannel` ile **aynı olmalı**;
 * o alan, kanalı belirtilmemiş bildirimlerin düşeceği kanalı seçiyor.
 */
export const CHANNEL_ID = 'reminders_v2';

/**
 * Görevler için ayrı kanal.
 *
 * Android'de kanal, kullanıcının ses/titreşim/öncelik ayarını yaptığı birimdir
 * ve **oluşturulduktan sonra önemi uygulama tarafından değiştirilemez**. Tek
 * kanal kullansaydık "hatırlatıcıları sustur ama görevleri duy" ayarı mümkün
 * olmazdı — ikisi farklı aciliyette.
 */
export const TASK_CHANNEL_ID = 'tasks_v2';

/**
 * Gecikmiş görev uyarıları için **ayrı** kanal.
 *
 * Şartname görev saati için `bildirim5.mp3`, gecikme için `bildirim6.mp3`
 * istiyor (§2.1). Android'de ses kanalın özelliği, bildirimin değil: tek
 * kanalda iki farklı ses mümkün değil. Ayrılmasının ikinci faydası, gecikme
 * uyarısı rahatsız edici bulunursa kullanıcının yalnızca onu
 * susturabilmesi — görev saatini duymaya devam eder.
 */
export const TASK_OVERDUE_CHANNEL_ID = 'tasks_overdue_v2';

/**
 * Aşılar için ayrı kanal.
 *
 * Görev kanalıyla paylaşılsaydı "görevleri sustur ama aşıyı duy" ayarı
 * mümkün olmazdı — kanalın önemi oluşturulduktan sonra uygulama tarafından
 * değiştirilemiyor. Aşı uyarısı ayda bir çalıyor ve kaçırılması telafisi
 * zor; günlük görev uyarılarıyla aynı kefeye konmamalı.
 */
export const VACCINE_CHANNEL_ID = 'vaccines_v2';

/**
 * Etkinlik uyarıları için **yüksek sesli** kanal.
 *
 * Diğer kanallardan iki farkı var ve ikisi de kasıtlı:
 *
 *  - **Ses ALARM akışından çalar** (`AndroidAudioUsage.ALARM`). Bildirim sesi
 *    telefonun "bildirim" ses düzeyine bağlı ve çoğu kullanıcıda düşük;
 *    alarm akışı ayrı ve belirgin şekilde yüksek. `enforceAudibility` ise
 *    sesin kısılmış akışlarda bile duyulmasını ister.
 *  - **`importance: MAX`** — ekranın üstünde beliren (heads-up) bildirim.
 *
 * Kanal ayrı olmak zorunda: Android'de kanalın önemi ve sesi **oluşturulduktan
 * sonra uygulama tarafından değiştirilemiyor**. Hatırlatıcı kanalıyla
 * paylaşılsaydı ya tüm hatırlatıcılar alarm sesiyle çalardı ya da etkinlik
 * uyarısı sessiz kalırdı.
 *
 * Kanalın ayarını ileride değiştirmek gerekirse **kimliği de artmalı**
 * (`events_v3` gibi); aksi hâlde yeni ayarlar yalnızca uygulamayı ilk kez
 * kuranlara uygulanır.
 */
export const EVENT_CHANNEL_ID = 'events_v2';

/** Açık tarihli planlamada kaç gün ileri gidilir. */
const HORIZON_DAYS = 7;

/**
 * Aşı uyarıları için ufuk — **gün**.
 *
 * Aşı takvimi 13 yıla kadar uzanıyor ve her doz üç uyarı istiyor. Ufuksuz
 * planlamada tek bir bebek 60 bildirim kuruyordu (emülatörde ölçüldü: 39) ve
 * `MAX_SCHEDULED` bütçesinin neredeyse tamamını yiyip hatırlatıcılarla
 * görevleri dışarı itiyordu — oysa 2030'daki bir dozun uyarısını bugün
 * kurmanın hiçbir faydası yok.
 *
 * 120 gün, takvimdeki en seyrek aralığı (2–6 ay) rahatça kapsıyor: her zaman
 * en az bir sonraki doz plana giriyor. Uygulama her ön plana gelişte yeniden
 * eşitlendiği için daha uzaktakiler zamanı gelince ekleniyor.
 */
const VACCINE_HORIZON_DAYS = 120;

/**
 * Etkinlik uyarıları için ufuk — **gün**.
 *
 * Genel ufuk (`HORIZON_DAYS`, 7 gün) etkinliğe yetmiyor: "14 gün önce" uyarısı
 * ancak etkinlik 14 günden yakınsa plana girerdi ve kullanıcının seçtiği en
 * erken uyarı sessizce hiç kurulmazdı. Aşı takvimiyle aynı ufuk kullanılıyor;
 * daha uzağı bugünden planlamanın faydası yok, uygulama her ön plana gelişte
 * yeniden eşitleniyor.
 */
const EVENT_HORIZON_DAYS = 120;

/**
 * Toplam planlı bildirim üst sınırı. iOS bekleyen bildirimleri 64'te kesip
 * fazlasını **sessizce** atar; en yakın zamanlılar korunacak şekilde kendimiz
 * kırpıyoruz ki hangi alarmın düştüğü belirsiz kalmasın.
 */
const MAX_SCHEDULED = 56;

export type SyncReport = {
  /** İşletim sistemine verilen bildirim sayısı. */
  scheduled: number;
  /** Sessiz saat nedeniyle hiç planlanmayan tekrar sayısı. */
  skipped: number;
  /** Sessiz saat sonuna ötelenen tekrar sayısı. */
  postponed: number;
  /** Sessize alınan (titreşimsiz/sessiz) tekrar sayısı. */
  silenced: number;
  /** `MAX_SCHEDULED` sınırı nedeniyle kırpılan tekrar sayısı. */
  trimmed: number;
  /** Süresiz tekrar eden tetikleyici kullanan hatırlatıcı sayısı. */
  repeating: number;
  /** Görevler için planlanan bildirim sayısı (30/15/5/0 dk uyarıları). */
  taskAlarms: number;
  /** Aşılar için planlanan bildirim sayısı (7/2/1 gün uyarıları). */
  vaccineAlarms: number;
  /** En yakın alarm; hiç yoksa null. */
  nextAt: Date | null;
};

const EMPTY_REPORT: SyncReport = {
  scheduled: 0, skipped: 0, postponed: 0, silenced: 0,
  trimmed: 0, repeating: 0, taskAlarms: 0, vaccineAlarms: 0, nextAt: null,
};

/* ───────────────────────── izin ve kanal ───────────────────────── */

export type PermissionState = 'granted' | 'denied' | 'undetermined';

function readStatus(res: Notifications.NotificationPermissionsStatus): PermissionState {
  if (res.granted) return 'granted';
  // iOS'ta "provisional" izin verilmiş ama sessiz demektir; granted bayrağı
  // bunu zaten kapsar. canAskAgain false ise kullanıcı kalıcı olarak reddetti.
  return res.canAskAgain ? 'undetermined' : 'denied';
}

export async function getPermission(): Promise<PermissionState> {
  return readStatus(await Notifications.getPermissionsAsync());
}

/**
 * İzin ister. Android 13+ üzerinde izin istemi **kanal oluşturulmadan
 * görünmediği** için kanal önce kurulur.
 */
export async function requestPermission(): Promise<PermissionState> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'denied';
  return readStatus(await Notifications.requestPermissionsAsync());
}

/**
 * Android bildirim kanallarını kurar.
 *
 * Her kanalın **kendi sesi** var (`notification-voice.md` §2.1). Ses dosya
 * **adıyla** veriliyor; dosyalar `app.json` → `expo-notifications` →
 * `sounds` dizisi sayesinde derleme sırasında `res/raw` altına kopyalanıyor
 * ve yalnızca temel adıyla anılıyor (Expo belgesi). Ad `sounds` dizisinde
 * yoksa Android kanalı **sessiz** oluşturur, bu yüzden listeyi tek kaynaktan
 * besliyoruz (`soundCatalog.ts`) — iki yerde elle yazılsaydı biri unutulur ve
 * arıza yalnızca gerçek cihazda görünürdü.
 *
 * Çağrı ucuz ve defalarca yapılabilir: aynı kimlikle çağırmak var olan
 * kanalın yalnızca adını ve açıklamasını güncelliyor.
 */
export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Hatırlatıcılar',
    description: 'Besleme, uyku ve bez değişimi hatırlatıcıları',
    importance: AndroidImportance.HIGH,
    sound: ALERTS.reminder.file,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync(TASK_CHANNEL_ID, {
    name: 'Görevler',
    description: 'Aile üyelerine atanan görevlerin zamanı geldiğinde',
    importance: AndroidImportance.HIGH,
    sound: ALERTS.taskDue.file,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync(TASK_OVERDUE_CHANNEL_ID, {
    name: 'Gecikmiş görevler',
    description: 'Görev saati geçtiği hâlde tamamlanmadığında',
    importance: AndroidImportance.HIGH,
    sound: ALERTS.taskOverdue.file,
    // Gecikme uyarısı daha ısrarlı bir titreşim taşır: amacı fark edilmek.
    vibrationPattern: [0, 400, 200, 400],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync(VACCINE_CHANNEL_ID, {
    name: 'Aşı takvimi',
    description: 'Aşı günü yaklaştığında (7 gün, 2 gün ve 1 gün önce)',
    importance: AndroidImportance.HIGH,
    sound: ALERTS.vaccine.file,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync(EVENT_CHANNEL_ID, {
    name: 'Etkinlik uyarıları (yüksek sesli)',
    description: 'Etkinlik günü yaklaştığında alarm sesiyle uyarır',
    importance: AndroidImportance.MAX,
    /*
     * Etkinlik, hatırlatıcı sesini **alarm akışından** çalar.
     *
     * `sound` alanının üç hâli var ve ikisi tuzak: alan hiç verilmezse
     * sistemin varsayılan bildirim sesi kullanılır, `null` verilirse ses
     * **kapanır**, dizge verilirse o bir **dosya adı** sayılır ve config
     * plugin'in `sounds` dizisinde aranır. `'default'` yazmak bu yüzden
     * "default adında bir ses dosyası bulunamadı" hatası üretiyordu —
     * emülatörde görüldü.
     *
     * Şartnamede etkinliğe ayrı bir ses atanmamış (§2.1 tablosunda satırı
     * yok), bu yüzden hatırlatıcı sesi kullanılıyor; "yüksek" olmasını
     * sağlayan şey zaten sesin kendisi değil, aşağıdaki ALARM akışı.
     */
    sound: ALERTS.reminder.file,
    audioAttributes: {
      // Ses bildirim akışından değil ALARM akışından çalar — asıl "yüksek
      // ses" bundan geliyor, bildirim ses düzeyinden bağımsız.
      usage: AndroidAudioUsage.ALARM,
      contentType: AndroidAudioContentType.SONIFICATION,
      flags: { enforceAudibility: true, requestHardwareAudioVideoSynchronization: false },
    },
    // Uzun ve çift darbeli titreşim: ses kapalıyken de fark edilsin.
    vibrationPattern: [0, 600, 300, 600, 300, 600],
    enableVibrate: true,
    /*
     * Rahatsız Etmeyin'i aşma isteği. Kullanıcı sistem ayarlarından bu izni
     * vermediyse Android sessizce yok sayar; zarar vermiyor, verildiğinde
     * etkinlik uyarısı DND sırasında da duyuluyor.
     */
    bypassDnd: true,
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
  });
}

type Occurrence = { at: Date; silent: boolean };

/** Sessiz saat kuralını uygular; `null` dönerse o tekrar atlanır. */
function applyQuiet(
  at: Date,
  reminder: Reminder,
  windows: QuietHour[],
  report: SyncReport,
): Occurrence | null {
  if (!reminder.respect_quiet_hours || windows.length === 0) return { at, silent: false };
  if (!coveringWindow(windows, at)) return { at, silent: false };

  if (reminder.quiet_behavior === 'skip') {
    report.skipped += 1;
    return null;
  }
  if (reminder.quiet_behavior === 'silent') {
    report.silenced += 1;
    return { at, silent: true };
  }
  report.postponed += 1;
  return { at: escapeQuiet(windows, at), silent: false };
}

/*
 * Bildirim başlığındaki simgeler **emoji** kalır.
 *
 * Uygulamanın geri kalanı vektör ikon setine geçti (components/Icon.tsx), ama
 * bildirim metni işletim sistemine düz metin olarak gider: orada bir bileşen
 * çizdiremeyiz. Emoji, bildirim gölgesinde türü bir bakışta ayırt etmenin tek
 * yolu — kanal ikonu hepsinde aynı.
 */
const CATEGORY_EMOJI: Record<string, string> = {
  feeding: '🍼', breastfeeding: '🤱', sleep: '😴',
  diaper: '🧷', pumping: '🥛', custom: '🔔',
};

/**
 * Hatırlatıcıda hangi ön uyarıların kurulacağı.
 *
 * Ofsetler **yalnızca `fixed_times` modunda** anlamlı: orada bir hedef an var
 * ("08:00'de D vitamini") ve ondan 15 dk önce uyarmak işe yarıyor. `interval`
 * modunda hedef an yok — "3 saatte bir" tekrarının 30 dakika öncesi diye bir
 * şey tanımlanamaz, çünkü tekrar son kayda göre kayıyor. O modda yalnızca tam
 * zamanında (`0`) uyarı kurulur.
 *
 * Liste ayrıca **ilk üçle** sınırlanır: her ofset her sabit saat için ayrı bir
 * DAILY tetikleyici demek (12 saat × 4 ofset = 48) ve iOS'un 64'lük sınırı
 * tek bir hatırlatıcı tarafından tüketilebilirdi.
 */
function reminderOffsets(reminder: Reminder): number[] {
  if (reminder.schedule_mode !== 'fixed_times') return [0];
  const list = reminder.notification_offsets;
  if (!list || list.length === 0) return [0];
  return [...new Set(list)].sort((a, b) => a - b).slice(0, 3);
}

function contentOf(
  reminder: Reminder,
  silent: boolean,
  offsetMin = 0,
): Notifications.NotificationContentInput {
  return {
    title: `${CATEGORY_EMOJI[reminder.category] ?? '🔔'} ${reminder.title}`,
    body: offsetMin > 0
      ? offsetLabel(offsetMin)
      : reminder.schedule_mode === 'interval' && reminder.interval_minutes
        ? `${reminder.interval_minutes} dakika geçti.`
        : 'Hatırlatma zamanı.',
    // Bildirime hatırlatıcı kimliği gömülür; dokunulduğunda doğru ekrana
    // gidebilmek ve eşitlemede kendi bildirimlerimizi tanımak için.
    data: { reminderId: reminder.id, kind: 'reminder', offsetMin },
    /*
     * Özel ses dosyası **adıyla** verilir; `'default'` yazmak Android'de
     * "default adında ses dosyası yok" hatası üretiyordu. `false` sesi
     * kapatır — sessiz saat davranışı bunu kullanıyor.
     *
     * iOS'ta ses yalnızca bu alandan geliyor (kanal kavramı yok); Android'de
     * kanal da aynı sesi taşıyor ve Expo belgesi tutarlılık için ikisinin
     * birden verilmesini öneriyor.
     */
    sound: silent ? false : ALERTS.reminder.file,
    ...(Platform.OS === 'android' ? { vibrate: silent ? [] : [0, 250, 250, 250] } : {}),
  };
}

/* ───────────────────────── eşitleme ───────────────────────── */

/**
 * Bizim planladığımız bildirimleri iptal eder.
 *
 * `cancelAllScheduledNotificationsAsync()` kullanılmıyor: başka bir özellik
 * (ör. müzik uyku zamanlayıcısı) ileride bildirim planlarsa onu da silerdi.
 * `data.kind` ile yalnızca kendi kayıtlarımız hedeflenir.
 */
const OUR_KINDS = ['reminder', 'task', 'vaccine'];

export async function cancelScheduled(kinds: string[] = OUR_KINDS): Promise<number> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const mine = pending.filter((p) => kinds.includes(String(p.content.data?.kind ?? '')));
  await Promise.all(mine.map((p) => Notifications.cancelScheduledNotificationAsync(p.identifier)));
  return mine.length;
}

/**
 * Tek bir görevin bekleyen bildirimlerini iptal eder.
 *
 * Görev tamamlandığında ya da silindiğinde tüm planı baştan kurmak yerine
 * yalnızca o görevi temizlemek yeterli; kullanıcı "Tamamlandı"ya bastığı anda
 * diğer alarmların da birkaç yüz milisaniye yeniden yazılması gereksiz.
 */
export async function cancelTaskAlarms(taskId: number): Promise<number> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const mine = pending.filter(
    (p) => p.content.data?.kind === 'task' && p.content.data?.taskId === taskId,
  );
  await Promise.all(mine.map((p) => Notifications.cancelScheduledNotificationAsync(p.identifier)));
  return mine.length;
}

/**
 * Tek bir aşının bekleyen bildirimlerini iptal eder.
 *
 * `cancelTaskAlarms`'ın aşı karşılığı; aynı gerekçeyle tek kayıt hedeflenir.
 */
export async function cancelVaccineAlarms(vaccineId: number): Promise<number> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const mine = pending.filter(
    (p) => p.content.data?.kind === 'vaccine' && p.content.data?.vaccineId === vaccineId,
  );
  await Promise.all(mine.map((p) => Notifications.cancelScheduledNotificationAsync(p.identifier)));
  return mine.length;
}

const TASK_EMOJI: Record<string, string> = {
  formula_prep: '🥣', breast_milk_feed: '🥛', medicine: '💊',
  care: '🧴', vaccine: '💉', custom: '📋',
};

/**
 * Aşı bildiriminin içeriği.
 *
 * Başlıkta aşı adı ve doz, gövdede kalan süre ve **yer** var: ebeveynin
 * bildirime bakıp vereceği karar "nereye gideceğim" sorusuna bağlı. Yer
 * girilmemişse satır hiç yazılmaz, "yer: —" demek bir şey öğretmiyor.
 */
function vaccineContent(
  vaccine: Vaccine,
  offsetMin: number,
): Notifications.NotificationContentInput {
  const dose = vaccine.dose_number ? ` (${vaccine.dose_number}. doz)` : '';
  const where = vaccine.location ? ` · ${vaccine.location}` : '';
  return {
    title: `💉 ${vaccine.name}${dose}`,
    body: `${offsetLabel(offsetMin)}${where}`,
    data: { kind: 'vaccine', vaccineId: vaccine.id, offsetMin },
    sound: ALERTS.vaccine.file,
    ...(Platform.OS === 'android' ? { vibrate: [0, 250, 250, 250] } : {}),
  };
}

/**
 * Görev bildiriminin içeriği.
 *
 * Gövdede **tarif** değil kalan süre yazılır; tarif uzun ve bildirim satırına
 * sığmıyor, ayrıca kilit ekranında görünmesini istemeyen ebeveyn olabilir.
 * Dokunulduğunda görev ekranı açılacağı için ayrıntı bir dokunuş uzakta.
 */
function taskContent(task: Task, offsetMin: number): Notifications.NotificationContentInput {
  const who = task.assignee ? ` · ${task.assignee.display}` : '';
  return {
    title: `${TASK_EMOJI[task.task_type] ?? '📋'} ${task.title}`,
    body: `${offsetLabel(offsetMin)}${who}`,
    data: { kind: 'task', taskId: task.id, offsetMin },
    sound: ALERTS.taskDue.file,
    ...(Platform.OS === 'android' ? { vibrate: [0, 250, 250, 250] } : {}),
  };
}

/**
 * Gecikme uyarısının aralığı — şartname: her **5 dakika**
 * (`notification-voice.md` §2.2.3).
 */
export const OVERDUE_EVERY_MIN = 5;

/**
 * Uygulama ölüyken gecikmeyi karşılayan **tarihli** merdiven — dakika.
 *
 * Tekrar eden tetikleyici ancak kurulduğu andan itibaren sayar, yani görev
 * saatinde uygulama kapalıysa kimse onu kuramaz. Bu merdiven o boşluğu
 * kapatır: ilk yarım saat gerçekten 5 dakikada bir, sonrası uygulama hiç
 * açılmazsa diye seyrelen bir emniyet ağı.
 *
 * Neden 24 saatin tamamı 5 dakikalıkla doldurulmuyor: 288 bildirim demek
 * olurdu ve iOS bekleyenleri 64'te kesip fazlasını sessizce atıyor
 * (`MAX_SCHEDULED`). Uygulama bir kez açıldığında merdiven iptal edilip
 * yerine süresiz tekrar eden tetikleyici kuruluyor.
 */
const OVERDUE_LADDER_MIN = [5, 10, 15, 20, 25, 30, 45, 60, 120, 240, 360];

/** Güvenlik zaman aşımı: 24 saat sonra uyarı kesilir (şartname §2.2.3). */
const OVERDUE_MAX_MIN = 24 * 60;

/**
 * Gecikmiş görev bildiriminin içeriği.
 *
 * `overdueMin` null ise bu, **süresiz tekrar eden** uyarıdır: kaç dakika
 * geçtiği tetikleme anında bilinemeyeceği için gövde zamansız yazılır.
 */
export function taskOverdueContent(
  task: Task,
  overdueMin: number | null,
): Notifications.NotificationContentInput {
  const who = task.assignee ? ` · ${task.assignee.display}` : '';
  const elapsed = overdueMin === null
    ? 'Hâlâ tamamlanmadı'
    : `${overdueMin < 60 ? `${overdueMin} dakika` : `${overdueMin / 60} saat`} geçti`;
  return {
    title: `⏰ Gecikti: ${task.title}`,
    body: `${elapsed}${who}`,
    /*
     * `kind: 'task'` kalıyor — `cancelTaskAlarms` ve bildirime dokunma
     * yönlendirmesi bu alana bakıyor. Gecikme olduğunu `overdue` ayırıyor;
     * ön plan sesi de bu sayede doğru tekrar sayısını seçiyor.
     */
    data: { kind: 'task', taskId: task.id, offsetMin: 0, overdue: true },
    sound: ALERTS.taskOverdue.file,
    ...(Platform.OS === 'android' ? { vibrate: [0, 400, 200, 400] } : {}),
  };
}

/**
 * Görev saatinden sonra planlanacak **tarihli** uyarılar.
 *
 * Yalnızca geleceğe düşenler döner; 24 saatlik zaman aşımını aşanlar elenir.
 */
export function overdueSlots(
  task: Task,
  nowMs: number = Date.now(),
): { at: Date; overdueMin: number }[] {
  const dueMs = Date.parse(task.due_time);
  if (!Number.isFinite(dueMs)) return [];

  return OVERDUE_LADDER_MIN
    .filter((min) => min <= OVERDUE_MAX_MIN)
    .map((overdueMin) => ({ at: new Date(dueMs + overdueMin * 60_000), overdueMin }))
    .filter((slot) => slot.at.getTime() > nowMs);
}

/**
 * Zaten gecikmiş bir görev için **süresiz tekrar eden** uyarıyı kurar.
 *
 * Tek bir bekleyen bildirim, 5 dakikada bir, görev kapanana kadar: 288
 * tarihli bildirimin bütçe sorunu olmadan şartnamenin istediği döngü. İşletim
 * sistemi uygulamadan bağımsız tekrarladığı için telefon kilitliyken ve
 * uygulama kapalıyken de çalar.
 *
 * **Sınır:** Android telefonu uzun süre hareketsizse (Doze) kesin alarmları
 * ~9–15 dakikaya seyreltir; ritim o pencerede 5 dakikanın biraz üstüne
 * çıkabilir. Tam ritim bir ön plan servisi (yeni native bağımlılık) ister.
 *
 * Her eşitlemede önce iptal edilip yeniden kurulduğu için sayaç baştan
 * başlar; uygulama ayaktayken 5 dakikalık döngüyü zaten `taskOverdue.ts`
 * yürütüyor (o, görev saatine demirli).
 */
export async function scheduleOverdueRepeat(task: Task): Promise<boolean> {
  const dueMs = Date.parse(task.due_time);
  if (!Number.isFinite(dueMs)) return false;
  // Zaman aşımını geçmiş görev artık uyarılmaz.
  if (Date.now() - dueMs >= OVERDUE_MAX_MIN * 60_000) return false;

  await Notifications.scheduleNotificationAsync({
    content: taskOverdueContent(task, null),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: OVERDUE_EVERY_MIN * 60,
      repeats: true,
      channelId: TASK_OVERDUE_CHANNEL_ID,
    },
  });
  return true;
}

/**
 * Bu hatırlatıcı bir **etkinlik** mi?
 *
 * Etkinlik, takvimdeki tek bir ana bağlı: tekrar etmez, bir tarihi ve bir
 * saati vardır. Böyle olanlar aşı/görev gibi "hedef an + ön uyarılar"
 * biçiminde planlanır; periyodik hatırlatıcıların DAILY tetikleyici yolundan
 * geçmezler, çünkü orada 14 gün öncesi diye bir kavram yok.
 *
 * Kategori tek başına yeterli değil: kullanıcı "etkinlik" kategorisini seçip
 * tekrar eden bir hatırlatıcı da kurabilir (her hafta prova gibi). O zaman
 * eski yol doğru olanıdır.
 */
function isEventReminder(reminder: Reminder): boolean {
  return (
    reminder.category === 'event' &&
    reminder.recurrence_type === 'none' &&
    reminder.schedule_mode === 'fixed_times' &&
    !!reminder.start_date &&
    (reminder.fixed_times?.length ?? 0) > 0
  );
}

/**
 * Etkinlik bildiriminin içeriği.
 *
 * Gövdede kalan süre yazılır ("14 gün kaldı"); etkinliğin kendi saati zaten
 * bildirimin üstünde görünüyor. `priority` ve `interruptionLevel` kanal
 * ayarını tamamlar: kanal Android'de sesi belirler, bu iki alan ise
 * bildirimin ekranda nasıl belireceğini.
 */
function eventContent(
  reminder: Reminder,
  offsetMin: number,
): Notifications.NotificationContentInput {
  const when = offsetMin > 0 ? offsetLabel(offsetMin) : 'Bugün — etkinlik zamanı.';
  const note = reminder.description?.trim();

  return {
    title: `📅 ${reminder.title}`,
    /*
     * Açıklama **ikinci satıra** konur. Aynı satıra eklenseydi kalan süre
     * ("7 gün kaldı") 250 karakterlik metnin arkasında kalır ve bildirim
     * kapalıyken okunamazdı; ayrı satırda, kapalı hâlde kalan süre görünür,
     * açılınca açıklama okunur.
     */
    body: note ? `${when}\n${note}` : when,
    data: { reminderId: reminder.id, kind: 'reminder', offsetMin },
    sound: ALERTS.reminder.file,
    priority: AndroidNotificationPriority.MAX,
    /*
     * iOS'ta sesin yüksekliği sistem zil düzeyine bağlı ve uygulama onu
     * aşamaz. `timeSensitive`, bildirimin **Odak/Rahatsız Etmeyin** kipinde de
     * gösterilmesini sağlar — iOS tarafında elimizdeki en yakın karşılık.
     * Etkinleşmesi için `com.apple.developer.usernotifications.time-sensitive`
     * yetkisi gerekiyor; yoksa iOS sessizce `active` gibi davranır.
     */
    interruptionLevel: 'timeSensitive',
    ...(Platform.OS === 'android' ? { vibrate: [0, 600, 300, 600, 300, 600] } : {}),
  };
}

/**
 * Hatırlatıcıları işletim sistemine yazar: önce kendi eski kayıtlarımızı
 * siler, sonra baştan planlar. Artımlı güncelleme yapılmıyor — tanım, sessiz
 * saat ve son kayıt zamanı birlikte değiştiğinde hangi bildirimin hâlâ geçerli
 * olduğunu izlemek, baştan planlamaktan daha kırılgan olurdu.
 */
export async function syncReminders(
  reminders: Reminder[],
  quietHours: QuietHour[],
  tasks: Task[] = [],
  vaccines: Vaccine[] = [],
  now: Date = new Date(),
): Promise<SyncReport> {
  if ((await getPermission()) !== 'granted') return { ...EMPTY_REPORT };

  await ensureChannel();
  await cancelScheduled();

  const report: SyncReport = { ...EMPTY_REPORT };
  const active = reminders.filter((r) => r.is_active);
  const windows = quietHours.filter((w) => w.is_enabled);

  /*
   * Tekrar eden tetikleyiciler ufuktan bağımsız oldukları için sınırdan muaf.
   * Tarihli olanlar — hatırlatıcı tekrarları ve görev uyarıları — tek bir
   * havuzda toplanır: iOS'un 64'lük sınırı ikisini ayırmıyor, bu yüzden
   * bütçe de ayrılmamalı. Kırpma zamana göre yapıldığı için en yakın uyarı
   * hangi türden olursa olsun korunur.
   */
  const dated: {
    at: Date;
    silent: boolean;
    reminder?: Reminder;
    task?: Task;
    vaccine?: Vaccine;
    offsetMin?: number;
    /** Gecikme merdiveninin basamağı — doluysa uyarı gecikme kanalından gider. */
    overdueMin?: number;
    /** Etkinlik ön uyarısı: yüksek sesli kanaldan ve kalan süre gövdesiyle. */
    event?: boolean;
  }[] = [];

  /*
   * Görev uyarılarına sessiz saat **uygulanmaz**. Hatırlatıcı periyodik ve
   * yaklaşıktır — gece 03:00'e denk gelmesi tesadüftür. Görevin saatini ise
   * kullanıcı tek tek seçmiştir; gece yarısına koyduysa bilerek koymuştur ve
   * sessize almak onu işini kaçırmaya iter.
   */
  for (const task of tasks) {
    if (task.status !== 'pending' && task.status !== 'in_progress') continue;
    for (const slot of alarmSlots(task.due_time, task.notification_offsets, now)) {
      dated.push({ at: slot.at, silent: false, task, offsetMin: slot.offsetMin });
    }

    /*
     * Gecikme uyarısı tam eşitlemede de kurulur. Önceden yalnızca görevi BU
     * cihazda kaydeden kişi kuruyordu (`taskAlarms.ts` → `onTaskSaved`);
     * eşin telefonunda açılan bir görev geciktiğinde burada hiç ses çıkmazdı.
     */
    if (Date.parse(task.due_time) <= now.getTime()) {
      // Tekrar eden tetikleyici ufuktan ve bütçeden muaf (yukarıdaki not).
      if (await scheduleOverdueRepeat(task)) {
        report.scheduled += 1;
        report.repeating += 1;
        report.taskAlarms += 1;
      }
    } else {
      for (const slot of overdueSlots(task, now.getTime())) {
        dated.push({ at: slot.at, silent: false, task, overdueMin: slot.overdueMin });
      }
    }
  }

  /*
   * Aşı uyarılarına da sessiz saat uygulanmaz: uyarı randevudan günler önce
   * çalıyor, yani gecenin bir yarısına denk gelmesi için kullanıcının randevuyu
   * oraya koyması gerekir. Kapanmış (yapılmış / atlanmış) aşının alarmı hiç
   * kurulmaz — "Otomatik Alarm Kapatma" kuralı.
   */
  const vaccineHorizon = now.getTime() + VACCINE_HORIZON_DAYS * 86_400_000;
  for (const vaccine of vaccines) {
    if (vaccine.status !== 'pending') continue;
    const at = vaccineInstant(vaccine);
    if (!at) continue;
    for (const slot of alarmSlots(at, vaccine.notification_offsets, now)) {
      // Ufku aşan uyarılar atlanır; `trimmed` sayılmazlar çünkü kırpılmış
      // değil, henüz sırası gelmemiş alarmlardır.
      if (slot.at.getTime() > vaccineHorizon) continue;
      dated.push({ at: slot.at, silent: false, vaccine, offsetMin: slot.offsetMin });
    }
  }

  /*
   * Etkinlikler: hedef an + ön uyarılar (14/7/2/1 gün önce, aynı gün).
   *
   * Sessiz saat **uygulanmaz** — görev ve aşı uyarılarıyla aynı gerekçe:
   * kullanıcı etkinliğin saatini kendi seçti, gece yarısına koyduysa bilerek
   * koydu. Üstelik bu uyarıların amacı kaçırılmamak; sessize almak isteğin
   * tersi olurdu. Form da bu yüzden etkinlikte sessiz saat anahtarını
   * göstermiyor.
   */
  const eventHorizon = now.getTime() + EVENT_HORIZON_DAYS * 86_400_000;
  for (const reminder of active) {
    if (!isEventReminder(reminder)) continue;
    const at = eventInstant(reminder.start_date, reminder.fixed_times?.[0]);
    if (!at) continue;
    for (const slot of alarmSlots(at, reminder.notification_offsets, now)) {
      if (slot.at.getTime() > eventHorizon) continue;
      dated.push({ at: slot.at, silent: false, reminder, offsetMin: slot.offsetMin, event: true });
    }
  }

  for (const reminder of active) {
    // Etkinlikler yukarıda planlandı; buradaki yol periyodik hatırlatıcılara ait.
    if (isEventReminder(reminder)) continue;
    if (canRepeat(reminder, windows)) {
      if (reminder.schedule_mode === 'fixed_times') {
        for (const t of reminder.fixed_times ?? []) {
          const mins = toMinutes(t);
          for (const offset of reminderOffsets(reminder)) {
            // Günün başına sarkan ofset bir önceki güne taşar; `(x % 1440 +
            // 1440) % 1440` ile 00:10'un 30 dk öncesi 23:40 olur ve DAILY
            // tetikleyici onu her gün o saatte çalar — istenen davranış.
            const at = ((mins - offset) % 1440 + 1440) % 1440;
            await Notifications.scheduleNotificationAsync({
              content: contentOf(reminder, false, offset),
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: Math.floor(at / 60),
                minute: at % 60,
                channelId: CHANNEL_ID,
              },
            });
            report.scheduled += 1;
          }
        }
        report.repeating += 1;
        continue;
      }

      const seconds = (reminder.interval_minutes ?? 0) * 60;
      if (seconds > 0) {
        await Notifications.scheduleNotificationAsync({
          content: contentOf(reminder, false),
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
            repeats: true,
            channelId: CHANNEL_ID,
          },
        });
        report.scheduled += 1;
        report.repeating += 1;
      }
      continue;
    }

    for (const at of rawOccurrences(reminder, now, HORIZON_DAYS)) {
      const occ = applyQuiet(at, reminder, windows, report);
      if (occ) dated.push({ ...occ, reminder });
    }
  }

  // En yakın alarmlar korunur; sınırı aşanlar kırpılır.
  dated.sort((a, b) => a.at.getTime() - b.at.getTime());
  const room = Math.max(0, MAX_SCHEDULED - report.scheduled);
  if (dated.length > room) report.trimmed = dated.length - room;

  for (const item of dated.slice(0, room)) {
    await Notifications.scheduleNotificationAsync({
      content: item.task
        ? item.overdueMin === undefined
          ? taskContent(item.task, item.offsetMin ?? 0)
          : taskOverdueContent(item.task, item.overdueMin)
        : item.vaccine
          ? vaccineContent(item.vaccine, item.offsetMin ?? 0)
          : item.event
            ? eventContent(item.reminder!, item.offsetMin ?? 0)
            : contentOf(item.reminder!, item.silent),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.at,
        channelId: item.task
          ? (item.overdueMin === undefined ? TASK_CHANNEL_ID : TASK_OVERDUE_CHANNEL_ID)
          : item.vaccine
            ? VACCINE_CHANNEL_ID
            : item.event
              ? EVENT_CHANNEL_ID
              : CHANNEL_ID,
      },
    });
    report.scheduled += 1;
    if (item.task) report.taskAlarms += 1;
    if (item.vaccine) report.vaccineAlarms += 1;
  }

  report.nextAt = dated[0]?.at ?? null;
  return report;
}

/** Test/doğrulama amaçlı: kaç bildirim bekliyor. */
export async function pendingCount(kinds: string[] = OUR_KINDS): Promise<number> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  return pending.filter((p) => kinds.includes(String(p.content.data?.kind ?? ''))).length;
}

