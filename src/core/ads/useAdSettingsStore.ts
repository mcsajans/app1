import { Platform } from 'react-native';
import { create } from 'zustand';

import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import { getDb } from '../db';

/**
 * Reklam ayarları — sistem geneli, yönetim panelinden yönetilir.
 *
 * Tek doğruluk kaynağı sunucudaki `ad_settings` tablosu; panel `/admin/ads`
 * ekranından yazıyor, bu depo `GET /ads/config` ile okuyor. Değerler
 * `.env`'de **değil**: reklam birimi kimliği, frekans sınırı ve
 * tetikleyiciler buradan gelince değişiklik için yeniden derleme gerekmiyor
 * (`EXPO_PUBLIC_*` değerleri pakete gömülür, bkz. `core/config.ts`).
 *
 * Logolarla (`useBrandingStore`) aynı desen: önce SQLite önbelleğinden çiz,
 * sonra ağdan tazele; uç kimlik doğrulaması istemiyor, bu yüzden giriş
 * yapılmadan da okunabiliyor.
 *
 * **Bu depo karar vermez, yalnızca ayarı taşır.** Frekans sınırını saymak,
 * 3 saniyelik gecikmeyi kurmak ve reklamı göstermek `adService`'in işi
 * (Reklam.md §2 Adım 2); henüz kurulmadı. Depodaki `shouldShowFor()` o
 * servisin soracağı tek soruyu — "bu tetikleyici açık mı" — cevaplıyor.
 */

/** `GET /api/v1/ads/config` gövdesi (sunucu: `lib/adSettings.ts`). */
export type AdTrigger = 'save' | 'complete' | 'invite' | 'timer_start';

export type AdConfig = {
  enabled: boolean;
  use_test_ids: boolean;
  interstitial: { android: string | null; ios: string | null };
  child_directed: boolean;
  under_age_of_consent: boolean;
  ump_enabled: boolean;
  personalized_ads: boolean;
  privacy_policy_url: string | null;
  frequency_minutes: number;
  session_cap: number;
  action_delay_ms: number;
  respect_quiet_hours: boolean;
  test_device_ids: string[];
  triggers: Record<AdTrigger, boolean>;
};

/**
 * Sunucuya hiç ulaşılamadığında geçerli olan hâl: **reklam kapalı**.
 *
 * Diğer yön (varsayılan açık) kabul edilemez: ayarını okuyamadığımız bir
 * sistemde reklam göstermek, kimlikleri bilinmeyen bir isteği AdMob'a atmak
 * ve kullanıcıya hesabın izin vermediği bir reklamı açmak demek. Sunucudaki
 * `AD_SETTINGS_DEFAULTS` ile aynı değerler.
 */
export const AD_CONFIG_FALLBACK: AdConfig = {
  enabled: false,
  use_test_ids: true,
  interstitial: { android: null, ios: null },
  child_directed: false,
  under_age_of_consent: false,
  ump_enabled: true,
  personalized_ads: true,
  privacy_policy_url: null,
  frequency_minutes: 3,
  session_cap: 5,
  action_delay_ms: 3000,
  respect_quiet_hours: false,
  test_device_ids: [],
  triggers: { save: true, complete: true, invite: true, timer_start: false },
};

const CACHE_KEY = 'ads';

/**
 * Sunucu yanıtını şekle sokar.
 *
 * Gelen gövde **doğrulanmadan** kullanılmamalı: eski bir sunucu sürümü ya da
 * yarım dönmüş bir yanıt, `frequency_minutes` yerine `undefined` verip
 * `adService`'in sınır hesabını `NaN`'a çevirebilir — o da sınırın tamamen
 * devre dışı kalması, yani ekranı reklamla dolduran bir hata olurdu. Eksik
 * her alan güvenli varsayılana düşer.
 */
export function normalizeAdConfig(raw: unknown): AdConfig {
  const o = (raw ?? {}) as Record<string, unknown>;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

  const unit = (o.interstitial ?? {}) as Record<string, unknown>;
  const trig = (o.triggers ?? {}) as Record<string, unknown>;
  const f = AD_CONFIG_FALLBACK;

  return {
    enabled: bool(o.enabled, f.enabled),
    use_test_ids: bool(o.use_test_ids, f.use_test_ids),
    interstitial: { android: str(unit.android), ios: str(unit.ios) },
    child_directed: bool(o.child_directed, f.child_directed),
    under_age_of_consent: bool(o.under_age_of_consent, f.under_age_of_consent),
    ump_enabled: bool(o.ump_enabled, f.ump_enabled),
    // Çocuklara yönelik beyanı açıkken kişiselleştirme HER DURUMDA kapalı:
    // sunucu da aynı kuralı uyguluyor, istemci ona güvenmek yerine kendi
    // tarafında da garanti ediyor (Play Families politikası).
    personalized_ads: bool(o.child_directed, false)
      ? false
      : bool(o.personalized_ads, f.personalized_ads),
    privacy_policy_url: str(o.privacy_policy_url),
    frequency_minutes: num(o.frequency_minutes, f.frequency_minutes),
    session_cap: num(o.session_cap, f.session_cap),
    action_delay_ms: num(o.action_delay_ms, f.action_delay_ms),
    respect_quiet_hours: bool(o.respect_quiet_hours, f.respect_quiet_hours),
    test_device_ids: Array.isArray(o.test_device_ids)
      ? o.test_device_ids.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      : [],
    triggers: {
      save: bool(trig.save, f.triggers.save),
      complete: bool(trig.complete, f.triggers.complete),
      invite: bool(trig.invite, f.triggers.invite),
      timer_start: bool(trig.timer_start, f.triggers.timer_start),
    },
  };
}

/** Bu platformun geçiş reklamı birimi; yoksa `null`. */
export function interstitialUnitId(config: AdConfig): string | null {
  return Platform.OS === 'ios' ? config.interstitial.ios : config.interstitial.android;
}

type AdSettingsStore = {
  config: AdConfig;
  hydrated: boolean;

  /** Önbellekten okur; ağ beklemeden karar verilebilsin diye. */
  hydrate: () => Promise<void>;
  /** `GET /ads/config` ile tazeler. Kimlik doğrulaması gerektirmez. */
  refresh: () => Promise<void>;

  /**
   * Belirtilen tetikleyici için reklam **denenebilir mi**.
   *
   * Yalnızca panel ayarına bakar: ana anahtar açık mı, bu tetikleyici seçili
   * mi, bu platform için bir birim kimliği var mı. Frekans sınırı, ön plan
   * kontrolü, ninni çalıyor mu gibi kapılar `adService`'e ait — onlar zamana
   * ve uygulama durumuna bağlı, buradaki ayar ise durağan.
   */
  shouldShowFor: (trigger: AdTrigger) => boolean;
};

export const useAdSettingsStore = create<AdSettingsStore>((set, get) => ({
  config: AD_CONFIG_FALLBACK,
  hydrated: false,

  hydrate: async () => {
    const db = await getDb();
    const row = await db.getFirstAsync<{ payload: string }>(
      'SELECT payload FROM remote_config_cache WHERE key = ?',
      [CACHE_KEY],
    );
    if (!row) {
      set({ hydrated: true });
      return;
    }
    try {
      set({ config: normalizeAdConfig(JSON.parse(row.payload)), hydrated: true });
    } catch {
      // Bozuk önbellek sessizce yok sayılır; tazeleme yerine koyacak.
      set({ config: AD_CONFIG_FALLBACK, hydrated: true });
    }
  },

  refresh: async () => {
    // Giriş yapılmamışken de çağrılır; uç kimlik doğrulaması istemiyor.
    const data = await api.get<unknown>(endpoints.adsConfig, { auth: false });
    const config = normalizeAdConfig(data);

    const db = await getDb();
    await db.runAsync(
      `INSERT INTO remote_config_cache (key, payload, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
      [CACHE_KEY, JSON.stringify(config), new Date().toISOString()],
    );

    set({ config, hydrated: true });
  },

  shouldShowFor: (trigger) => {
    const { config } = get();
    if (!config.enabled) return false;
    if (!config.triggers[trigger]) return false;
    // Test kimlikleri açıkken birim kimliği gerekmiyor: `adService`
    // `TestIds.INTERSTITIAL` kullanıyor.
    if (!config.use_test_ids && !interstitialUnitId(config)) return false;
    return true;
  },
}));
