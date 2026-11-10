import * as Notifications from 'expo-notifications';

import {
  MUSIC_ACTION, MUSIC_NOTICE_KIND, hideMusicNotice, showMusicNotice,
} from './musicNotice';
import { useMusicStore } from './useMusicStore';

/**
 * Çalar bildirimini mağazayla eşitler ve düğmelerini işler.
 *
 * Köprü ayrı bir dosyada, çünkü `useMusicStore` saf çalma mantığı olarak
 * kalmalı: bildirim katmanını oraya koymak, mağazayı `expo-notifications`'a
 * bağlar ve çalmayı bildirim izni olmadan test edilemez hâle getirirdi.
 */

/** Son sunulan satır; aynı içeriği yeniden yazmamak için. */
let shown: { id: number; playing: boolean } | null = null;

/**
 * Mağaza değiştikçe bildirimi günceller.
 *
 * Yalnızca **parça ya da çalma durumu** değiştiğinde yazılır. Her durum
 * güncellemesinde yazılsaydı saniyede iki kez (çaların `updateInterval`
 * değeri) bildirim yeniden çizilirdi: Android'de gölgede göz kırpması gibi
 * görünür ve pil yakar.
 */
function sync(): void {
  const { current, status } = useMusicStore.getState();

  if (!current) {
    if (shown) {
      shown = null;
      void hideMusicNotice();
    }
    return;
  }

  const next = { id: current.id, playing: status.playing };
  if (shown && shown.id === next.id && shown.playing === next.playing) return;

  shown = next;
  void showMusicNotice(current.title, current.artist, status.playing).catch(() => undefined);
}

let unsubscribe: (() => void) | null = null;

/**
 * Köprüyü başlatır. Kabuk bir kez çağırır (`App.tsx`).
 *
 * Döndürdüğü işlev aboneliği ve dinleyiciyi kaldırır — ama **bildirimi
 * kaldırmaz**: kabuk söküldüğünde (çıkış) çalma zaten `stopMusic()` ile
 * durduruluyor ve bildirim oradan kalkıyor.
 */
export function startMusicNotice(): () => void {
  if (unsubscribe) return unsubscribe;

  sync();
  const stopStore = useMusicStore.subscribe(sync);

  const responded = Notifications.addNotificationResponseReceivedListener((response) => {
    if (response.notification.request.content.data?.kind !== MUSIC_NOTICE_KIND) return;

    const store = useMusicStore.getState();
    switch (response.actionIdentifier) {
      case MUSIC_ACTION.pause:
      case MUSIC_ACTION.resume:
        store.toggle();
        break;
      case MUSIC_ACTION.stop:
        store.stop();
        break;
      default:
        /*
         * Gövdeye dokunmak yalnızca uygulamayı açar; çalmaya dokunulmaz.
         * Ekrana yönlendirme BİLİNÇLİ olarak yapılmıyor: kullanıcı başka bir
         * işin ortasında olabilir ve bildirime basmak onu ninni ekranına
         * fırlatmamalı — düğmeler zaten gereken iki eylemi veriyor.
         */
        break;
    }
  });

  unsubscribe = () => {
    stopStore();
    responded.remove();
    unsubscribe = null;
  };
  return unsubscribe;
}
