import type { Task } from '../api/modules';
import { playAlert, stopAlert } from './alertSound';
import { OVERDUE_INTERVAL_MS, OVERDUE_MAX_MS } from './soundCatalog';
import { nextTickDelayMs, shouldNagOverdue } from './tickPlan';

/**
 * Gecikmiş görev uyarı döngüsü
 * (`modules_doc/notification-voice.md` §2.1, §2.2.3).
 *
 * Şartname: görev saati geçtiği hâlde tamamlanmadıysa `bildirim6.mp3`
 * **her 5 dakikada bir** çalmalı ve görev "Tamamlandı" ya da "İptal"
 * edilene — veya 24 saatlik güvenlik zaman aşımı dolana — kadar sürmeli.
 *
 * ## Neden uygulama içinde
 *
 * Döngüyü işletim sistemine devretmek 24 saat × 12 = **288 bekleyen
 * bildirim** demek. iOS bekleyen bildirimleri 64'te kesip fazlasını sessizce
 * atıyor; tek bir gecikmiş görev tüm hatırlatıcıları, aşıları ve diğer
 * görevleri plandan dışarı iterdi (`scheduler.ts` → `MAX_SCHEDULED`). Bu
 * yüzden işletim sistemi tarafında **sınırlı bir merdiven** planlanıyor
 * (`taskAlarms.ts`) ve 5 dakikalık döngünün tamamı uygulama ayaktayken
 * burada çalışıyor.
 *
 * Sonuç, şartnameden şu noktada ayrılıyor ve bu bilinçli: telefon kilitliyken
 * ve uygulama kapalıyken 5 dakikada bir ses **çalmıyor**; onun yerine
 * gecikme bildirimleri azalan sıklıkta geliyor. Uygulama açıldığında döngü
 * kaldığı yerden devam ediyor (bkz. NOTLAR-ve-EKSIKLER.md).
 */

type Loop = {
  taskId: number;
  /** Görevin kendi zamanı — zaman aşımı buradan sayılır. */
  dueMs: number;
  timer: ReturnType<typeof setTimeout>;
};

const loops = new Map<number, Loop>();

/** Görev kapalı mı — kapalı görevin uyarısı olmaz. */
const isClosed = (task: Task): boolean =>
  task.status === 'completed' || task.status === 'cancelled';

function stopLoop(taskId: number): void {
  const loop = loops.get(taskId);
  if (!loop) return;
  clearTimeout(loop.timer);
  loops.delete(taskId);
}

/**
 * Döngüyü tek bir görev için kurar ya da kaldırır.
 *
 * `now` dışarıdan verilebiliyor: döngü mantığı saf kalsın ve testte sahte
 * zamanla sürülebilsin diye.
 */
function arm(task: Task, nowMs: number): void {
  const dueMs = Date.parse(task.due_time);
  if (!Number.isFinite(dueMs)) return;

  // Henüz gecikmemiş, kapanmış ya da 24 saati geçmiş: döngü yok.
  if (!shouldNagOverdue({ dueMs, nowMs, closed: isClosed(task), maxMs: OVERDUE_MAX_MS })) {
    stopLoop(task.id);
    stopAlert('taskOverdue');
    return;
  }

  // Aynı görev için döngü zaten kuruluysa dokunulmaz; yoksa her görev
  // tazelemesi 5 dakikalık aralığı baştan başlatır ve uyarı hiç çalmazdı.
  const existing = loops.get(task.id);
  if (existing && existing.dueMs === dueMs) return;
  stopLoop(task.id);

  /*
   * İlk uyarı, gecikmenin **bir sonraki 5 dakikalık katında** çalar: görev 12
   * dakika gecikmişse 15. dakikada. Hemen çalmak, uygulamayı her açışta
   * ses demek olurdu.
   */
  const delay = nextTickDelayMs(nowMs - dueMs, OVERDUE_INTERVAL_MS);

  const timer = setTimeout(() => {
    loops.delete(task.id);

    // Zaman aşımı sınırı her turda yeniden denetlenir; uygulama saatlerce
    // açık kalabilir.
    if (Date.now() - dueMs >= OVERDUE_MAX_MS) return;

    playAlert('taskOverdue');
    arm(task, Date.now());
  }, delay);

  loops.set(task.id, { taskId: task.id, dueMs, timer });
}

/**
 * Açık görev listesine göre döngüleri hizalar.
 *
 * Her görev tazelemesinde çağrılır (`useNotificationStore.sync`). Listede
 * olmayan görevler — silinmiş, tamamlanmış ya da başka bebeğe ait —
 * döngüden düşer.
 */
export function syncOverdueLoops(tasks: Task[], nowMs: number = Date.now()): void {
  const seen = new Set<number>();

  for (const task of tasks) {
    seen.add(task.id);
    arm(task, nowMs);
  }

  for (const taskId of [...loops.keys()]) {
    if (!seen.has(taskId)) stopLoop(taskId);
  }
}

/**
 * Tek bir görev kapandığında çağrılır — "Tamamlandı"ya basıldığı an.
 *
 * Tam listeyi beklemek yanlış olurdu: kullanıcı görevi kapattıktan sonra bir
 * sonraki tazelemeye kadar (ön plana geliş) ses çalmaya devam ederdi.
 */
export function cancelOverdueLoop(taskId: number): void {
  stopLoop(taskId);
  stopAlert('taskOverdue');
}

/** Oturum kapanışında: bütün döngüler kalkar. */
export function clearOverdueLoops(): void {
  for (const taskId of [...loops.keys()]) stopLoop(taskId);
  stopAlert('taskOverdue');
}

/** Test ve tanılama: hangi görevler için döngü bekliyor. */
export const pendingOverdue = (): number[] => [...loops.keys()];
