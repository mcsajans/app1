import { elapsedSec, type LiveTimer, type TimerKind } from '../timers/liveTimer';
import { useLiveTimerStore } from '../timers/useLiveTimerStore';
import { playAlert, stopAlert } from './alertSound';
import { nextTickDelayMs } from './tickPlan';
import { TICK_INTERVAL_MS, type AlertKind } from './soundCatalog';

/**
 * Sayaç çalışırken periyodik sesli uyarı
 * (`modules_doc/notification-voice.md` §2.1, §2.2.2).
 *
 * Şartname iki aralık istiyor:
 *
 *  - **Beslenme** (biberon / emzirme / sağma) — sayaç aktifken her 5 dakikada
 *    bir `bildirim3.mp3`, 1 tekrar.
 *  - **Uyku** — sayaç aktifken her 30 dakikada bir `bildirim1.mp3`, 1 tekrar.
 *
 * Ve bir koşul: ses **yalnızca sayaç RUNNING durumdayken** çalmalı;
 * duraklatıldığında ya da oturum kapandığında periyodik uyarı anında
 * sonlanmalı.
 *
 * ## Neden mağazaya abone, ekrana değil
 *
 * Sayaç ekranından çıkmak oturumu bitirmiyor — ebeveyn emzirmeyi başlatıp ana
 * sayfaya dönebiliyor. Uyarı bir ekranın efektine bağlanırsa ekran söküldüğü
 * anda susardı. `useLiveTimerStore` zaten çalışan tüm sayaçların ekrandan
 * bağımsız tek kaydı; abonelik oraya kurulu.
 *
 * ## Aralık neden sayacın başlangıcından sayılıyor
 *
 * Zamanlayıcı, kalan süreyi **geçen süreden** hesaplıyor: 5 dakikalık
 * aralıkta sayaç 7 dakikadır çalışıyorsa sonraki uyarı 3 dakika sonra çalar.
 * Böylece uygulama arka plandan döndüğünde ya da ekran değiştiğinde ritim
 * kaymıyor. Sabit `setInterval` kullanılsaydı her yeniden kurulum aralığı
 * baştan başlatır ve ebeveyn hiç uyarı almayabilirdi.
 *
 * ## Sınır: JavaScript arka planda çalışmaz
 *
 * Uygulama arka plandayken ya da öldürüldüğünde bu zamanlayıcılar durur;
 * geri dönüldüğünde geçen süreye göre yeniden hizalanır. İşletim sistemi
 * düzeyinde 5 dakikada bir bildirim planlamak teknik olarak mümkün ama
 * bedeli ağır: bir saatlik emzirme oturumu 12 bekleyen bildirim demek ve
 * iOS'un 64'lük bütçesini (`scheduler.ts` → `MAX_SCHEDULED`) hatırlatıcılarla
 * paylaşıyoruz. Kilit ekranındaki canlı sayaç bildirimi
 * (`liveTimerNotice.ts`) bu boşluğu sessizce dolduruyor: süre orada akıyor.
 */

/** Hangi sayaç türü hangi aralıkla ve hangi sesle uyarır. */
const TICKS: Readonly<Record<TimerKind, { intervalMs: number; alert: AlertKind }>> = {
  // Emzirme ve sağma şartnamedeki "Beslenme" grubuna girer.
  breastfeeding: { intervalMs: TICK_INTERVAL_MS.feeding, alert: 'feedingTick' },
  pumping: { intervalMs: TICK_INTERVAL_MS.feeding, alert: 'feedingTick' },
  sleep: { intervalMs: TICK_INTERVAL_MS.sleep, alert: 'sleepTick' },
};

type Scheduled = {
  timer: ReturnType<typeof setTimeout>;
  /** Hangi seansa ait — seans değişince zamanlayıcı baştan kurulur. */
  startedAt: string;
};

const scheduled = new Map<TimerKind, Scheduled>();

function cancel(kind: TimerKind): void {
  const entry = scheduled.get(kind);
  if (!entry) return;
  clearTimeout(entry.timer);
  scheduled.delete(kind);
}

/**
 * Bir sonraki uyarıyı kurar.
 *
 * `elapsed` saniye cinsinden geçen süre; sonraki uyarı, geçen sürenin bir
 * üstündeki aralık katına denk gelir.
 */
function schedule(kind: TimerKind, timer: LiveTimer): void {
  const tick = TICKS[kind];
  // Geçen süre 7 dk, aralık 5 dk ise sonraki katı 10 dk: 3 dk sonra
  // (hesap `tickPlan.ts` içinde, saf ve test edilebilir).
  const delay = nextTickDelayMs(elapsedSec(timer) * 1000, tick.intervalMs);

  const handle = setTimeout(() => {
    scheduled.delete(kind);

    /*
     * Çalmadan önce durum **yeniden** okunuyor.
     *
     * Zamanlayıcı kurulduktan sonra sayaç duraklatılmış ya da bitirilmiş
     * olabilir; mağazadan gelen son hâle bakılmazsa duran bir sayaç için ses
     * çalardı — şartnamenin açıkça yasakladığı durum (§2.2.2).
     */
    const live = useLiveTimerStore.getState().timers[kind];
    if (!live || live.status !== 'running' || live.startedAt !== timer.startedAt) return;

    playAlert(tick.alert);
    schedule(kind, live);
  }, delay);

  scheduled.set(kind, { timer: handle, startedAt: timer.startedAt });
}

/** Mağazanın son hâline göre zamanlayıcıları hizalar. */
function sync(timers: Partial<Record<TimerKind, LiveTimer>>): void {
  for (const kind of Object.keys(TICKS) as TimerKind[]) {
    const timer = timers[kind];
    const running = timer && timer.status === 'running';

    if (!running) {
      cancel(kind);
      /*
       * Duraklatma anında çalan ses de **kesilir**: şartname periyodik
       * uyarıların sayaç durduğunda "anında sonlandırılmasını" istiyor. Ses
       * 7 saniye uzunluğunda olabiliyor; duraklat düğmesine basıldıktan
       * sonra devam etmesi arızalı görünürdü.
       */
      stopAlert(TICKS[kind].alert);
      continue;
    }

    // Aynı seans için zamanlayıcı zaten kuruluysa dokunulmaz — yoksa her
    // mağaza güncellemesi (meme değişimi, bildirim tazelemesi) aralığı
    // baştan başlatır ve uyarı hiç çalmazdı.
    const existing = scheduled.get(kind);
    if (existing && existing.startedAt === timer.startedAt) continue;

    cancel(kind);
    schedule(kind, timer);
  }
}

let unsubscribe: (() => void) | null = null;

/**
 * Periyodik sayaç uyarılarını başlatır. Kabuk bir kez çağırır (`App.tsx`).
 *
 * Döndürdüğü işlev aboneliği ve bekleyen zamanlayıcıları kaldırır.
 */
export function startTimerTicker(): () => void {
  if (unsubscribe) return unsubscribe;

  sync(useLiveTimerStore.getState().timers);
  const stop = useLiveTimerStore.subscribe((state) => sync(state.timers));

  unsubscribe = () => {
    stop();
    for (const kind of Object.keys(TICKS) as TimerKind[]) cancel(kind);
    unsubscribe = null;
  };
  return unsubscribe;
}

/** Test ve tanılama: hangi türler için zamanlayıcı bekliyor. */
export const pendingTicks = (): TimerKind[] => [...scheduled.keys()];
