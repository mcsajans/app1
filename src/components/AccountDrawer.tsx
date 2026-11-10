import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Animated, Easing, Modal, Pressable, ScrollView,
  StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../core/auth/useAuthStore';
import { APP_NAME, APP_VERSION } from '../core/config';
import { navigateTo, type RootStackParamList } from '../core/navigation/navigationRef';
import { useBabyStore } from '../core/stores/useBabyStore';
import { Icon, type IconName } from './Icon';
import { colors, radius, spacing, typography } from '../core/theme';
import { Avatar } from './Brand';
import { Button } from './ui';

const PANEL_RATIO = 0.82;
const PANEL_MAX = 360;
const DURATION = 220;

/**
 * Sağdan açılan hesap paneli.
 *
 * `@react-navigation/drawer` kullanılmadı: o paket `react-native-reanimated`
 * ve `react-native-gesture-handler` gerektirir — iki native bağımlılık, yeni
 * bir prebuild ve kalıcı bakım yükü. Buradaki ihtiyaç tek bir düğmeye basınca
 * açılan bir panel; React Native'in kendi `Modal` + `Animated` bileşenleri
 * bunu kaydırma jesti olmadan karşılıyor.
 *
 * Panel navigasyon ağacının dışında durduğu için yönlendirmeyi `navigateTo`
 * (navigationRef) ile yapar.
 */
export function AccountDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(PANEL_MAX, width * PANEL_RATIO);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const babyCount = useBabyStore((s) => s.babies.length);
  const [signingOut, setSigningOut] = useState(false);

  /*
   * `visible` kapanırken Modal'ı HEMEN sökmek kapanış animasyonunu yutardı.
   * Bu yüzden çıkış ayrı izlenir: kapanış isteği animasyonu başlatır, animasyon
   * bitince Modal sökülür.
   *
   * Geçiş efektte değil, RENDER sırasında yakalanır (React'in "türetilmiş
   * durumu render'da düzelt" kalıbı). Efekt içinde setState çağırmak fazladan
   * bir render turu doğurur ve panelin ilk karesinin atlanmasına yol açardı.
   */
  const [exiting, setExiting] = useState(false);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (!visible) setExiting(true);
  }
  const mounted = visible || exiting;
  /*
   * `useRef(...).current` yerine tembel `useState`: bu değer stil üzerinden
   * RENDER'ı besliyor, yani semantik olarak ref değil state. Tembel
   * başlatıcı, Animated.Value'nun her render'da yeniden kurulmamasını
   * garanti eder (useMemo'nun böyle bir garantisi yok).
   */
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: DURATION,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });

    // Geri çağrı eşzamansızdır: render turunun dışında, güvenle setState edilir.
    animation.start(({ finished }) => {
      if (finished && !visible) setExiting(false);
    });

    return () => animation.stop();
  }, [visible, progress]);

  /** Önce paneli kapat, sonra yönlendir — aksi hâlde panel yeni ekranın üstünde kalırdı. */
  const go = useCallback(
    (name: keyof RootStackParamList) => {
      onClose();
      navigateTo(name);
    },
    [onClose],
  );

  const confirmLogout = () => {
    Alert.alert(
      'Çıkış yap',
      'Bu cihazdaki yerel kopya silinecek. Kayıtların hesabında durmaya devam eder.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkış yap',
          style: 'destructive',
          onPress: () => {
            setSigningOut(true);
            // Panel açık kalırsa çıkış sonrası giriş ekranının üstünde asılı kalır.
            onClose();
            void logout().finally(() => setSigningOut(false));
          },
        },
      ],
    );
  };

  if (!mounted) return null;

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [panelWidth, 0],
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Karartma: panelin dışına dokunmak kapatır. */}
      <Animated.View style={[s.scrim, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Hesap menüsünü kapat"
        />
      </Animated.View>

      <Animated.View
        style={[
          s.panel,
          {
            width: panelWidth,
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
            transform: [{ translateX }],
          },
        ]}
      >
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* ── Hesap başlığı ── */}
          <View style={s.header}>
            <Avatar size={56} />
            <View style={s.headerText}>
              <Text style={s.name} numberOfLines={1}>
                {user?.full_name ?? '—'}
              </Text>
              <Text style={s.mail} numberOfLines={1}>
                {user?.email ?? ''}
              </Text>
            </View>
          </View>

          <View style={s.meta}>
            <Text style={s.metaText}>
              {babyCount} kayıtlı bebek
              {user?.phone ? ` · ${user.phone}` : ''}
            </Text>
          </View>

          {/* ── Eylemler ── */}
          <View style={s.group}>
            <Row icon="edit" label="Bilgilerimi düzenle" onPress={() => go('profile')} />
            <Row icon="settings" label="Ayarlar" onPress={() => go('settings')} />
          </View>

          <View style={s.spacer} />

          <Button
            label={signingOut ? 'Çıkış yapılıyor…' : 'Çıkış yap'}
            variant="danger"
            onPress={confirmLogout}
            disabled={signingOut}
          />

          <Text style={s.version}>
            {APP_NAME} v{APP_VERSION}
          </Text>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function Row({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && s.rowPressed]}
      accessibilityRole="button"
    >
      <View style={s.rowIcon}>
        <Icon name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={s.rowLabel}>{label}</Text>
      <Icon name="chevron" size={20} color={colors.textFaint} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  content: { flexGrow: 1, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1 },
  name: { ...typography.h3, color: colors.text },
  mail: { ...typography.small, color: colors.textSoft },
  meta: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  metaText: { ...typography.small, color: colors.textSoft },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.primarySoft },
  rowIcon: { width: 26, alignItems: 'center' },
  rowLabel: { ...typography.body, color: colors.text, fontWeight: '600', flex: 1 },
  rowChevron: { ...typography.h3, color: colors.textFaint },
  spacer: { flex: 1, minHeight: spacing.lg },
  version: { ...typography.tiny, color: colors.textFaint, textAlign: 'center' },
});
