import dayjs, { Dayjs } from 'dayjs';

export type Age = {
  totalDays: number;
  weeks: number;
  months: number;
  days: number;
  label: string;
};

export type CorrectedAge = Age & {
  /** Beklenen doğum tarihine kaç gün kaldığı (henüz term'e ulaşılmadıysa). */
  daysToTerm: number;
};

/** Tam gebelik kabul edilen süre; düzeltme bunun üzerinden hesaplanır. */
const TERM_WEEKS = 40;

/** Düzeltilmiş yaşın anlamlı olduğu üst sınır (DSÖ uygulaması). */
const CORRECTION_LIMIT_MONTHS = 24;

function label(totalDays: number, months: number, days: number): string {
  // 0–30 gün: gün cinsinden. Hafta gösterimi ebeveyn için daha az somut.
  if (months === 0) return `${totalDays} günlük`;
  if (months < 24) return days > 0 ? `${months} ay ${days} gün` : `${months} ay`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y} yaş ${m} ay` : `${y} yaş`;
}

function breakdown(from: Dayjs, to: Dayjs): Omit<Age, 'label'> {
  const today = to.startOf('day');
  const born = from.startOf('day');
  const totalDays = Math.max(0, today.diff(born, 'day'));
  const months = Math.max(0, to.diff(from, 'month'));
  const afterMonth = from.add(months, 'month').startOf('day');
  const days = Math.max(0, today.diff(afterMonth, 'day'));
  return { totalDays, weeks: Math.floor(totalDays / 7), months, days };
}

/**
 * Doğum tarihinden tam ay + kalan gün hesaplar (takvim ayı uzunlukları dikkate
 * alınır). Yaş saklanmaz, her gösterimde `birth_date`'ten türetilir.
 */
export function calcAge(birthDate: string, now: Dayjs = dayjs()): Age {
  const b = dayjs(birthDate);
  if (!b.isValid()) return { totalDays: 0, weeks: 0, months: 0, days: 0, label: '-' };
  const parts = breakdown(b, now);
  return { ...parts, label: label(parts.totalDays, parts.months, parts.days) };
}

/**
 * Prematüre bebekler için düzeltilmiş yaş (TEKNIK_DOKUMAN.md §14.1.1).
 *
 * Gelişim, doğum tarihine değil **beklenen doğum tarihine** göre izlenir:
 * eksik kalan her gebelik haftası yaştan düşülür. Beklenen tarih henüz
 * gelmediyse sonuç negatiftir; sıfıra KIRPILMAZ, çünkü kırpmak "bebek term'e
 * 3 hafta var" bilgisini gizlerdi.
 *
 * `null` döner: bebek prematüre değilse, gebelik haftası bilinmiyorsa,
 * 40 hafta ve üzeriyse ya da düzeltmenin anlamlı olduğu yaş aşıldıysa.
 */
export function calcCorrectedAge(
  birthDate: string,
  options: { isPremature: boolean; gestationalAgeWeeks: number | null },
  now: Dayjs = dayjs(),
): CorrectedAge | null {
  const { isPremature, gestationalAgeWeeks } = options;
  if (!isPremature || gestationalAgeWeeks === null) return null;
  if (gestationalAgeWeeks >= TERM_WEEKS) return null;

  const b = dayjs(birthDate);
  if (!b.isValid()) return null;

  const actual = calcAge(birthDate, now);
  if (actual.months >= CORRECTION_LIMIT_MONTHS) return null;

  // Beklenen doğum tarihi = gerçek doğum + eksik kalan gebelik süresi.
  const missingDays = (TERM_WEEKS - gestationalAgeWeeks) * 7;
  const term = b.add(missingDays, 'day');
  const daysToTerm = Math.max(0, term.startOf('day').diff(now.startOf('day'), 'day'));

  if (daysToTerm > 0) {
    return {
      totalDays: -daysToTerm,
      weeks: 0,
      months: 0,
      days: 0,
      daysToTerm,
      label: `term'e ${daysToTerm} gün`,
    };
  }

  const parts = breakdown(term, now);
  return {
    ...parts,
    daysToTerm: 0,
    label: label(parts.totalDays, parts.months, parts.days),
  };
}
