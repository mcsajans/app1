import { useAdSettingsStore } from '../ads/useAdSettingsStore';
import { useBrandingStore } from '../branding/useBrandingStore';
import { useInboxStore } from '../notifications/useInboxStore';
import { useNotificationStore } from '../notifications/useNotificationStore';
import { useModuleStore } from '../modules/useModuleStore';
import { useBabyStore } from '../stores/useBabyStore';

export type RefreshScope = { includePrivate: boolean };

/**
 * Sunucudan tazeleme — aynı anda yalnızca bir tane çalışır.
 *
 * İki sebeple şart:
 *  1. Her görev SQLite'a `withExclusiveTransactionAsync` ile yazıyor; iki
 *     tazeleme çakışırsa ikincisi "database is locked" ile düşer.
 *  2. Açılış efekti ile "ön plana gelme" tetikleyicisi aynı anda ateşleyebilir.
 *
 * Çalışan bir tazeleme varken gelen istek **sıraya alınır** (katılmaz):
 * aksi halde yalnızca logo çeken dar kapsamlı bir tazelemeye katılan geniş
 * kapsamlı istek, özel verisi hiç çekilmeden "bitti" sanırdı. En fazla bir
 * istek sırada bekler ve kapsamlar birleştirilir.
 */
let running: Promise<void> | null = null;
let queued: RefreshScope | null = null;

async function run(scope: RefreshScope): Promise<void> {
  const tasks: { name: string; go: () => Promise<void> }[] = [
    { name: 'branding', go: () => useBrandingStore.getState().refresh() },
    // Reklam ayarları da sistem geneli ve oturumdan bağımsız; logolarla aynı
    // dar kapsamda tazelenir ki panelden yapılan değişiklik uygulamaya
    // en geç bir sonraki ön plana gelişte ulaşsın.
    { name: 'ads', go: () => useAdSettingsStore.getState().refresh() },
  ];

  // Oturum gerektiren uçlar yalnızca giriş yapılmışken çağrılır.
  if (scope.includePrivate) {
    tasks.push(
      { name: 'babies', go: () => useBabyStore.getState().sync() },
      { name: 'modules', go: () => useModuleStore.getState().refresh() },
      // Bildirimler bebekler tazelendikten SONRA planlanır: seçili bebek
      // değişmişse önceki bebeğin hatırlatıcıları planlanmış olurdu.
      // SQLite'a dokunmadığı için sıraya girmesi sakıncasız.
      {
        name: 'reminders',
        go: () => useNotificationStore.getState().sync(useBabyStore.getState().selected()?.id ?? null),
      },
      /*
       * Zil rozeti. Yalnızca SAYI çekilir, liste değil: liste çekmece
       * açılınca yükleniyor ve her tazelemede 50 satır indirmek, ön plana her
       * gelişte gereksiz bir istek olurdu.
       */
      { name: 'inbox', go: () => useInboxStore.getState().refreshBadge() },
    );
  }

  // SIRAYLA: tek SQLite bağlantısında eşzamanlı yazma güvenli değil.
  for (const task of tasks) {
    try {
      await task.go();
    } catch (err) {
      // Ağ yoksa önbellekle devam edilir; hata yutulmaz, görünür kalır.
      console.warn(`[bebiqa] ${task.name} tazelenemedi:`, err);
    }
  }
}

export function refreshAll(scope: RefreshScope): Promise<void> {
  if (running) {
    queued = { includePrivate: (queued?.includePrivate ?? false) || scope.includePrivate };
    return running;
  }

  running = run(scope).finally(() => {
    running = null;
    const next = queued;
    queued = null;
    if (next) void refreshAll(next);
  });

  return running;
}
