export type ModuleKey =
  | 'babies'
  | 'feeding'
  | 'breastfeeding'
  | 'bottle'
  | 'solid'
  | 'sleep'
  | 'diaper'
  | 'music'
  | 'reminders'
  | 'timeline'
  | 'family'
  | 'reports'
  | 'pumping'
  | 'tasks'
  | 'vaccines'
  | 'growth';

/** Modül meta verisi — React bağımlılığı yok, store bunu güvenle import eder. */
export type ModuleMeta = {
  key: ModuleKey;
  title: string;
  /**
   * Sekme çubuğunda kullanılan kısa ad.
   *
   * "Emzirme Sayacı" ya da "Süt Sağma" gibi başlıklar dört sekme yan yana
   * dizildiğinde satıra sığmıyor. Katalogda durur ki yeni bir alt modül
   * eklendiğinde Beslenme ekranında elle bir şey değiştirmek gerekmesin.
   */
  shortTitle?: string;
  description: string;
  /**
   * Modülün ikonu ayrı bir alan DEĞİL: `key` zaten `components/Icon.tsx`
   * sözlüğündeki semantik adla aynı. İki yerde tutmak, yeni modül eklerken
   * birini güncellemeyi unutmaya davetiye çıkarıyordu.
   */
  color: string;
  /** true ise ayarlardan kapatılamaz */
  isCore: boolean;
  defaultOn: boolean;
  sortOrder: number;
  /** bağımlılık: belirtilen modüllerden biri/hepsi kapalıysa bu modül de pasif sayılır */
  requires?: { keys: ModuleKey[]; mode: 'any' | 'all' };
  /**
   * Üst modül. Doluysa bu modül **kendi başına** bir kutu değildir: ana
   * ekrandaki ızgarada ve navigasyon ağacında yer almaz, üst modülün ekranında
   * sekme olarak çizilir.
   *
   * Yönetim panelindeki aç/kapa ayarı korunur — alt modül kapatıldığında
   * sekmesi çizilmez. Katalogdan satırı silmek bu ayarı tamamen kaybettirirdi.
   */
  parent?: ModuleKey;
};

export type ModuleStates = Partial<Record<ModuleKey, boolean>>;
