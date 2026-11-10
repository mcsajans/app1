import type { GrowthMeasurement, GrowthSeries } from '../../core/api/modules';

/**
 * Gelişim sunum yardımcıları — React'e bağımlı değil, bu yüzden ayrı dosyada.
 *
 * Sayı biçimi modülün en kolay yanlış yapılan kısmı: kilo **gram** olarak
 * saklanıyor ama ebeveyn "6,2 kg" diye okuyor, ondalık ayırıcı virgül ve
 * eksi değerler (bebek kilo kaybedebilir, ilk haftalarda olağan) işaretiyle
 * yazılmalı. Hepsi tek yerde.
 */

export type MetricKey = 'weight' | 'height' | 'head';

export type MetricMeta = {
  key: MetricKey;
  /** Kart ve grafik başlığı. */
  label: string;
  /** Sekme çipi — üçü yan yana sığmalı. */
  short: string;
  /** `components/Icon.tsx` sözlüğündeki semantik ad. */
  icon: 'weight' | 'height' | 'headSize';
  /** Form alanının etiketi; giriş birimi saklama birimiyle aynı. */
  inputLabel: string;
  inputHint: string;
};

export const GROWTH_METRICS: MetricMeta[] = [
  {
    key: 'weight',
    label: 'Kilo',
    short: 'Kilo',
    icon: 'weight',
    /*
     * Giriş **gram**: bebek profilindeki "Doğum kilosu (gram)" alanıyla aynı
     * birim. Kilogram kabul edilseydi "6,2" ile "6200" aynı kutuya girer ve
     * hangisinin kastedildiği belirsiz kalırdı; gösterimde yine kg yazılıyor.
     */
    inputLabel: 'Kilo (gram)',
    inputHint: 'örn. 6200',
  },
  { key: 'height', label: 'Boy', short: 'Boy', icon: 'height', inputLabel: 'Boy (cm)', inputHint: 'örn. 62,5' },
  {
    key: 'head',
    label: 'Baş çevresi',
    short: 'Baş',
    icon: 'headSize',
    inputLabel: 'Baş çevresi (cm)',
    inputHint: 'örn. 41,5',
  },
];

export const METRIC_BY_KEY: Record<MetricKey, MetricMeta> = GROWTH_METRICS.reduce(
  (acc, m) => ({ ...acc, [m.key]: m }),
  {} as Record<MetricKey, MetricMeta>,
);

/** Gereksiz ondalığı kırpar ve virgüle çevirir: 62.50 → "62,5". */
export function trim(value: number, digits = 1): string {
  return String(Number(value.toFixed(digits))).replace('.', ',');
}

/**
 * Kilo gösterimi. 1000 gramın altında **gram** yazılır: yenidoğanda 3250 g ile
 * 3100 g arasındaki fark "3,2 kg / 3,1 kg" olarak yazıldığında kayboluyordu.
 */
export function formatWeight(grams: number): string {
  if (Math.abs(grams) < 1000) return `${Math.round(grams)} g`;
  return `${trim(grams / 1000, 2)} kg`;
}

export const formatCm = (value: number): string => `${trim(value)} cm`;

export function formatMetric(key: MetricKey, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return key === 'weight' ? formatWeight(value) : formatCm(value);
}

/** İşaretli değişim: "+320 g", "−0,5 cm". Eksi için gerçek eksi işareti. */
export function formatDelta(key: MetricKey, value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value === 0) return null;
  const sign = value > 0 ? '+' : '−';
  return `${sign}${formatMetric(key, Math.abs(value))}`;
}

/**
 * Hız cümlesi.
 *
 * Kiloda **günlük** anlamlı ("günde 28 g" yenidoğan için tanıdık bir sayı),
 * boy ve baş çevresinde değil: günde 0,03 cm hiçbir şey anlatmıyor, o yüzden
 * haftaya çevriliyor.
 */
export function formatPace(key: MetricKey, perDay: number | null): string | null {
  if (perDay === null || !Number.isFinite(perDay) || perDay === 0) return null;
  if (key === 'weight') {
    const sign = perDay > 0 ? '' : '−';
    return `günde ${sign}${Math.round(Math.abs(perDay))} g`;
  }
  const weekly = perDay * 7;
  const sign = weekly > 0 ? '' : '−';
  return `haftada ${sign}${trim(Math.abs(weekly), 1)} cm`;
}

/** İki takvim günü arasındaki tam gün sayısı. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** "12 günde", "3 ayda" — iki ölçüm arasının okunur hâli. */
export function spanText(series: GrowthSeries): string | null {
  if (!series.latest || !series.previous) return null;
  const days = daysBetween(series.previous.measured_on, series.latest.measured_on);
  if (days <= 0) return null;
  if (days < 31) return `${days} günde`;
  const months = Math.round(days / 30);
  return `${months} ayda`;
}

/** `YYYY-AA-GG` → "5 Kas 2026". */
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export function dayText(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Ölçümün o metrikteki değeri; grafik ve liste aynı yerden okusun. */
export function valueOf(row: GrowthMeasurement, key: MetricKey): number | null {
  if (key === 'weight') return row.weight_g;
  if (key === 'height') return row.height_cm;
  return row.head_cm;
}

export type ChartBar = {
  measured_on: string;
  value: number;
  /** 0–1 arası yükseklik oranı; ekran bunu piksele çevirir. */
  ratio: number;
};

/**
 * Mini sütun grafiği için veriyi hazırlar.
 *
 * Taban **sıfır değil**, serinin en küçük değeri: bebek 6,1 → 6,3 kg arasında
 * gezinirken sıfırdan başlayan bir eksen üç özdeş sütun çizer ve değişimi
 * tamamen gizler. Taban biraz aşağı çekiliyor (`PAD`) ki en küçük ölçüm de
 * görünür bir sütun olsun.
 *
 * Tek ölçüm varsa oran 1 döner: yarım sütun çizmek "yarı yolda" gibi yanlış
 * bir şey anlatırdı.
 */
export function chartBars(
  rows: GrowthMeasurement[],
  key: MetricKey,
  limit = 12,
): ChartBar[] {
  const points = rows
    .map((r) => ({ measured_on: r.measured_on, value: valueOf(r, key) }))
    .filter((p): p is { measured_on: string; value: number } => p.value !== null)
    // Liste en yeniden eskiye geliyor; grafik soldan sağa zaman akışı ister.
    .slice(0, limit)
    .reverse();

  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0], ratio: 1 }];

  const values = points.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const PAD = (max - min) * 0.25 || Math.abs(max) * 0.02 || 1;
  const base = min - PAD;

  return points.map((p) => ({
    ...p,
    ratio: Math.max(0.08, Math.min(1, (p.value - base) / (max - base))),
  }));
}

/**
 * Form alanını sayıya çevirir.
 *
 * Boş alan **hata değil**: üç ölçüden yalnızca birini girmek olağan durum.
 * `null` "bu ölçü girilmedi" demek, `undefined` dönüş yok — ayrım çağıranın
 * işini karıştırırdı.
 */
export function parseMeasure(
  raw: string,
  key: MetricKey,
): { value: number | null; error: string | null } {
  const text = raw.trim().replace(',', '.');
  if (text === '') return { value: null, error: null };

  const n = Number(text);
  if (!Number.isFinite(n)) return { value: null, error: `${METRIC_BY_KEY[key].label}: sayı gir` };

  // Sınırlar sunucuyla aynı (routes/v1/growth.ts); burada erken söylemek bir
  // ağ turunu önlüyor ve hangi alanın sorunlu olduğunu formda gösteriyor.
  if (key === 'weight') {
    if (!Number.isInteger(n)) return { value: null, error: 'Kilo gram cinsinden tam sayı olmalı' };
    if (n < 500 || n > 30000) return { value: null, error: 'Kilo 500–30000 gram arası olmalı' };
  }
  if (key === 'height' && (n < 20 || n > 130)) {
    return { value: null, error: 'Boy 20–130 cm arası olmalı' };
  }
  if (key === 'head' && (n < 15 || n > 65)) {
    return { value: null, error: 'Baş çevresi 15–65 cm arası olmalı' };
  }

  return { value: n, error: null };
}
