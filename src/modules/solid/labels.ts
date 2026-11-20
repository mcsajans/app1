/**
 * Ek gıda etiketleri — ekran ve ekleme sayfası aynı sözlükleri okur.
 *
 * Form alt sayfaya taşınınca (2026-11-21) iki dosya oluştu; etiketleri her
 * ikisine kopyalamak zamanla ayrışmaya açık bir tekrar olurdu.
 */

export const CATEGORY_LABELS: Record<string, string> = {
  vegetable: 'Sebze',
  fruit: 'Meyve',
  cereal: 'Tahıl',
  protein: 'Protein',
  dairy: 'Süt ürünü',
  snack: 'Atıştırmalık',
  other: 'Diğer',
};

export const REACTION_LABELS: Record<string, string> = {
  loved: 'Sevdi',
  neutral: 'Nötr',
  disliked: 'Sevmedi',
  allergic: 'Alerji',
};

export const UNIT_LABELS: Record<string, string> = {
  spoon: 'kaşık',
  gram: 'gram',
  bowl: 'kâse',
  piece: 'adet',
};
