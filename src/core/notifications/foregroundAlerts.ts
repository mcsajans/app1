import * as Notifications from 'expo-notifications';

import { LIVE_TIMER_KIND } from '../timers/liveTimer';
import { playAlert, stopAlert } from './alertSound';
import type { AlertKind } from './soundCatalog';

/**
 * Uygulama ön plandayken bildirim sesini **tekrar sayısıyla** çalar
 * (`modules_doc/notification-voice.md` §2.1, §2.2.1).
 *
 * ## Sorun
 *
 * İşletim sistemine teslim edilen bir bildirimin sesi **bir kez** çalar.
 * Şartname ise olaya göre 1, 2 ya da 4 tekrar istiyor ve kullanıcı bildirime
 * dokunduğunda sesin kesilmesini istiyor. İkisi de sistemin elinde değil.
 *
 * ## Çözüm
 *
 * Ön planda ses **iki kez değil bir kez** duyulsun diye iş bölüşülüyor:
 *
 *  - Bildirim işleyicisi (`useNotificationStore`) kendi türlerimiz için
 *    `shouldPlaySound: false` döndürüyor; Expo belgesi bu alanın kanal sesini
 *    de bastırdığını söylüyor.
 *  - Bildirim geldiğinde buradaki dinleyici aynı sesi `expo-audio` ile
 *    şartnamedeki tekrar sayısınca çalıyor.
 *
 * Uygulama **arka plandayken** işleyici hiç çalışmıyor: ses kanaldan tek
 * seferlik çalıyor ve tekrar olmuyor. Bu sınır bilinçli — tekrar için N ayrı
 * bildirim planlamak iOS'un 64'lük bekleyen bildirim bütçesini tüketirdi
 * (`scheduler.ts` → `MAX_SCHEDULED`).
 */

/** Bu bildirim hangi uyarı sesini çalmalı? Bizim türümüz değilse `null`. */
export function alertKindOf(data: unknown): AlertKind | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  const kind = typeof record.kind === 'string' ? record.kind : null;

  // Canlı sayaç bildirimi bir uyarı değil, durum satırı: her meme değişiminde
  // yeniden sunuluyor ve ses çalması emzirme boyunca telefonu çaldırırdı.
  if (kind === null || kind === LIVE_TIMER_KIND) return null;

  /*
   * Görevin kalıcı satırı da öyle (`taskNotice.ts`): `kind` yine `'task'` —
   * dokunulduğunda görev ekranı açılsın diye — ama her eşitlemede yeniden
   * sunuluyor. `live` ayrımı olmasaydı uygulama her tazelendiğinde görev
   * sesi çalardı.
   */
  if (record.live === true) return null;

  switch (kind) {
    case 'reminder':
      return 'reminder';
    case 'task':
      // Gecikme merdiveninin bildirimleri `overdue` taşıyor (`taskAlarms.ts`);
      // ses görev saatinin kendi sesinden ayrı olmalı (§2.1).
      return record.overdue === true ? 'taskOverdue' : 'taskDue';
    case 'vaccine': {
      /*
       * Şartname: aşı uyarısı 2 tekrar, **aşı süresinde** 4 tekrar (§2.1).
       * "Aşı süresi" = ofseti 0 olan uyarı, yani randevu anı; 7/2/1 gün
       * öncesi ön uyarıdır.
       */
      const offset = typeof record.offsetMin === 'number' ? record.offsetMin : null;
      return offset === 0 ? 'vaccineDay' : 'vaccine';
    }
    default:
      return null;
  }
}

/**
 * Ön plan uyarı seslerini dinlemeye başlar. Kabuk bir kez çağırır (`App.tsx`).
 *
 * Döndürdüğü işlev abonelikleri kaldırır.
 */
export function startForegroundAlerts(): () => void {
  const received = Notifications.addNotificationReceivedListener((notification) => {
    const kind = alertKindOf(notification.request.content.data);
    if (kind) playAlert(kind);
  });

  /*
   * Bildirime dokunulduğunda ses **kesilir** (§2.2.1).
   *
   * Aynı dinleyiciyi canlı sayaç köprüsü de kuruyor (`App.tsx`), ama o
   * yalnızca sayaç düğmelerini işliyor. İki ayrı abonelik olması sorun değil:
   * `expo-notifications` aynı yanıtı tüm dinleyicilere veriyor ve ikisi farklı
   * işler yapıyor — birleştirmek, ses kesmeyi sayaç mantığının içine
   * gömmek olurdu.
   */
  const responded = Notifications.addNotificationResponseReceivedListener(() => {
    stopAlert();
  });

  return () => {
    received.remove();
    responded.remove();
  };
}
