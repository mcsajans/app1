import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { create } from 'zustand';

import { audioSource } from '../api/assets';
import { trackSource, type Track } from '../api/modules';
import { hideMusicNotice } from './musicNotice';

/**
 * Ninni çaları — **ekranlardan bağımsız** tek oturum (Modül 7).
 *
 * ## Neden mağazada, ekranda değil
 *
 * Çalar önce `MusicScreen` içinde `useAudioPlayer` ile kuruluyordu. O kanca
 * nesneyi **bileşen söküldüğünde serbest bırakıyor**
 * (`useReleasingSharedObject`), dolayısıyla ebeveyn ninniyi başlatıp ana
 * sayfaya döndüğü anda çalar yok ediliyor ve ses kesiliyordu — logda
 * `ExoPlayerImpl: Release` olarak görüldü. Oysa uyutma müziğinin tek işi,
 * ebeveyn telefonu bırakıp bebeğin yanından ayrıldıktan sonra çalmaya devam
 * etmek.
 *
 * Bu yüzden çalar `createAudioPlayer` ile **elle** yönetiliyor: hiçbir
 * bileşenin ömrüne bağlı değil, yalnızca `stop()` ya da oturum kapanışı onu
 * yok ediyor.
 *
 * ## Arka planda çalmanın üç koşulu
 *
 * Üçü birden gerekiyor; biri eksikse ses ya hiç başlamıyor ya da kısa süre
 * sonra kesiliyor:
 *
 *  1. `shouldPlayInBackground: true` — uygulama arka plana geçince
 *     duraklatılmasın.
 *  2. `interruptionMode: 'doNotMixPersistent'` — **kalıcı** ses odağı. Uyutma
 *     müziği uzun bir oturum; `doNotMix` geçici odak istiyor ve sistem onu
 *     geri alabiliyor. Kilit ekranı denetimleri de yalnızca bu iki kipte
 *     çalışıyor.
 *  3. `setActiveForLockScreen(true, …)` — Expo belgesi bunu açıkça şart
 *     koşuyor: kilit ekranı denetimleri kurulmazsa Android'de ses yaklaşık
 *     **3 dakika** sonra kesiliyor. Bildirim çubuğundaki duraklat/devam
 *     düğmeleri de buradan geliyor.
 *
 * ## Durum neden kopyalanıyor
 *
 * `useAudioPlayerStatus` bir çalar nesnesi istiyor; çalar yokken (hiçbir şey
 * çalmıyorken) kancaya verecek bir şey yok. Bu yüzden durum
 * `playbackStatusUpdate` olayından mağazaya yansıtılıyor: ekran çalar var da
 * yok da olsa aynı alanları okuyor ve hangi ekranda olunduğundan bağımsız
 * doğru çiziliyor.
 */

/** Fade-out süresi: sesin aniden kesilmesi bebeği uyandırabilir. */
export const FADE_MS = 8000;
const FADE_STEP_MS = 200;

/** Ekranın çizim için okuduğu alanlar. */
export type MusicStatus = {
  playing: boolean;
  isLoaded: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
};

const IDLE: MusicStatus = {
  playing: false,
  isLoaded: false,
  isBuffering: false,
  currentTime: 0,
  duration: 0,
  error: null,
};

type State = {
  current: Track | null;
  status: MusicStatus;
  loop: boolean;
  /** Uyku zamanlayıcısı, dakika; 0 kapalı. */
  timerMin: number;
  /** Zamanlayıcı dolup ses kısılmaya başladı mı — ekranda gösterilir. */
  fading: boolean;

  play: (track: Track) => void;
  /** Çalıyorsa duraklatır, duraklatılmışsa devam ettirir. */
  toggle: () => void;
  /** Oturumu tamamen kapatır: çalar yok edilir, bildirim kalkar. */
  stop: () => void;
  setLoop: (loop: boolean) => void;
  setTimerMin: (minutes: number) => void;
};

/*
 * Çalar ve zamanlayıcılar mağaza **dışında**, modül düzeyinde duruyor.
 * Zustand durumuna konsaydı her `set` çağrısı yerli nesneyi yeni bir referans
 * gibi gösterir ve bileşenler gereksiz yeniden çizilirdi; ayrıca bunlar
 * arayüz durumu değil, kaynak.
 */
let player: AudioPlayer | null = null;
let subscription: { remove: () => void } | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let sleepTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimers(): void {
  if (fadeTimer) clearInterval(fadeTimer);
  if (sleepTimer) clearTimeout(sleepTimer);
  fadeTimer = null;
  sleepTimer = null;
}

/**
 * Süren bir fade-out'u iptal eder ve sesi tam seviyeye döndürür.
 *
 * Kullanıcı kısılma sırasında araya girerse (Çal/Duraklat'a basmak, başka
 * parça seçmek) niyeti bellidir: zamanlayıcı artık geçersiz. İptal
 * edilmeseydi aralık çalışmaya devam eder, ses kullanıcı "Çal"a bastıktan
 * sonra bile sıfıra inip duraklardı — düğmeye basmanın hiçbir şey yapmadığı
 * izlenimi verirdi.
 */
function cancelFade(): void {
  if (!fadeTimer) return;
  clearInterval(fadeTimer);
  fadeTimer = null;
  // Çalar her zaman 1'de başlıyor ve bundan başka hiçbir yer sesi
  // değiştirmiyor, bu yüzden geri dönülecek seviye sabit.
  if (player) player.volume = 1;
}

/** Çaları ve aboneliği bırakır. Çağrıldıktan sonra `player` kullanılamaz. */
function destroyPlayer(): void {
  clearTimers();
  // Denetim satırı çalarla birlikte kalkar; köprü de mağaza değişimini
  // görüp aynı sonuca varıyor ama burada beklemeden kaldırmak, "Kapat"a
  // basıldığında bildirimin anında gitmesini sağlıyor.
  void hideMusicNotice();
  subscription?.remove();
  subscription = null;

  const dying = player;
  player = null;
  if (!dying) return;

  try {
    // Önce kilit ekranı denetimleri kalkar, sonra çalar; ters sırada
    // bildirim ölü bir oturuma bağlı kalabiliyor.
    dying.clearLockScreenControls();
    dying.pause();
    dying.remove();
  } catch {
    // Çalar zaten bırakılmış olabilir (hızlı iki `stop`); ikinci bırakmanın
    // hatası kullanıcıyı ilgilendiren bir şey değil.
  }
}

export const useMusicStore = create<State>((set, get) => ({
  current: null,
  status: IDLE,
  loop: true,
  timerMin: 0,
  fading: false,

  play: (track) => {
    const source = audioSource(trackSource(track));
    if (!source) {
      set({ status: { ...IDLE, error: 'Parçanın adresi yok.' } });
      return;
    }

    // Aynı parçaya yeniden basmak devam ettirir, baştan başlatmaz: kullanıcı
    // listede çalan satıra dokunduğunda sesi sıfırlamak şaşırtıcı olurdu.
    if (player && get().current?.id === track.id) {
      cancelFade();
      set({ fading: false });
      player.play();
      return;
    }

    destroyPlayer();

    /*
     * Ses kipi her çalma başlangıcında kuruluyor. Tek seferlik bir açılış
     * çağrısı yetmiyor: kip **genel** bir ayar ve araya giren başka bir ses
     * (uyarı tonları) ileride onu değiştirebilir; burada kurmak ninninin
     * kendi koşullarını garanti ediyor.
     */
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMixPersistent',
    }).catch(() => undefined);

    let created: AudioPlayer;
    try {
      created = createAudioPlayer(source, { updateInterval: 500 });
    } catch {
      set({ status: { ...IDLE, error: 'Çalar başlatılamadı.' } });
      return;
    }

    player = created;
    created.loop = get().loop;
    created.volume = 1;

    subscription = created.addListener('playbackStatusUpdate', (s) => {
      // Geciken olay: çalar değişmişse ya da yok edilmişse yok sayılır.
      if (player !== created) return;
      set({
        status: {
          playing: s.playing,
          isLoaded: s.isLoaded,
          isBuffering: s.isBuffering,
          currentTime: s.currentTime,
          duration: s.duration,
          error: s.error,
        },
      });
    });

    /*
     * Kilit ekranı ve bildirim çubuğu denetimleri.
     *
     * `showNextTrack`/`showPreviousTrack` kapalı: çalar tek parça çalıyor,
     * oynatma listesi yok. Düğmeleri göstermek hiçbir şey yapmayan bir
     * denetim sunmak olurdu.
     */
    try {
      created.setActiveForLockScreen(
        true,
        {
          title: track.title,
          artist: track.artist ?? 'Bebiqa',
          albumTitle: 'Ninni & Müzik',
        },
        { showNextTrack: false, showPreviousTrack: false },
      );
    } catch {
      // Denetimler kurulamazsa çalma yine başlar; yalnızca arka planda
      // ömrü kısalır. Sessizce geçmek, çalmayı tamamen engellemekten iyi.
    }

    set({ current: track, status: IDLE, fading: false });
    created.play();
  },

  toggle: () => {
    if (!player) return;
    // Kısılma sürüyorsa kullanıcının dokunuşu onu iptal eder; yoksa ses
    // "Çal"a basıldıktan sonra bile sıfıra inip dururdu.
    cancelFade();
    if (get().fading) set({ fading: false, timerMin: 0 });
    if (get().status.playing) player.pause();
    else player.play();
  },

  stop: () => {
    destroyPlayer();
    set({ current: null, status: IDLE, timerMin: 0, fading: false });
  },

  setLoop: (loop) => {
    set({ loop });
    if (player) player.loop = loop;
  },

  setTimerMin: (minutes) => {
    clearTimers();
    set({ timerMin: minutes, fading: false });

    if (minutes <= 0 || !player) return;

    sleepTimer = setTimeout(() => {
      const active = player;
      if (!active) return;
      set({ fading: true });

      /*
       * Kademeli kısma (fade-out): süre dolduğunda sesin aniden kesilmesi
       * bebeği uyandırabiliyor. Sıfıra inince çalar duraklatılır ve ses eski
       * seviyesine alınır ki bir sonraki çalma kısık başlamasın.
       */
      const steps = Math.max(1, Math.round(FADE_MS / FADE_STEP_MS));
      let left = steps;
      const from = active.volume ?? 1;

      fadeTimer = setInterval(() => {
        if (player !== active) {
          clearTimers();
          return;
        }
        left -= 1;
        active.volume = Math.max(0, (from * left) / steps);
        if (left > 0) return;

        clearTimers();
        active.pause();
        active.volume = from;
        set({ timerMin: 0, fading: false });
      }, FADE_STEP_MS);
    }, minutes * 60_000);
  },
}));

/**
 * Oturum kapanışında çalma durdurulur.
 *
 * Sayaç bildirimleriyle aynı gerekçe: ses ve bildirim işletim sisteminin
 * elinde yaşıyor; çıkış yapan kullanıcının telefonunda ninninin çalmaya
 * devam etmesi ve kilit ekranında başka bir hesabın parçasının görünmesi
 * kabul edilemez.
 */
export function stopMusic(): void {
  useMusicStore.getState().stop();
}
