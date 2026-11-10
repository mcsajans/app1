import * as Notifications from 'expo-notifications';

import { breastfeedingService, sleepService } from '../api/modules';
import { useModuleStore } from '../modules/useModuleStore';
import { TIMER_ACTION } from '../notifications/liveTimerNotice';
import { useBabyStore } from '../stores/useBabyStore';
import { LIVE_TIMER_KIND, type TimerKind } from './liveTimer';
import { useLiveTimerStore } from './useLiveTimerStore';

/**
 * Bildirim üstündeki düğmelerin karşılığı.
 *
 * Üç aksiyon var: duraklat, devam et, bitir. Hepsi uygulamayı ön plana
 * getiriyor (gerekçe `liveTimerNotice.ts` → `FOREGROUND`), bu yüzden burada
 * ağ çağrısı yapmak güvenli: uygulama ayakta.
 *
 * "Bitir" **kaydı burada yazmaz**. Emzirmede bitiş annenin aktif süre
 * düzeltmesini bekliyor (§10.2.1), sağmada da miktar henüz girilmedi; ikisi de
 * ekranda tamamlanıyor. Bu yüzden niyet mağazaya bırakılır, ekran açılınca
 * pencereyi kendisi açar. Uykuda böyle bir pencere yok — "Uyandı" doğrudan
 * yazılır, çünkü ebeveyni gece 03:00'te ekrana davet etmenin karşılığı yok.
 */

const TIMER_KINDS: TimerKind[] = ['breastfeeding', 'sleep', 'pumping'];

const isTimerKind = (v: unknown): v is TimerKind =>
  typeof v === 'string' && (TIMER_KINDS as string[]).includes(v);

/** Modül sistem genelinde kapalıysa ekranı navigasyon ağacında yok (§9). */
const moduleOpen = (kind: TimerKind) => useModuleStore.getState().states[kind] !== false;

export async function handleTimerResponse(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const data = response.notification.request.content.data ?? {};
  if (data.kind !== LIVE_TIMER_KIND) return;

  const kind = data.timerKind;
  if (!isTimerKind(kind)) return;

  const store = useLiveTimerStore.getState();
  const timer = store.timers[kind] ?? null;

  /*
   * Bebek ve seans kimliği önce mağazadan okunur, yoksa bildirimin kendi
   * verisinden. Bildirim gölgede günlerce durabilir ve mağaza o arada
   * tazelenmiş olabilir; taze olan daha doğrudur.
   */
  const babyId = timer?.babyId ?? (typeof data.babyId === 'number' ? data.babyId : null);
  const sessionId = timer?.sessionId ?? (typeof data.sessionId === 'number' ? data.sessionId : null);
  const babyName = useBabyStore.getState().selected()?.firstName ?? timer?.babyName ?? null;

  const openScreen = () => {
    if (moduleOpen(kind)) store.requestOpen(kind);
  };

  switch (response.actionIdentifier) {
    // Bildirimin gövdesine dokunmak: yalnızca ilgili ekranı açar.
    case Notifications.DEFAULT_ACTION_IDENTIFIER:
      openScreen();
      return;

    case TIMER_ACTION.pause:
      if (kind === 'pumping') {
        await store.pausePumping();
        return;
      }
      if (kind === 'breastfeeding' && babyId !== null && sessionId !== null) {
        await breastfeedingService.pause(babyId, sessionId);
        await store.refreshFromServer(babyId, babyName);
      }
      return;

    case TIMER_ACTION.resume:
      if (kind === 'pumping') {
        await store.resumePumping();
        return;
      }
      if (kind === 'breastfeeding' && babyId !== null && sessionId !== null) {
        await breastfeedingService.resume(babyId, sessionId);
        await store.refreshFromServer(babyId, babyName);
      }
      return;

    case TIMER_ACTION.stop:
      if (kind === 'sleep') {
        if (sessionId === null) return;
        await sleepService.stop(sessionId, {});
        // Kayıt kapandı; bildirim de hemen kalkar. Sunucuyu yeniden
        // sormuyoruz: sonuç belli ve gece yarısı gereksiz bir istek.
        store.publish('sleep', null);
        openScreen();
        return;
      }
      // Emzirme ve sağma: pencereyi ekran açacak.
      store.requestStop(kind);
      openScreen();
      return;

    default:
      return;
  }
}

/**
 * Soğuk başlatmada kaçırılan yanıtı yakalar.
 *
 * Uygulama bildirime basılarak **açıldığında** dinleyici henüz kurulmamış
 * olabilir; `getLastNotificationResponseAsync` o yanıtı döndürür. Aynı yanıtın
 * iki kez işlenmemesi için işlenen bildirim kimliği hatırlanır — "Bitir" iki
 * kez uygulanırsa ikinci çağrı kapanmış seansta `422` alırdı.
 */
const handled = new Set<string>();

export async function handleColdStartTimerResponse(): Promise<void> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return;
  await handleTimerResponseOnce(response);
}

export async function handleTimerResponseOnce(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const key = [
    response.notification.request.identifier,
    response.actionIdentifier,
    response.notification.date,
  ].join(':');
  if (handled.has(key)) return;
  handled.add(key);
  await handleTimerResponse(response);
}
