/**
 * Periyodik uyarıların zamanlama hesabı — **saf** işlevler.
 *
 * React, React Native ve expo içe aktarılmaz; dosya düz Node ile test
 * edilebilir (`liveTimer.ts`, `quietHours.ts` ve `alarmPlan.ts` ile aynı
 * gerekçe: mobil projede test koşucusu yok, bkz. NOTLAR-ve-EKSIKLER.md §4).
 *
 * Hesap iki yerde kullanılıyor — sayaç uyarıları (`timerTicker.ts`) ve
 * gecikmiş görev döngüsü (`taskOverdue.ts`) — ve ikisinde de aynı kural
 * geçerli: **sonraki uyarı, geçen sürenin bir üstündeki aralık katında
 * çalar.**
 *
 * Kuralın gerekçesi: zamanlayıcılar ekran değişiminde, uygulama ön plana
 * dönüşünde ve her mağaza güncellemesinde yeniden kurulabiliyor. Düz bir
 * `setInterval` her kurulumda aralığı baştan başlatır; 5 dakikalık bir uyarı,
 * 4 dakikada bir tazelenen bir ekranda **hiç** çalmazdı. Geçen süreye
 * demirlenmiş bir hesap bu tuzağı tamamen ortadan kaldırıyor.
 */

/** Zamanlayıcı kurulurken kabul edilen en kısa gecikme. */
export const MIN_DELAY_MS = 1_000;

/**
 * Bir sonraki uyarıya kalan süre (ms).
 *
 * @param elapsedMs  Olayın başından beri geçen süre. Negatifse 0 sayılır.
 * @param intervalMs Uyarı aralığı. Pozitif olmak zorunda.
 *
 * Geçen süre tam aralık katına denk gelse bile sonraki **kat** döner: 10
 * dakikada, 5 dakikalık aralıkta kalan süre 5 dakikadır, 0 değil. Sıfır
 * dönseydi zamanlayıcı anında ateşlenip sonsuz döngüye girerdi.
 */
export function nextTickDelayMs(elapsedMs: number, intervalMs: number): number {
  if (!(intervalMs > 0)) throw new Error('intervalMs pozitif olmalı');
  const elapsed = Math.max(0, elapsedMs);
  const nextAt = (Math.floor(elapsed / intervalMs) + 1) * intervalMs;
  return Math.max(MIN_DELAY_MS, nextAt - elapsed);
}

/**
 * Gecikmiş görev döngüsü hâlâ çalışmalı mı?
 *
 * Üç koşul birden gerekir: görev kapanmamış olmalı, zamanı **geçmiş** olmalı
 * ve güvenlik zaman aşımı dolmamış olmalı (§2.2.3 → 24 saat).
 */
export function shouldNagOverdue(params: {
  /** Görevin zamanı (ms). */
  dueMs: number;
  /** Şimdi (ms). */
  nowMs: number;
  /** Görev tamamlandı ya da iptal edildi mi? */
  closed: boolean;
  /** Güvenlik zaman aşımı (ms). */
  maxMs: number;
}): boolean {
  const { dueMs, nowMs, closed, maxMs } = params;
  if (closed) return false;
  if (!Number.isFinite(dueMs)) return false;
  const overdueFor = nowMs - dueMs;
  return overdueFor >= 0 && overdueFor < maxMs;
}
