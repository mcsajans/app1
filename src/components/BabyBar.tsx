import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { imageSource } from '../core/api/assets';
import { useBabyStore } from '../core/stores/useBabyStore';
import { calcAge, calcCorrectedAge } from '../core/utils/age';
import { Icon } from './Icon';
import { NotificationBell } from './NotificationBell';
import { colors, radius, shadow, spacing, typography } from '../core/theme';
import type { Baby } from '../core/types';

/**
 * Üst şerit — şablondaki başlık.
 *
 * Solda yuvarlak bebek fotoğrafı (mavi halkalı), yanında bebeğin adı ve
 * "Yaş: …" satırı, sağda **zil** ve ayarlar düğmesi. Uygulama logosu bilinçli
 * olarak buraya konmadı: şablonda yok ve şeritte dört şeyin yan yana durması
 * adı sıkıştırırdı. Logo giriş/yükleme ekranlarında görünüyor.
 *
 * Zil, şartname gereği ayarların **yanında** (modules_doc/bildirimler.md:
 * "menü butonunun yanına"). Sol tarafa konsaydı bebek alanının dokunma
 * hedefini bölerdi; o alan zaten profile gidiyor.
 *
 * Üst güvenli alanı kendisi tüketir; alt ağaç `top: 0` ile çalışır
 * (bkz. App.tsx), böylece çift boşluk oluşmaz.
 */

/** Gerçek yaş birincildir; prematürede düzeltilmiş yaş etiketle eklenir (§14.1.1). */
function ageLabel(baby: Baby | null): string {
  if (!baby) return 'Bebek profili yok';
  const actual = calcAge(baby.birthDate).label;
  const corrected = calcCorrectedAge(baby.birthDate, {
    isPremature: baby.isPremature,
    gestationalAgeWeeks: baby.gestationalAgeWeeks,
  });
  return corrected ? `Yaş: ${actual} · düzeltilmiş ${corrected.label}` : `Yaş: ${actual}`;
}

export function BabyAvatar({ baby, size = 52 }: { baby: Baby | null; size?: number }) {
  const src = imageSource(baby?.photoUrl);
  const round = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[s.avatarRing, round]}>
      {src ? (
        <Image source={src} style={[s.avatarImg, round]} resizeMode="cover" />
      ) : (
        baby ? (
          <Text style={[s.avatarText, { fontSize: size * 0.36 }]}>
            {baby.firstName.slice(0, 1).toLocaleUpperCase('tr-TR')}
          </Text>
        ) : (
          <Icon name="babies" size={size * 0.52} color={colors.primary} />
        )
      )}
    </View>
  );
}

export function BabyBar({
  onOpenBaby,
  onOpenSettings,
  onOpenNotifications,
}: {
  onOpenBaby: () => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
}) {
  const insets = useSafeAreaInsets();
  const babies = useBabyStore((st) => st.babies);
  const selectedId = useBabyStore((st) => st.selectedId);
  const selected = babies.find((b) => b.id === selectedId) ?? null;

  return (
    <View style={[s.bar, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable
        onPress={onOpenBaby}
        style={({ pressed }) => [s.babyArea, pressed && s.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Bebek profillerini aç"
      >
        <BabyAvatar baby={selected} />
        <View style={s.texts}>
          <Text style={s.name} numberOfLines={1}>
            {selected?.firstName ?? 'Bebek ekle'}
          </Text>
          <Text style={s.age} numberOfLines={1}>
            {ageLabel(selected)}
          </Text>
        </View>
      </Pressable>

      <NotificationBell onPress={onOpenNotifications} />

      <Pressable
        onPress={onOpenSettings}
        style={({ pressed }) => [s.settings, pressed && s.pressed]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Hesap ve ayarlar menüsünü aç"
      >
        {/* Şablondaki "sliders" ikonu. Önce elle çizilmişti (iki çizgi + iki
            nokta); artık uygulamanın geri kalanıyla aynı setten geliyor. */}
        <Icon name="settings" size={24} color={colors.text} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
  },
  // Zil ve ayarlar eklenince aralarındaki `gap` fazla geldi: iki yuvarlak
  // düğme arasında 12 px boşluk, şeridin sağ ucunu dağıtıyordu.
  babyArea: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  pressed: { opacity: 0.6 },
  avatarRing: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2.5,
    borderColor: '#A8C8EC',
    overflow: 'hidden',
    ...shadow.card,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: colors.primary, fontWeight: '800' },
  texts: { flex: 1 },
  name: { ...typography.h3, color: colors.text },
  age: { ...typography.small, color: colors.textSoft, marginTop: 1 },
  settings: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
