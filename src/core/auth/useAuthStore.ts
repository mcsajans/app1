import { Platform } from 'react-native';
import { create } from 'zustand';

import { APP_VERSION } from '../config';
import { api, ApiError } from '../api/client';
import { endpoints } from '../api/endpoints';
import { setSessionHooks } from '../api/session';
import { clearLocalMirror } from '../db';
import { stopAllAlerts } from '../notifications/alertSound';
import { hideAllTaskNotices } from '../notifications/taskNotice';
import { clearOverdueLoops } from '../notifications/taskOverdue';
import { stopMusic } from '../music/useMusicStore';
import { useLiveTimerStore } from '../timers/useLiveTimerStore';
import type { Relationship } from '../api/modules';
import { clearRefreshToken, readRefreshToken, saveRefreshToken } from './tokenStore';

export type AuthUser = {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_path: string | null;
  locale: string;
  /**
   * Kayıtta seçilen yakınlık. `migrations/014` öncesi sunucular bu alanı
   * döndürmüyor, bu yüzden opsiyonel — eski bir sunucuya bağlanan istemci
   * çökmemeli.
   */
  relationship?: Relationship;
  relationship_label?: string;
  is_admin: boolean;
};

type TokenPair = { access_token: string; refresh_token: string };
type AuthPayload = TokenPair & { user: AuthUser };

export type AuthStatus = 'checking' | 'signedOut' | 'signedIn';

type AuthStore = {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  /** Oturum süresi dolduğunda giriş ekranında gösterilecek bilgi. */
  notice: string | null;

  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (
    fullName: string,
    email: string,
    password: string,
    relationship: Relationship,
  ) => Promise<void>;
  logout: () => Promise<void>;
  clearNotice: () => void;
};

/** Sunucuya hangi cihazdan gelindiğini bildirir (oturum listesi için). */
const device = () => ({
  name: Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : 'Web',
  platform: Platform.OS,
  app_version: APP_VERSION,
});

/**
 * Eşzamanlı refresh'leri tekilleştirir. Token rotation'da aynı refresh
 * token'ı iki kez göndermek sunucuda "çalınmış token" sayılır ve kullanıcının
 * **tüm** oturumlarını iptal eder (§5.6) — bu yüzden tek uçuş şart.
 *
 * Tekilleştirme `rotate()` içindedir, çağıranlarda değil: açılışta `restore()`
 * ile 401 yakalayan istemci ara katmanı aynı anda yenileme isteyebiliyor ve
 * ikisi ayrı yollardan gittiğinde aynı token iki kez gidiyordu. Sonuç,
 * kullanıcının hiçbir şey yapmadan oturumunun kapanmasıydı.
 */
let refreshInFlight: Promise<AuthPayload | null> | null = null;

/**
 * Saklanan refresh token'ı yeni bir çiftle değiştirir ve yenisini saklar.
 * `null` döner: saklanmış token yok. Hata fırlatır: çağıran karar verir —
 * açılışta kimlik reddi çıkış demektir, istek ortasında yalnızca o istek
 * başarısızdır.
 */
function rotate(): Promise<AuthPayload | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const stored = await readRefreshToken();
    if (!stored) return null;
    const data = await api.post<AuthPayload>(
      endpoints.auth.refresh,
      { refresh_token: stored },
      { auth: false },
    );
    await saveRefreshToken(data.refresh_token);
    return data;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  status: 'checking',
  user: null,
  accessToken: null,
  notice: null,

  restore: async () => {
    try {
      const data = await rotate();
      if (!data) {
        set({ status: 'signedOut', user: null, accessToken: null });
        return;
      }
      set({ status: 'signedIn', user: data.user, accessToken: data.access_token });
    } catch (err) {
      // Ağ hatasında oturumu silmeyiz; yalnızca kimlik reddinde çıkış yapılır.
      const authFailed =
        err instanceof ApiError &&
        (err.code === 'UNAUTHENTICATED' || err.code === 'TOKEN_EXPIRED' || err.code === 'FORBIDDEN');

      if (authFailed) {
        await clearRefreshToken();
        await clearLocalMirror();
        set({
          status: 'signedOut',
          user: null,
          accessToken: null,
          notice: err instanceof ApiError ? err.message : null,
        });
      } else {
        set({ status: 'signedOut', user: null, accessToken: null });
      }
    }
  },

  login: async (email, password) => {
    const data = await api.post<AuthPayload>(
      endpoints.auth.login,
      { email: email.trim().toLowerCase(), password, device: device() },
      { auth: false },
    );
    // Önceki hesabın aynası kalmasın (§5.7).
    await clearLocalMirror();
    await saveRefreshToken(data.refresh_token);
    set({ status: 'signedIn', user: data.user, accessToken: data.access_token, notice: null });
  },

  register: async (fullName, email, password, relationship) => {
    const data = await api.post<AuthPayload>(
      endpoints.auth.register,
      {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        // Kullanıcının varsayılan yakınlığı; ilk bebeğini oluştururken
        // üyeliğine yazılır (sunucu: migrations/014).
        relationship,
        device: device(),
      },
      { auth: false },
    );
    await clearLocalMirror();
    await saveRefreshToken(data.refresh_token);
    set({ status: 'signedIn', user: data.user, accessToken: data.access_token, notice: null });
  },

  logout: async () => {
    const refresh = await readRefreshToken();
    try {
      await api.post(endpoints.auth.logout, { refresh_token: refresh ?? undefined });
    } catch {
      // Sunucuya ulaşılamasa da yerelde çıkış yapılır.
    }
    await clearRefreshToken();
    /*
     * Çalışan sayaçların bildirimi önce kaldırılır: bunlar işletim sistemi
     * gölgesinde yaşıyor ve yerel ayna silinse de orada kalırdı. Çıkış yapmış
     * bir kullanıcının kilit ekranında "Emzirme sürüyor" yazması, hem artık
     * yapılamayacak bir işlem vaat eder hem de bir sonraki kullanıcıya
     * öncekinin verisini gösterirdi.
     */
    await useLiveTimerStore.getState().clearAll().catch(() => undefined);
    /*
     * Çalan uyarı sesi ve bekleyen gecikme turları da susturulur
     * (`notification-voice.md` §2.2.1). Sayaç bildirimleriyle aynı gerekçe:
     * ses işletim sisteminin değil uygulamanın elinde ve çıkış yapmış bir
     * hesabın görevi için telefonun çalmaya devam etmesi kabul edilemez.
     */
    stopAllAlerts();
    clearOverdueLoops();
    // Kalıcı görev satırları da kalkar: çıkmış bir hesabın görevi telefonun
    // bildirimlerinde durmaya devam edemez.
    await hideAllTaskNotices().catch(() => undefined);
    /*
     * Ninni de susturulur. Çalma oturumu bilinçli olarak ekranlardan
     * bağımsız yaşıyor (`useMusicStore`), yani çıkış yapmak onu kendiliğinden
     * durdurmaz: çıkan kullanıcının telefonunda müziğin çalmaya devam etmesi
     * ve kilit ekranında başka bir hesabın parçasının görünmesi kabul edilemez.
     */
    stopMusic();
    await clearLocalMirror();
    refreshInFlight = null;
    set({ status: 'signedOut', user: null, accessToken: null, notice: null });
  },

  clearNotice: () => set({ notice: null }),
}));

/**
 * client.ts'in oturumla konuştuğu kancalar. Modül yüklenirken bir kez kurulur.
 */
setSessionHooks({
  getAccessToken: () => useAuthStore.getState().accessToken,

  refresh: async () => {
    try {
      const data = await rotate();
      if (!data) return null;
      useAuthStore.setState({ user: data.user, accessToken: data.access_token });
      return data.access_token;
    } catch {
      // İstek ortasındaki başarısızlık oturumu kapatmaz; 401'i çağıran görür.
      return null;
    }
  },

  onSessionExpired: () => {
    void (async () => {
      await clearRefreshToken();
      await clearLocalMirror();
      useAuthStore.setState({
        status: 'signedOut',
        user: null,
        accessToken: null,
        notice: 'Oturumun sona erdi, tekrar giriş yap.',
      });
    })();
  },
});
