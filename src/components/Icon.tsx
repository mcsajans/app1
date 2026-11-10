import React from 'react';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static';

import { colors } from '../core/theme';

/**
 * Uygulamanın tek ikon kaynağı.
 *
 * Önceden ikonlar **emoji** idi (👶 🍼 😴 …). Emoji üç sorun çıkarıyordu:
 * her platform kendi çizimini gösterdiği için aynı ekran Android ve iOS'ta
 * farklı görünüyordu, boyut ve hizalama yazı tipine bağlı olduğundan ızgarada
 * kutudan kutuya kayıyordu, ve renk gömülü olduğu için tema ile hiç
 * uyuşmuyordu.
 *
 * Yerine **Material Design Icons** (`@react-native-vector-icons`) kullanılıyor:
 * 7400+ ikonluk set, bebek bakımı için şaşırtıcı derecede zengin
 * (`baby-bottle-outline`, `mother-nurse`, `diaper-outline`, `teddy-bear`…).
 * `outline` varyantları tercih edildi: içi dolu ikonlar pastel kutuların
 * üzerinde ağır duruyordu, çizgi ikonlar hem daha kurumsal hem daha yumuşak.
 *
 * **Semantik adlandırma.** Çağıran taraf `bottle` der, `baby-bottle-outline`
 * demez. Set değiştirilecek olursa (ya da bir ikon başka bir çizimle
 * değiştirilecekse) tek dosya yeterlidir; ekranlar ikon kütüphanesini hiç
 * tanımaz.
 *
 * `/static` içe aktarımı bilinçli: font APK'ya gömülür ve ilk karede hazırdır.
 * Varsayılan (dinamik) içe aktarımda font çalışma zamanında yükleniyor ve
 * açılış ekranında ikonlar bir an boş kutu olarak çiziliyordu. Karşılığında
 * `app.json`'a config plugin satırı ve bir prebuild gerekiyor.
 */

/** Semantik ad → Material Design Icons adı. */
const GLYPHS = {
  // ── modüller ──
  babies: 'baby-face-outline',
  /*
   * `baby-bottle` MDI'de **eğik** çizilmiş; 22-32 px'te biberondan çok bir
   * etikete benziyor ve akış listesinde her satır aynı belirsiz şekille
   * doluyordu. `bottle-tonic-outline` dik duruyor, boyun + gövde silüeti
   * küçük boyutta da "şişe" olarak okunuyor.
   */
  /*
   * Beslenme üst modülü. `baby-bottle-outline` biberonla karışırdı ve zaten
   * eğik çizimi yüzünden elenmişti; `food-*` ailesi ise yetişkin yemeği
   * çağrıştırıyor. `nutrition` dördünü birden kapsayan tek nötr simge.
   */
  feeding: 'nutrition',
  bottle: 'bottle-tonic-outline',
  breastfeeding: 'mother-nurse',
  sleep: 'sleep',
  diaper: 'diaper-outline',
  solid: 'bowl-mix-outline',
  pumping: 'cup-outline',
  music: 'music-note-outline',
  reminders: 'bell-outline',
  timeline: 'timeline-text-outline',
  family: 'account-group-outline',
  reports: 'chart-box-outline',
  /** Gelişim: yükselen çizgi. Raporların kutulu grafiğinden ayrışsın diye. */
  growth: 'chart-timeline-variant',
  /** Gelişim ölçüleri — kart başlıklarında tek tek kullanılıyor. */
  weight: 'scale-bathroom',
  height: 'human-male-height-variant',
  headSize: 'head-outline',
  tasks: 'checkbox-marked-circle-outline',
  /*
   * MDI'de `syringe` ya da `vaccine` adında bir ikon YOK; arama
   * sonuçlarından tek uygun olan `needle`. `outline` varyantı da
   * bulunmuyor, bu yüzden burada dolu çizim kullanılıyor — iğne silueti
   * ince olduğu için pastel kutuda ağır durmuyor.
   */
  vaccines: 'needle',

  // ── alt gezinme çubuğu ──
  home: 'home-variant-outline',
  feed: 'format-list-bulleted',
  plus: 'plus',
  account: 'account-circle-outline',

  // ── görev türleri ──
  taskFormula: 'bottle-tonic-outline',
  taskBreastMilk: 'cup-outline',
  taskMedicine: 'pill',
  taskCare: 'lotion-outline',
  taskCustom: 'clipboard-text-outline',
  taskVaccine: 'needle',

  // ── izinler ──
  bell: 'bell-outline',
  /** Kesin alarm izni — çalar saat silüeti, zil ikonundan ayrışsın diye. */
  alarm: 'alarm-check',
  calendar: 'calendar-month-outline',
  photos: 'image-multiple-outline',

  // ── kayıt alt türleri ──
  water: 'water-outline',
  night: 'weather-night',
  nap: 'white-balance-sunny',
  pee: 'water-outline',
  poop: 'emoticon-poop',
  allergy: 'alert-octagon-outline',
  loved: 'heart-outline',
  used: 'check-circle-outline',

  // ── küçük arayüz simgeleri ──
  close: 'close',
  /**
   * Düz tik — onay kutusunun **içinde** kullanılır. `check` çemberli bir
   * işarettir; kare bir kutunun içine konunca kutu-içinde-daire gibi
   * duruyordu.
   */
  tick: 'check',
  star: 'star',
  starOutline: 'star-outline',
  camera: 'camera-outline',
  key: 'key-variant',
  chevron: 'chevron-right',
  repeat: 'repeat',
  repeatOff: 'repeat-off',
  /** Şifre alanındaki "göster" düğmesi — gizliyken bu çizilir. */
  eye: 'eye-outline',
  /** Şifre görünürken "gizle" düğmesi. */
  eyeOff: 'eye-off-outline',

  // ── durum ve boş ekranlar ──
  check: 'check-circle-outline',
  warning: 'alert-circle-outline',
  clock: 'clock-outline',
  note: 'note-text-outline',
  settings: 'tune-variant',
  edit: 'account-edit-outline',
  trash: 'trash-can-outline',
  share: 'share-variant-outline',
  teddy: 'teddy-bear',

  // ── aşı takibi ──
  /** Yapılacağı yer — sağlık ocağı / hastane. */
  hospital: 'hospital-building',
  /** Doktor adı satırı. `doctor` ikonu bir kişi silueti; stetoskop daha okunur. */
  doctor: 'stethoscope',
  location: 'map-marker-outline',
  /** Yan etki: ateş. */
  fever: 'thermometer',
  /** Atlanan aşının rozeti — iptal değil, bilinçli atlama. */
  skipped: 'minus-circle-outline',
  upcoming: 'calendar-clock-outline',

  // ── hatırlatıcı kategorileri ──
  /*
   * Etkinlik. Şartname emoji öneriyor (🎉 / 🎈) ama emoji her platformda
   * farklı çiziliyor ve temayla uyuşmuyor (dosya başındaki gerekçe).
   * `party-popper` düşünüldü; takvim yıldızı seçildi çünkü etkinlik
   * hatırlatıcısı bir kutlama değil, bir TARİH — doğum günü de olabilir,
   * veli toplantısı da.
   */
  event: 'calendar-star-outline',
} as const;

export type IconName = keyof typeof GLYPHS;

/** Bir ikon adının sözlükte olup olmadığını güvenle sorar. */
export function hasIcon(name: string): name is IconName {
  return name in GLYPHS;
}

export function Icon({
  name,
  size = 24,
  color = colors.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <MaterialDesignIcons name={GLYPHS[name]} size={size} color={color} />;
}
