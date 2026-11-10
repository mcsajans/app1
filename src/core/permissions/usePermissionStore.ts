import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import {
  getCalendarPermission, requestCalendarPermission,
} from '../calendar/deviceCalendar';
import { getPermission, requestPermission } from '../notifications/scheduler';
import type { IconName } from '../../components/Icon';

/**
 * Kurulumdan sonra bir kez çalışan izin karşılaması.
 *
 * Android 13'ten beri bildirim izni **istenmeden** verilmiyor; takvim ve
 * galeri de aynı şekilde. İzinleri kullanıldıkları ana bırakmak teoride daha
 * kibar ama pratikte ebeveyn ilk hatırlatıcısını kurduğunda sessizce hiçbir
 * alarm almıyor ve bunu günler sonra fark ediyordu.
 *
 * Bu yüzden izinler **girişten hemen sonra, hepsi birden ve gerekçesiyle**
 * isteniyor. İstemler yine işletim sisteminin kendi diyaloglarıdır; biz
 * yalnızca öncesinde neden gerektiğini yazıyoruz.
 */

export type PermissionKey = 'notifications' | 'exactAlarm' | 'calendar' | 'photos';
export type PermissionState = 'granted' | 'denied' | 'undetermined';

export type PermissionInfo = {
  key: PermissionKey;
  title: string;
  /** Neden istendiği — istemden ÖNCE gösterilir. */
  reason: string;
  /** Verilmezse ne kaybedilir; reddetmek uygulamayı kullanılmaz yapmıyor. */
  ifDenied: string;
  /** `components/Icon.tsx` sözlüğündeki semantik ad. */
  icon: IconName;
};

export const PERMISSIONS: PermissionInfo[] = [
  {
    key: 'notifications',
    title: 'Bildirimler',
    reason: 'Hatırlatıcılar ve görevler zamanı gelince haber versin.',
    ifDenied: 'Alarmlar kurulur ama hiç çalmaz.',
    icon: 'bell',
  },
  /*
   * Android 12'den (API 31) beri **kesin** alarm ayrı bir izin.
   *
   * Verilmezse `expo-notifications` alarmı `setExactAndAllowWhileIdle` ile
   * kuruyor ama sistem onu bir pencereye yayıyor: emülatörde ölçüldü, 5
   * dakikalık gecikmiş görev uyarısı `window=+3m44s` ile planlanıyordu —
   * yani "18:00 hatırlatıcısı" 18:04'te çalabiliyordu. Hatırlatıcı ve görev
   * saatinin anlamı buna bağlı olduğu için izin isteniyor.
   *
   * Android 14'ten (API 34) itibaren yeni kurulumlarda **varsayılan olarak
   * kapalı** geliyor; altındaki sürümlerde açık başlıyor ve istem anında
   * dönüyor.
   */
  {
    key: 'exactAlarm',
    title: 'Alarm ve hatırlatıcılar',
    reason: 'Hatırlatıcı ve görev uyarıları tam seçtiğin dakikada çalsın.',
    ifDenied: 'Uyarılar gelir ama birkaç dakika gecikebilir.',
    icon: 'alarm',
  },
  {
    key: 'calendar',
    title: 'Takvim',
    reason: 'Görevleri telefonun takvimine de yazalım; uygulama kapalıyken de uyarsın.',
    ifDenied: 'Uyarılar yalnızca uygulama kuruluyken çalışır.',
    icon: 'calendar',
  },
  {
    key: 'photos',
    title: 'Fotoğraflar',
    reason: 'Bebeğin profil fotoğrafını seçebilmen için.',
    ifDenied: 'Profil fotoğrafı eklenemez; geri kalan her şey çalışır.',
    icon: 'photos',
  },
];

function readImageStatus(res: ImagePicker.PermissionResponse): PermissionState {
  if (res.granted) return 'granted';
  return res.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Kesin alarm izni — yalnızca Android.
 *
 * iOS ve web'de paket her zaman `granted` döndürüyor; orada böyle bir kavram
 * yok ve ekranda "verilmedi" göstermek kullanıcıyı boşuna telaşlandırırdı.
 */
async function readExactAlarm(): Promise<PermissionState> {
  try {
    const res = await Notifications.getExactAlarmPermissionsAsync();
    if (res.granted) return 'granted';
    // `canAskAgain: false` burada "izin manifestte yok" demek: istem açılamaz.
    return res.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'denied';
  }
}

/**
 * Kesin alarm izni bir diyalogla değil, **sistem ayar ekranıyla** isteniyor;
 * paket kullanıcı geri dönünce sözü çözüyor.
 *
 * İki tuzak var ve ikisi de yutuluyor:
 *  - İzin `app.json`'da tanımlı değilse çağrı **reddediyor**. Tanım
 *    eklendikten sonra `expo prebuild` + yeniden derleme şart; eski derlemede
 *    bu dalın hata vermesi beklenen durumdur.
 *  - Kullanıcı ayar ekranında izni **geri alırsa** Android uygulamayı yeniden
 *    başlatıyor ve söz hiç çözülmüyor. Bir sonraki açılışta `readExactAlarm`
 *    doğru durumu okuyor.
 */
async function askExactAlarm(): Promise<PermissionState> {
  try {
    const res = await Notifications.requestExactAlarmPermissionsAsync();
    return res.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

async function readOne(key: PermissionKey): Promise<PermissionState> {
  if (key === 'notifications') return getPermission();
  if (key === 'exactAlarm') return readExactAlarm();
  if (key === 'calendar') return getCalendarPermission();
  try {
    return readImageStatus(await ImagePicker.getMediaLibraryPermissionsAsync());
  } catch {
    return 'denied';
  }
}

async function askOne(key: PermissionKey): Promise<PermissionState> {
  if (key === 'notifications') return requestPermission();
  if (key === 'exactAlarm') return askExactAlarm();
  if (key === 'calendar') return requestCalendarPermission();
  try {
    return readImageStatus(await ImagePicker.requestMediaLibraryPermissionsAsync());
  } catch {
    return 'denied';
  }
}

type Statuses = Record<PermissionKey, PermissionState>;

const UNKNOWN: Statuses = {
  notifications: 'undetermined',
  exactAlarm: 'undetermined',
  calendar: 'undetermined',
  photos: 'undetermined',
};

/**
 * Karşılama sayfasının gösterildiğini işaretleyen kalıcı bayrak.
 *
 * Yalnızca "hiç sorulmamış izin var mı" bakmak yetmiyor: kullanıcı "Şimdi
 * değil" derse izinler sorulmamış kalır ve sayfa her açılışta geri gelirdi.
 */
const SEEN_KEY = 'bebiqa.permissions_seen';

async function readSeen(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(SEEN_KEY)) === '1';
  } catch {
    // Okunamıyorsa sayfayı göstermek, hiç göstermemekten iyidir.
    return false;
  }
}

async function markSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(SEEN_KEY, '1');
  } catch {
    // Yazılamazsa sayfa bir kez daha çıkar; zararsız.
  }
}

type Store = {
  statuses: Statuses;
  /** İstemler sürüyor mu — ekranda düğmeleri kilitlemek için. */
  asking: boolean;
  refresh: () => Promise<Statuses>;
  /** Sırayla hepsini ister; zaten verilmiş olanlar atlanır. */
  askAll: () => Promise<Statuses>;
  ask: (key: PermissionKey) => Promise<PermissionState>;
  /** Hâlâ hiç sorulmamış bir izin var mı? */
  hasPending: () => boolean;
  /**
   * Karşılama sayfası bu açılışta gösterilmeli mi? Durumları da tazeler.
   * Yalnızca ilk kez (bayrak yokken) ve sorulacak bir şey varken `true`.
   */
  shouldWelcome: () => Promise<boolean>;
  /** Sayfa kapatıldı — bir daha kendiliğinden açılmaz. */
  dismissWelcome: () => Promise<void>;
};

export const usePermissionStore = create<Store>((set, get) => ({
  statuses: { ...UNKNOWN },
  asking: false,

  refresh: async () => {
    const entries = await Promise.all(
      PERMISSIONS.map(async (p) => [p.key, await readOne(p.key)] as const),
    );
    const statuses = Object.fromEntries(entries) as Statuses;
    set({ statuses });
    return statuses;
  },

  ask: async (key) => {
    const state = await askOne(key);
    set((prev) => ({ statuses: { ...prev.statuses, [key]: state } }));
    return state;
  },

  askAll: async () => {
    set({ asking: true });
    try {
      // Sırayla: iki sistem diyaloğunu aynı anda açmak Android'de ikincisini
      // sessizce düşürüyor.
      for (const p of PERMISSIONS) {
        const current = get().statuses[p.key];
        if (current === 'granted' || current === 'denied') continue;
        await get().ask(p.key);
      }
      return get().statuses;
    } finally {
      set({ asking: false });
    }
  },

  hasPending: () => PERMISSIONS.some((p) => get().statuses[p.key] === 'undetermined'),

  shouldWelcome: async () => {
    if (await readSeen()) return false;
    await get().refresh();
    return get().hasPending();
  },

  dismissWelcome: markSeen,
}));
