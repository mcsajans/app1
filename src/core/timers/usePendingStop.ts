import { useEffect, useRef } from 'react';

import type { TimerKind } from './liveTimer';
import { useLiveTimerStore } from './useLiveTimerStore';

/**
 * Bildirimdeki "Bitir" niyetini ekrana taşır.
 *
 * Bildirim kaydı kendisi yazmıyor (gerekçe `timerActions.ts`): emzirmede
 * aktif süre düzeltme penceresi, sağmada miktar girişi bekliyor. Niyet
 * mağazada bir bayrak olarak durur, ilgili ekran açıldığında burada tüketilir.
 *
 * İki ayrıntı davranışı belirliyor:
 *
 *  - **`enabled`**: ekran ilk render'da veriyi henüz çekmemiş olabilir. O anda
 *    tüketilirse bayrak boşa harcanır ve "Bitir" hiçbir şey yapmamış görünür.
 *    Bu yüzden yalnızca ekran hazır olduğunda (çalışan seans elde) tüketilir;
 *    `enabled` sonradan `true` olduğunda efekt yeniden kurulup bekleyen
 *    bayrağı yakalar.
 *  - **Gecikmeli ilk kontrol**: abonelik yalnızca SONRAKİ değişimleri görür,
 *    oysa niyet ekran monte olmadan önce (soğuk başlatmada) konmuş olabilir.
 *    İlk kontrol bu yüzden elle yapılıyor ama mikro göreve bırakılıyor: efekt
 *    gövdesinde senkron `setState` zincirleme render tetikliyor
 *    (`react-hooks/set-state-in-effect`).
 */
export function usePendingStop(kind: TimerKind, enabled: boolean, onStop: () => void): void {
  // Geri çağrı her render'da yeniden oluşuyor; bağımlılık olarak verilmesi
  // aboneliği her render'da yeniden kurardı.
  const handler = useRef(onStop);
  useEffect(() => {
    handler.current = onStop;
  });

  useEffect(() => {
    if (!enabled) return;

    const check = () => {
      if (useLiveTimerStore.getState().consumePendingStop(kind)) handler.current();
    };

    const timeout = setTimeout(check, 0);
    const unsubscribe = useLiveTimerStore.subscribe(check);

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [kind, enabled]);
}
