import { AppState } from 'react-native';
import {
  AdEventType, AdsConsent, AdsConsentStatus, InterstitialAd, MaxAdContentRating, MobileAds, TestIds,
} from 'react-native-google-mobile-ads';

import { allowedByFrequency } from './frequency';
import { useMusicStore } from '../music/useMusicStore';
import { useSaveFeedbackStore } from '../feedback/useSaveFeedbackStore';
import { coveringWindow } from '../notifications/quietHours';
import { useNotificationStore } from '../notifications/useNotificationStore';
import type { QuietHour } from '../api/modules';
import {
  interstitialUnitId, useAdSettingsStore, type AdConfig, type AdTrigger,
} from './useAdSettingsStore';

/**
 * Geçiş reklamı (AdMob interstitial) servisi — `modules_doc/Reklam.md` §2.
 *
 * React'siz, tek örnekli, ekranlardan bağımsız. Ekranların bildiği tek şey
 * `showAdAfterAction(trigger)` çağrısı; gerisi burada.
 *
 * **Değişmez kural: reklam hiçbir koşulda kaydı etkilemez.** Kayıt ve sayaç
 * işlemleri çağıran tarafta `await` edilmiş olur, bu fonksiyon `void` döner,
 * hiç `throw` etmez ve her native çağrı `try/catch` içindedir. Ağ yoksa,
 * SDK kurulmamışsa ya da AdMob hata verirse kullanıcı hiçbir şey fark etmez.
 *
 * Ayarların **tamamı** yönetim panelinden gelir (`useAdSettingsStore`,
 * TEKNIK_DOKUMAN.md §7.6): birim kimlikleri, frekans sınırı, gecikme,
 * tetikleyiciler, beyanlar. Burada sabit sayı yok.
 */

/* ────────────────────────────── durum ────────────────────────────────────── */

let interstitial: InterstitialAd | null = null;
/** Olay aboneliklerini bırakmak için; reklam örneği yenilenirken kullanılır. */
let unsubscribers: (() => void)[] = [];
/** Hangi birim kimliğiyle kurulduğu — panelden kimlik değişince yenilenir. */
let builtWithUnitId: string | null = null;
/** Kişiselleştirme durumu da istek seçeneğine giriyor; değişince yenilenir. */
let builtWithPersonalized: boolean | null = null;

let initialized = false;
let initializing: Promise<void> | null = null;
/** UMP izni alındıktan sonra reklam isteyebilir miyiz. */
let canRequestAds = true;
/**
 * UMP akışı kişiselleştirmeye izin veriyor mu.
 *
 * Panel ayarına **ek** bir kapı: `AdsConsentStatus.REQUIRED`, "izin gerekli
 * ama alınmadı" demek ve o durumda panelde kişiselleştirme açık olsa bile
 * kişiselleştirilmiş reklam istenemez. `NOT_REQUIRED` (AEA dışı) ve
 * `OBTAINED` izin verir.
 */
let personalizedAllowed = true;

/** Son gösterim zamanı (ms) ve bu oturumdaki gösterim sayısı — frekans sınırı. */
let lastShownAt = 0;
let shownThisSession = 0;

/** Bekleyen gecikmeli gösterim; panelden reklam kapatılırsa iptal edilir. */
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

/** Sunucuda sessiz saat yoksa geçerli varsayılan pencere (Reklam.md §0.3-B). */
const DEFAULT_QUIET: QuietHour = {
  id: -1,
  label: null,
  start_time: '23:00',
  end_time: '07:00',
  /** Haftanın yedi günü: 0b1111111. */
  days_mask: 127,
  auto_from_sleep: false,
  is_enabled: true,
};

/* ───────────────────────────── yardımcılar ───────────────────────────────── */

function config(): AdConfig {
  return useAdSettingsStore.getState().config;
}

/**
 * Kullanılacak reklam birimi kimliği.
 *
 * `__DEV__` ya da panelde "test kimlikleri" açıkken **her zaman** Google'ın
 * test birimi. Kendi canlı reklamına tıklamak hesabın kalıcı kapatılma
 * sebebi (Reklam.md §1 notu); geliştirme derlemesinin canlı birim istemesi
 * için hiçbir gerekçe yok.
 */
/**
 * Kişiselleştirme bu istekte açık mı: panel ayarı **ve** UMP izni.
 *
 * İkisini ayrı tutmak şart — panelde açık olması izin alındığı anlamına
 * gelmiyor ve izni olmayana kişiselleştirilmiş reklam istemek GDPR ihlali.
 */
function personalizedFor(cfg: AdConfig): boolean {
  return cfg.personalized_ads && personalizedAllowed;
}

function unitIdFor(cfg: AdConfig): string | null {
  if (__DEV__ || cfg.use_test_ids) return TestIds.INTERSTITIAL;
  return interstitialUnitId(cfg);
}

function clearPending(): void {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

/* ──────────────────────────── ön yükleme ─────────────────────────────────── */

function teardown(): void {
  for (const off of unsubscribers) {
    try {
      off();
    } catch {
      // Abonelik bırakma hatası yutulur; örnek zaten atılıyor.
    }
  }
  unsubscribers = [];
  try {
    interstitial?.destroy();
  } catch {
    // SDK yoksa ya da örnek zaten atılmışsa önemsiz.
  }
  interstitial = null;
  builtWithUnitId = null;
  builtWithPersonalized = null;
}

/**
 * Reklam örneğini kurar ve yüklemeyi başlatır.
 *
 * `CLOSED` ve `ERROR` olaylarında **hemen** yeni reklam yüklenir: AdMob bir
 * örneği yalnızca bir kez gösteriyor, yeniden yüklemezsek ilk reklamdan
 * sonra bir daha hiç reklam gelmez ve bu sessiz bir gelir kaybı olur.
 */
function build(cfg: AdConfig): void {
  const unitId = unitIdFor(cfg);
  if (!unitId) return;

  teardown();

  try {
    const personalized = personalizedFor(cfg);
    const ad = InterstitialAd.createForAdRequest(unitId, {
      // Kişiselleştirme kapalıysa (panel ayarı ya da UMP reddi) istek de
      // kişiselleştirilmemiş olmalı; yalnızca yanıtı yok saymak yetmez.
      requestNonPersonalizedAdsOnly: !personalized,
    });
    interstitial = ad;
    builtWithUnitId = unitId;
    builtWithPersonalized = personalized;

    unsubscribers.push(
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        reload();
      }),
      ad.addAdEventListener(AdEventType.ERROR, () => {
        /*
         * Hata genelde "no fill" ya da ağ yokluğu. Hemen yeniden denemek
         * istek selipine yol açar, bu yüzden kısa bir gecikmeyle: bir sonraki
         * kaydın 3 saniyesinde hazır olması yeterli.
         */
        setTimeout(reload, 30_000);
      }),
      ad.addAdEventListener(AdEventType.OPENED, () => {
        /*
         * Sayaç GÖSTERİM anında artırılıyor, `show()` çağrısında değil:
         * yüklenmemiş ya da hata veren bir reklam oturum kotasını
         * harcamamalı — kullanıcı hiçbir şey görmediği hâlde sonraki
         * gösterimler sessizce atlanırdı.
         */
        lastShownAt = Date.now();
        shownThisSession += 1;
      }),
    );

    ad.load();
  } catch {
    // Native modül yoksa (Expo Go, prebuild atlanmış derleme) buraya düşer.
    // Reklam olmaz, uygulama çalışmaya devam eder.
    interstitial = null;
  }
}

function reload(): void {
  const cfg = config();
  if (!cfg.enabled) return;
  const unitId = unitIdFor(cfg);
  if (!unitId) return;

  // Kimlik ya da kişiselleştirme değiştiyse örneği baştan kur; aynıysa
  // mevcut örneğe yeni bir yükleme yeter.
  if (!interstitial || builtWithUnitId !== unitId || builtWithPersonalized !== personalizedFor(cfg)) {
    build(cfg);
    return;
  }
  try {
    interstitial.load();
  } catch {
    // Yükleme başlatılamadıysa bir sonraki tetikleyicide yine denenir.
  }
}

/* ──────────────────────────── başlatma ──────────────────────────────────── */

/**
 * SDK'yı bir kez başlatıp ilk reklamı ön yükler. `initAds`in iç kısmı.
 *
 * Hiçbir koşulda fırlatmıyor: başlatma başarısızsa reklam olmaz, uygulama
 * çalışmaya devam eder. Dönen `boolean` "başlatıldı mı" bilgisidir.
 */
async function runInit(): Promise<boolean> {
  const cfg = config();
  // Panelde reklam kapalıysa HİÇ başlatılmaz: kapalı bir sistemde SDK'yı
  // ayağa kaldırmak boşa açılış süresi ve gereksiz ağ isteği.
  if (!cfg.enabled) return false;

  try {
    await MobileAds().setRequestConfiguration({
      tagForChildDirectedTreatment: cfg.child_directed,
      tagForUnderAgeOfConsent: cfg.under_age_of_consent,
      // Çocuklara yönelik beyanı varken içerik derecesi de kısıtlanmalı;
      // beyanı tek başına yapıp yetişkin içeriğe izin vermek tutarsız olur.
      maxAdContentRating: cfg.child_directed ? MaxAdContentRating.G : MaxAdContentRating.PG,
      // Panele girilen cihazlarda canlı birim yerine test reklamı gelir;
      // "kendi reklamına tıklama" riskini ortadan kaldıran asıl ayar bu.
      testDeviceIdentifiers: cfg.test_device_ids,
    });
  } catch {
    // Yapılandırma yazılamadıysa reklam göstermemek daha doğru: beyanı
    // bilinmeyen bir istek atmak politika riski.
    return false;
  }

  if (cfg.ump_enabled) {
    try {
      const info = await AdsConsent.gatherConsent({
        testDeviceIdentifiers: cfg.test_device_ids,
      });
      canRequestAds = info.canRequestAds;
      /*
       * İzin REDDEDİLDİYSE reklam kaldırılmaz, **kişiselleştirilmemiş**
       * reklam gösterilir (Reklam.md §0.3-D). Reddedeni reklamsız bırakmak
       * gelir modelini delerdi.
       */
      personalizedAllowed = info.status !== AdsConsentStatus.REQUIRED;
    } catch {
      /*
       * UMP akışı patlarsa reklam isteğine devam edilir: form yalnızca AEA
       * kullanıcıları için zorunlu ve `gatherConsent` hatası çoğunlukla
       * "form yapılandırılmamış" demek. Burada durmak, AEA dışındaki tüm
       * kullanıcılarda geliri sıfırlardı.
       */
      canRequestAds = true;
    }
  }

  try {
    await MobileAds().initialize();
  } catch {
    return false;
  }

  build(config());
  return true;
}

/**
 * SDK'yı bir kez başlatır ve ilk reklamı ön yükler.
 *
 * **Sıra önemli** (Reklam.md §2 Adım 2): önce `setRequestConfiguration`
 * (çocuklara yönelik beyanı, test cihazları), sonra UMP izni, en sonda
 * `initialize()`. Başlatma sırasında SDK reklam ön yükleyebildiği için beyan
 * ve izin ondan önce yerinde olmalı — tersi sırada ilk istek yanlış
 * yapılandırmayla gider ve çocuklara yönelik bir uygulamada bu politika
 * ihlalidir.
 *
 * Başarısız ya da "reklam kapalı" hâlinde `initialized` **false kalır** ve
 * sonraki çağrı yeniden dener; panelden reklam açıldığında yeniden derleme ya
 * da yeniden açılış beklemeye gerek olmamalı.
 *
 * Temizlik `finally` içinde: `initializing`i async gövdenin İÇİNDEN
 * sıfırlamak çalışmıyordu. Async gövde ilk `await`e kadar EŞZAMANLI koşuyor,
 * yani `initializing = null` ataması `initializing = <promise>`
 * atamasından ÖNCE gerçekleşiyor ve hemen üzerine yazılıyordu. Sonuç:
 * "reklam kapalı" ile açılan bir uygulamada `initializing` kalıcı olarak
 * çözülmüş bir promise'te takılıyor, `initialized` hâlâ false olduğu için her
 * `initAds()` o bayat promise'i döndürüyor ve SDK bir daha HİÇ başlatılmıyordu
 * — panelden reklam açmak hiçbir şey yapmazdı.
 */
export function initAds(): Promise<void> {
  if (initialized) return Promise.resolve();
  if (initializing) return initializing;

  const task = runInit().then((ok) => {
    initialized = ok;
  });

  initializing = task;
  void task.finally(() => {
    if (initializing === task) initializing = null;
  });

  return task;
}

/**
 * Panel ayarı değişimini izler. `App.tsx` kabuğunda bir kez çağrılır.
 *
 * İki iş yapıyor:
 *  - Reklam **kapatıldığında** bekleyen gecikmeli gösterimi iptal eder.
 *    Olmasaydı, panelde reklamı kapattıktan sonra son tetiklenen reklam bir
 *    kez daha açılırdı.
 *  - Reklam **açıldığında** SDK'yı başlatır. Uygulama kapalı reklam ayarıyla
 *    açılmış olabilir; panelden açılınca yeniden başlatmayı beklememek için.
 */
export function watchAdSettings(): () => void {
  return useAdSettingsStore.subscribe((state, prev) => {
    const now = state.config;
    const before = prev.config;
    if (now === before) return;

    if (!now.enabled) {
      clearPending();
      return;
    }

    if (!before.enabled) {
      void initAds();
      return;
    }

    // Kimlik ya da kişiselleştirme değiştiyse yeni ayarla yeniden kur.
    if (initialized) {
      const unitId = unitIdFor(now);
      if (unitId !== builtWithUnitId || personalizedFor(now) !== builtWithPersonalized) {
        build(now);
      }
    }
  });
}

/* ──────────────────────────── güvenlik kapıları ──────────────────────────── */

/**
 * Frekans sınırı. Hesabın kendisi `frequency.ts` içinde — saf ve Node altında
 * test edilebilir (`scripts/tests/ad-frequency.test.mjs`); burada yalnızca
 * modül durumu o fonksiyona veriliyor.
 */
function withinFrequencyCap(cfg: AdConfig): boolean {
  return allowedByFrequency({
    frequencyMinutes: cfg.frequency_minutes,
    sessionCap: cfg.session_cap,
    lastShownAt,
    shownThisSession,
    now: Date.now(),
  });
}

/** Panelde açıksa, kullanıcının sessiz saat penceresinde reklam gösterilmez. */
function inQuietHours(): boolean {
  const windows = useNotificationStore.getState().quietHours.filter((w) => w.is_enabled);
  // Kullanıcı hiç pencere tanımlamadıysa 23:00–07:00 varsayılır (§0.3-B).
  const effective = windows.length > 0 ? windows : [DEFAULT_QUIET];
  return coveringWindow(effective, new Date()) !== null;
}

/**
 * Gösterim anındaki tüm kapılar.
 *
 * Kapıların **gösterim anında** (gecikme dolduğunda) değerlendirilmesi şart,
 * tetikleme anında değil: 3 saniye içinde kullanıcı uygulamadan çıkabilir,
 * ninni açabilir ya da onay penceresi hâlâ kapanmamış olabilir.
 */
function canShowNow(trigger: AdTrigger): boolean {
  const cfg = config();

  // Panel ayarı: ana anahtar, tetikleyici seçimi, birim kimliği.
  if (!useAdSettingsStore.getState().shouldShowFor(trigger)) return false;
  if (!canRequestAds) return false;
  if (!withinFrequencyCap(cfg)) return false;

  // Uygulama ön planda değilse reklam, kullanıcı geri döndüğünde alakasız bir
  // yerde açılırdı.
  if (AppState.currentState !== 'active') return false;

  /*
   * Ninni/beyaz gürültü çalıyorsa gösterilmez: tam ekran reklam sesi keser ve
   * uyutulmaya çalışılan bebeği uyandırır. Bu, modülün bütün amacını
   * boşa çıkaran tek senaryo.
   */
  if (useMusicStore.getState().status.playing) return false;

  // Kaydetme onay penceresi hâlâ açıkken iki tam ekran katman üst üste
  // binmemeli; kullanıcı neyin onaylandığını okuyamadan reklam açılırdı.
  if (useSaveFeedbackStore.getState().phase !== 'hidden') return false;

  if (cfg.respect_quiet_hours && inQuietHours()) return false;

  return true;
}

/* ──────────────────────────── dışa açılan uç ─────────────────────────────── */

/**
 * İşlem tamamlandıktan sonra çağrılır; panelde tanımlı gecikmenin ardından
 * (varsayılan 3 sn) reklamı dener.
 *
 * `await` EDİLMEZ ve hata fırlatmaz. Çağıranın sözleşmesi tek satır: kayıt ya
 * da sayaç işlemi başarıyla bittikten **sonra** çağır.
 */
export function showAdAfterAction(trigger: AdTrigger = 'save'): void {
  const cfg = config();

  // Tetikleme anında da bakılıyor — kapalı bir sistemde boşuna zamanlayıcı
  // kurmamak için. Asıl karar gecikme dolduğunda yeniden verilir.
  if (!useAdSettingsStore.getState().shouldShowFor(trigger)) return;

  // SDK henüz başlatılmadıysa (uygulama kapalı ayarla açıldı, panel sonradan
  // açtı) burada başlatılır; bu gösterime yetişmezse sonrakine yetişir.
  if (!initialized) void initAds();

  // Aynı anda yalnızca bir bekleyen gösterim: art arda üç kayıt giren
  // kullanıcıya üç zamanlayıcı kurmak, frekans sınırını delmeden de olsa
  // gereksiz iş.
  clearPending();

  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    if (!canShowNow(trigger)) return;

    const ad = interstitial;
    // Yüklenmemiş reklam HATA DEĞİL, sessiz geçiş: bir sonrakine hazır olması
    // için yeniden yükleme tetiklenir.
    if (!ad || !ad.loaded) {
      reload();
      return;
    }

    ad.show().catch(() => {
      // Gösterim başarısız: örnek tükenmiş olabilir, yenisi yüklenir.
      reload();
    });
  }, cfg.action_delay_ms);
}

/**
 * Test ve teşhis için okunabilir durum. Üretimde çağrılmıyor; frekans
 * sınırının gerçekten devrede olup olmadığını emülatörde görmenin tek yolu.
 */
export function adDebugState(): Record<string, unknown> {
  return {
    initialized,
    canRequestAds,
    unitId: builtWithUnitId,
    loaded: interstitial?.loaded ?? false,
    shownThisSession,
    lastShownAt: lastShownAt === 0 ? null : new Date(lastShownAt).toISOString(),
    pending: pendingTimer !== null,
  };
}
