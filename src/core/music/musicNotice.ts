import * as Notifications from 'expo-notifications';
import {
  AndroidImportance, AndroidNotificationPriority, AndroidNotificationVisibility,
} from 'expo-notifications';
import { Platform } from 'react-native';

import { getPermission } from '../notifications/scheduler';
import { colors } from '../theme';

/**
 * Ninni çalarının **kendi** bildirimi — gerçek bir "Kapat" düğmesiyle.
 *
 * ## Neden Media3 kartı yetmiyor
 *
 * `setActiveForLockScreen` sistemin medya kartını kuruyor ve orada duraklat /
 * devam et var; arka planda çalmayı ayakta tutan foreground servis de o.
 * Ama o kartta **kapatma düğmesi yok** ve ekleyemiyoruz: `expo-audio`,
 * Media3'ün özel düğmelerini (`CommandButton`) dışarı açmıyor —
 * `AudioLockScreenOptions` yalnızca ileri/geri sarma ve sonraki/önceki parça
 * sunuyor (`AudioControlsService.updateSessionCustomLayout`). Kartı kaydırarak
 * kapatmak ise yalnızca kartı gizliyor; çalar duraklatılmış hâlde bellekte
 * kalıyor, çünkü kaydırma olayı JS'e hiç bildirilmiyor.
 *
 * `expo-audio`'nun Kotlin'ini yamalamak düşünüldü ve **reddedildi**: paketin
 * her yükseltmesinde bozulur ve projenin kuralı native klasörleri elle
 * düzenlememek (AGENTS.md).
 *
 * Bu yüzden ikinci bir bildirim: aynı desen uygulamada zaten var ve
 * çalışıyor — canlı sayaç bildirimi de böyle duraklat/devam/bitir düğmeleri
 * taşıyor (`liveTimerNotice.ts`).
 *
 * **Bedeli:** ninni çalarken bildirim gölgesinde iki satır olur — sistemin
 * medya kartı ve bu. Medya kartı silinemiyor (foreground servisin kendisi) ve
 * kilit ekranı ile Bluetooth/kulaklık düğmeleri ondan geliyor, yani işlevsiz
 * bir kopya değil.
 */

/** Kanal: sessiz ve düşük önemli — bu bir uyarı değil, denetim satırı. */
export const MUSIC_CHANNEL_ID = 'music_player';

/** Bildirimin `data.kind` değeri; yanıt dinleyicisi buna bakıyor. */
export const MUSIC_NOTICE_KIND = 'music_player';

export const MUSIC_ACTION = {
  pause: 'music-pause',
  resume: 'music-resume',
  stop: 'music-stop',
} as const;

/** Sabit kimlik: aynı kimlikle yeniden sunmak bildirimi YERİNDE günceller. */
const NOTICE_ID = 'music-player';

const CATEGORY = { playing: 'music-playing', paused: 'music-paused' } as const;

/**
 * Düğmeler uygulamayı **ön plana getirir** (`opensAppToForeground: true`).
 *
 * `false` olsaydı ve uygulama öldürülmüşse yanıt dinleyicisi hiç çalışmazdı
 * (paketin kendi tip dokümanı); düğme sessizce hiçbir şey yapmış olurdu.
 * Gerekçenin tamamı `liveTimerNotice.ts` → `FOREGROUND`.
 */
const FOREGROUND = { opensAppToForeground: true } as const;

let ready: Promise<void> | null = null;

/**
 * Kanalı ve kategorileri kurar — bir kez.
 *
 * Kategoriler bildirimden **önce** kayıtlı olmalı; sonradan kaydedilen
 * kategori, hâlihazırda gösterilmiş bildirime düğme eklemiyor.
 */
export function ensureMusicNotice(): Promise<void> {
  if (!ready) ready = setup();
  return ready;
}

async function setup(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(MUSIC_CHANNEL_ID, {
      name: 'Ninni çalar',
      description: 'Müzik çalarken görünen kalıcı denetim satırı',
      /*
       * LOW: ses yok, titreşim yok, heads-up yok. Kanalın önemi
       * oluşturulduktan sonra değiştirilemediği için en baştan doğru
       * seçilmeli (bkz. notification-voice.md §2.1).
       */
      importance: AndroidImportance.LOW,
      enableVibrate: false,
      vibrationPattern: null,
      sound: null,
      showBadge: false,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    });
  }

  await Promise.all([
    Notifications.setNotificationCategoryAsync(CATEGORY.playing, [
      { identifier: MUSIC_ACTION.pause, buttonTitle: 'Duraklat', options: FOREGROUND },
      { identifier: MUSIC_ACTION.stop, buttonTitle: 'Kapat', options: { ...FOREGROUND, isDestructive: true } },
    ]),
    Notifications.setNotificationCategoryAsync(CATEGORY.paused, [
      { identifier: MUSIC_ACTION.resume, buttonTitle: 'Devam et', options: FOREGROUND },
      { identifier: MUSIC_ACTION.stop, buttonTitle: 'Kapat', options: { ...FOREGROUND, isDestructive: true } },
    ]),
  ]);
}

/**
 * Çalar bildirimini sunar ya da yerinde günceller.
 *
 * İzin yoksa sessizce geçilir: bildirim gösterememek çalmayı engellememeli.
 */
export async function showMusicNotice(
  title: string,
  artist: string | null,
  playing: boolean,
): Promise<void> {
  if ((await getPermission()) !== 'granted') return;
  await ensureMusicNotice();

  await Notifications.scheduleNotificationAsync({
    identifier: NOTICE_ID,
    content: {
      title: playing ? '🎵 Ninni çalıyor' : '🎵 Ninni duraklatıldı',
      body: [title, artist].filter(Boolean).join(' · '),
      data: { kind: MUSIC_NOTICE_KIND },
      categoryIdentifier: playing ? CATEGORY.playing : CATEGORY.paused,
      sound: false,
      // Kaydırmayla kapanmaz: çalar sürerken denetimlerin kaybolması,
      // kullanıcının kapatma düğmesini kaybetmesi demekti.
      sticky: true,
      autoDismiss: false,
      color: colors.primary,
      priority: AndroidNotificationPriority.LOW,
      // iOS: sessiz teslim, banner yok. Bir uyarı değil, durum satırı.
      interruptionLevel: 'passive',
      ...(Platform.OS === 'android' ? { vibrate: [] } : {}),
    },
    /*
     * Kanal **tetikleyiciden** verilir. `trigger: null` da anında teslim
     * ediyor ama kanal belirtmediği için Android bildirimi varsayılan
     * (HIGH önemli) kanala düşürüyor — canlı sayaç bildiriminde tam olarak
     * bu olmuştu. `ChannelAwareTriggerInput` anında teslim eder ve kanalı
     * seçer.
     */
    trigger: Platform.OS === 'android' ? { channelId: MUSIC_CHANNEL_ID } : null,
  });
}

/** Çalma bittiğinde bildirimi kaldırır. */
export async function hideMusicNotice(): Promise<void> {
  await Notifications.dismissNotificationAsync(NOTICE_ID).catch(() => undefined);
  await Notifications.cancelScheduledNotificationAsync(NOTICE_ID).catch(() => undefined);
}
