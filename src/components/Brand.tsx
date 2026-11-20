import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { imageSource } from '../core/api/assets';
import { useAuthStore } from '../core/auth/useAuthStore';
import { useBrandingStore } from '../core/branding/useBrandingStore';
import { colors } from '../core/theme';

/**
 * Pakete gömülü Bebiqa yazı markası (`assets/logo.jpg`'den üretildi: zemini
 * saydamlaştırılıp çevresindeki boşluk kırpıldı, çünkü ekran zemini beyaz
 * değil). Ağ beklemeden çizilir.
 */
const APP_LOGO = require('../../assets/logo.png');
/** Dosyanın kendi en-boy oranı (1650x416); çözümleyici boş dönerse yedeği. */
const APP_LOGO_ASSET = Image.resolveAssetSource(APP_LOGO) as
  | { width?: number; height?: number }
  | undefined;
const APP_LOGO_RATIO =
  APP_LOGO_ASSET?.width && APP_LOGO_ASSET.height
    ? APP_LOGO_ASSET.width / APP_LOGO_ASSET.height
    : 1650 / 416;

/**
 * Yazı markası enine uzun ve adı kendi içinde taşıdığı için kare bir logonun
 * yüksekliğiyle çizilirse ekranı kaplıyor; `size`ın bu oranı kadarıyla çizip
 * genişliği kendi en-boy oranından türetiyoruz.
 */
const WORDMARK_SCALE = 0.6;

/**
 * Yönetim panelinden yüklenen logoyu gösterir; henüz yüklenmemişse ya da
 * indirilemiyorsa pakete gömülü Bebiqa yazı markasına düşer — panelde logo
 * tanımlı olmadığında (yeni kurulumlarda olağan) ekran boş kalmaz.
 */
export function BrandLogo({ slot, size }: { slot: 'project' | 'app'; size: number }) {
  const url = useBrandingStore((s) => (slot === 'project' ? s.projectLogo : s.appLogo));
  const remote = imageSource(url);
  const height = remote ? size : size * WORDMARK_SCALE;

  return (
    <Image
      source={remote ?? APP_LOGO}
      style={{ width: remote ? size : height * APP_LOGO_RATIO, height }}
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
