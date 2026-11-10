import React, { useEffect } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { useSaveFeedbackStore } from '../core/feedback/useSaveFeedbackStore';
import { colors, radius, shadow, spacing, typography } from '../core/theme';

/** Onayın kendiliğinden kapanma süresi. */
const AUTO_CLOSE_MS = 1600;

/**
 * Kaydetme penceresi — kabukta, gezinme ağacının **dışında** durur: kaydettikten
 * sonra ekran değiştiren formlarda (bebek profili) pencere ekranla birlikte
 * kaybolmasın.
 *
 * İki durumu var: kaydederken çark, bittiğinde onay. Onay kendiliğinden
 * kapanır — her kayıttan sonra "Tamam"a basmak, günde yirmi kayıt giren
 * ebeveyne yirmi fazladan dokunuş demekti. Düğme yine de duruyor: beklemek
 * istemeyen hemen kapatabilsin.
 */
export function SaveFeedbackModal() {
  const phase = useSaveFeedbackStore((s) => s.phase);
  const message = useSaveFeedbackStore((s) => s.message);
  const hide = useSaveFeedbackStore((s) => s.hide);

  useEffect(() => {
    if (phase !== 'done') return undefined;
    const timer = setTimeout(hide, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [phase, hide]);

  return (
    <Modal
      visible={phase !== 'hidden'}
      transparent
      animationType="fade"
      // Kaydetme sürerken geri tuşu pencereyi kapatmaz: istek hâlâ yolda ve
      // kapanan pencere kullanıcıya "iptal oldu" dedirtirdi.
      onRequestClose={() => { if (phase === 'done') hide(); }}
      statusBarTranslucent
    >
      <View style={s.backdrop}>
        <View style={s.card}>
          {phase === 'busy' ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={s.title}>Kaydediliyor…</Text>
            </>
          ) : (
            <>
              <View style={s.badge}>
                <Icon name="check" size={34} color={colors.success} />
              </View>
              <Text style={s.title}>{message}</Text>
              <Pressable
                onPress={hide}
                style={({ pressed }) => [s.ok, pressed && s.okPressed]}
                accessibilityRole="button"
              >
                <Text style={s.okText}>Tamam</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    minWidth: 240,
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    ...shadow.raised,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E6F6EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.h3, color: colors.text, textAlign: 'center' },
  ok: {
    minWidth: 140,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  okPressed: { opacity: 0.85 },
  okText: { ...typography.h3, color: '#FFFFFF' },
});
