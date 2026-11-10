/**
 * Canlı sayaç modeli — **saf** işlevler.
 *
 * React, React Native ve expo içe aktarılmaz; dosya düz Node ile test
 * edilebilir (`quietHours.ts` ve `vaccineFormat.ts` ile aynı gerekçe:
 * mobil projede test koşucusu yok, bkz. NOTLAR-ve-EKSIKLER.md §4).
 *
 * Sayaç **zaman damgasından** hesaplanır, hiçbir yerde artırılmaz: uygulama
 * arka plana geçse, öldürülse ya da telefon yeniden başlasa bile süre doğru
 * kalır (§10.3). Bildirim metni de bu yüzden "kaç saniye geçti" değil,
 * "saat kaçta başladı" üzerine kuruludur — metin eskiyebilir, başlangıç anı
 * eskimez.
 */

export type TimerKind = 'breastfeeding' | 'sleep' | 'pumping';
export type TimerStatus = 'running' | 'paused';

/**
 * Bildirimin `data.kind` değeri.
 *
 * `scheduler.ts` kendi planladığı kayıtları bu alanla tanıyor ve
 * `cancelScheduled()` yalnızca kendi türlerini siliyor; canlı sayaç bu yüzden
 * ayrı bir tür adı taşır, yoksa hatırlatıcı eşitlemesi onu da iptal ederdi.
 */
export const LIVE_TIMER_KIND = 'live_timer';

export type LiveTimer = {
  kind: TimerKind;
  status: TimerStatus;
  /** Seansın başlangıcı (ISO, UTC). Bildirimdeki "…'den beri" bundan yazılır. */
  startedAt: string;
  /**
   * Açık segmentin başlangıcı (ISO); duraklatıldıysa `null`.
   *
   * Emzirmede meme değiştikçe yeni segment açılır (§10.1); geçen süre
   * kapanmış segmentlerin toplamı (`baseSec`) artı açık segmenttir.
   */
  segmentStartedAt: string | null;
  /** Kapanmış segmentlerin toplamı (saniye). */
  baseSec: number;
  /**
   * Sunucudaki seans/kayıt kimliği.
   *
   * Emzirmede `breastfeeding_sessions.id`, uykuda `sleep_records.id`.
   * Sağmada **null**: sağma kronometresinin sunucu karşılığı yok, kayıt
   * ancak miktar girilince oluşur (bkz. `useLiveTimerStore`).
   */
  sessionId: number | null;
  babyId: number | null;
  babyName: string | null;
  /** Alt başlık: "Sol meme", "Şekerleme"… */
  detail: string | null;
};

/**
 * Tür başına bildirim görünümü.
 *
 * Simge **emoji** kalır: bildirim metni işletim sistemine düz metin olarak
 * gider, orada vektör ikon çizdiremeyiz (aynı gerekçe `scheduler.ts`
 * içindeki `CATEGORY_EMOJI` için de yazılı).
 */
export const TIMER_META: Record<
  TimerKind,
  { emoji: string; label: string; pausable: boolean; stopLabel: string }
> = {
  breastfeeding: { emoji: '🤱', label: 'Emzirme', pausable: true, stopLabel: 'Bitir' },
  // Uykuda duraklatma yok: bebek ya uyuyor ya uyandı; uyku kaydının durum
  // makinesinde `paused` diye bir hâl de yok (§22.3).
  sleep: { emoji: '😴', label: 'Uyku', pausable: false, stopLabel: 'Uyandı' },
  pumping: { emoji: '🥛', label: 'Sağma', pausable: true, stopLabel: 'Bitir' },
};

/**
 * Meme ve uyku tipi etiketleri.
 *
 * Burada duruyorlar çünkü **iki yerden** okunuyorlar: ekranlar ve bildirim
 * metni. Ekranda bırakılsalardı bildirim katmanı bir ekranı içe aktarmak
 * zorunda kalır, ya da etiket ikinci kez yazılırdı — ve "Şekerleme" bir gün
 * değişirse bildirim eski adı göstermeye devam ederdi.
 */
export const SIDE_LABEL = { left: 'Sol', right: 'Sağ' } as const;
export const SLEEP_TYPE_LABEL = { night: 'Gece uykusu', nap: 'Şekerleme' } as const;

/** Geçen süre (saniye): kapanmış segmentler + açık segment. */
export function elapsedSec(timer: LiveTimer, nowMs: number = Date.now()): number {
  const base = Math.max(0, Math.floor(timer.baseSec));
  if (!timer.segmentStartedAt) return base;
  const startMs = Date.parse(timer.segmentStartedAt);
  if (!Number.isFinite(startMs)) return base;
  return base + Math.max(0, Math.floor((nowMs - startMs) / 1000));
}

/** `14:32` — cihazın yerel saatiyle. Geçersiz değerde boş dizge. */
export function clockText(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Bildirimdeki süre metni — **dakika** çözünürlüğünde.
 *
 * Saniye gösterilmiyor: bildirim yalnızca durum değişiminde ve uygulama ön
 * plan/arka plan geçişlerinde yenileniyor (JS arka planda çalışmaz), bu yüzden
 * saniyeli bir sayaç çoğu zaman yanlış olurdu. Dakika, hem yeterli hem de
 * eskidiğinde göze batmıyor.
 */
export function elapsedText(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  if (s < 60) return 'yeni başladı';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} dk`;
  return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
}

/** Bildirim başlığı ve gövdesi. */
export function noticeText(
  timer: LiveTimer,
  nowMs: number = Date.now(),
): { title: string; body: string } {
  const meta = TIMER_META[timer.kind];
  const title = `${meta.emoji} ${meta.label} ${timer.status === 'paused' ? 'duraklatıldı' : 'sürüyor'}`;

  const clock = clockText(timer.startedAt);
  const body = [
    timer.babyName,
    timer.detail,
    clock ? `${clock}'den beri` : null,
    elapsedText(elapsedSec(timer, nowMs)),
  ]
    .filter((part): part is string => !!part && part.length > 0)
    .join(' · ');

  return { title, body };
}

/*
 * ───────── sunucu kaydı → sayaç tanımı ─────────
 *
 * Eşleme **tek yerde** duruyor: hem ekranlar (kendi verisini çektiklerinde)
 * hem de kabuk (`refreshFromServer`) aynı işlevi çağırıyor. İki kopya olsaydı
 * biri `paused` hâlini unuttuğunda bildirim ekranla çelişirdi.
 *
 * Parametre tipleri **yapısal** tutuldu (API tipleri içe aktarılmıyor), böylece
 * bu dosya hiçbir şeye bağlı olmadan düz Node ile test edilebilir durumda
 * kalıyor.
 */

type BreastSessionLike = {
  status: string;
  started_at: string;
  open_segment_started_at: string | null;
  total_active_sec: number;
  session_id: number;
  open_side: 'left' | 'right' | null;
  last_side: 'left' | 'right' | null;
};

export function breastTimerOf(
  session: BreastSessionLike,
  babyId: number | null,
  babyName: string | null,
): LiveTimer {
  const paused = session.status === 'paused';
  // Duraklatıldığında açık taraf yok; etiket son emzirilen tarafı gösterir
  // ki bildirimde "Emzirme duraklatıldı" yanında hangi meme olduğu kalsın.
  const side = session.open_side ?? session.last_side;

  return {
    kind: 'breastfeeding',
    status: paused ? 'paused' : 'running',
    startedAt: session.started_at,
    segmentStartedAt: paused ? null : session.open_segment_started_at,
    baseSec: Number(session.total_active_sec ?? 0),
    sessionId: session.session_id,
    babyId,
    babyName,
    detail: side ? `${SIDE_LABEL[side]} meme` : null,
  };
}

type SleepRecordLike = { id: number; started_at: string; sleep_type: string };

export function sleepTimerOf(
  record: SleepRecordLike,
  babyId: number | null,
  babyName: string | null,
): LiveTimer {
  return {
    kind: 'sleep',
    status: 'running',
    startedAt: record.started_at,
    segmentStartedAt: record.started_at,
    // Uykuda segment yok: kayıt açılır ve kapanır, arada duraklatma olmaz.
    baseSec: 0,
    sessionId: record.id,
    babyId,
    babyName,
    detail: SLEEP_TYPE_LABEL[record.sleep_type as keyof typeof SLEEP_TYPE_LABEL] ?? null,
  };
}

/**
 * İki sayaç tanımı bildirim açısından aynı mı?
 *
 * Bildirimi gereksiz yeniden yazmamak için kullanılır: aynı içerikle
 * `scheduleNotificationAsync` çağırmak Android'de bildirimi yeniden
 * çizdiriyor ve kullanıcı gölgesinde göz kırpması olarak görünüyor.
 * `baseSec` ve dakikaya yuvarlanmış süre karşılaştırmaya dâhil değil —
 * metin zaten dakika çözünürlüğünde.
 */
export function sameNotice(a: LiveTimer | null, b: LiveTimer | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.kind === b.kind &&
    a.status === b.status &&
    a.startedAt === b.startedAt &&
    a.detail === b.detail &&
    a.babyName === b.babyName &&
    a.sessionId === b.sessionId &&
    elapsedText(elapsedSec(a)) === elapsedText(elapsedSec(b))
  );
}
