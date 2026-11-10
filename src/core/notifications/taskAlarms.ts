import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { taskService, type Task } from '../api/modules';
import { removeMine, upsertEvent } from '../calendar/deviceCalendar';
import { getDeviceId } from '../device/deviceId';
import { alarmSlots, offsetLabel } from './alarmPlan';
import { ALERTS } from './soundCatalog';
import {
  TASK_CHANNEL_ID, TASK_OVERDUE_CHANNEL_ID, cancelTaskAlarms, ensureChannel, getPermission,
  overdueSlots, scheduleOverdueRepeat, taskOverdueContent,
} from './scheduler';
import { hideTaskNotice, showTaskNotice } from './taskNotice';
import { cancelOverdueLoop } from './taskOverdue';

/**
 * Bir görevin alarmlarının yaşam döngüsü (modules_doc/bildirimler.md).
 *
 * İki ayrı kanal kullanılır ve **ikisi de** kurulur:
 *
 *  - **Yerel bildirim** — uygulama kurulu olduğu sürece çalışır, sessiz saat
 *    ve kanal ayarlarına tabidir.
 *  - **Takvim etkinliği** — uygulama hiç açılmasa, hatta silinse bile durur.
 *
 * Hangisinin elde kalacağını garanti edemeyiz (bildirim izni geri alınabilir,
 * takvim izni verilmemiş olabilir), bu yüzden ikisi birden kurulur. Bedeli,
 * her ikisi de açıkken kullanıcının aynı uyarıyı iki kez almasıdır; bunu
 * `enable_device_alarm` ile kapatabiliyor.
 */

/*
 * Bildirim başlığındaki simgeler **emoji** kalır.
 *
 * Uygulamanın geri kalanı vektör ikon setine geçti (components/Icon.tsx), ama
 * bildirim metni işletim sistemine düz metin olarak gider: orada bir bileşen
 * çizdiremeyiz. Emoji, bildirim gölgesinde türü bir bakışta ayırt etmenin tek
 * yolu — kanal ikonu hepsinde aynı.
 */
const TASK_EMOJI: Record<string, string> = {
  formula_prep: '🥣', breast_milk_feed: '🥛', medicine: '💊',
  care: '🧴', custom: '📋',
};

/** Görev kapalı mı — kapalı görevin alarmı olmaz. */
function isClosed(task: Task): boolean {
  return task.status === 'completed' || task.status === 'cancelled';
}

/**
 * Tek bir görevin yerel bildirimlerini yeniden planlar.
 *
 * Tam eşitleme (`syncReminders`) yerine tek görev hedeflenir: kullanıcı
 * "Kaydet"e bastığı anda diğer tüm alarmların yeniden yazılması gereksiz bir
 * gecikme olurdu. Bütçe kırpması bir sonraki tam eşitlemede uygulanır.
 */
async function scheduleLocal(task: Task): Promise<number> {
  await cancelTaskAlarms(task.id);
  if (isClosed(task)) return 0;
  if ((await getPermission()) !== 'granted') return 0;

  await ensureChannel();
  const slots = alarmSlots(task.due_time, task.notification_offsets);
  const who = task.assignee ? ` · ${task.assignee.display}` : '';

  for (const slot of slots) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${TASK_EMOJI[task.task_type] ?? '📋'} ${task.title}`,
        body: `${offsetLabel(slot.offsetMin)}${who}`,
        data: { kind: 'task', taskId: task.id, offsetMin: slot.offsetMin },
        // Özel ses dosya **adıyla** verilir (soundCatalog.ts); `'default'`
        // yazmak Android'de "o adda ses dosyası yok" hatası üretiyordu.
        sound: ALERTS.taskDue.file,
        ...(Platform.OS === 'android' ? { vibrate: [0, 250, 250, 250] } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: slot.at,
        channelId: TASK_CHANNEL_ID,
      },
    });
  }

  return slots.length + (await scheduleOverdueNag(task));
}

/**
 * Gecikme uyarılarının **işletim sistemi** tarafı
 * (`notification-voice.md` §2.1, §2.2.3).
 *
 * Şartname: görev saati geçtiği hâlde tamamlanmadıysa uyarı **5 dakikada
 * bir**, görev kapanana kadar. İki ayrı araç kullanılır:
 *
 *  - **Görev zaten gecikmişse** süresiz tekrar eden tek bir tetikleyici
 *    kurulur (`scheduleOverdueRepeat`). İşletim sistemi uygulamadan bağımsız
 *    tekrarladığı için telefon kilitliyken ve uygulama kapalıyken de çalar —
 *    ve bütçeden yalnızca **bir** yer alır.
 *  - **Görev henüz gecikmemişse** tekrar eden tetikleyici kurulamaz: ancak
 *    kurulduğu andan itibaren sayar, görev saatini bekleyemez. Onun yerine
 *    tarihli bir merdiven planlanır (`overdueSlots`) — ilk yarım saat
 *    gerçekten 5 dakikada bir, sonrası uygulama hiç açılmazsa diye seyrelen
 *    bir emniyet ağı. Uygulama bir kez açıldığında merdiven iptal edilip
 *    yerine tekrar eden tetikleyici geçer.
 *
 * Her uyarı ayrı bir kanaldan (`TASK_OVERDUE_CHANNEL_ID`) ve `bildirim6.mp3`
 * ile gelir; görev saatinin kendi sesinden (`bildirim5.mp3`) ayırt edilebilir
 * olması şartnamenin isteği.
 */
async function scheduleOverdueNag(task: Task, nowMs: number = Date.now()): Promise<number> {
  const dueMs = Date.parse(task.due_time);
  if (!Number.isFinite(dueMs)) return 0;

  if (dueMs <= nowMs) return (await scheduleOverdueRepeat(task)) ? 1 : 0;

  let count = 0;
  for (const slot of overdueSlots(task, nowMs)) {
    await Notifications.scheduleNotificationAsync({
      content: taskOverdueContent(task, slot.overdueMin),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: slot.at,
        channelId: TASK_OVERDUE_CHANNEL_ID,
      },
    });
    count += 1;
  }

  return count;
}

/** Bu cihazın bu göreve yazdığı takvim kaydı. */
async function myAlarm(task: Task) {
  const me = await getDeviceId();
  return task.device_alarm_ids.find((a) => a.device_uuid === me) ?? null;
}

/**
 * Görev oluşturulduktan ya da güncellendikten sonra çağrılır.
 *
 * Takvim kimliği değiştiyse sunucuya yazılır — ama bu yazma **sessizce
 * başarısız olabilir**: alarm kurmak kaydın kendisinden daha az önemli ve
 * ağ hatası yüzünden kullanıcıya "görev kaydedilemedi" demek yanlış olurdu.
 * Kimlik kaybolursa en kötü ihtimalle takvimde sahipsiz bir etkinlik kalır.
 */
export async function onTaskSaved(task: Task): Promise<void> {
  await scheduleLocal(task);
  // Kalıcı satır alarmdan bağımsız: görev açık kaldığı sürece gölgede durur.
  await showTaskNotice(task);

  const previous = await myAlarm(task);

  if (isClosed(task) || !task.enable_device_alarm) {
    if (previous) {
      const kept = await removeMine(task.device_alarm_ids);
      await taskService.update(task.id, { device_alarm_ids: kept }).catch(() => undefined);
    }
    return;
  }

  const created = await upsertEvent({
    title: task.title,
    notes: task.note,
    startAt: new Date(task.due_time),
    offsets: task.notification_offsets,
    previous,
  });
  if (!created) return;

  const others = task.device_alarm_ids.filter((a) => a.device_uuid !== created.device_uuid);
  await taskService
    .update(task.id, { device_alarm_ids: [...others, created] })
    .catch(() => undefined);
}

/**
 * Görev tamamlandığında, iptal edildiğinde ya da silindiğinde çağrılır.
 *
 * `persist` yalnızca görev hâlâ varken anlamlı: silinen bir görevin
 * `device_alarm_ids` alanını güncellemeye çalışmak 404 döndürürdü.
 */
export async function onTaskClosed(task: Task, persist = true): Promise<void> {
  await cancelTaskAlarms(task.id);
  await hideTaskNotice(task.id);
  /*
   * Uygulama içi gecikme döngüsü de **hemen** durur. Bir sonraki tam
   * eşitlemeyi beklemek, kullanıcı "Tamamlandı"ya bastıktan sonra ön plana
   * geri dönene kadar 5 dakikada bir ses çalmaya devam etmek demekti.
   */
  cancelOverdueLoop(task.id);
  if (task.device_alarm_ids.length === 0) return;

  const kept = await removeMine(task.device_alarm_ids);
  if (!persist) return;
  await taskService.update(task.id, { device_alarm_ids: kept }).catch(() => undefined);
}
