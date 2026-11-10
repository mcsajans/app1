import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import {
  SafeAreaInsetsContext,
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { migrate } from './src/core/db';
import { useAuthStore } from './src/core/auth/useAuthStore';
import { initAds, watchAdSettings } from './src/core/ads/adService';
import { useAdSettingsStore } from './src/core/ads/useAdSettingsStore';
import { useBrandingStore } from './src/core/branding/useBrandingStore';
import { MODULE_BY_KEY } from './src/core/modules/catalog';
import { useModuleStore } from './src/core/modules/useModuleStore';
import { useInboxStore } from './src/core/notifications/useInboxStore';
import { startForegroundAlerts } from './src/core/notifications/foregroundAlerts';
import { startMusicNotice } from './src/core/music/musicNoticeBridge';
import { startTimerTicker } from './src/core/notifications/timerTicker';
import { ensureLiveTimer } from './src/core/notifications/liveTimerNotice';
import { usePermissionStore } from './src/core/permissions/usePermissionStore';
import { useBabyStore } from './src/core/stores/useBabyStore';
import {
  handleColdStartTimerResponse, handleTimerResponseOnce,
} from './src/core/timers/timerActions';
import { useLiveTimerStore } from './src/core/timers/useLiveTimerStore';
import { refreshAll } from './src/core/sync/refreshAll';
import { AuthNavigator } from './src/core/navigation/AuthNavigator';
import { navigationRef, navigateTo, openModule } from './src/core/navigation/navigationRef';
import { RootNavigator } from './src/core/navigation/RootNavigator';
import { AccountDrawer } from './src/components/AccountDrawer';
import { BabyBar } from './src/components/BabyBar';
import { BottomNav, NAV_SPACE, type NavKey } from './src/components/BottomNav';
import { BottomNavSpaceContext } from './src/components/bottomNavSpace';
import { NotificationSheet } from './src/components/NotificationSheet';
import { PermissionsSheet } from './src/components/PermissionsSheet';
import { SplashBounce } from './src/components/SplashBounce';
import { QuickAddSheet } from './src/components/QuickAddSheet';
import { SaveFeedbackModal } from './src/components/SaveFeedbackModal';
import { EmptyState, Screen } from './src/components/ui';
import { colors } from './src/core/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppShell />
    </SafeAreaProvider>
  );
}

function AppShell() {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [bootError, setBootError] = useState<string | null>(null);

  // Verinin HANGİ hesap için yüklendiği tutulur; hesap değişince ekran
  // kendiliğinden "yükleniyor"a döner, ayrıca sıfırlama yapmak gerekmez.
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const dataReady = status === 'signedIn' && loadedFor !== null && loadedFor === userId;

  // Açılış: yerel şema → önbellekteki logo → saklanan oturum.
  useEffect(() => {
    (async () => {
      try {
        await migrate();
        await useBrandingStore.getState().hydrate();
        // Reklam ayarı da önbellekten okunur: ağ gelmeden önce "reklam var mı"
        // sorusunun cevabı, son bilinen panel ayarı olsun.
        await useAdSettingsStore.getState().hydrate();
        /*
         * Reklam SDK'sı önbellekten okunan ayarla başlatılır (Reklam.md §2
         * Adım 2). `await` EDİLMİYOR: AdMob başlatması ağa çıkıyor ve açılışı
         * ona bağlamak, reklam kapalı bir kurulumda ya da ağ yokken uygulamayı
         * bekletirdi. Ayar kapalıysa `initAds` hiçbir şey yapmıyor.
         *
         * Sunucudan gelen taze ayar farklıysa `watchAdSettings` aboneliği
         * devralıyor: reklam panelden açılmışsa SDK'yı o başlatır.
         */
        void initAds();
        // Logo ve reklam ayarı giriş ekranında da gerekli; oturumdan bağımsız
        // tazelenir.
        void refreshAll({ includePrivate: false });
        await useAuthStore.getState().restore();
      } catch (e) {
        setBootError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  /*
   * Panel ayarı değişimini izle (Reklam.md §2 Adım 2, madde 7).
   *
   * İki iş: reklam panelden KAPATILDIĞINDA bekleyen gecikmeli gösterimi iptal
   * etmek — yoksa kapatıldıktan sonra son tetiklenen reklam bir kez daha
   * açılırdı — ve AÇILDIĞINDA SDK'yı başlatmak, çünkü uygulama kapalı ayarla
   * açılmış olabilir.
   */
  useEffect(() => watchAdSettings(), []);

  // Oturum açıkken: önce yerel aynadan çiz, sonra sunucudan tazele.
  useEffect(() => {
    if (status !== 'signedIn' || userId === null) return;

    /*
     * Bildirim kutusu bellekte duruyor (SQLite'a yazılmıyor), bu yüzden hesap
     * değişiminde elle boşaltılır. Olmasaydı yeni hesap, bir önceki
     * kullanıcının rozetini ve satırlarını `refreshAll` yetişene kadar
     * görürdü — başkasının bildirimini göstermek kabul edilemez.
     */
    useInboxStore.getState().clear();

    let cancelled = false;
    (async () => {
      try {
        await Promise.all([
          useBabyStore.getState().hydrate(),
          useModuleStore.getState().hydrate(),
        ]);
      } catch (e) {
        if (!cancelled) setBootError(e instanceof Error ? e.message : String(e));
        return;
      }
      if (cancelled) return;
      setLoadedFor(userId);
      void refreshAll({ includePrivate: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [status, userId]);

  // Uygulama ön plana geldiğinde modül durumu, bebekler ve logolar tazelenir (§9.2).
  const appState = useRef<AppStateStatus>((AppState.currentState ?? 'active') as AppStateStatus);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const cameToForeground = appState.current.match(/inactive|background/) && next === 'active';
      appState.current = next;
      if (cameToForeground) {
        void refreshAll({ includePrivate: useAuthStore.getState().status === 'signedIn' });
      }
    });
    return () => sub.remove();
  }, []);

  if (bootError) {
    return (
      <Screen scroll={false}>
        <EmptyState icon="warning" title="Başlatma hatası" detail={bootError} />
      </Screen>
    );
  }

  if (status === 'checking') return <BrandedLoading label="Bebiqa hazırlanıyor…" />;
  if (status === 'signedOut') return <AuthNavigator />;
  if (!dataReady) return <BrandedLoading label="Bilgilerin yükleniyor…" />;

  return <SignedInShell />;
}

/**
 * Oturum açıkken kabuk: üstte bebek şeridi, altta gezinme çubuğu, ortada
 * navigasyon ağacı.
 *
 * Üç katman ağacın **dışında** durur, çünkü tüm ekranların üzerine binmeleri
 * ve ekran değişse de ayakta kalmaları gerekir: hesap paneli, hızlı kayıt
 * sayfası ve alt çubuk. Yönlendirmeyi `navigationRef` üzerinden yaparlar.
 */
function SignedInShell() {
  const insets = useSafeAreaInsets();
  const [accountOpen, setAccountOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  /**
   * İzin karşılaması — kurulumdan sonra bir kez. Oturum açıldıktan sonra
   * gösterilir, giriş ekranında değil: izinleri hesabı olmayan birine
   * sormanın karşılığı yok ve ilk izlenim giriş akışını uzatırdı.
   */
  const [permsOpen, setPermsOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      if (await usePermissionStore.getState().shouldWelcome()) setPermsOpen(true);
    })();
  }, []);

  useLiveTimerBridge();
  useAlertSounds();

  const closePerms = useCallback(() => {
    setPermsOpen(false);
    void usePermissionStore.getState().dismissWelcome();
  }, []);
  /** Alt çubukta hangi sekmenin seçili çizileceği. */
  const [navKey, setNavKey] = useState<NavKey | null>('home');

  const closeAccount = useCallback(() => setAccountOpen(false), []);
  const closeQuick = useCallback(() => setQuickOpen(false), []);
  const closeInbox = useCallback(() => setInboxOpen(false), []);

  const onNavigate = useCallback((key: NavKey) => {
    if (key === 'account') {
      // Hesap bir ekran değil, panel; çubukta seçili görünmemeli.
      setAccountOpen(true);
      return;
    }
    setNavKey(key);
    navigateTo(key);
  }, []);

  return (
    <View style={s.shell}>
      <BabyBar
        onOpenBaby={() => {
          setNavKey(null);
          navigateTo('babies');
        }}
        onOpenSettings={() => setAccountOpen(true)}
        onOpenNotifications={() => setInboxOpen(true)}
      />
      {/*
        Üst güvenli alanı BabyBar tüketti. Alt ağaç hâlâ cihazın gerçek
        inset'ini görseydi her ekran ikinci kez boşluk bırakırdı; bu yüzden
        yalnızca bu alt ağaç için top sıfırlanır.

        Alt inset **sıfırlanmaz**. Önceden sıfırlanıyordu ("boşluğu BottomNav
        tüketiyor" varsayımıyla) ama çubuk `position: absolute` olduğu için
        yer kaplamıyor; sonuç, hem ekranların son düğmesinin çubuğun arkasında
        kalması hem de Modal ile açılan alt sayfaların jest çubuğuna
        değmesiydi. Gerçek inset olduğu gibi geçer; çubuğun örttüğü yüksekliği
        ise ayrı bir context taşır — böylece yalnızca çubuğun **altında** çizilen
        ekranlar onu hesaba katar, üstünde açılan Modal sayfalar katmaz.
      */}
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        <BottomNavSpaceContext.Provider value={NAV_SPACE}>
          <NavigationContainer
            ref={navigationRef}
            // Kullanıcı geri tuşuyla ya da bir kutudan gezindiğinde çubuğun
            // seçili sekmesi gerçek ekranla uyumlu kalmalı.
            onStateChange={(state) => {
              const name = state?.routes[state.index ?? 0]?.name;
              setNavKey(
                name === 'home' || name === 'timeline' || name === 'reports'
                  ? (name as NavKey)
                  : null,
              );
            }}
          >
            <RootNavigator />
          </NavigationContainer>
        </BottomNavSpaceContext.Provider>
      </SafeAreaInsetsContext.Provider>

      <BottomNav active={navKey} onNavigate={onNavigate} onQuickAdd={() => setQuickOpen(true)} />

      <AccountDrawer visible={accountOpen} onClose={closeAccount} />
      <QuickAddSheet visible={quickOpen} onClose={closeQuick} />
      <NotificationSheet visible={inboxOpen} onClose={closeInbox} />
      <PermissionsSheet visible={permsOpen} onClose={closePerms} />

      {/*
        Kaydetme penceresi en sonda: kabuktaki diğer alt sayfaların (hesap,
        hızlı kayıt, bildirimler) ÜSTÜNDE çizilmeli — hızlı kayıt sayfasından
        kaydedildiğinde onay o sayfanın arkasında kalmasın.
      */}
      <SaveFeedbackModal />
    </View>
  );
}

/**
 * Bildirim seslerinin kabuk tarafı (`modules_doc/notification-voice.md` §2).
 *
 * İki süreç ekranlardan **bağımsız** olmak zorunda, bu yüzden kabukta
 * duruyorlar:
 *
 *  - **Periyodik sayaç uyarıları** — beslenme 5 dk, uyku 30 dk. Ebeveyn
 *    emzirmeyi başlatıp ana sayfaya dönüyor; uyarı bir ekranın efektine
 *    bağlanırsa ekran söküldüğü anda susardı.
 *  - **Ön plan uyarı sesleri** — bildirim geldiğinde tekrar sayısını uygulayan
 *    dinleyici. Hangi ekranın açık olduğundan bağımsız çalışmalı.
 *
 * İkisi de oturum açıkken kurulur ve `SignedInShell` söküldüğünde kalkar:
 * çıkış yapan kullanıcıya ses çalmanın anlamı yok.
 */
function useAlertSounds(): void {
  useEffect(() => {
    const stopTicker = startTimerTicker();
    const stopAlerts = startForegroundAlerts();
    /*
     * Ninni çalarının bildirimi de burada: çalma oturumu ekranlardan
     * bağımsız yaşıyor (`useMusicStore`), dolayısıyla denetim satırı da
     * ekrana bağlanamaz.
     */
    const stopMusicNotice = startMusicNotice();
    return () => {
      stopTicker();
      stopAlerts();
      stopMusicNotice();
    };
  }, []);
}

/**
 * Canlı sayaç bildiriminin kabuk tarafı (`bildirimler.md` → Ek geliştirme).
 *
 * Dört iş burada toplanıyor, çünkü dördü de **ekranlardan bağımsız** olmalı:
 * ebeveyn emzirmeyi başlatıp uygulamayı kapatsa bile bildirim ayakta kalmalı
 * ve düğmeleri çalışmalı.
 */
function useLiveTimerBridge(): void {
  const babyId = useBabyStore((s) => s.selected()?.id ?? null);
  const babyName = useBabyStore((s) => s.selected()?.firstName ?? null);
  const pendingOpen = useLiveTimerStore((s) => s.pendingOpen);

  // 1) Kanal + kategoriler, yerel sağma kronometresi, soğuk başlatmada
  //    kaçırılan bildirim yanıtı.
  useEffect(() => {
    void (async () => {
      await ensureLiveTimer().catch(() => undefined);
      await useLiveTimerStore.getState().hydratePumping();
      await handleColdStartTimerResponse().catch(() => undefined);
    })();
  }, []);

  // 2) Sunucudaki çalışan seanslarla eşitle. Bebek değişince de yeniden:
  //    bildirim seçili bebeğin sayacını gösterir.
  useEffect(() => {
    void useLiveTimerStore.getState().refreshFromServer(babyId, babyName);
  }, [babyId, babyName]);

  // 3) Bildirim düğmeleri. Uygulama ayaktayken yanıt buradan gelir; soğuk
  //    başlatma yukarıdaki (1) adımında ele alınıyor ve aynı yanıt iki kez
  //    işlenmesin diye ikisi de `...Once` sarmalayıcısını kullanıyor.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleTimerResponseOnce(response).catch(() => undefined);
    });
    return () => sub.remove();
  }, []);

  /*
   * 4) Ön plan/arka plan geçişleri.
   *
   * Arka plana geçerken metin bir kez tazelenir: JavaScript arka planda
   * çalışmadığı için bu, kullanıcı uygulamadan çıkarken bildirimde
   * yazabildiğimiz **son** doğru değer. Geri dönerken sunucu sorulur —
   * diğer ebeveyn kendi telefonundan uykuyu bitirmiş olabilir.
   */
  const phase = useRef<AppStateStatus>((AppState.currentState ?? 'active') as AppStateStatus);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const was = phase.current;
      phase.current = next;

      if (next === 'background' || next === 'inactive') {
        useLiveTimerStore.getState().refreshNotices();
        return;
      }
      if (next === 'active' && was.match(/inactive|background/)) {
        const baby = useBabyStore.getState().selected();
        void useLiveTimerStore.getState().refreshFromServer(baby?.id ?? null, baby?.firstName ?? null);
      }
    });
    return () => sub.remove();
  }, []);

  /*
   * 5) Bildirimden gelen "şu modülü aç" isteği.
   *
   * Niyet, ağaç hazır olmadan **tüketilmez**: soğuk başlatmada bu efekt
   * NavigationContainer ile aynı render turunda çalışıyor ve `navigationRef`
   * henüz bağlanmamış olabilir. Tüketip yönlendirmeyi kaybetmek yerine kısa
   * aralıkla yeniden denenir (`navigateTo` hazır değilken sessizce düşüyor).
   */
  useEffect(() => {
    if (pendingOpen === null) return;

    const tryOpen = () => {
      if (!navigationRef.isReady()) {
        timer = setTimeout(tryOpen, 120);
        return;
      }
      const kind = useLiveTimerStore.getState().consumePendingOpen();
      // Emzirme ve sağma artık Beslenme ekranının sekmeleri; `openModule`
      // onları üst modülün ilgili sekmesinde açar (uyku kendi ekranında kalır).
      if (kind) openModule(kind, MODULE_BY_KEY[kind]?.parent);
    };

    let timer = setTimeout(tryOpen, 0);
    return () => clearTimeout(timer);
  }, [pendingOpen]);
}

/** Yükleme ekranında uygulamanın kendi logosu gösterilir. */
/**
 * Açılış ekranı. Çizimi `SplashBounce` yapar (zıplayan ikon + dolan çubuk);
 * burada yalnızca hangi metnin gösterileceği belirlenir.
 */
function BrandedLoading({ label }: { label: string }) {
  return <SplashBounce label={label} />;
}

const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
