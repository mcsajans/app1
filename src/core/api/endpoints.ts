/**
 * REST uç noktaları — `API_BASE_URL` (…/api/v1) sonrasına eklenen yollar.
 *
 * Kaynak: `C:\wamp64\www\bebektakip\src\routes\v1\*` (bkz. TEKNIK_DOKUMAN.md §8.1).
 * Sunucuda **henüz yazılmamış** uçlar bilinçli olarak buraya eklenmedi:
 * `/sleep/start`, `/sleep/{id}/stop`, `/reminders`, `/quiet-hours`,
 * `/notifications/log`, `/music/*`, `/sync/push`, `/sync/pull`, fotoğraf yükleme
 * (`/auth/me/avatar`, `/babies/{id}/photo`) ve şifre sıfırlama
 * (`/auth/forgot-password`, `/auth/reset-password`).
 */

export type Id = number | string;

export const endpoints = {
  /** Kimlik doğrulaması gerektirmez; sunucunun ayakta olduğunu doğrular. */
  health: '/health',

  /**
   * Yönetim panelinden yüklenen proje ve uygulama logoları. Giriş ekranında da
   * gösterildiği için kimlik doğrulaması gerektirmez (§7.5).
   */
  branding: '/branding',

  /**
   * Reklam ayarları — sistem geneli, yönetim panelinden yazılır
   * (`/admin/ads`). Giriş yapılmadan da okunur: uygulama açılışta reklam
   * servisini kurarken bu değerlere ihtiyaç duyuyor ve içinde sır yok
   * (bkz. `core/ads/useAdSettingsStore.ts`).
   */
  adsConfig: '/ads/config',

  auth: {
    register: '/auth/register',
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    logoutAll: '/auth/logout-all',
    me: '/auth/me',
    password: '/auth/me/password',
    /** Sıfırlama kodunu e-postayla ister; hesabın varlığını sızdırmaz. */
    forgotPassword: '/auth/forgot-password',
    /** E-postadaki kod + yeni şifre. Başarılıysa tüm oturumlar kapanır. */
    resetPassword: '/auth/reset-password',
    sessions: '/auth/sessions',
    session: (id: Id) => `/auth/sessions/${id}`,
  },

  babies: {
    list: '/babies',
    create: '/babies',
    detail: (babyId: Id) => `/babies/${babyId}`,
    /** Bebeğe ait TÜM kayıtları kalıcı siler; profil ve üyelik kalır (owner). */
    resetData: (babyId: Id) => `/babies/${babyId}/data`,
    select: (babyId: Id) => `/babies/${babyId}/select`,
    /** multipart/form-data, alan adı `photo` (§14.2). */
    photo: (babyId: Id) => `/babies/${babyId}/photo`,
    members: (babyId: Id) => `/babies/${babyId}/members`,
    member: (babyId: Id, userId: Id) => `/babies/${babyId}/members/${userId}`,
    leave: (babyId: Id) => `/babies/${babyId}/members/me`,
    transferOwnership: (babyId: Id) => `/babies/${babyId}/transfer-ownership`,
  },

  invitations: {
    /** Bebek bağlamında: oluştur (POST) ve bekleyenleri listele (GET). */
    ofBaby: (babyId: Id) => `/babies/${babyId}/invitations`,
    cancel: (babyId: Id, invitationId: Id) =>
      `/babies/${babyId}/invitations/${invitationId}`,
    mine: '/invitations/mine',
    accept: '/invitations/accept',
    decline: '/invitations/decline',
  },

  /** Besleme · uyku · bez: bebek bağlamında liste/oluştur, tekil yolda güncelle/sil. */
  records: {
    feedings: (babyId: Id) => `/babies/${babyId}/feedings`,
    feeding: (id: Id) => `/feedings/${id}`,
    sleep: (babyId: Id) => `/babies/${babyId}/sleep`,
    sleepItem: (id: Id) => `/sleep/${id}`,
    diapers: (babyId: Id) => `/babies/${babyId}/diapers`,
    diaper: (id: Id) => `/diapers/${id}`,
  },

  breastfeeding: {
    active: (babyId: Id) => `/babies/${babyId}/breastfeeding/active`,
    start: (babyId: Id) => `/babies/${babyId}/breastfeeding/start`,
    switch: (babyId: Id, sessionId: Id) =>
      `/babies/${babyId}/breastfeeding/${sessionId}/switch`,
    pause: (babyId: Id, sessionId: Id) =>
      `/babies/${babyId}/breastfeeding/${sessionId}/pause`,
    resume: (babyId: Id, sessionId: Id) =>
      `/babies/${babyId}/breastfeeding/${sessionId}/resume`,
    stop: (babyId: Id, sessionId: Id) =>
      `/babies/${babyId}/breastfeeding/${sessionId}/stop`,
  },

  timeline: {
    timeline: (babyId: Id) => `/babies/${babyId}/timeline`,
    activity: (babyId: Id) => `/babies/${babyId}/activity`,
    dailyReport: (babyId: Id) => `/babies/${babyId}/reports/daily`,
  },

  /**
   * Modül aktifliği sistem genelidir ve yalnızca yönetim panelinden değişir;
   * bu yüzden burada yazma ucu yoktur (TEKNIK_DOKUMAN.md §9.1).
   */
  modules: {
    list: '/modules',
  },

  /**
   * Bildirim merkezi (TEKNIK_DOKUMAN.md §22.13).
   *
   * Yollar bebek bağlamlı DEĞİL: satırlar kullanıcıya ait, `baby_id` yalnızca
   * bir süzgeç. Zil açıldığında ebeveyn hangi bebekte olduğuna bakmaksızın
   * her şeyi görmek istiyor.
   */
  notifications: {
    list: '/notifications',
    unreadCount: '/notifications/unread-count',
    read: (id: Id) => `/notifications/${id}/read`,
    readAll: '/notifications/read-all',
    remove: (id: Id) => `/notifications/${id}`,
  },

  /** Modül 14 — Aşı Takibi (TEKNIK_DOKUMAN.md §22.12). */
  vaccines: {
    ofBaby: (babyId: Id) => `/babies/${babyId}/vaccines`,
    /**
     * Sistem aşı kütüphanesi. Bebek bağlamı yok: liste herkeste aynı.
     * Sunucuda `/vaccines/:id` kuralından ÖNCE tanımlı olmak zorunda, yoksa
     * `library` metni `:id` kalıbına düşerdi.
     */
    library: '/vaccines/library',
    detail: (id: Id) => `/vaccines/${id}`,
    schedule: (id: Id) => `/vaccines/${id}/schedule`,
    complete: (id: Id) => `/vaccines/${id}/complete`,
    status: (id: Id) => `/vaccines/${id}/status`,
  },
} as const;
