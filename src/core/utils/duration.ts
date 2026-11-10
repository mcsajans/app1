/** ms -> "ss:dd:ss" (emzirme/uyku kronometresi gösterimi) */
export function formatHms(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
}

/** saniye -> "2 sa 14 dk" / "17 dk 28 sn" (okunabilir özet) */
export function formatHuman(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
  if (m > 0) return r > 0 ? `${m} dk ${r} sn` : `${m} dk`;
  return `${r} sn`;
}
