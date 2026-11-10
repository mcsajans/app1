import * as Notifications from 'expo-notifications';
// Bu üç sabit pakette `export *` zinciriyle yeniden dışa açıldığı için ad
// alanı üzerinden erişimi eslint çözemiyor; adlandırılmış import net
// (`scheduler.ts`'teki `AndroidImportance` ile aynı gerekçe).
import {
  AndroidImportance, AndroidNotificationPriority, AndroidNotificationVisibility,
} from 'expo-notifications';
import { Platform } from 'react-native';

import { colors } from '../theme';
import {
  LIVE_TIMER_KIND, TIMER_META, noticeText,
  type LiveTimer, type TimerKind, type TimerStatus,
} from '../timers/liveTimer';
import { getPermission } from './scheduler';

/**
 * Canlı sayaç bildirimi — kilit ekranında ve bildirim gölgesinde süren
 * kronometre (`bildirimler.md` → "Ek geliştirme").
 *
 * ## Neden yeni bir native bağımlılık yok
 *
 * Şartname `@notifee/react-native`, `react-native-foreground-service` ve
 * `react-native-live-activity` öneriyordu. Üçü de kuruluma girmedi:
 *
 *  - `expo-notifications` Android'de **`sticky`** (kaydırmayla kapanmayan,
 *    `setOngoing`) ve **bildirim üstü aksiyon düğmeleri** zaten sağlıyor.
 *    Kurulu sürümde (58.1.7) Android tarafı `categoryIdentifier` okuyup
 *    `builder.addAction(...)` çağırıyor — dokümanda alan "iOS" etiketli
 *    görünse de native kaynakta ikisi de destekli.
 *  - Notifee hem FCM servis kaydı yüzünden `expo-notifications` ile aynı
 *    alana giriyor hem de bu projede push altyapısı hiç yok
 *    (`enableRemoteNotifications: false`).
 *  - Bu dosyadaki her şey **çalışma zamanında** kuruluyor (kanal + kategori);
 *    `app.json`'a satır, prebuild'e tur eklemiyor. Mevcut derleme ile çalışır.
 *
 * ## Bilinçli sınır: sayaç saniye saniye akmıyor
 *
 * Bildirim metni **durum değişiminde** ve uygulama ön plan/arka plan
 * geçişlerinde yenilenir. Arka planda JavaScript çalışmadığı için daha sık
 * yenilemek mümkün değil; işletim sistemi tarafında kendi kendine akan bir
 * kronometre ise native hedef istiyor (Android `setUsesChronometer`, iOS
 * ActivityKit). Bu yüzden metin "14:32'den beri" ile **başlangıç anına**
 * demirlendi: dakika değeri eskise de cümle doğru kalır.
 *
 * Yükseltme yolu NOTLAR-ve-EKSIKLER.md §4.2'de yazılı (`expo-widgets`).
 */

/** Android kanalı. Sessiz ve düşük önemli: bu bir uyarı değil, durum göstergesi. */
export const LIVE_CHANNEL_ID = 'live_timer';

/** Aksiyon kimlikleri — yanıt dinleyicisi bunlara göre dallanır. */
export const TIMER_ACTION = {
  pause: 'timer-pause',
  resume: 'timer-resume',
  stop: 'timer-stop',
} as const;

/** Her tür için sabit bildirim kimliği; aynı kimlikle yeniden sunmak YERİNDE günceller. */
const noticeId = (kind: TimerKind) => `live-timer-${kind}`;

/** Kategori kimliği duruma da bağlı: düğme başlığı "Duraklat" ↔ "Devam et" değişiyor. */
const categoryId = (kind: TimerKind, status: TimerStatus) => `timer-${kind}-${status}`;

/**
 * Aksiyonlar uygulamayı **ön plana getirir** (`opensAppToForeground: true`).
 *
 * Paketin kendi tip dokümanı şunu söylüyor: `false` ise ve uygulama
 * öldürülmüşse (yalnızca arka planda değil) yanıt dinleyicisi **hiç
 * çalışmaz**. Yani "uygulama kapalıyken bildirimden duraklat" ancak arka plan
 * görevi (`expo-task-manager` + `registerTaskAsync`, yalnızca Android) ya da
 * bir foreground service ile mümkün. İkisi de yeni native bağımlılık ve yeni
 * derleme demek; onun yerine düğmeye basınca uygulama açılıp işlemi hemen
 * uyguluyor — her iki platformda ve her durumda **kesin** çalışan davranış.
 *
 * Ayrıca emzirmeyi bitirmek zaten uygulamayı açmak istiyor: aktif süre
 * düzeltme penceresi (§10.2.1) bildirim içine sığmaz.
 */
const FOREGROUND = { opensAppToForeground: true } as const;

function actionsFor(kind: TimerKind, status: TimerStatus): Notifications.NotificationAction[] {
  const meta = TIMER_META[kind];
  const list: Notifications.NotificationAction[] = [];

  if (meta.pausable) {
    list.push(
      status === 'paused'
        ? { identifier: TIMER_ACTION.resume, buttonTitle: 'Devam et', options: FOREGROUND }
        : { identifier: TIMER_ACTION.pause, buttonTitle: 'Duraklat', options: FOREGROUND },
    );
  }

  list.push({
    identifier: TIMER_ACTION.stop,
    buttonTitle: meta.stopLabel,
    options: { ...FOREGROUND, isDestructive: true },
  });

  return list;
}

let ready: Promise<void> | null = null;

/**
 * Kanalı ve kategorileri kurar — bir kez.
 *
 * Kategoriler bildirimden **önce** kayıtlı olmalı; sonradan kaydedilen
 * kategori, hâlihazırda gösterilmiş bildirime düğme eklemiyor.
 */
export function ensureLiveTimer(): Promise<void> {
  if (!ready) ready = setup();
  return ready;
}

async function setup(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(LIVE_CHANNEL_ID, {
      name: 'Çalışan sayaçlar',
      description: 'Emzirme, uyku ve sağma kronometresi sürerken görünen kalıcı bildirim',
      /*
       * LOW: ses yok, titreşim yok, ekranın üstünde belirme (heads-up) yok.
       * Kanalın önemi oluşturulduktan sonra uygulama tarafından
       * değiştirilemediği için en baştan doğru seçilmeli — hatırlatıcı
       * kanalıyla (HIGH) paylaşılsaydı her meme değişiminde telefon titrerdi.
       */
      importance: AndroidImportance.LOW,
      enableVibrate: false,
      vibrationPattern: null,
      sound: null,
      showBadge: false,
      // Kilit ekranında içerik görünsün; asıl amaç bu (PRIVATE olsaydı
      // "içerik gizli" yazardı ve sayaç kilit ekranından okunamazdı).
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    });
  }

  const kinds: TimerKind[] = ['breastfeeding', 'sleep', 'pumping'];
  const statuses: TimerStatus[] = ['running', 'paused'];

  await Promise.all(
    kinds.flatMap((kind) =>
      statuses
        // Duraklatılamayan türde "paused" kategorisi hiç kullanılmaz.
        .filter((status) => TIMER_META[kind].pausable || status === 'running')
        .map((status) =>
          Notifications.setNotificationCategoryAsync(
            categoryId(kind, status),
            actionsFor(kind, status),
          ),
        ),
    ),
  );
}

/**
 * Sayaç bildirimini sunar ya da yerinde günceller.
 *
 * Aynı `identifier` ile yeniden sunmak bildirimi **değiştirir**, yenisini
 * eklemez: Android tarafında istek kimliği bildirim etiketi (tag) olarak
 * kullanılıyor ve `notify()` aynı (tag, id) çiftini üzerine yazıyor; iOS'ta
 * da aynı kimlikli istek teslim edilmiş bildirimin yerine geçer. Bu yüzden
 * tür başına tek satır birikir, meme değişiminde ikinci bildirim çıkmaz.
 */
export async function showTimerNotice(timer: LiveTimer): Promise<void> {
  if ((await getPermission()) !== 'granted') return;
  await ensureLiveTimer();

  const { title, body } = noticeText(timer);

  await Notifications.scheduleNotificationAsync({
    identifier: noticeId(timer.kind),
    content: {
      title,
      body,
      data: {
        kind: LIVE_TIMER_KIND,
        timerKind: timer.kind,
        sessionId: timer.sessionId,
        babyId: timer.babyId,
      },
      categoryIdentifier: categoryId(timer.kind, timer.status),
      sound: false,
      // Android: kaydırmayla kapanmaz ve dokununca kaybolmaz. Sayaç sürerken
      // bildirimin kaybolması, ebeveynin kronometreyi kapatacak düğmeyi
      // kaybetmesi demekti.
      sticky: true,
      autoDismiss: false,
      color: colors.primary,
      priority: AndroidNotificationPriority.LOW,
      // iOS: sessiz teslim, banner'sız. Bir uyarı değil, durum satırı.
      interruptionLevel: 'passive',
      ...(Platform.OS === 'android' ? { vibrate: [] } : {}),
    },
    /*
     * `trigger: null` **yetmiyordu**: anında teslim ediliyordu ama kanal
     * belirtilmediği için Android bildirimi `expo_notifications_fallback_
     * notification_channel`'a düşürüyordu (emülatörde `dumpsys notification`
     * ile görüldü). Sonuç, yukarıda kurulan `live_timer` kanalının hiç
     * kullanılmamasıydı:
     *
     *  - Kanalın **önemi LOW olacakken fallback'in HIGH'ı** geçerli oluyor,
     *    yani durum satırı ekranın üstünde beliren (heads-up) bir karta
     *    dönüşebiliyordu — oysa bu bir uyarı değil.
     *  - Kullanıcının bildirim ayarlarında "Çalışan kronometre" kanalında
     *    yaptığı değişiklik hiçbir şeye etki etmiyordu.
     *
     * `ChannelAwareTriggerInput` (`{ channelId }`) tam da bunun için var:
     * bildirimi yine **anında** teslim eder ama kanalı seçer.
     */
    trigger: Platform.OS === 'android' ? { channelId: LIVE_CHANNEL_ID } : null,
  });
}

/** Sayaç bittiğinde bildirimi kaldırır. */
export async function hideTimerNotice(kind: TimerKind): Promise<void> {
  const id = noticeId(kind);
  // İkisi birlikte: biri gösterilmiş bildirimi gölgeden alır, diğeri
  // (teorik olarak) henüz teslim edilmemiş isteği iptal eder.
  await Promise.all([
    Notifications.dismissNotificationAsync(id).catch(() => undefined),
    Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
  ]);
}

/** Çıkışta / hesap değişiminde: hepsini kaldır. */
export async function hideAllTimerNotices(): Promise<void> {
  await Promise.all(
    (['breastfeeding', 'sleep', 'pumping'] as TimerKind[]).map((k) => hideTimerNotice(k)),
  );
}
