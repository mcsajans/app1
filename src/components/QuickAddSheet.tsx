import React, { useEffect, useState } from 'react';
import {
  Animated, Easing, Modal, Pressable, ScrollView,
  StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { activeModules } from '../core/modules/catalog';
import { useModuleStore } from '../core/modules/useModuleStore';
import { MODULE_SCREENS } from '../core/navigation/moduleScreens';
import { openModule } from '../core/navigation/navigationRef';
import { Icon } from './Icon';
import { colors, radius, shadow, spacing, typography } from '../core/theme';
import type { ModuleKey, ModuleMeta } from '../core/modules/types';

const DURATION = 200;

/**
 * Hızlı kayıt sayfasında gösterilmeyen modüller — kayıt girilmeyenler.
 *
 * `feeding` de burada: kendisi bir kabuk, kayıt girilen şey alt modülleri.
 * Hem kabuk hem dört alt modül listelenseydi aynı ekran beş kez görünürdü.
 */
const NOT_RECORDABLE: ModuleKey[] = [
  'babies', 'timeline', 'reports', 'family', 'music', 'feeding',
];

/**
 * Alt çubuğun ortasındaki (＋) düğmesinin açtığı sayfa.
 *
 * Şablonda bu düğmenin ne yaptığı yazmıyor; en doğal karşılığı "hangi kaydı
 * gireceksin?" sorusu. Liste modül kataloğundan türetilir, yani kapalı bir
 * modül burada da görünmez.
 *
 * Kayıt girilmeyen modüller (bebek profilleri, akış, raporlar, aile, müzik)
 * elenir: bunlar ana ekrandaki ızgarada zaten var ve hızlı kayıt listesinde
 * durmaları listeyi anlamsız uzatırdı.
 */
export function QuickAddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const states = useModuleStore((s) => s.states);

  const options = activeModules(states).filter(
    (m) => MODULE_SCREENS[m.key] && !NOT_RECORDABLE.includes(m.key),
  );

  const [progress] = useState(() => new Animated.Value(0));
  const [exiting, setExiting] = useState(false);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (!visible) setExiting(true);
  }

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: DURATION,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setExiting(false);
    });
    return () => animation.stop();
  }, [visible, progress]);

  if (!visible && !exiting) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });

  /*
   * Alt modüller artık kendi ekranı olmayan sekmeler; `openModule` onları üst
   * modülün ilgili sekmesinde açar. Doğrudan `navigateTo(key)` çağrılsaydı
   * ağaçta böyle bir rota olmadığı için dokunuş sessizce hiçbir şey yapmazdı.
   */
  const go = (m: ModuleMeta) => {
    onClose();
    openModule(m.key, m.parent);
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[s.scrim, { opacity: progress }]}>
        <Pressable
          style={s.fill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Hızlı kayıt sayfasını kapat"
        />
      </Animated.View>

      <Animated.View
        style={[
          s.sheet,
          { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] },
        ]}
      >
        <View style={s.handle} />
        <Text style={s.title}>Ne kaydetmek istiyorsun?</Text>

        <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
          {options.map((m) => (
            <Pressable
              key={m.key}
              onPress={() => go(m)}
              style={({ pressed }) => [s.item, pressed && s.pressed]}
              accessibilityRole="button"
              accessibilityLabel={m.title}
            >
              <View style={[s.box, { backgroundColor: m.color }]}>
                <Icon name={m.key} size={30} color={colors.text} />
              </View>
              <Text style={s.label} numberOfLines={2}>
                {m.title}
              </Text>
            </Pressable>
          ))}
          {options.length === 0 ? (
            <Text style={s.empty}>Açık kayıt modülü yok.</Text>
          ) : null}
        </ScrollView>
      </Animated.View>
    </Modal>
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
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    ...shadow.raised,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, rowGap: spacing.lg },
  item: { width: '22%', alignItems: 'center', gap: spacing.xs },
  pressed: { opacity: 0.7 },
  box: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  label: { ...typography.tiny, color: colors.text, fontWeight: '600', textAlign: 'center' },
  empty: { ...typography.small, color: colors.textSoft },
});
