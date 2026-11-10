/**
 * Tasarım belirteçleri — `modules_doc/tasarim.jpg` şablonundan.
 *
 * Renkler göz kararı değil, şablondan **örneklenerek** alındı (her nokta için
 * küçük bir pencerenin en sık rengi; JPEG gürültüsüne dayanıklı olsun diye).
 * Değiştirirken şablona geri bakmak gerekir.
 */

/** Modül kutularının pastel zeminleri — şablondaki 12 kutudan örneklendi. */
export const moduleTint = {
  babies: '#CCE0F8',
  /*
   * Beslenme, dört alt modülün (emzirme, biberon, ek gıda, sağma) üst kutusu.
   * Şablondaki biberon kremi aynen kullanılıyor: alt modüller artık ızgarada
   * kendi kutularıyla durmadığı için ton çakışması olmuyor ve "beslenme"nin
   * şablondaki karşılığı zaten bu sıcak kremdi.
   */
  feeding: '#FCECCC',
  bottle: '#FCECCC',
  breastfeeding: '#FCDCE0',
  sleep: '#D0D8F4',
  diaper: '#DCF0F4',
  solid: '#F8CCCC',
  pumping: '#BCC8BC',
  music: '#A0B8AC',
  reminders: '#F8CCC8',
  timeline: '#E0CCE0',
  family: '#C0CCC0',
  reports: '#A0BCAC',
  // Şablonda 13. kutu yok; ızgaradaki pastel aileye uyan bir ton seçildi.
  tasks: '#F8E0C0',
  // Aşı: sağlık çağrışımı için soğuk nane tonu. Pastel aileyle uyumlu ama
  // komşularından (uyku mavisi, bez turkuazı) ayrışacak kadar yeşile çalıyor.
  vaccines: '#CCEEDC',
  /*
   * Gelişim: soğuk menekşe. Uyku (#D0D8F4) daha mavi, günlük akış (#E0CCE0)
   * daha pembe; ızgarada üçü yan yana gelmediği için bu aradaki ton ayırt
   * edilebiliyor. Ölçüm/grafik çağrışımı raporlarla aynı aileye düşmesin
   * diye yeşillerden uzak duruldu.
   */
  growth: '#D8D0EC',
} as const;

export const colors = {
  /** Ekran zemini — düz beyaz değil, hafif mavi-gri. */
  bg: '#F0F4FC',
  surface: '#FFFFFF',
  /** Kart içindeki ikinci düzey yüzey (pastel kutucuklar üstü). */
  surfaceSoft: '#F7F9FD',
  border: '#E4E9F2',
  text: '#16202C',
  textSoft: '#6B7585',
  textFaint: '#9AA3B2',

  primary: '#5B8DEF',
  primarySoft: '#E8F0FE',
  danger: '#E5484D',
  success: '#2FA66A',
  warning: '#E8A33D',

  /** Alt çubuktaki orta eylem düğmesi (şablondaki yeşil daire). */
  accent: '#8FB39C',
  accentSoft: '#DCE8DF',
  /** Alt çubukta seçili sekme. */
  navActive: '#E8939A',
  navIdle: '#A8B0BE',

  // ── Modül vurguları ──
  // Pastel zeminler kutular için; aşağıdakiler nokta/çubuk gibi küçük,
  // doygun işaretler için (akış kartlarının sol şeridi gibi).
  ...moduleTint,

  /** Akış kartlarının sol şeridi — şablondan örneklenen üç doygun ton. */
  trackFeeding: '#F09098',
  trackSleep: '#90B0E8',
  trackDiaper: '#84C8A8',
  trackOther: '#C8A8D8',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Şablondaki köşeler mevcut temadan belirgin biçimde daha yumuşak. */
export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } as const;

/**
 * Kart gölgeleri. Şablonda gölge çok yumuşak ve neredeyse renksiz; Android'de
 * `elevation` tek başına sert bir gri verdiği için ikisi birlikte ayarlandı.
 */
export const shadow = {
  card: {
    shadowColor: '#1B2A4A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#1B2A4A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

export const typography = {
  /** Bölüm başlıkları şablonda kalın ve koyu. */
  h1: { fontSize: 26, fontWeight: '800' as const },
  h2: { fontSize: 21, fontWeight: '800' as const },
  h3: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  tiny: { fontSize: 11, fontWeight: '500' as const },
  mono: { fontSize: 34, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as const },
} as const;
