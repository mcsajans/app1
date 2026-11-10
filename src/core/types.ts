export type Gender = 'kiz' | 'erkek' | 'belirtilmedi';
export type Side = 'left' | 'right';
export type AmountUnit = 'ml' | 'cl';

export type FeedType =
  | 'breast'
  | 'bottle_breastmilk'
  | 'bottle_formula'
  | 'solid'
  | 'water';

export type SleepType = 'night' | 'nap';
export type RecordStatus = 'running' | 'paused' | 'completed';

/** Sunucudaki ENUM ile birebir; serbest metin kabul edilmez. */
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

export type Baby = {
  id: number;
  syncUuid: string;
  firstName: string;
  lastName: string | null;
  gender: Gender;
  birthDate: string;        // YYYY-MM-DD
  birthTime: string | null; // HH:mm[:ss]
  /** Gram, tam sayı — kg dönüşümünde kayıp olmaması için (bkz. §14.0). */
  birthWeightG: number | null;
  birthHeightCm: number | null;
  headCircumferenceCm: number | null;
  isPremature: boolean;
  /** Prematüre ise dolu; düzeltilmiş yaş bundan hesaplanır. */
  gestationalAgeWeeks: number | null;
  bloodType: BloodType | null;
  note: string | null;
  photoPath: string | null;
  /** Sunucunun verdiği mutlak adres; cihaz origin'ine çevrilerek kullanılır. */
  photoUrl: string | null;
  isSelected: boolean;
  isOwner: boolean;
  /**
   * Bu bebekteki yetkim. Davet koduyla katılan kullanıcı `editor` ya da
   * `viewer` olur; `viewer` yalnızca okuyabilir, bu yüzden arayüz düzenleme
   * ve kayıt ekleme yollarını ona hiç göstermez (asıl engel sunucuda, §5.5).
   */
  myPermission: Permission;
  /** Bebeği oluşturan kişinin adı — paylaşılan bebekte "kim paylaştı". */
  ownerName: string | null;
  /** Bebeğe erişimi olan kişi sayısı. */
  memberCount: number;
  sortOrder: number;
};

export type Permission = 'owner' | 'editor' | 'viewer';

export type Feeding = {
  id: number;
  syncUuid: string;
  babyId: number;
  feedType: FeedType;
  startedAt: string;        // ISO UTC
  endedAt: string | null;
  durationSec: number | null;
  amountMl: number | null;
  foodName: string | null;
  note: string | null;
  status: RecordStatus;
};

export type BreastSegment = {
  seq: number;
  side: Side;
  startedAt: string;
  endedAt: string | null;
  activeSec: number;
};

export type SleepRecord = {
  id: number;
  syncUuid: string;
  babyId: number;
  sleepType: SleepType;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  wakeCount: number;
  note: string | null;
  status: 'running' | 'completed';
};

export type TimelineKind = 'feeding' | 'sleep' | 'music' | 'notification';

export type TimelineEntry = {
  id: string;
  kind: TimelineKind;
  color: string;
  icon: string;
  title: string;
  detail: string;
  startedAt: string;
  endedAt: string | null;
};
