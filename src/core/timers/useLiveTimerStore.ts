import { create } from 'zustand';

import { breastfeedingService, sleepService } from '../api/modules';
import { getDb } from '../db';
import {
  hideAllTimerNotices, hideTimerNotice, showTimerNotice,
} from '../notifications/liveTimerNotice';
import { useBabyStore } from '../stores/useBabyStore';
import {
  breastTimerOf, elapsedSec, sameNotice, sleepTimerOf,
  type LiveTimer, type TimerKind,
} from './liveTimer';

/**
 * Çalışan sayaçların **tek** kaydı ve bildirim aynası.
 *
 * Ekranlar sayaç durumunu zaten sunucudan okuyor; bu mağaza onların bildiğini
 * ekran söküldükten sonra da ayakta tutar. Gerekçe: bildirimdeki "Duraklat"
 * düğmesine basıldığında ilgili ekran monte olmak zorunda değil — hangi seans
 * çalışıyordu bilgisinin ekrandan bağımsız bir yerde durması gerekiyor.
 *
 * Mağaza süre **saymaz**: her sayaç zaman damgasıyla tanımlı, geçen süre
 * okunurken hesaplanıyor (`elapsedSec`). Sayılsaydı arka plana geçen uygulama
 * geride kalırdı.
 */

type State = {
  timers: Partial<Record<TimerKind, LiveTimer>>;
  /**
   * Bildirimden "Bitir"e basıldı: ilgili ekran açıldığında özet/kayıt
   * penceresini kendiliğinden açsın.
   *
   * Doğrudan sunucuya "bitir" göndermiyoruz, çünkü emzirmede bitiş annenin
   * aktif süre düzeltmesini bekliyor (§10.2.1) ve sağmada miktar henüz
   * girilmedi. Bildirim yalnızca niyeti taşır, kaydı ekran yazar.
   */
  pendingStop: TimerKind | null;
  /**
   * Bildirimden gelen "şu modülü aç" isteği.
   *
   * Yönlendirme burada **yapılmaz**: uygulama bildirime basılarak soğuk
   * başlatıldığında navigasyon ağacı henüz monte değil ve `navigateTo` çağrısı
   * sessizce düşer (bkz. `navigationRef.ts`). Niyet mağazada bekler, kabuk
   * ağaç hazır olunca tüketir.
   */
  pendingOpen: TimerKind | null;

  publish: (kind: TimerKind, timer: LiveTimer | null) => void;
  /** Metni tazeler (ön plan/arka plan geçişleri). */
  refreshNotices: () => void;
  refreshFromServer: (babyId: number | null, babyName: string | null) => Promise<void>;

  requestStop: (kind: TimerKind) => void;
  consumePendingStop: (kind: TimerKind) => boolean;
  requestOpen: (kind: TimerKind) => void;
  consumePendingOpen: () => TimerKind | null;

  /** Oturum kapanınca: bildirimleri kaldır, yerel kronometreyi sil. */
  clearAll: () => Promise<void>;

  /* ── sağma (yerel) kronometresi ── */
  hydratePumping: () => Promise<void>;
  startPumping: (babyId: number | null, babyName: string | null) => Promise<void>;
  pausePumping: () => Promise<void>;
  resumePumping: () => Promise<void>;
  /** Kronometreyi kapatır ve geçen süreyi (saniye) döndürür. */
  stopPumping: () => Promise<number>;
};

/* ───────────────────────── yerel kalıcılık ───────────────────────── */

type TimerRow = {
  kind: string;
  baby_id: number | null;
  baby_name: string | null;
  started_at: string;
  segment_started_at: string | null;
  base_sec: number;
  status: string;
  detail: string | null;
};

const rowToTimer = (r: TimerRow): LiveTimer => ({
  kind: r.kind as TimerKind,
  status: r.status === 'paused' ? 'paused' : 'running',
  startedAt: r.started_at,
  segmentStartedAt: r.segment_started_at,
  baseSec: r.base_sec,
  sessionId: null,
  babyId: r.baby_id,
  babyName: r.baby_name,
  detail: r.detail,
});

async function saveLocalTimer(timer: LiveTimer): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO local_timer
       (kind, baby_id, baby_name, started_at, segment_started_at, base_sec, status, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(kind) DO UPDATE SET
       baby_id = excluded.baby_id, baby_name = excluded.baby_name,
       started_at = excluded.started_at, segment_started_at = excluded.segment_started_at,
       base_sec = excluded.base_sec, status = excluded.status, detail = excluded.detail`,
    [
      timer.kind, timer.babyId, timer.babyName, timer.startedAt,
      timer.segmentStartedAt, Math.round(timer.baseSec), timer.status, timer.detail,
    ],
  );
}

async function deleteLocalTimer(kind: TimerKind): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM local_timer WHERE kind = ?', [kind]);
}

/* ───────────────────────── mağaza ───────────────────────── */

export const useLiveTimerStore = create<State>((set, get) => ({
  timers: {},
  pendingStop: null,
  pendingOpen: null,

  publish: (kind, timer) => {
    const current = get().timers[kind] ?? null;

    /*
     * Salt okuyan üyeye sayaç bildirimi **gösterilmez**.
     *
     * Bildirimin tek amacı kilit ekranından kontrol; viewer ise duraklatma ve
     * bitirme isteklerini sunucu `404` ile reddediyor (§5.5). Düğmeleri
     * göstermek, kesin reddedilecek bir eylem vaat etmek olurdu — ekranlarda
     * `useCanEdit` ile aynı gerekçe. Çalışan bir sayaç varsa onu ekranda
     * görmeye devam ediyor.
     */
    if (timer !== null && useBabyStore.getState().selected()?.myPermission === 'viewer') {
      if (current !== null) get().publish(kind, null);
      return;
    }

    if (timer === null) {
      if (current === null) return;
      set((s) => {
        const next = { ...s.timers };
        delete next[kind];
        return { timers: next };
      });
      void hideTimerNotice(kind);
      return;
    }

    // Aynı içerikse bildirimi yeniden yazmıyoruz: Android'de aynı metinle
    // yeniden sunmak satırı yeniden çizdiriyor ve gölgede göz kırpması gibi
    // görünüyor.
    if (sameNotice(current, timer)) return;

    set((s) => ({ timers: { ...s.timers, [kind]: timer } }));
    void showTimerNotice(timer);
  },

  refreshNotices: () => {
    for (const timer of Object.values(get().timers)) {
      if (timer) void showTimerNotice(timer);
    }
  },

  /**
   * Sunucudaki çalışan seansları okuyup bildirimleri eşitler.
   *
   * Hiçbir ekran monte olmasa bile doğru çalışır; uygulama ön plana
   * geldiğinde çağrılıyor. Böylece diğer ebeveyn kendi telefonundan uykuyu
   * bitirdiyse buradaki bildirim de kapanır.
   */
  refreshFromServer: async (babyId, babyName) => {
    if (babyId === null) {
      get().publish('breastfeeding', null);
      get().publish('sleep', null);
      return;
    }

    /*
     * İki uç birbirinden bağımsız; `allSettled` kullanılıyor çünkü biri
     * başarısız olduğunda (çevrimdışı) diğerinin sonucu yine uygulanmalı.
     * Hata durumunda bildirim **olduğu gibi bırakılır**: "istek başarısız"
     * ile "seans bitmiş" aynı şey değil, karıştırılırsa çalışan sayacın
     * bildirimi ağ sekmesinde kaybolurdu.
     */
    const [bf, sleep] = await Promise.allSettled([
      breastfeedingService.active(babyId),
      sleepService.list(babyId),
    ]);

    if (bf.status === 'fulfilled') {
      const session = bf.value.session;
      get().publish(
        'breastfeeding',
        session && session.status !== 'completed'
          ? breastTimerOf(session, babyId, babyName)
          : null,
      );
    }

    if (sleep.status === 'fulfilled') {
      const running = sleep.value.sleep.find((r) => r.status === 'running') ?? null;
      get().publish('sleep', running ? sleepTimerOf(running, babyId, babyName) : null);
    }
  },

  requestStop: (kind) => set({ pendingStop: kind }),

  consumePendingStop: (kind) => {
    if (get().pendingStop !== kind) return false;
    set({ pendingStop: null });
    return true;
  },

  requestOpen: (kind) => set({ pendingOpen: kind }),

  consumePendingOpen: () => {
    const kind = get().pendingOpen;
    if (kind !== null) set({ pendingOpen: null });
    return kind;
  },

  clearAll: async () => {
    set({ timers: {}, pendingStop: null, pendingOpen: null });
    await hideAllTimerNotices();
    await deleteLocalTimer('pumping').catch(() => undefined);
  },

  /* ── sağma kronometresi ── */

  hydratePumping: async () => {
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<TimerRow>(
        'SELECT * FROM local_timer WHERE kind = ?',
        ['pumping'],
      );
      if (!row) {
        get().publish('pumping', null);
        return;
      }
      get().publish('pumping', rowToTimer(row));
    } catch {
      // Şema henüz göç etmemişse sessiz geç; sayaç yokmuş gibi davranılır.
    }
  },

  startPumping: async (babyId, babyName) => {
    const now = new Date().toISOString();
    const timer: LiveTimer = {
      kind: 'pumping',
      status: 'running',
      startedAt: now,
      segmentStartedAt: now,
      baseSec: 0,
      sessionId: null,
      babyId,
      babyName,
      detail: null,
    };
    await saveLocalTimer(timer);
    get().publish('pumping', timer);
  },

  pausePumping: async () => {
    const current = get().timers.pumping;
    if (!current || current.status === 'paused') return;
    const timer: LiveTimer = {
      ...current,
      status: 'paused',
      // Duraklatmada açık segment kapanır ve biriken süreye eklenir; böylece
      // "duraklatıldı" süresi sayaca girmez.
      baseSec: elapsedSec(current),
      segmentStartedAt: null,
    };
    await saveLocalTimer(timer);
    get().publish('pumping', timer);
  },

  resumePumping: async () => {
    const current = get().timers.pumping;
    if (!current || current.status === 'running') return;
    const timer: LiveTimer = {
      ...current,
      status: 'running',
      segmentStartedAt: new Date().toISOString(),
    };
    await saveLocalTimer(timer);
    get().publish('pumping', timer);
  },

  stopPumping: async () => {
    const current = get().timers.pumping;
    if (!current) return 0;
    const total = elapsedSec(current);
    await deleteLocalTimer('pumping');
    get().publish('pumping', null);
    return total;
  },
}));
