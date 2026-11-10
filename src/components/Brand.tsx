import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { imageSource } from '../core/api/assets';
import { useAuthStore } from '../core/auth/useAuthStore';
import { useBrandingStore } from '../core/branding/useBrandingStore';
import { colors } from '../core/theme';

/**
 * Yönetim panelinden yüklenen logoyu gösterir; henüz yüklenmemişse ya da
 * indirilemiyorsa yedek olarak emoji kullanılır — logo yokken ekran boş kalmaz.
 */
export function BrandLogo({
  slot,
  size,
  fallback = '',
}: {
  slot: 'project' | 'app';
  size: number;
  fallback?: string;
}) {
  const url = useBrandingStore((s) => (slot === 'project' ? s.projectLogo : s.appLogo));
  const source = imageSource(url);

  if (!source) {
    return <Text style={{ fontSize: size * 0.82 }}>{fallback}</Text>;
  }

  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel={slot === 'project' ? 'Proje logosu' : 'Uygulama logosu'}
    />
  );
}

/** Ad soyaddan baş harfler — profil görseli yoksa onun yerine geçer. */
export function initialsOf(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';
  return (first + last).toLocaleUpperCase('tr-TR');
}

/** Dairesel profil görseli; yoksa baş harfler. */
export function Avatar({ size = 36 }: { size?: number }) {
  const user = useAuthStore((s) => s.user);
  const source = imageSource(user?.avatar_path);
  const round = { width: size, height: size, borderRadius: size / 2 };

  if (source) {
    return <Image source={source} style={round} accessibilityRole="image" accessibilityLabel="Profil görselin" />;
  }

  return (
    <View style={[s.initials, round]}>
      <Text style={[s.initialsText, { fontSize: size * 0.38 }]}>{initialsOf(user?.full_name)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  initials: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  initialsText: { color: colors.primary, fontWeight: '800' },
});
