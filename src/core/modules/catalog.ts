import { moduleTint } from '../theme';
import type { ModuleMeta, ModuleKey, ModuleStates } from './types';

export const MODULE_CATALOG: ModuleMeta[] = [
  {
    key: 'babies',
    title: 'Bebek Profilleri',
    description: 'Çoklu bebek yönetimi, yaş hesabı, profil geçişi',
    color: moduleTint.babies,
    isCore: true, defaultOn: true, sortOrder: 1,
  },
  /*
   * Beslenme — dört alt modülün üst kutusu.
   *
   * Ana ekrandaki ızgarada emzirme, biberon, ek gıda ve sağma için ayrı ayrı
   * dört kutu vardı; dördü de aynı soruya ("bebek ne aldı?") bakıyordu ve
   * ızgaranın yarısını yiyordu. Artık tek kutu açılıyor, alt modüller o
   * ekranda sekme oluyor.
   *
   * `requires: any` ile: dört alt modülün dördü de kapatılmışsa Beslenme
   * kutusu da çizilmez — boş sekme çubuğu açmanın anlamı yok.
   */
  {
    key: 'feeding',
    title: 'Beslenme',
    description: 'Emzirme, biberon, ek gıda ve süt sağma tek ekranda',
    color: moduleTint.feeding,
    isCore: false, defaultOn: true, sortOrder: 2,
    requires: { keys: ['breastfeeding', 'bottle', 'solid', 'pumping'], mode: 'any' },
  },
  {
    key: 'breastfeeding',
    title: 'Emzirme Sayacı',
    shortTitle: 'Emzirme',
    description: 'Sağ/sol meme için ayrı kronometre, aktif emme süresi',
    color: moduleTint.breastfeeding,
    isCore: false, defaultOn: true, sortOrder: 3,
    parent: 'feeding',
  },
  {
    key: 'bottle',
    title: 'Biberon',
    description: 'Anne sütü / formül mama, ml veya cl miktar girişi',
    color: moduleTint.bottle,
    isCore: false, defaultOn: true, sortOrder: 2,
    parent: 'feeding',
  },
  {
    key: 'solid',
    title: 'Ek Gıda',
    description: 'Mama ve katı gıda kaydı',
    color: moduleTint.solid,
    isCore: false, defaultOn: false, sortOrder: 6,
    parent: 'feeding',
  },
  {
    key: 'sleep',
    title: 'Uyku Takibi',
    description: 'Gece uykusu ve gündüz şekerlemesi, uyanma sayacı',
    color: moduleTint.sleep,
    isCore: false, defaultOn: true, sortOrder: 4,
  },
  {
    key: 'diaper',
    title: 'Bez Değişimi',
    description: 'Çiş / kaka, renk, kıvam, pişik ve krem takibi',
    color: moduleTint.diaper,
    isCore: false, defaultOn: true, sortOrder: 5,
  },
  {
    key: 'music',
    title: 'Ninni & Müzik',
    description: 'Uyutma müzikleri, arka planda çalma, uyku zamanlayıcı',
    color: moduleTint.music,
    isCore: false, defaultOn: true, sortOrder: 8,
  },
  {
    key: 'reminders',
    title: 'Hatırlatıcılar',
    description: 'Periyodik bildirim planlama ve sessiz saat',
    color: moduleTint.reminders,
    isCore: false, defaultOn: true, sortOrder: 9,
    requires: { keys: ['breastfeeding', 'bottle', 'solid'], mode: 'any' },
  },
  {
    key: 'timeline',
    title: 'Günlük Akış',
    description: 'O güne ait tüm kayıtların kronolojik dökümü',
    color: moduleTint.timeline,
    isCore: false, defaultOn: true, sortOrder: 10,
  },
  {
    key: 'family',
    title: 'Aile ve Yetkiler',
    description: 'Davet, yakınlık ve yetki yönetimi',
    color: moduleTint.family,
    isCore: false, defaultOn: true, sortOrder: 11,
  },
  {
    key: 'reports',
    title: 'Raporlar',
    description: 'Günlük ve haftalık özet toplamlar',
    color: moduleTint.reports,
    isCore: false, defaultOn: false, sortOrder: 12,
  },
  {
    key: 'tasks',
    title: 'Görevler',
    description: 'Aile üyelerine görev atama ve mama tarifi',
    color: moduleTint.tasks,
    isCore: false, defaultOn: true, sortOrder: 13,
  },
  {
    key: 'pumping',
    title: 'Süt Sağma',
    shortTitle: 'Sağma',
    description: 'Pompa ile sağma süresi ve miktarı',
    color: moduleTint.pumping,
    isCore: false, defaultOn: false, sortOrder: 7,
    parent: 'feeding',
  },
  {
    key: 'vaccines',
    title: 'Aşı Takibi',
    description: 'Ulusal aşı takvimi, randevu ve hatırlatma',
    color: moduleTint.vaccines,
    isCore: false, defaultOn: true, sortOrder: 14,
  },
  {
    key: 'growth',
    title: 'Gelişim Takibi',
    shortTitle: 'Gelişim',
    description: 'Kilo, boy ve baş çevresi ölçümleri ve değişim grafiği',
    color: moduleTint.growth,
    isCore: false, defaultOn: true, sortOrder: 15,
  },
];

export const MODULE_BY_KEY: Record<ModuleKey, ModuleMeta> = MODULE_CATALOG.reduce(
  (acc, m) => ({ ...acc, [m.key]: m }),
  {} as Record<ModuleKey, ModuleMeta>,
);

export const defaultStates = (): ModuleStates =>
  MODULE_CATALOG.reduce<ModuleStates>((acc, m) => {
    acc[m.key] = m.defaultOn;
    return acc;
  }, {});

/** Switch durumu + bağımlılık kontrolü birlikte değerlendirilir. */
export function isModuleActive(key: ModuleKey, states: ModuleStates): boolean {
  const meta = MODULE_BY_KEY[key];
  if (!meta) return false;
  if (meta.isCore) return true;
  if (states[key] === false) return false;
  if (meta.requires) {
    const { keys, mode } = meta.requires;
    const ok = mode === 'all'
      ? keys.every((k) => isModuleActive(k, states))
      : keys.some((k) => isModuleActive(k, states));
    if (!ok) return false;
  }
  return true;
}

export function activeModules(states: ModuleStates): ModuleMeta[] {
  return MODULE_CATALOG
    .filter((m) => isModuleActive(m.key, states))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Kendi başına açılabilen modüller — ana ekran ızgarası ve navigasyon ağacı.
 *
 * Alt modüller (`parent` dolu) elenir: onlara üst modülün ekranındaki
 * sekmeden ulaşılır. Ayrı bir yol daha açılsaydı aynı ekrana iki kapıdan
 * girilirdi; alt sekme çubuğu tam bu yüzden kaldırılmıştı
 * (bkz. `RootNavigator`).
 */
export function topLevelModules(states: ModuleStates): ModuleMeta[] {
  return activeModules(states).filter((m) => !m.parent);
}

/** Bir üst modülün açık alt modülleri — sekme çubuğunu besler. */
export function childModules(parent: ModuleKey, states: ModuleStates): ModuleMeta[] {
  return activeModules(states).filter((m) => m.parent === parent);
}

/** Sekme etiketi: kısa ad varsa o, yoksa tam başlık. */
export const moduleLabel = (m: ModuleMeta): string => m.shortTitle ?? m.title;
