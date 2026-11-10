import type { Vaccine, VaccineStatus } from '../../core/api/modules';

/**
 * Aşı sunum yardımcıları — React'e bağımlı değil, bu yüzden ayrı dosyada:
 * durum türetmesi ve ay/gün aritmetiği modülün en kolay yanlış yapılan kısmı
 * ve düz Node altında doğrulanabilir olması işe yarıyor
 * (`scratchpad/vaccine_format_test.mjs`).
 */

/** Ekranda gösterilen durumlar. İkisi türetilmiştir, sunucuda saklanmaz. */
export type EffectiveStatus = VaccineStatus | 'upcoming' | 'delayed';

/** Aşı günü yaklaştı sayılan pencere. */
export const UPCOMING_DAYS = 30;

/** Randevu saati girilmemişse varsayılan saat — sağlık ocağı açılışı. */
export const DEFAULT_HOUR = '09:00';

export const VACCINE_STATUS_LABELS: Record<EffectiveStatus, string> = {
  pending: 'Planlandı',
  upcoming: 'Yaklaşıyor',
  delayed: 'Gecikti',
  completed: 'Yapıldı',
  skipped: 'Atlandı',
};

/** Sekme başlıkları — şartnamedeki adlandırma. */
export const CATEGORY_LABELS = {
  mandatory: 'Ulusal Aşı Takvimi',
  optional: 'Özel Aşılar',
  custom: 'Diğer / Manuel',
} as const;

/** Kısa sekme etiketi; uzun adlar üç chip'i ekrandan taşırıyordu. */
export const CATEGORY_SHORT = {
  mandatory: 'Ulusal',
  optional: 'Özel',
  custom: 'Manuel',
} as const;

/** 'YYYY-AA-GG' → o günün yerel gece yarısı. Geçersizse null. */
export function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Yerel gün sınırına indirir; saat farkı gün sayımını bozmasın. */
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Bugünden planlanan güne kaç gün var. Negatif = geçmiş.
 *
 * Takvim **günü** üzerinden sayılır, 24 saatlik dilimler üzerinden değil:
 * bu gece 23:00'da "yarın" olan bir aşı 1 gün sonra olmalı, 0 değil. Saatler
 * sıfırlanmazsa yaz saati geçişi de tam gün hesabını kaydırırdı.
 */
export function daysUntil(plannedDate: string, now: Date = new Date()): number | null {
  const day = parseDay(plannedDate);
  if (!day) return null;
  const diff = day.getTime() - midnight(now).getTime();
  return Math.round(diff / 86_400_000);
}

/**
 * Ekranda gösterilecek durum.
 *
 * Kullanıcının kararı her zaman kazanır: `completed` ve `skipped` olduğu gibi
 * döner. Yalnızca `pending` zamanla yorumlanır — geçmişte kaldıysa `delayed`,
 * bir ay içindeyse `upcoming`.
 *
 * Sunucuda hesaplanmıyor; gerekçe TEKNIK_DOKUMAN.md §22.12'de.
 */
export function effectiveStatus(
  vaccine: Pick<Vaccine, 'status' | 'planned_date'>,
  now: Date = new Date(),
): EffectiveStatus {
  if (vaccine.status !== 'pending') return vaccine.status;
  const days = daysUntil(vaccine.planned_date, now);
  if (days === null) return 'pending';
  if (days < 0) return 'delayed';
  if (days <= UPCOMING_DAYS) return 'upcoming';
  return 'pending';
}

export const statusLabel = (vaccine: Pick<Vaccine, 'status' | 'planned_date'>, now?: Date) =>
  VACCINE_STATUS_LABELS[effectiveStatus(vaccine, now)];

/**
 * Alarmın kurulacağı **an**.
 *
 * Gün ve saat ayrı sütunlarda duruyor; burada cihazın yerel saat diliminde
 * birleştirilirler. Saat girilmemişse 09:00 varsayılır — 00:00 varsayımı
 * "1 gün önce" uyarısını bir gün erken çalardı.
 */
export function vaccineInstant(
  vaccine: Pick<Vaccine, 'planned_date' | 'planned_time'>,
): Date | null {
  const day = parseDay(vaccine.planned_date);
  if (!day) return null;
  const time = vaccine.planned_time ?? DEFAULT_HOUR;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!m) return null;
  day.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return day;
}

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

/** 'YYYY-AA-GG' → "20 Eylül 2026". */
export function prettyDate(plannedDate: string): string {
  const day = parseDay(plannedDate);
  if (!day) return plannedDate;
  return `${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}`;
}

/**
 * Kart üstündeki zaman satırı: tarih + varsa saat + kalan süre.
 *
 * Kalan süre gün cinsinden yazılır ("3 gün kaldı"), saat cinsinden değil: aşı
 * randevusunda ebeveynin kafasındaki birim gündür. Bugün ve yarın özel olarak
 * adlandırılır — "0 gün kaldı" kimsenin kullandığı bir ifade değil.
 */
export function whenLabel(
  vaccine: Pick<Vaccine, 'planned_date' | 'planned_time' | 'status'>,
  now: Date = new Date(),
): string {
  const base = vaccine.planned_time
    ? `${prettyDate(vaccine.planned_date)} · ${vaccine.planned_time}`
    : prettyDate(vaccine.planned_date);

  // Kapanmış aşıda kalan süre anlamsız: "yapıldı" ile "2 gün kaldı" bir arada
  // okunduğunda çelişiyor.
  if (vaccine.status !== 'pending') return base;

  const days = daysUntil(vaccine.planned_date, now);
  if (days === null) return base;
  if (days === 0) return `${base} · bugün`;
  if (days === 1) return `${base} · yarın`;
  if (days === -1) return `${base} · 1 gün geçti`;
  if (days < 0) return `${base} · ${-days} gün geçti`;
  return `${base} · ${days} gün kaldı`;
}

/**
 * Hedef ayın insan okunur karşılığı: *"Doğumda"*, *"2. ayın sonu"*,
 * *"18. ayın sonu"*, *"4 yaş"*, *"13 yaş"*.
 *
 * 24 ay ve üstü yıla çevrilir; "48. ayın sonu" kimsenin konuştuğu bir ifade
 * değil, ebeveyn "4 yaş" diyor. 24'ün altında ay kalır, çünkü bebeklikte
 * takvim ay üzerinden izleniyor.
 */
export function ageLabel(targetMonth: number | null | undefined): string | null {
  if (targetMonth === null || targetMonth === undefined) return null;
  if (!Number.isFinite(targetMonth) || targetMonth < 0) return null;
  if (targetMonth === 0) return 'Doğumda';
  if (targetMonth < 24) return `${targetMonth}. ayın sonu`;
  const years = Math.floor(targetMonth / 12);
  const rest = targetMonth % 12;
  if (rest === 0) return `${years} yaş`;
  return `${years} yaş ${rest} ay`;
}

export type VaccineGroup = {
  /** Gruplama anahtarı: hedef ay, ya da özel aşılarda planlanan yıl-ay. */
  key: string;
  title: string;
  items: Vaccine[];
};

/**
 * Kartları başlık altında toplar.
 *
 * Ulusal takvimde yirmi kart düz bir liste olarak okunamıyordu; ebeveyn
 * "2. ayda neler var" diye bakıyor. Gruplama **hedef aya** göre yapılır,
 * planlanan tarihe göre değil: randevu öne/arkaya alınsa bile aşı hâlâ
 * "2. ayın aşısı"dır.
 *
 * Özel ve manuel aşıların hedef ayı olmayabilir; onlar planlanan tarihin
 * ay-yılına göre gruplanır.
 */
export function groupByMonth(vaccines: Vaccine[]): VaccineGroup[] {
  const groups = new Map<string, VaccineGroup>();

  for (const v of vaccines) {
    const hasTarget = v.target_month !== null && v.target_month !== undefined;
    const day = parseDay(v.planned_date);
    const key = hasTarget
      ? `m${v.target_month}`
      : `d${v.planned_date.slice(0, 7)}`;
    const title = hasTarget
      ? (ageLabel(v.target_month) ?? v.planned_date)
      : day
        ? `${MONTHS[day.getMonth()]} ${day.getFullYear()}`
        : v.planned_date;

    const existing = groups.get(key);
    if (existing) existing.items.push(v);
    else groups.set(key, { key, title, items: [v] });
  }

  /*
   * Sıralama gruptaki EN ERKEN planlanan tarihe göre. Hedef aya göre
   * sıralamak, hedefi olmayan (manuel) grupları listenin başına atardı;
   * tarihe göre sıralamak iki tür grubu tek bir zaman çizgisinde buluşturuyor.
   */
  const earliest = (g: VaccineGroup) =>
    Math.min(...g.items.map((v) => parseDay(v.planned_date)?.getTime() ?? Number.MAX_SAFE_INTEGER));

  return [...groups.values()]
    .map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => a.planned_date.localeCompare(b.planned_date)),
    }))
    .sort((a, b) => earliest(a) - earliest(b));
}

/** Kartta gösterilen yan etki özeti; hiçbiri işaretli değilse null. */
export function sideEffectSummary(vaccine: Pick<Vaccine, 'side_effects'>): string | null {
  const se = vaccine.side_effects;
  if (!se) return null;
  const parts: string[] = [];
  if (se.fever) parts.push('ateş');
  if (se.swelling) parts.push('şişlik');
  if (se.redness) parts.push('kızarıklık');
  if (se.irritability) parts.push('huzursuzluk');
  if (parts.length === 0 && !se.note?.trim()) return null;
  const head = parts.length ? parts.join(', ') : 'yan etki yok';
  return se.note?.trim() ? `${head} — ${se.note.trim()}` : head;
}

/** Listenin tepesindeki özet: "3 gecikmiş · 2 yaklaşan · 15 yapıldı". */
export function listSummary(vaccines: Vaccine[], now: Date = new Date()): string {
  const count: Record<string, number> = {};
  for (const v of vaccines) {
    const st = effectiveStatus(v, now);
    count[st] = (count[st] ?? 0) + 1;
  }
  const parts: string[] = [];
  if (count.delayed) parts.push(`${count.delayed} gecikmiş`);
  if (count.upcoming) parts.push(`${count.upcoming} yaklaşan`);
  if (count.completed) parts.push(`${count.completed} yapıldı`);
  if (count.skipped) parts.push(`${count.skipped} atlandı`);
  return parts.length ? parts.join(' · ') : `${vaccines.length} aşı planlı`;
}
