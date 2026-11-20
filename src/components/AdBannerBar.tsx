import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

import { Icon } from './Icon';
import { initAds } from '../core/ads/adService';
import { bannerAllowed, bannerUnitId, useAdSettingsStore } from '../core/ads/useAdSettingsStore';
import { useBannerStore } from '../core/ads/useBannerStore';
import { colors, spacing, typography } from '../core/theme';

/**
 * Ekranın en altındaki sabit banner reklamı.
 *
 * Geçiş reklamından (`adService`) bağımsız: tetikleyiciye bağlı değil,
 * sürekli duruyor ve AdMob tarafından kendi kendine tazeleniyor (tazeleme
 * aralığı AdMob konsolundan, birim ayarından yönetilir — istemcide sabit
 * sayı yok).
 *
 * **Uygulamanın kullanım alanını gerçekten daraltır.** Çubuk kabukta, alt
 * gezinme çubuğunun ALTINDA duruyor; gezinme çubuğu onun üstüne kayıyor ve
 * ekranlar `BottomNavSpaceContext` üzerinden bu kadar daha alt pay bırakıyor.
 * Reklamın içeriğin üzerine binmesi, altta kalan düğmeye yanlışlıkla
 * tıklanmasına ve AdMob'un "accidental click" ihlaline açık kapı olurdu.
 *
 * **Kapatılabilir ama kalıcı değil.** "×" çubuğu kapatıyor; her ekran
 * değişiminde `useBannerStore.reopen()` onu geri açıyor (bkz. `App.tsx`).
 * Kapalıyken yerinde ince bir şerit kalıyor — yeniden açmanın yolu görünür
 * olsun ve çubuk birden belirip düzeni zıplatmasın diye.
 *
 * Cihazın alt güvenli alanı (jest çubuğu) **bu çubuğun** dolgusunda; ölçülen
 * yükseklik ise yalnızca içerik. İkisini ayırmak gerekiyor çünkü `Screen`
 * zaten `insets.bottom` ekliyor; ölçüme dâhil edilseydi pay iki kez sayılırdı.
 */
export function AdBannerBar() {
  const insets = useSafeAreaInsets();
  const config = useAdSettingsStore((s) => s.config);
  const collapsed = useBannerStore((s) => s.collapsed);
  const failed = useBannerStore((s) => s.failed);
  const seq = useBannerStore((s) => s.seq);
  const setCollapsed = useBannerStore((s) => s.setCollapsed);
  const setFailed = useBannerStore((s) => s.setFailed);
  const setHeight = useBannerStore((s) => s.setHeight);

  /*
   * SDK'nın kurulu olduğundan emin ol. Kabuk açılışta zaten `initAds()`
   * çağırıyor ama o sırada önbellekteki ayar "reklam kapalı" olabilir;
   * panelden açıldığında banner, SDK başlatılmadan istek atıp sessizce
   * başarısız olurdu. Çağrı bedava: `initAds` ikinci kez çağrıldığında
   * hiçbir şey yapmıyor.
   */
  useEffect(() => {
    if (bannerAllowed(config)) void initAds();
  }, [config]);

  const unitId = config.use_test_ids ? TestIds.BANNER : bannerUnitId(config);

  /*
   * Panel kapalıysa ya da istek başarısızsa hiç çizilmez: ekranın altında boş
   * bir şerit bırakmanın anlamı yok. Ölçülen yükseklik depoda kalır ama
   * kabuk onu yalnızca çubuk görünürken kullanıyor (`App.tsx`), yani bayat
   * değer bir yere sızmıyor — render sırasında depoya yazmamak için
   * (React derleyicisinin saflık kuralı) bilerek böyle.
   */
  if (!bannerAllowed(config) || failed || !unitId) return null;

  return (
    <View style={[s.bar, { paddingBottom: insets.bottom }]}>
      <View
        style={s.inner}
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      >
        {collapsed ? (
          <Pressable
            onPress={() => setCollapsed(false)}
            style={s.strip}
            accessibilityRole="button"
            accessibilityLabel="Reklamı göster"
          >
            <Text style={s.stripText}>Reklamı göster</Text>
          </Pressable>
        ) : (
          <>
            <BannerAd
              // `seq` değişince bileşen yeniden bağlanır ve YENİ bir istek
              // gider; başarısız bir yüklemeden sonra tekrar denemenin yolu bu.
              key={seq}
              unitId={unitId}
              /*
               * Çapalı uyarlanabilir banner: yüksekliği cihaz genişliğine
               * göre AdMob belirliyor (telefonda ~50-60 dp). Sabit `BANNER`
               * boyutu geniş ekranlarda kenarlarda boşluk bırakıyordu.
               */
              size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
              requestOptions={{
                // Panel "kişiselleştirme kapalı" diyorsa (ya da çocuklara
                // yönelik beyan açıksa) istek de kişiselleştirilmemiş gider.
                requestNonPersonalizedAdsOnly: !config.personalized_ads,
              }}
              onAdFailedToLoad={() => setFailed(true)}
            />
            <Pressable
              onPress={() => setCollapsed(true)}
              // 14 px'lik bir çarpıya parmakla nişan almak zor; dokunma alanı
              // simgeden belirgin biçimde büyük tutuluyor.
              hitSlop={10}
              style={s.close}
              accessibilityRole="button"
              accessibilityLabel="Reklamı kapat"
            >
              <Icon name="close" size={14} color={colors.textSoft} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inner: { alignItems: 'center', justifyContent: 'center' },
  close: {
    position: 'absolute',
    top: 2,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    opacity: 0.9,
  },
  strip: {
    height: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripText: { ...typography.tiny, color: colors.textFaint, paddingHorizontal: spacing.md },
});
