import * as Notifications from 'expo-notifications';
// Bu üç sabit pakette `export *` zinciriyle yeniden dışa açıldığı için ad
// alanı üzerinden erişimi eslint çözemiyor; adlandırılmış import net
// (`liveTimerNotice.ts` ile aynı gerekçe).
import {
  AndroidImportance, AndroidNotificationPriority, AndroidNotificationVisibility,
} from 'expo-notifications';
import { Platform } from 'react-native';

import type { Task } from '../api/modules';
import { colors } from '../theme';
import { getPermission } from './scheduler';

/**
 * Açık görevlerin **kalıcı** bildirimi — bildirim gölgesinde ve kilit
 * ekranında duran, kaydırmayla kapanmayan satır.
 *
 * Gecikme uyarısı 5 dakikada bir *çalar* ama ses geçicidir: ebeveyn sesi
 * kaçırdıysa geriye bakacak bir iz kalmıyordu, çünkü uyarı bildirimine
 * dokunulduğunda o da kayboluyor. Kalıcı satır o izi tutar: görev tamamlanana
 * kadar telefonda görünür durur.
 *
 * ## Neden yeni bir native bağımlılık yok
 *
 * `liveTimerNotice.ts`'teki gerekçenin aynısı: `expo-notifications` Android'de
 * `sticky` (`setOngoing`) sağlıyor ve buradaki her şey **çalışma zamanında**
 * kuruluyor — `app.json`'a satır, prebuild'e tur eklemiyor, mevcut derlemeyle
 * çalışıyor.
 *
 * ## Neden ayrı ve sessiz bir kanal
 *
 * Bu bir uyarı değil, durum göstergesi. Gecikme kanalıyla (`tasks_overdue_v2`,
 * HIGH + `bildirim6.mp3`) paylaşılsaydı her tazelemede telefon çalardı —
 * kalıcı satır her eşitlemede yeniden sunuluyor.
 */

/** Android kanalı. Sessiz ve düşük önemli. */
export const TASK_LIVE_CHANNEL_ID = 'task_live';

/**
 * En fazla kaç görev satırı gösterilir.
 *
 * Açık görev sayısı pratikte bir elin parmaklarını geçmiyor; yine de sınırsız
 * bırakmak, bir kerede yirmi görev açan kullanıcıda bildirim gölgesini
 * kullanılamaz hâle getirirdi. Sınırı aşanlar satır almaz — sesli uyarıları
 * yine çalar.
 */
const MAX_NOTICES = 8;

const PREFIX = 'task-live-';
const noticeId = (taskId: number) => `${PREFIX}${taskId}`;

const TASK_EMOJI: Record<string, string> = {
  formula_prep: '🥣', breast_milk_feed: '🥛', medicine: '💊',
  care: '🧴', vaccine: '💉', custom: '📋',
};

/** Yerel saat `SS:DD`. */
function clock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const isOpen = (task: Task): boolean =>
  task.status === 'pending' || task.status === 'in_progress';

let ready: Promise<void> | null = null;

/** Kanalı kurar — bir kez. */
export function ensureTaskNoticeChannel(): Promise<void> {
  if (!ready) ready = setup();
  return ready;
}

async function setup(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(TASK_LIVE_CHANNEL_ID, {
    name: 'Açık görevler',
    description: 'Tamamlanmamış görevler için bildirimlerde duran kalıcı satır',
    /*
     * LOW: ses yok, titreşim yok, heads-up yok. Kanalın önemi oluşturulduktan
     * sonra uygulama tarafından değiştirilemediği için en baştan doğru
     * seçilmeli.
     */
    importance: AndroidImportance.LOW,
    enableVibrate: false,
    vibrationPattern: null,
    sound: null,
    showBadge: false,
    // Kilit ekranında içerik görünsün; asıl amaç bu.
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
}

/** Tek bir görevin kalıcı satırını sunar ya da yerinde günceller. */
export async function showTaskNotice(task: Task, nowMs: number = Date.now()): Promise<void> {
  if (!isOpen(task)) {
    await hideTaskNotice(task.id);
    return;
  }
  if ((await getPermission()) !== 'granted') return;
  await ensureTaskNoticeChannel();

  const dueMs = Date.parse(task.due_time);
  const late = Number.isFinite(dueMs) && dueMs < nowMs;
  const who = task.assignee ? ` · ${task.assignee.display}` : ' · atanmadı';

  await Notifications.scheduleNotificationAsync({
    // Aynı kimlikle yeniden sunmak satırı **değiştirir**, yenisini eklemez.
    identifier: noticeId(task.id),
    content: {
      title: `${TASK_EMOJI[task.task_type] ?? '📋'} ${task.title}`,
      body: `${clock(task.due_time)}${late ? ' · gecikti' : ''}${who}`,
      // `kind: 'task'` bildirime dokunulduğunda görev ekranını açıyor; `live`
      // bunu gecikme uyarısından ayırır (ön planda ses çalmasın diye).
      data: { kind: 'task', taskId: task.id, live: true },
      sound: false,
      // Android: kaydırmayla kapanmaz ve dokununca kaybolmaz. Görev hâlâ
      // açıkken satırın kaybolması, izin kaybolması demekti.
      sticky: true,
      autoDismiss: false,
      color: colors.primary,
      priority: AndroidNotificationPriority.LOW,
      // iOS: sessiz teslim, banner'sız. Bir uyarı değil, durum satırı.
      interruptionLevel: 'passive',
      ...(Platform.OS === 'android' ? { vibrate: [] } : {}),
    },
    /*
     * `trigger: null` yetmiyor: kanal belirtilmezse Android bildirimi
     * `expo_notifications_fallback_notification_channel`'a düşürüyor ve
     * yukarıdaki LOW ayarı hiç kullanılmıyor (bkz. `liveTimerNotice.ts`).
     * `ChannelAwareTriggerInput` bildirimi yine **anında** teslim eder.
     */
    trigger: Platform.OS === 'android' ? { channelId: TASK_LIVE_CHANNEL_ID } : null,
  });
}

/** Görev kapandığında ya da silindiğinde satırı kaldırır. */
export async function hideTaskNotice(taskId: number): Promise<void> {
  const id = noticeId(taskId);
  // İkisi birlikte: biri gösterilmiş satırı gölgeden alır, diğeri henüz
  // teslim edilmemiş isteği iptal eder.
  await Promise.all([
    Notifications.dismissNotificationAsync(id).catch(() => undefined),
    Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
  ]);
}

/** Gölgede duran kalıcı görev satırlarının görev kimlikleri. */
async function presentedTaskIds(): Promise<number[]> {
  const list = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  return list
    .map((n) => n.request.identifier)
    .filter((id) => typeof id === 'string' && id.startsWith(PREFIX))
    .map((id) => Number(id.slice(PREFIX.length)))
    .filter((id) => Number.isFinite(id));
}

/**
 * Açık görev listesine göre kalıcı satırları hizalar.
 *
 * Her görev tazelemesinde çağrılır (`useNotificationStore.sync`). Hangi
 * satırların durduğu **işletim sisteminden** okunur, bellekte tutulan bir
 * listeden değil: uygulama yeniden başladığında o liste boş olurdu ve
 * kapanmış görevlerin satırları gölgede sonsuza kadar kalırdı.
 */
export async function syncTaskNotices(
  tasks: Task[],
  nowMs: number = Date.now(),
): Promise<void> {
  if ((await getPermission()) !== 'granted') {
    await hideAllTaskNotices();
    return;
  }

  const open = tasks
    .filter(isOpen)
    // En yakın (ve gecikmiş) görev üstte dursun; sınır aşılırsa satırı en
    // acil olanlar almalı.
    .sort((a, b) => Date.parse(a.due_time) - Date.parse(b.due_time))
    .slice(0, MAX_NOTICES);

  const keep = new Set(open.map((t) => t.id));
  for (const taskId of await presentedTaskIds()) {
    if (!keep.has(taskId)) await hideTaskNotice(taskId);
  }

  for (const task of open) await showTaskNotice(task, nowMs);
}

/** Çıkışta, izin geri alındığında ve bebek seçimi boşaldığında: hepsi kalkar. */
export async function hideAllTaskNotices(): Promise<void> {
  for (const taskId of await presentedTaskIds()) await hideTaskNotice(taskId);
}
