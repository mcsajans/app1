/**
 * Elle girilen zaman aralığı — istemci tarafı kurallar.
 *
 * Aynı kurallar sunucuda da var (`src/lib/manualEntry.ts`, TEKNIK_DOKUMAN.md
 * §11.1 / §10.6) ve **son söz sunucunundur**. Buradaki kopyanın tek işi,
 * kullanıcıya ağ gidiş dönüşü beklemeden söylemek: "bitiş başlangıçtan önce"
 * hatasını kaydet düğmesine basınca öğrenmek, formu baştan doldurtur.
 *
 * Dosya **saf**tır: hiçbir şey içe aktarmaz, React bilmez. Bu sayede düz Node
 * ile test edilebiliyor (`scripts/tests/manual-window.test.mjs`).
 */

/** Telefon saati ile sunucu saati arasındaki kaymaya bırakılan pay. */
export const FUTURE_TOLERANCE_SEC = 120;

/** En fazla ne kadar geriye kayıt girilebilir — yıl/ay yazım hatası tuzağı. */
export const MAX_BACKDATE_SEC = 30 * 24 * 3600;

/** Tek bir uyku kaydının üst sınırı. */
export const MAX_SLEEP_SPAN_SEC = 24 * 3600;

/** Tek bir emzirme seansının üst sınırı — uykudan bilerek farklı (§10.6). */
export const MAX_BREAST_SPAN_SEC = 6 * 3600;

export type WindowIssue = {
  /** Hatanın hangi alanı işaret ettiği — alanın altında gösterilir. */
  field: 'start' | 'end';
  message: string;
};

/**
 * 'YYYY-AA-GG' + 'SS:DD' → yerel zamanda milisaniye.
 *
 * Geçersiz girdide `NaN` döner; çağıran bunu "henüz seçilmedi" diye ele alır.
 * `new Date('2026-11-21T13:20')` yerel saat olarak yorumlanır — bu bilinçli:
 * kullanıcı duvardaki saati giriyor, UTC'ye çevirmek cihazın işi.
 */
export function composeMoment(dateValue: string | null, timeValue: string | null): number {
  if (!dateValue || !timeValue) return Number.NaN;
  const ms = new Date(`${dateValue}T${timeValue}:00`).getTime();
  return Number.isFinite(ms) ? ms : Number.NaN;
}

/**
 * Pencerenin kendi içinde tutarlı olup olmadığına bakar.
 *
 * `endMs = null` → kayıt açık (kronometre o andan itibaren akacak).
 * Sorun yoksa `null` döner.
 */
export function validateWindow(params: {
  startMs: number;
  endMs: number | null;
  maxSpanSec: number;
  /** Varsayılan "şu an"; yalnızca testler sabit bir değer geçer. */
  nowMs?: number;
}): WindowIssue | null {
  const { startMs, endMs, maxSpanSec } = params;
  /*
   * Saat okuma BURADA yapılır, çağıran bileşende değil: React derleyicisinin
   * saflık kuralı (react-hooks/purity) bir bileşen gövdesinde `Date.now()`
   * görmek istemiyor — ve her ekranda aynı değeri elle geçirmek gürültü.
   */
  const nowMs = params.nowMs ?? Date.now();

  if (!Number.isFinite(startMs)) {
    return { field: 'start', message: 'Başlangıç tarih ve saatini seç.' };
  }
  if ((startMs - nowMs) / 1000 > FUTURE_TOLERANCE_SEC) {
    return { field: 'start', message: 'Başlangıç ileri bir tarih olamaz.' };
  }
  if ((nowMs - startMs) / 1000 > MAX_BACKDATE_SEC) {
    return { field: 'start', message: 'Başlangıç 30 günden eski olamaz.' };
  }

  if (endMs === null) return null;

  if (!Number.isFinite(endMs)) {
    return { field: 'end', message: 'Bitiş tarih ve saatini seç.' };
  }
  if (endMs <= startMs) {
    return { field: 'end', message: 'Bitiş, başlangıçtan sonra olmalı.' };
  }
  if ((endMs - nowMs) / 1000 > FUTURE_TOLERANCE_SEC) {
    return { field: 'end', message: 'Bitiş ileri bir tarih olamaz.' };
  }
  if ((endMs - startMs) / 1000 > maxSpanSec) {
    const hours = Math.round(maxSpanSec / 3600);
    return { field: 'end', message: `Tek kayıt ${hours} saatten uzun olamaz.` };
  }
  return null;
}

/**
 * Uyku tipi önerisi: 19:00–05:00 arası başlayan uyku **gece** sayılır
 * (TEKNIK_DOKUMAN.md §11).
 *
 * Yalnızca ÖNERİ: kullanıcı tipi elle değiştirdiyse bir daha uygulanmaz,
 * yoksa seçimi geri alınıyormuş gibi görünürdü.
 */
export function suggestSleepType(startMs: number): 'night' | 'nap' {
  if (!Number.isFinite(startMs)) return 'nap';
  const hour = new Date(startMs).getHours();
  return hour >= 19 || hour < 5 ? 'night' : 'nap';
}

/**
 * Pencereyi sol/sağ meme arasında paylaştırır.
 *
 * `leftRatio` 0–1 arası; saniyeler tam sayıya yuvarlanır ve toplamları
 * pencereyi **aşmaz** — sunucu toplamı aralıkla karşılaştırıp reddediyor,
 * yuvarlama yüzünden bir saniye taşmak kaydı düşürürdü.
 */
export function splitWindow(windowSec: number, leftRatio: number): { leftSec: number; rightSec: number } {
  const total = Math.max(0, Math.floor(windowSec));
  const ratio = Math.min(1, Math.max(0, leftRatio));
  const leftSec = Math.min(total, Math.round(total * ratio));
  return { leftSec, rightSec: total - leftSec };
}

/**
 * 'SS:DD' → o saatin milisaniye karşılığı.
 *
 * Sayacı geçmişten başlatma ekranı yalnızca **saat** sorar: "yarım saat önce
 * başlamıştı" en sık senaryo ve orada tarih seçtirmek iki fazladan dokunuş.
 * Tarih yoksa gün belirsiz kalır; kural şudur: seçilen saat şu andan ileride
 * görünüyorsa yalnızca DÜNE ait olabilir — gece 00:10'da "23:50" girmek
 * beklenen bir davranıştır, 23:50'yi bugün yazmak ise imkânsız bir gelecek
 * üretirdi.
 *
 * Ne kadar geriye gidilebileceği burada denetlenmez; onu çağıran taraf
 * kendi tavanıyla (emzirmede 6 saat) yapar.
 */
export function momentFromClock(hhmm: string | null, nowMs?: number): number {
  if (!hhmm) return Number.NaN;
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return Number.NaN;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return Number.NaN;

  const now = nowMs ?? Date.now();
  const picked = new Date(now);
  picked.setHours(hour, minute, 0, 0);
  const ms = picked.getTime();
  return ms > now + FUTURE_TOLERANCE_SEC * 1000 ? ms - 24 * 3600 * 1000 : ms;
}
