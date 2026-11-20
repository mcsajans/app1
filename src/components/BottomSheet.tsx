import React, { useEffect, useState } from 'react';
import {
  Animated, Easing, Modal, Pressable, ScrollView,
  StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing, typography } from '../core/theme';

const DURATION = 200;

/**
 * Alttan açılan sayfa iskeleti — tutamaç, karartma, kayma animasyonu.
 *
 * Aynı kalıp uygulamada birkaç yerde elle yazılmıştı (`QuickAddSheet`,
 * `ActiveDurationSheet`…). Elle kayıt sayfaları ikinci ve üçüncü kopyayı
 * doğuracağı için ortak bir iskelet çıkarıldı. Mevcut sayfalar bilerek
 * dönüştürülmedi: her birinin kendi düzen ayrıntısı var ve çalışan bir
 * pencereyi yeniden yazmak bu işin konusu değil.
 *
 * Kapanış animasyonu bitene kadar içerik ekranda kalır (`exiting`); aksi
 * hâlde sayfa, aşağı kayarken bir anda boşalırdı.
 */
export function BottomSheet({
  visible,
  title,
  subtitle,
  busy,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Kaydetme sürerken karartmaya dokunmak sayfayı kapatmaz. */
  busy?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

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

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[s.scrim, { opacity: progress }]}>
        <Pressable
          style={s.fill}
          onPress={busy ? undefined : onClose}
          accessibilityRole="button"
          accessibilityLabel={`${title} sayfasını kapat`}
        />
      </Animated.View>

      <Animated.View
        style={[
          s.sheet,
          {
            maxHeight: height * 0.92,
            paddingBottom: insets.bottom + spacing.lg,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={s.handle} />
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          {children}
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
  content: { gap: spacing.sm, paddingBottom: spacing.md },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.small, color: colors.textSoft },
});
