import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View,
} from 'react-native';

import { colors, radius, spacing, typography } from '../core/theme';

/**
 * Açılış ekranı: ortada zıplayan uygulama ikonu, hemen altında dolan çubuk.
 *
 * **Yerel uygulama ikonu kullanılıyor**, sunucudan gelen marka logosu değil.
 * Açılışta logo henüz indirilmemiş olabiliyor ve ekran bir süre boş kalıyordu;
 * paketlenmiş ikon ilk karede hazır.
 *
 * Dosya olarak `icon.png` değil **`android-icon-foreground.png`** seçildi:
 * `icon.png` opak ve kare, zeminin üstünde kenarları belli olan bir kutu gibi
 * duruyordu. Uyarlanabilir ikonun ön planı saydam, yani logo ekranla
 * kaynaşıyor. Bedeli, içeriğin tuvalin ancak yarısını kaplaması (güvenli
 * alan kuralı) — görsel bu yüzden daha büyük çizilir.
 *
 * Her iki animasyon da `useNativeDriver` ile çalışır — JS iş parçacığı
 * açılışta zaten meşgul (göç, SecureStore okuması, ilk istek) ve animasyon
 * orada kalırsa takılıyordu. Bu yüzden çubuk `width` ile değil `scaleX` ile
 * doldurulur: genişlik native sürücüde animasyonlanamıyor.
 */

/** Çubuğun genişliği; `scaleX` hesabı buna dayandığı için sabit. */
const BAR_WIDTH = 180;
const BAR_HEIGHT = 6;

/** Zıplama yüksekliği — daha fazlası oyuncak değil huzursuz görünüyordu. */
const HOP = 22;

export function SplashBounce({ label }: { label: string }) {
  /*
   * `useRef(new Animated.Value(0)).current` yerine tembel `useState`:
   * ref'e render sırasında erişmek React'in kurallarına aykırı (lint bunu
   * yakalıyor) ve `new Animated.Value(0)` her render'da yeniden kurulurdu.
   */
  const [hop] = useState(() => new Animated.Value(0));
  const [fill] = useState(() => new Animated.Value(0));
  /**
   * Sistemde "hareketi azalt" açıksa zıplama yapılmaz.
   *
   * Vestibüler duyarlılığı olan kullanıcılar için tekrarlayan hareket rahatsız
   * edici; çubuk yine dolar, yalnızca ikon sabit durur.
   */
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      hop.setValue(0);
      return;
    }
    /*
     * Zıplama iki ayrı eğri: yukarı çıkarken yavaşlayan (`out`), inerken
     * hızlanan (`in`). Tek bir eğri kullanılınca hareket mekanik duruyordu —
     * yerçekimi hissi bu asimetriden geliyor. Tepede ve yerde kısa birer
     * bekleme, zıplamayı "nefes alan" bir ritme oturtuyor.
     */
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hop, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(hop, {
          toValue: 0,
          duration: 340,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(140),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hop, reduceMotion]);

  useEffect(() => {
    /*
     * Çubuk gerçek bir ilerleme göstermiyor: açılışta ne kadar iş kaldığını
     * bilmiyoruz (göç, oturum yenileme, ilk istek — hepsi ağ hızına bağlı).
     * Dürüst olan, dolup baştan başlayan bir döngü: "çalışıyorum" der, yalan
     * bir yüzde göstermez.
     */
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fill, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fill, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [fill]);

  const translateY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -HOP] });

  /*
   * `scaleX` görünümü **merkezinden** ölçekler; sola yapışık dolum için
   * kaybolan yarım genişlik kadar geri kaydırılır. scaleX = 0 iken çubuk
   * tamamen kaybolup bir an titrediği için 0.02'den başlar.
   */
  const scaleX = fill.interpolate({ inputRange: [0, 1], outputRange: [0.02, 1] });
  const shift = fill.interpolate({
    inputRange: [0, 1],
    outputRange: [-BAR_WIDTH / 2, 0],
  });

  return (
    <View style={s.wrap}>
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Image
          source={require('../../assets/android-icon-foreground.png')}
          style={s.logo}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="Bebiqa"
        />
      </Animated.View>

      <View style={s.barTrack}>
        <Animated.View
          style={[s.barFill, { transform: [{ translateX: shift }, { scaleX }] }]}
        />
      </View>

      <Text style={s.label} accessibilityLiveRegion="polite">
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: spacing.xl,
  },
  /*
   * Uyarlanabilir ikonun ön planı tuvalin ~%55'ini kaplar (kalanı güvenli
   * alan), bu yüzden görünen boyut istenenin yaklaşık iki katı verilir.
   */
  logo: { width: 200, height: 200 },

  barTrack: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },

  label: { ...typography.small, color: colors.textSoft, marginTop: -spacing.md },
});
