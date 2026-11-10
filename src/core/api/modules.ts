import { api } from './client';
import { endpoints, type Id } from './endpoints';

/**
 * Modül servis katmanı (Modül 2–12).
 *
 * Her modülün şartnamesi ayrı bir `<modül>Service` istiyor; burada tek dosyada
 * ad alanı olarak toplandılar — hepsi aynı `api` istemcisini, aynı hata
 * zarfını ve aynı `Host` başlığı mantığını paylaşıyor. Ayrı dosyalara bölmek
 * dokuz kez aynı importu tekrarlamaktan başka bir şey getirmezdi.
 *
 * Adresler bebek bağlamlıdır: yetki sunucuda `requireBaby()` ile tek noktadan
 * uygulanır (TEKNIK_DOKUMAN.md §22).
 */

const babyPath = (babyId: Id, suffix: string) => `/babies/${babyId}${suffix}`;

/**
 * Her kayıt listesinin yanında dönen denetim alanları.
 *
 * Sunucu bunları zaten gönderiyordu (`SELECT x.*` + `users`/`baby_members`
 * JOIN'leri) ama tipler bilmediği için kayıt detayında kullanılamıyordu.
 * İsteğe bağlı tanımlandılar: bazı uçlar (ör. özetler) bu alanları
 * döndürmez ve zorunlu olsalardı orada tip hatası verirdi.
 */
export type AuditFields = {
  /** Kaydı giren kişinin adı. */
  actor_name?: string;
  /** Yakınlığı — "Baba Mehmet kaydetti" metni için (§5.3). */
  /**
   * Sunucu enum döndürür ama alan opsiyonel ve eski kayıtlarda boş olabilir;
   * `Relationship` yazılması etiket sözlüğünde dizinlemeyi de tiple güvenli
   * kılıyor (önceden `string` olduğu için elle daraltma gerekiyordu).
   */
  actor_relationship?: Relationship | null;
  /** Kronometreyle mi elle mi girildi. */
  entry_source?: 'timer' | 'manual';
  created_at?: string;
  updated_at?: string;
};

/** ISO 8601, UTC — sunucu her zaman offset'li dizge bekler. */
export const iso = (d: Date = new Date()) => d.toISOString();

/** Cihazın UTC'ye göre dakika farkı (TR için +180). */
export const tzOffsetMin = () => -new Date().getTimezoneOffset();

export const localDate = (d: Date = new Date()) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/* ─────────────────────── Modül 5: Uyku ─────────────────────── */

export type SleepRecord = {
  id: number;
  sleep_type: 'night' | 'nap';
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  quality: 'rahat' | 'huzursuz' | 'sik_uyandi' | null;
  wake_reason: string | null;
  wake_count: number;
  note: string | null;
  status: 'running' | 'completed';
} & AuditFields;

export type SleepSummary = {
  date: string;
  night_sleep_sec: number;
  nap_sec: number;
  total_sleep_sec: number;
  session_count: number;
  nap_count: number;
  last_wake_at: string | null;
  awake_window_sec: number | null;
};

export const sleepService = {
  list: (babyId: Id, limit = 50) =>
    api.get<{ sleep: SleepRecord[] }>(babyPath(babyId, '/sleep'), { query: { limit } }),

  summary: (babyId: Id, date: string) =>
    api.get<SleepSummary>(babyPath(babyId, '/sleep/daily-summary'), { query: { date } }),

  start: (babyId: Id, sleepType: 'night' | 'nap') =>
    api.post<{ sleep: SleepRecord; already_running: boolean }>(
      babyPath(babyId, '/sleep/start'),
      { sleep_type: sleepType, started_at: iso(), tz_offset_min: tzOffsetMin() },
    ),

  stop: (recordId: Id, body: { wake_count?: number; quality?: string | null; wake_reason?: string | null }) =>
    api.post<{ sleep: SleepRecord }>(`/sleep/${recordId}/stop`, { ended_at: iso(), ...body }),

  create: (babyId: Id, body: Record<string, unknown>) =>
    api.post<{ sleep: SleepRecord }>(babyPath(babyId, '/sleep'), {
      tz_offset_min: tzOffsetMin(),
      ...body,
    }),

  update: (recordId: Id, body: Record<string, unknown>) =>
    api.put<{ sleep: SleepRecord }>(`/sleep/${recordId}`, body),

  remove: (recordId: Id) => api.delete<{ deleted: boolean }>(`/sleep/${recordId}`),
};

/* ─────────────────────── Modül 6: Bez ─────────────────────── */

export const DIAPER_TYPES = ['cis', 'kaka', 'karisik', 'kuru'] as const;
export const POOP_COLORS = ['sari', 'yesil', 'kahverengi', 'siyah', 'kirmizi', 'diger'] as const;
export const POOP_TEXTURES = ['normal', 'yumusak', 'sulu', 'sert'] as const;
export const RASH_LEVELS = ['none', 'mild', 'severe'] as const;

export type DiaperRecord = {
  id: number;
  changed_at: string;
  diaper_type: (typeof DIAPER_TYPES)[number];
  color: (typeof POOP_COLORS)[number] | null;
  consistency: (typeof POOP_TEXTURES)[number] | null;
  rash_status: (typeof RASH_LEVELS)[number];
  cream_applied: number | boolean;
  note: string | null;
} & AuditFields;

export type DiaperSummary = {
  date: string;
  total_count: number;
  wet_count: number;
  dirty_count: number;
  dry_count: number;
  cream_applied_count: number;
  worst_rash_status: (typeof RASH_LEVELS)[number];
};

export const diaperService = {
  list: (babyId: Id, limit = 50) =>
    api.get<{ diapers: DiaperRecord[] }>(babyPath(babyId, '/diapers'), { query: { limit } }),

  summary: (babyId: Id, date: string) =>
    api.get<DiaperSummary>(babyPath(babyId, '/diapers/daily-summary'), { query: { date } }),

  create: (babyId: Id, body: Record<string, unknown>) =>
    api.post<{ diaper: DiaperRecord }>(babyPath(babyId, '/diapers'), {
      tz_offset_min: tzOffsetMin(),
      ...body,
    }),

  update: (id: Id, body: Record<string, unknown>) =>
    api.put<{ diaper: DiaperRecord }>(`/diapers/${id}`, body),

  remove: (id: Id) => api.delete<{ deleted: boolean }>(`/diapers/${id}`),
};

/* ────────────────────── Modül 4: Ek gıda ────────────────────── */

export const FOOD_CATEGORIES = [
  'vegetable', 'fruit', 'cereal', 'protein', 'dairy', 'snack', 'other',
] as const;
export const REACTIONS = ['loved', 'neutral', 'disliked', 'allergic'] as const;
/** Ek gıdada hacim birimi kullanılamaz; sunucu reddeder (§22.2). */
export const PORTION_UNITS = ['spoon', 'gram', 'bowl', 'piece'] as const;

export type SolidRecord = {
  id: number;
  started_at: string;
  food_name: string | null;
  food_category: (typeof FOOD_CATEGORIES)[number] | null;
  reaction: (typeof REACTIONS)[number] | null;
  is_three_day_rule: number | boolean;
  amount: string | number | null;
  amount_unit: string | null;
  note: string | null;
} & AuditFields;

export type AllergyRow = {
  food_name: string;
  food_category: string | null;
  reaction: string;
  occurrence_count: number;
  last_seen_at: string;
  last_note: string | null;
};

export const solidService = {
  list: (babyId: Id, limit = 50) =>
    api.get<{ feedings: SolidRecord[] }>(babyPath(babyId, '/feedings'), {
      query: { type: 'solid', limit },
    }),

  allergies: (babyId: Id, include: 'allergic' | 'disliked' = 'allergic') =>
    api.get<{ foods: AllergyRow[] }>(babyPath(babyId, '/solid/allergies'), { query: { include } }),

  create: (babyId: Id, body: Record<string, unknown>) =>
    api.post<{ feeding: SolidRecord }>(babyPath(babyId, '/feedings'), {
      feed_type: 'solid',
      tz_offset_min: tzOffsetMin(),
      ...body,
    }),

  remove: (id: Id) => api.delete<{ deleted: boolean }>(`/feedings/${id}`),
};

/* ─────────────────── Modül 3: Biberon ─────────────────── */

/** Biberonla verilen içerik tipleri. */
export const BOTTLE_CONTENTS = ['bottle_breastmilk', 'bottle_formula', 'water'] as const;
export type BottleContent = (typeof BOTTLE_CONTENTS)[number];

/**
 * Hacim birimleri. Sunucu sıvı beslemede yalnızca bunları kabul eder ve
 * `amount_ml` üretilen sütunu da yalnızca bunlarda dolar (§22.2).
 */
export const VOLUME_UNITS = ['ml', 'cl'] as const;
export type VolumeUnit = (typeof VOLUME_UNITS)[number];

export type BottleRecord = {
  id: number;
  feed_type: BottleContent;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  /** DECIMAL sütunları mysql2'den dizge gelir. */
  amount: string | number | null;
  amount_unit: string | null;
  amount_ml: string | number | null;
  note: string | null;
} & AuditFields;

export type BottleSummary = {
  date: string;
  bottle_count: number;
  bottle_total_ml: number;
  avg_ml: number;
  breastmilk_count: number;
  breastmilk_ml: number;
  formula_count: number;
  formula_ml: number;
  water_count: number;
  water_ml: number;
  last_bottle_at: string | null;
  /** Son biberondan beri geçen süre; günden bağımsız hesaplanır. */
  since_last_bottle_sec: number | null;
  avg_interval_sec: number | null;
};

export const bottleService = {
  /**
   * Geçmiş üç tipi birlikte getirir. Filtreyi sunucuda uygulamak önemli:
   * filtresiz çekip istemcide ayıklamak, `limit` sunucuda uygulandığı için
   * çok emzirme/ek gıda kaydı olan bir bebekte biberonları listeden dışarı
   * itebilirdi.
   */
  list: (babyId: Id, limit = 50) =>
    api.get<{ feedings: BottleRecord[] }>(babyPath(babyId, '/feedings'), {
      query: { type: BOTTLE_CONTENTS.join(','), limit },
    }),

  summary: (babyId: Id, date: string) =>
    api.get<BottleSummary>(babyPath(babyId, '/feedings/daily-summary'), { query: { date } }),

  create: (
    babyId: Id,
    body: {
      feed_type: BottleContent;
      amount: number;
      amount_unit: VolumeUnit;
      started_at?: string;
      ended_at?: string | null;
      duration_sec?: number | null;
      note?: string | null;
      entry_source?: 'timer' | 'manual';
    },
  ) =>
    api.post<{ feeding: BottleRecord }>(babyPath(babyId, '/feedings'), {
      started_at: iso(),
      tz_offset_min: tzOffsetMin(),
      ...body,
    }),

  update: (id: Id, body: Record<string, unknown>) =>
    api.put<{ feeding: BottleRecord }>(`/feedings/${id}`, body),

  remove: (id: Id) => api.delete<{ deleted: boolean }>(`/feedings/${id}`),
};

/* ─────────────────── Modül 2: Emzirme ─────────────────── */

export type BreastSession = {
  /** FEEDING kimliği — silme/düzenleme uçları bunu kullanır. */
  id: number;
  /** Seans kimliği — seans komutları (durdur, aktif süre düzelt) bunu ister. */
  session_id: number | null;
  start_time: string;
  end_time: string | null;
  left_duration_seconds: number;
  right_duration_seconds: number;
  /**
   * Geriye dönük alan: artık **etkin aktif** süreyi taşır (anne düzelttiyse
   * onun değeri). Ölçülen değer `measured_active_sec`'te.
   */
  total_duration_seconds: number;
  /** Kronometrenin duraklatılmadan saydığı saniye (§10.2). */
  measured_active_sec: number;
  /** Başlangıçtan bitişe duvar saati — duraklamalar dâhil. */
  total_elapsed_sec: number;
  /** Bebeğin gerçekten emdiği süre; anne düzeltmediyse ölçülene eşit. */
  active_duration_sec: number;
  /** Duvar saati eksi aktif süre. */
  passive_duration_sec: number;
  /** Anne süreyi elle düzeltti mi. */
  is_duration_adjusted: boolean;
  last_side: 'left' | 'right' | null;
  status: string;
  notes: string | null;
  /** Yalnızca /breastfeeding/last yanıtında döner. */
  minutes_ago?: number;
} & AuditFields;

/**
 * `/breastfeeding/active` ve seans komutlarının döndürdüğü çalışan seans.
 *
 * Önceden `Record<string, unknown>` olarak tipleniyordu; ekran da körlemesine
 * dönüştürüyordu. Var olmayan alan adları (`left_sec`, `active_sec`,
 * `segment_started_at`) derleyiciden kaçtı ve kronometre birikmiş süreyi hep
 * 0 saydı. Gerçek şekil burada tanımlı, böylece sunucu şekli değişirse
 * derleme kırılır.
 */
export type ActiveBreastSession = {
  session_id: number;
  feeding_id: number;
  baby_id: number;
  status: 'running' | 'paused' | 'completed';
  started_at: string;
  ended_at: string | null;
  left_active_sec: number;
  right_active_sec: number;
  /** Kapanmış segmentlerin toplamı — açık segment buna dâhil değil. */
  total_active_sec: number;
  measured_active_sec: number;
  total_elapsed_sec: number;
  active_duration_sec: number;
  passive_duration_sec: number;
  is_duration_adjusted: boolean;
  pause_count: number;
  last_side: 'left' | 'right' | null;
  next_side: 'left' | 'right' | null;
  /** Şu an açık segmentin tarafı; duraklatıldıysa null. */
  open_side: 'left' | 'right' | null;
  /** Açık segmentin başlangıcı; duraklatıldıysa null. */
  open_segment_started_at: string | null;
};

export const breastfeedingService = {
  list: (babyId: Id, limit = 50) =>
    api.get<{ sessions: BreastSession[] }>(babyPath(babyId, '/breastfeeding'), { query: { limit } }),

  last: (babyId: Id) =>
    api.get<{ last: BreastSession | null; next_side: 'left' | 'right' | null }>(
      babyPath(babyId, '/breastfeeding/last'),
    ),

  active: (babyId: Id) =>
    api.get<{ session: ActiveBreastSession | null }>(babyPath(babyId, '/breastfeeding/active')),

  start: (babyId: Id, side: 'left' | 'right') =>
    api.post<{ session: ActiveBreastSession }>(babyPath(babyId, '/breastfeeding/start'), {
      side,
      at: iso(),
    }),

  switchSide: (babyId: Id, sessionId: Id, side: 'left' | 'right') =>
    api.post(babyPath(babyId, `/breastfeeding/${sessionId}/switch`), { side, at: iso() }),

  pause: (babyId: Id, sessionId: Id) =>
    api.post(babyPath(babyId, `/breastfeeding/${sessionId}/pause`), { at: iso() }),

  resume: (babyId: Id, sessionId: Id) =>
    api.post(babyPath(babyId, `/breastfeeding/${sessionId}/resume`), { at: iso() }),

  /**
   * Seansı bitirir. `activeDurationSec` verilirse annenin "bebek aslında şu
   * kadar emdi" düzeltmesidir; ölçülen değer sunucuda ezilmez, ayrı tutulur.
   */
  stop: (babyId: Id, sessionId: Id, activeDurationSec?: number) =>
    api.post(babyPath(babyId, `/breastfeeding/${sessionId}/stop`), {
      at: iso(),
      ...(activeDurationSec === undefined ? {} : { active_duration_sec: activeDurationSec }),
    }),

  /** Aktif süreyi sonradan düzeltir; `null` düzeltmeyi kaldırır. */
  adjustActiveDuration: (babyId: Id, sessionId: Id, activeDurationSec: number | null) =>
    api.patch(babyPath(babyId, `/breastfeeding/${sessionId}/active-duration`), {
      active_duration_sec: activeDurationSec,
    }),
};

/* ─────────────────── Modül 12: Süt sağma ─────────────────── */

export const STORAGE_LOCATIONS = ['fridge', 'freezer', 'used_immediately'] as const;

export type PumpingRecord = {
  id: number;
  pumped_at: string;
  left_amount_ml: number | null;
  right_amount_ml: number | null;
  total_amount_ml: number | null;
  duration_sec: number | null;
  storage_location: (typeof STORAGE_LOCATIONS)[number];
  is_used: boolean;
  note: string | null;
} & AuditFields;

export type Stash = {
  fridge: { amount_ml: number; session_count: number };
  freezer: { amount_ml: number; session_count: number };
  total_available_ml: number;
};

export const pumpingService = {
  list: (babyId: Id, limit = 50) =>
    api.get<{ pumping: PumpingRecord[] }>(babyPath(babyId, '/pumping'), { query: { limit } }),

  stash: (babyId: Id) => api.get<Stash>(babyPath(babyId, '/pumping/stash')),

  create: (babyId: Id, body: Record<string, unknown>) =>
    api.post<{ pumping: PumpingRecord }>(babyPath(babyId, '/pumping'), {
      tz_offset_min: tzOffsetMin(),
      ...body,
    }),

  markUsed: (id: Id, isUsed: boolean) =>
    api.patch<{ pumping: PumpingRecord }>(`/pumping/${id}/use`, { is_used: isUsed }),

  remove: (id: Id) => api.delete<{ deleted: boolean }>(`/pumping/${id}`),
};

/* ─────────────────── Modül 8: Hatırlatıcılar ─────────────────── */

/**
 * Hatırlatıcı kategorileri (TEKNIK_DOKUMAN §22.14).
 *
 * Şartnamedeki kümeye `breastfeeding` ve `pumping` eklenmiş hâli: o iki
 * modülün kendi hatırlatıcıları zaten kullanımda ve listeden düşürülmeleri
 * kayıtlı satırları doğrulamadan geçemez hâle getirirdi.
 */
export const REMINDER_CATEGORIES = [
  'feeding', 'breastfeeding', 'sleep', 'diaper', 'pumping',
  'medicine', 'vaccine', 'doctor', 'event', 'custom',
] as const;
export type ReminderCategory = (typeof REMINDER_CATEGORIES)[number];

/**
 * Tekrar biçimi.
 *
 *  - `none`        tek seferlik; yalnızca `start_date` gününde çalar
 *  - `daily`       her gün
 *  - `weekly`      `start_date`in haftanın günü, her hafta
 *  - `custom_days` `repeat_days`teki günlerde
 */
export const RECURRENCE_TYPES = ['none', 'daily', 'weekly', 'custom_days'] as const;
export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];

/** Esnek zamanlama alanları — hatırlatıcıya eklenir. */
export type RecurrenceFields = {
  recurrence_type: RecurrenceType;
  /** ISO gün numarası: 1 = Pazartesi … 7 = Pazar. JS `getDay()` düzeni DEĞİL. */
  repeat_days: number[] | null;
  /** 'YYYY-AA-GG'; boşsa "bugünden itibaren". */
  start_date: string | null;
  /** 'YYYY-AA-GG', dahil; boşsa süresiz. */
  end_date: string | null;
};

/**
 * Cihaz takvimine yazılan uyarının kimliği. Kimlik **cihaza özgüdür**; hangi
 * cihazın yazdığı da saklanır ki telefon, tabletin etkinliğini silmeye
 * çalışmasın (migrations/013).
 */
export type DeviceAlarm = {
  device_uuid: string;
  event_id: string;
  calendar_id?: string | null;
};

/** Görev ve hatırlatıcının paylaştığı çoklu bildirim alanları. */
export type AlarmFields = {
  /** Kaç dakika ÖNCE uyarılacağı. `null` = kullanıcı tümünü kapattı. */
  notification_offsets: number[] | null;
  device_alarm_ids: DeviceAlarm[];
  enable_device_alarm: boolean;
};

/** Etkinlik açıklamasının üst sınırı — sunucudaki sütun genişliğiyle aynı olmalı. */
export const REMINDER_DESCRIPTION_MAX = 250;

export type Reminder = {
  id: number;
  title: string;
  /**
   * Serbest açıklama — şimdilik yalnızca **etkinlik** kategorisinde giriliyor
   * (en fazla `REMINDER_DESCRIPTION_MAX` karakter).
   *
   * Alan opsiyonel: `reminders` tablosunda karşılığı henüz yok ve bu sütunu
   * döndürmeyen bir sunucuya bağlanan istemci çökmemeli (aynı yaklaşım
   * `AuthUser.relationship` için de kullanıldı). Sunucu göçü geldiğinde
   * burada bir değişiklik gerekmiyor.
   */
  description?: string | null;
  category: ReminderCategory;
  schedule_mode: 'interval' | 'fixed_times';
  interval_minutes: number | null;
  anchor: 'last_record' | 'last_fired';
  fixed_times: string[] | null;
  respect_quiet_hours: boolean;
  /** Sessiz saate denk gelen alarm ertelenir / sessize alınır / atlanır. */
  quiet_behavior: 'postpone' | 'silent' | 'skip';
  is_active: boolean;
  next_trigger_at: string | null;
} & AlarmFields & RecurrenceFields;

/** Sessiz saat penceresi. `22:00–07:00` gibi gece yarısını aşan aralıklar geçerlidir. */
export type QuietHour = {
  id: number;
  label: string | null;
  start_time: string;
  end_time: string;
  /** Bit maskesi: bit 0 = Pazartesi … bit 6 = Pazar. 127 = her gün. */
  days_mask: number;
  auto_from_sleep: boolean;
  is_enabled: boolean;
};

export const QUIET_DAYS_ALL = 127;

export const reminderService = {
  list: (babyId: Id) => api.get<{ reminders: Reminder[] }>(babyPath(babyId, '/reminders')),

  create: (babyId: Id, body: Record<string, unknown>) =>
    api.post<{ reminder: Reminder }>(babyPath(babyId, '/reminders'), body),

  update: (id: Id, body: Record<string, unknown>) =>
    api.put<{ reminder: Reminder }>(`/reminders/${id}`, body),

  toggle: (id: Id, isActive?: boolean) =>
    api.patch<{ reminder: Reminder }>(`/reminders/${id}/toggle`,
      isActive === undefined ? {} : { is_active: isActive }),

  remove: (id: Id) => api.delete<{ deleted: boolean }>(`/reminders/${id}`),
};

export const quietHourService = {
  list: (babyId: Id) => api.get<{ quiet_hours: QuietHour[] }>(babyPath(babyId, '/quiet-hours')),

  create: (babyId: Id, body: {
    label?: string | null;
    start_time: string;
    end_time: string;
    days_mask?: number;
  }) => api.post<{ quiet_hour: QuietHour }>(babyPath(babyId, '/quiet-hours'), body),

  update: (id: Id, body: Record<string, unknown>) =>
    api.put<{ quiet_hour: QuietHour }>(`/quiet-hours/${id}`, body),

  remove: (id: Id) => api.delete<{ deleted: boolean }>(`/quiet-hours/${id}`),
};

/* ─────────────── Modül 13: Görevler ─────────────── */

/**
 * `vaccine` Modül 14 ile eklendi: aşı randevusu aileden birine görev olarak
 * atanabiliyor. Bu türdeki görevler aşı ekranından üretilir — görev formunda da
 * seçilebilir, çünkü ebeveyn aşıya götürme işini aşı kaydı olmadan da atamak
 * isteyebilir.
 */
export const TASK_TYPES = [
  'formula_prep', 'breast_milk_feed', 'medicine', 'care', 'vaccine', 'custom',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * Tarif ayrıntıları. Alanlar göreve göre değiştiği için sunucuda tek bir JSON
 * sütununda durur; burada hepsi isteğe bağlı tanımlanır ve ekran görev tipine
 * göre hangilerini göstereceğine karar verir.
 */
export type TaskDetails = {
  formula_amount_ml?: number;
  formula_scoops?: number;
  hot_water_ml?: number;
  cold_water_ml?: number;
  pumping_stash_id?: number;
  dose?: string | null;
  special_notes?: string | null;
};

export type Task = {
  id: number;
  sync_uuid: string;
  baby_id: number;
  title: string;
  task_type: TaskType;
  status: TaskStatus;
  due_time: string;
  tz_offset_min: number;
  instruction_details: TaskDetails | null;
  note: string | null;
  completed_at: string | null;
  creator: { user_id: number; name: string };
  /** null ise kimseye atanmamış — aileden herkes üstlenebilir. */
  assignee: {
    user_id: number;
    name: string;
    relationship: string | null;
    label: string | null;
    display: string;
  } | null;
  completed_by_name: string | null;
  created_at: string;
  updated_at: string;
} & AlarmFields;

export const taskService = {
  list: (
    babyId: Id,
    opts: { status?: TaskStatus[]; assigned?: 'me' | 'any'; date?: string } = {},
  ) =>
    api.get<{ tasks: Task[] }>(babyPath(babyId, '/tasks'), {
      query: {
        ...(opts.status?.length ? { status: opts.status.join(',') } : {}),
        ...(opts.assigned ? { assigned: opts.assigned } : {}),
        ...(opts.date ? { date: opts.date, tz_offset_min: tzOffsetMin() } : {}),
      },
    }),

  get: (taskId: Id) => api.get<{ task: Task }>(`/tasks/${taskId}`),

  create: (
    babyId: Id,
    body: {
      title: string;
      task_type: TaskType;
      due_time: string;
      assigned_user_id?: number | null;
      instruction_details?: TaskDetails | null;
      note?: string | null;
      notification_offsets?: number[] | null;
      enable_device_alarm?: boolean;
    },
  ) =>
    api.post<{ task: Task }>(babyPath(babyId, '/tasks'), {
      tz_offset_min: tzOffsetMin(),
      ...body,
    }),

  update: (taskId: Id, body: Record<string, unknown>) =>
    api.put<{ task: Task }>(`/tasks/${taskId}`, body),

  /**
   * Durum değiştirir. `createRecord` yalnızca tamamlamada anlamlıdır: mama ve
   * sağılmış süt görevlerini beslenme kaydına dönüştürür, süt görevinde stoğu
   * da düşer.
   */
  setStatus: (taskId: Id, status: TaskStatus, createRecord = false) =>
    api.patch<{ task: Task }>(`/tasks/${taskId}/status`, {
      status,
      create_record: createRecord,
    }),

  remove: (taskId: Id) => api.delete<{ deleted: boolean }>(`/tasks/${taskId}`),
};

/* ─────────────── Modül 14: Aşı Takibi ─────────────── */

export const VACCINE_CATEGORIES = ['mandatory', 'optional', 'custom'] as const;
export type VaccineCategory = (typeof VACCINE_CATEGORIES)[number];

/**
 * Sunucuda **saklanan** durumlar.
 *
 * `upcoming` ve `delayed` burada yok: onlar planlanan tarih ile cihazın bugünü
 * karşılaştırılarak ekranda türetilir (`vaccineFormat.ts`). Sunucuda
 * saklanmaları için her gece çalışan bir iş gerekirdi ve "bugün" cihazın saat
 * diliminde anlamlı, sunucunun UTC'sinde değil (TEKNIK_DOKUMAN.md §22.12).
 */
export const VACCINE_STATUSES = ['pending', 'completed', 'skipped'] as const;
export type VaccineStatus = (typeof VACCINE_STATUSES)[number];

/** Şartnamedeki dört boolean + serbest not. */
export type SideEffects = {
  fever: boolean;
  swelling: boolean;
  redness: boolean;
  irritability: boolean;
  note?: string | null;
};

/** Aşıya bağlı "aşıya götür" görevinin özeti. */
export type VaccineTask = {
  id: number;
  title: string | null;
  status: TaskStatus | null;
  due_time: string | null;
  assignee: {
    user_id: number;
    name: string | null;
    relationship: string | null;
    label: string | null;
    display: string | null;
  } | null;
};

export type Vaccine = {
  id: number;
  sync_uuid: string;
  baby_id: number;
  vaccine_definition_id: number | null;
  /** Kütüphane kodu (`hepb_1`, `dabt_r`…); özel aşıda null. */
  code: string | null;
  /** Ad tek alanda birleşir: ekran "tanımlı mı özel mi" ayrımını yapmak zorunda kalmaz. */
  name: string;
  category: VaccineCategory;
  is_custom: boolean;
  /** Doğumdan kaç ay sonra; özel aşıda null. */
  target_month: number | null;
  dose_number: number | null;
  description: string | null;
  status: VaccineStatus;
  /** 'YYYY-AA-GG' */
  planned_date: string;
  /** 'SS:DD' — randevu saati girilmediyse null. */
  planned_time: string | null;
  location: string | null;
  doctor_name: string | null;
  completed_date: string | null;
  side_effects: SideEffects | null;
  note: string | null;
  assigned_task: VaccineTask | null;
  created_at: string;
  updated_at: string;
} & AlarmFields;

/** Sistem aşı kütüphanesi satırı — bebeğe bağlı değil. */
export type VaccineDefinition = {
  id: number;
  code: string;
  name: string;
  category: VaccineCategory;
  target_month: number;
  dose_number: number;
  description: string | null;
};

export const vaccineService = {
  list: (
    babyId: Id,
    opts: { category?: VaccineCategory[]; status?: VaccineStatus[] } = {},
  ) =>
    api.get<{ vaccines: Vaccine[] }>(babyPath(babyId, '/vaccines'), {
      query: {
        ...(opts.category?.length ? { category: opts.category.join(',') } : {}),
        ...(opts.status?.length ? { status: opts.status.join(',') } : {}),
      },
    }),

  /** Kütüphane. Bebek bağlamı yok; `category` ile süzülebilir. */
  library: (category?: VaccineCategory) =>
    api.get<{ definitions: VaccineDefinition[] }>('/vaccines/library', {
      query: category ? { category } : {},
    }),

  get: (id: Id) => api.get<{ vaccine: Vaccine }>(`/vaccines/${id}`),

  /**
   * Takvime aşı ekler. İki kullanım tek uçta: kütüphaneden
   * (`vaccine_definition_id`) ya da elle (`custom_vaccine_name`).
   */
  create: (
    babyId: Id,
    body: {
      vaccine_definition_id?: number | null;
      custom_vaccine_name?: string | null;
      custom_dose_number?: number | null;
      planned_date: string;
      planned_time?: string | null;
      location?: string | null;
      note?: string | null;
      notification_offsets?: number[] | null;
      enable_device_alarm?: boolean;
    },
  ) => api.post<{ vaccine: Vaccine }>(babyPath(babyId, '/vaccines'), body),

  /**
   * Randevu: tarih, saat, yer — ve istenirse aile ferdine görev.
   *
   * `task_due_time` istemciden gider: `planned_date` + `planned_time` **yerel**
   * bir gündür, sunucu onu kendi saat dilimine göre yorumlasaydı randevu saati
   * üç saat kayardı.
   */
  schedule: (
    id: Id,
    body: {
      planned_date?: string;
      planned_time?: string | null;
      location?: string | null;
      note?: string | null;
      assign_task?: boolean;
      assigned_user_id?: number | null;
      task_due_time?: string;
      notification_offsets?: number[] | null;
      enable_device_alarm?: boolean;
    },
  ) =>
    api.post<{ vaccine: Vaccine }>(`/vaccines/${id}/schedule`, {
      tz_offset_min: tzOffsetMin(),
      ...body,
    }),

  /** Yapıldı işaretle — doktor, yer ve yan etkilerle birlikte. */
  complete: (
    id: Id,
    body: {
      completed_date?: string;
      doctor_name?: string | null;
      location?: string | null;
      side_effects?: SideEffects | null;
      note?: string | null;
    } = {},
  ) => api.patch<{ vaccine: Vaccine }>(`/vaccines/${id}/complete`, body),

  /** Atlandı işaretlemek ve tamamlamayı geri almak için. */
  setStatus: (id: Id, status: VaccineStatus) =>
    api.patch<{ vaccine: Vaccine }>(`/vaccines/${id}/status`, { status }),

  /** Genel güncelleme; çoğunlukla cihaz takvimi kimliklerini geri yazmak için. */
  update: (id: Id, body: Record<string, unknown>) =>
    api.put<{ vaccine: Vaccine }>(`/vaccines/${id}`, body),

  remove: (id: Id) => api.delete<{ deleted: boolean }>(`/vaccines/${id}`),
};

/* ─────────────── Bildirim Merkezi ─────────────── */

export const NOTIFICATION_TYPES = [
  'vaccine', 'task', 'reminder', 'routine', 'family',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Bildirime dokununca gidilecek ekran — **modül anahtarı**.
 *
 * Sunucu `VaccineDetail` gibi adlar saklamıyor: bu uygulamada kayıt başına
 * detay ekranı yok, navigasyon ağacı modül anahtarlarından üretiliyor
 * (TEKNIK_DOKUMAN §9, §22.13).
 */
export type NotificationTarget =
  | 'vaccines' | 'tasks' | 'reminders' | 'timeline' | 'family' | 'babies';

export type AppNotification = {
  id: number;
  sync_uuid: string;
  baby_id: number;
  baby_name: string | null;
  title: string;
  body: string;
  type: NotificationType;
  target_screen: NotificationTarget | null;
  target_id: number | null;
  /** 1'den büyükse bu satır birden çok rutin kaydı temsil ediyor. */
  group_count: number;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  /** Olayı yapan kişi; sistem kaynaklı satırlarda null. */
  actor: {
    user_id: number;
    name: string | null;
    relationship: string | null;
    display: string | null;
  } | null;
};

/**
 * Bildirim kutusu servisi.
 *
 * `reminderService` ve cihaz alarmlarıyla (core/notifications/scheduler.ts)
 * karıştırılmamalı: orası **senin** kurduğun alarmı telefona yazıyor, burası
 * **başkasının** yaptığı işi sunucudan okuyor.
 */
export const inboxService = {
  /** Liste ve rozet tek istekte gelir; iki tur atmamak ve sayı kaymasın diye. */
  list: (
    opts: { babyId?: Id; unreadOnly?: boolean; type?: NotificationType[]; limit?: number } = {},
  ) =>
    api.get<{ notifications: AppNotification[]; unread_count: number }>('/notifications', {
      query: {
        ...(opts.babyId ? { baby_id: opts.babyId } : {}),
        ...(opts.unreadOnly ? { unread_only: true } : {}),
        ...(opts.type?.length ? { type: opts.type.join(',') } : {}),
        ...(opts.limit ? { limit: opts.limit } : {}),
      },
    }),

  unreadCount: (babyId?: Id) =>
    api.get<{ unread_count: number }>('/notifications/unread-count', {
      query: babyId ? { baby_id: babyId } : {},
    }),

  read: (id: Id) =>
    api.patch<{ notification: AppNotification }>(`/notifications/${id}/read`, {}),

  /** `babyId` verilirse yalnızca o bebeğin bildirimleri işaretlenir. */
  readAll: (babyId?: Id) =>
    api.patch<{ marked: number }>('/notifications/read-all', babyId ? { baby_id: babyId } : {}),

  remove: (id: Id) => api.delete<{ deleted: boolean }>(`/notifications/${id}`),
};

/* ──────────── Modül 10: Aile ve Yetkiler ──────────── */

export const RELATIONSHIPS = [
  'anne', 'baba', 'dede', 'babaanne', 'anneanne', 'hala', 'teyze',
  'amca', 'dayi', 'kardes', 'ustanne', 'ustbaba', 'bakici', 'diger',
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

/**
 * Yakınlığın Türkçe karşılığı.
 *
 * Önceden `FamilyScreen` ve `RecordDetail` içinde iki ayrı kopya vardı ve
 * `diger` birinde "Diğer", diğerinde "Yakın" yazıyordu — aynı kişi iki ekranda
 * farklı görünüyordu. Tek kaynak: ekranda **"Yakın"** kullanılır, çünkü
 * "Diğer Mehmet" bir kişi adının önünde tuhaf duruyor.
 */
export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  anne: 'Anne', baba: 'Baba', dede: 'Dede', babaanne: 'Babaanne', anneanne: 'Anneanne',
  hala: 'Hala', teyze: 'Teyze', amca: 'Amca', dayi: 'Dayı', kardes: 'Kardeş',
  ustanne: 'Üvey anne', ustbaba: 'Üvey baba', bakici: 'Bakıcı', diger: 'Yakın',
};

/**
 * Kayıt ekranında sunulan kısa liste.
 *
 * Tam liste on dört seçenek; kayıt anında o kadar ayrıntı sormak formu
 * uzatıyor ve çoğu kullanıcı ilk dörtten birini seçiyor. Geri kalanı bebek
 * eklerken ve aile ekranından değiştirilebiliyor.
 */
export const SIGNUP_RELATIONSHIPS = ['anne', 'baba', 'bakici', 'diger'] as const;

/** 'owner' davetle verilemez; yalnızca sahiplik devriyle geçer. */
export const GRANTABLE_PERMISSIONS = ['editor', 'viewer'] as const;
export type Permission = 'owner' | 'editor' | 'viewer';

export type Member = {
  user_id: number;
  full_name: string;
  email: string;
  avatar_path: string | null;
  permission: Permission;
  relationship: Relationship;
  /** Serbest metin etiketi varsa o, yoksa yakınlığın Türkçe karşılığı. */
  relationship_label: string;
  display_name: string;
  joined_at: string;
};

export type Invitation = {
  id: number;
  email: string;
  relationship: Relationship;
  permission: 'editor' | 'viewer';
  status: string;
  expires_at: string;
  created_at: string;
  invited_by_name?: string;
  /** Yalnızca `/invitations/mine` yanıtında döner. */
  code?: string;
};

/** `/invitations/mine` — bana gelen davetler; bebek bağlamı yoktur. */
export type MyInvitation = {
  id: number;
  relationship: Relationship;
  permission: 'editor' | 'viewer';
  expires_at: string;
  created_at: string;
  baby_id: number;
  baby_name: string;
  baby_photo: string | null;
  invited_by_name: string;
};

export const familyService = {
  members: (babyId: Id) =>
    api.get<{ members: Member[]; my_permission: Permission }>(babyPath(babyId, '/members')),

  updateMember: (
    babyId: Id,
    userId: Id,
    body: { permission?: 'editor' | 'viewer'; relationship?: Relationship; relationship_label?: string | null },
  ) => api.put<{ members: Member[] }>(babyPath(babyId, `/members/${userId}`), body),

  removeMember: (babyId: Id, userId: Id) =>
    api.delete<{ members: Member[] }>(babyPath(babyId, `/members/${userId}`)),

  /** Kendi isteğiyle ayrılma. Sahip bu ucu kullanamaz (sunucu 403 döner). */
  leave: (babyId: Id) => api.delete<{ left: boolean }>(babyPath(babyId, '/members/me')),

  transferOwnership: (babyId: Id, userId: Id) =>
    api.post<{ members: Member[] }>(babyPath(babyId, '/transfer-ownership'), { user_id: userId }),

  invitations: (babyId: Id) =>
    api.get<{ invitations: Invitation[] }>(babyPath(babyId, '/invitations')),

  /**
   * Davet oluşturur. Düz davet kodu **yalnızca bu yanıtta, bir kez** döner;
   * veritabanında sadece özeti (`code_hash`) saklanır. Bu yüzden ekran kodu
   * hemen gösterip paylaşılmasını istemek zorundadır — sonradan okunamaz.
   */
  invite: (babyId: Id, body: { email: string; relationship: Relationship; permission: 'editor' | 'viewer' }) =>
    api.post<{
      invitation_id: number;
      code: string;
      email: string;
      relationship: Relationship;
      permission: 'editor' | 'viewer';
      expires_at: string;
    }>(babyPath(babyId, '/invitations'), body),

  revokeInvitation: (babyId: Id, invitationId: Id) =>
    api.delete<{ revoked: boolean }>(babyPath(babyId, `/invitations/${invitationId}`)),

  /* ── bana gelen davetler (bebek bağlamı yok) ── */

  myInvitations: () => api.get<{ invitations: MyInvitation[] }>('/invitations/mine'),

  accept: (by: { code?: string; invitation_id?: number }) =>
    api.post<Record<string, unknown>>('/invitations/accept', by),

  decline: (by: { code?: string; invitation_id?: number }) =>
    api.post<Record<string, unknown>>('/invitations/decline', by),
};

/* ─────────────────── Modül 7: Müzik ─────────────────── */

export const MUSIC_CATEGORIES = [
  'ninni', 'beyaz_gurultu', 'doga', 'klasik', 'kalp_atisi', 'dua', 'diger',
] as const;

export type Track = {
  id: number;
  title: string;
  artist: string | null;
  category: string;
  /**
   * Sunucudaki göreli yol (`/uploads/music/...`) — **çalmak için bunu kullan**.
   *
   * `audio_url` ile ikisi aynı dosyayı gösteriyor, ama göreli yol cihazın
   * zaten bağlı olduğu origin'e ekleniyor. Mutlak adres ise sunucunun kendini
   * nasıl bildiğine (`PUBLIC_BASE_URL`) bağlı; yerel kurulumda bu
   * `http://bebektakip.test` olduğu için hiçbir telefon çözemiyor ve çalma
   * sessizce başarısız oluyordu (bkz. `core/api/assets.ts`).
   *
   * Eski sunucu sürümleri bu alanı göndermiyor; `audio_url` bu yüzden yedek
   * olarak duruyor.
   */
  audio_path?: string | null;
  audio_url: string | null;
  duration_seconds: number | null;
  is_favorite: boolean;
};

/** Parçanın çalınabilir adresi: göreli yol varsa o, yoksa mutlak adres. */
export const trackSource = (track: Track | null): string | null =>
  track ? (track.audio_path ?? track.audio_url) : null;

export const musicService = {
  list: (category?: string) =>
    api.get<{ tracks: Track[] }>('/music', { query: category ? { category } : undefined }),

  favorites: () => api.get<{ tracks: Track[] }>('/music/favorites'),

  toggleFavorite: (id: Id) =>
    api.post<{ track_id: number; is_favorite: boolean }>(`/music/${id}/favorite`),
};

/* ─────────────────── Modül 9: Günlük akış ─────────────────── */

export type TimelineEntry = {
  kind: string;
  ref_id: number;
  subtype: string;
  started_at: string;
  ended_at: string | null;
  /** Emzirmede **etkin aktif** süre (anne düzelttiyse onun değeri). */
  duration_sec: number | null;
  /** Yalnızca emzirmede dolu: duraklamalar dâhil duvar saati. */
  total_elapsed_sec: number | null;
  amount_ml: number | null;
  note: string | null;
  actor: { user_id: number; name: string; display: string; is_me: boolean };
};

export type TimelinePage = {
  date: string;
  entries: TimelineEntry[];
  page: number;
  limit: number;
  has_more: boolean;
};

export const timelineService = {
  feed: (babyId: Id, opts: { date: string; page?: number; limit?: number; categories?: string[] }) =>
    api.get<TimelinePage>(babyPath(babyId, '/timeline'), {
      query: {
        date: opts.date,
        tz_offset_min: tzOffsetMin(),
        page: opts.page ?? 1,
        limit: opts.limit ?? 20,
        categories: opts.categories?.length ? opts.categories.join(',') : undefined,
      },
    }),
};

/* ─────────────────── Modül 11: Raporlar ─────────────────── */

/** Raporlarda serbest tarih aralığı; bitiş günü dâhildir. */
export type ReportRange = { startDate: string; endDate: string };

/** Sunucunun çözdüğü pencere — ekrandaki başlık bundan yazılır. */
export type ResolvedRange = { start_date: string; end_date: string; days: number };

export type ReportSummary = {
  period: string;
  days: number;
  start_date: string;
  end_date: string;
  feeding: { count: number; total_ml: number; breastfeeding_sec: number; avg_per_day: number };
  sleep: { night_sec: number; nap_sec: number; total_sec: number; wake_count: number; avg_sec_per_day: number };
  diaper: { count: number; wet_count: number; dirty_count: number; rash_count: number; avg_per_day: number };
};

export type TrendPoint = Record<string, number | string>;

/*
 * Tarih aralığı iki uçta da **aynı** biçimde gönderilir: özet ile grafik aynı
 * pencereyi göstermeli, yoksa ekranın üstündeki toplamlar altındaki sütunlarla
 * uyuşmaz. `range` verilmediğinde sunucu eski `period`/`days` davranışına
 * düşer — güncellenmemiş bir istemci çalışmaya devam eder.
 */
const rangeQuery = (range?: ReportRange | null) =>
  (range ? { start_date: range.startDate, end_date: range.endDate } : {});

export const reportService = {
  summary: (babyId: Id, period: 'daily' | 'weekly' | 'monthly', range?: ReportRange | null) =>
    api.get<ReportSummary>(babyPath(babyId, '/reports/summary'), {
      query: { period, tz_offset_min: tzOffsetMin(), ...rangeQuery(range) },
    }),

  trends: (
    babyId: Id,
    metric: 'sleep' | 'feeding' | 'diaper',
    days: number,
    range?: ReportRange | null,
  ) =>
    api.get<{ metric: string } & ResolvedRange & { series: TrendPoint[] }>(
      babyPath(babyId, '/reports/trends'),
      { query: { metric, days, tz_offset_min: tzOffsetMin(), ...rangeQuery(range) } },
    ),
};

/* ─────────────────── Bebek verilerini sıfırlama ─────────────────── */

export type ResetDataResult = {
  reset: boolean;
  baby: { id: number; first_name: string };
  /** Tablo adı → silinen satır sayısı; yalnızca dolu olanlar döner. */
  deleted: Record<string, number>;
  total: number;
};

export const babyService = {
  /**
   * Bebeğe ait tüm kayıtları kalıcı siler. Profil, fotoğraf ve aile üyeleri
   * KALIR — işlem "veri sıfırlama", profil silme değil (o `removeBaby`).
   *
   * Sunucu yalnızca **owner**'a izin veriyor; paylaşılan bir profilde
   * düzenleyici üye `404` alır (§5.5).
   */
  resetData: (babyId: Id) => api.delete<ResetDataResult>(endpoints.babies.resetData(babyId)),
};

/* ─────────────── Modül 15: Gelişim Takibi ─────────────── */

/**
 * Tek bir gün için ölçüm. Üçü de isteğe bağlı ama en az biri dolu olmak
 * zorunda: evde çoğu zaman yalnızca tartı var, boy ve baş çevresi doktor
 * kontrolüne kalıyor.
 */
export type GrowthMeasurement = {
  id: number;
  sync_uuid: string;
  baby_id: number;
  /** Takvim günü (`YYYY-AA-GG`) — ölçüm bir an değil, bir gün olayıdır. */
  measured_on: string;
  weight_g: number | null;
  height_cm: number | null;
  head_cm: number | null;
  note: string | null;
  created_by: number;
  creator_name: string | null;
  created_at: string;
  updated_at: string;
};

export type GrowthPoint = { value: number; measured_on: string };

/** Tek bir ölçünün (kilo / boy / baş) zaman içindeki durumu. */
export type GrowthSeries = {
  latest: GrowthPoint | null;
  previous: GrowthPoint | null;
  /** Doğumdaki değer — bebek profilinden gelir. */
  birth: number | null;
  /** latest − previous. */
  change: number | null;
  /** latest − birth. */
  since_birth: number | null;
  /** İki ölçüm arasındaki günlük hız ("günde 28 g"). */
  per_day: number | null;
  count: number;
};

export type GrowthSummary = {
  birth_date: string;
  measurement_count: number;
  last_measured_on: string | null;
  weight: GrowthSeries;
  height: GrowthSeries;
  head: GrowthSeries;
};

export type GrowthInput = {
  measured_on: string;
  weight_g?: number | null;
  height_cm?: number | null;
  head_cm?: number | null;
  note?: string | null;
};

export const growthService = {
  list: (babyId: Id, opts: { from?: string; to?: string; limit?: number } = {}) =>
    api.get<{ measurements: GrowthMeasurement[] }>(babyPath(babyId, '/growth'), {
      query: {
        ...(opts.from ? { from: opts.from } : {}),
        ...(opts.to ? { to: opts.to } : {}),
        ...(opts.limit ? { limit: opts.limit } : {}),
      },
    }),

  summary: (babyId: Id) =>
    api.get<GrowthSummary>(babyPath(babyId, '/growth/summary')),

  /**
   * Ölçüm kaydeder. **Aynı gün varsa üzerine yazar** — sunucu tekil anahtarla
   * günde tek satır tutuyor, bu yüzden ayrı bir "güncelle" çağrısına gerek
   * yok: form hangi günü seçtiyse o günün satırı o olur.
   */
  save: (babyId: Id, body: GrowthInput) =>
    api.post<{ measurement: GrowthMeasurement }>(babyPath(babyId, '/growth'), body),

  get: (id: Id) => api.get<{ measurement: GrowthMeasurement }>(`/growth/${id}`),

  /** Günü değiştirmez; yalnızca ölçüleri ve notu günceller. */
  update: (id: Id, body: Omit<GrowthInput, 'measured_on'>) =>
    api.put<{ measurement: GrowthMeasurement }>(`/growth/${id}`, body),

  remove: (id: Id) => api.delete<{ deleted: boolean }>(`/growth/${id}`),
};
