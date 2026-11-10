export type AmountUnit = 'ml' | 'cl';

/** Girilen miktarı daima ml'ye normalize eder (raporlar tek birimde toplanır). */
export function toMl(amount: number, unit: AmountUnit): number {
  return unit === 'cl' ? amount * 10 : amount;
}

export function fromMl(ml: number, unit: AmountUnit): number {
  return unit === 'cl' ? ml / 10 : ml;
}

export function formatAmount(ml: number | null | undefined, unit: AmountUnit = 'ml'): string {
  if (ml == null) return '-';
  const v = fromMl(ml, unit);
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${unit}`;
}
