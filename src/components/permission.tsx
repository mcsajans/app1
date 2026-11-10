import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useBabyStore } from '../core/stores/useBabyStore';
import { Icon } from './Icon';
import { colors, radius, spacing, typography } from '../core/theme';

/**
 * Seçili bebekte yazma yetkim var mı?
 *
 * Asıl engel **sunucudadır** (`requireBaby('editor')`, §5.5); buradaki kontrol
 * güvenlik değil, kullanıcıya kesin reddedilecek bir düğme sunmamak içindir.
 * Olmasaydı salt okuyan üye "Kaydet"e basıp "Kayıt bulunamadı" hatası alırdı —
 * varlık sızdırmamak için 404 döndüğünden hata mesajı da yanıltıcı olurdu.
 */
export function useCanEdit(): boolean {
  const baby = useBabyStore((s) => s.selected());
  if (!baby) return false;
  return baby.myPermission !== 'viewer';
}

/** Salt okuma kipinde ekranın başında duran açıklama. */
export function ReadOnlyBanner() {
  const baby = useBabyStore((s) => s.selected());
  if (!baby || baby.myPermission !== 'viewer') return null;

  return (
    <View style={s.banner}>
      <View style={s.titleRow}>
        <Icon name="warning" size={16} color={colors.warning} />
        <Text style={s.title}>Yalnızca görüntüleme</Text>
      </View>
      <Text style={s.body}>
        {baby.firstName} için kayıtları görebilir ama ekleyip değiştiremezsin.
        {baby.ownerName ? ` Yetkiyi ${baby.ownerName} değiştirebilir.` : ''}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.textFaint,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...typography.small, color: colors.textSoft, fontWeight: '700' },
  body: { ...typography.tiny, color: colors.textFaint, marginTop: 2 },
});
