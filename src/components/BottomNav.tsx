import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from './Icon';
import { colors, radius, shadow } from '../core/theme';

/**
 * Alt gezinme çubuğu — şablondaki beş öğeli kabuk.
 *
 * Bu çubuk **modül sekmesi değildir**: modüller ana ekrandaki ızgarada durur.
 * Buradaki beş öğe uygulamanın sabit iskeleti: ana sayfa, günlük akış, hızlı
 * kayıt (ortadaki yuvarlak düğme), raporlar ve hesap. Modül sayısı artsa da
 * bu çubuk değişmez — eskiden sekmeler modüllerden türetildiği için taşıyordu.
 *
 * Çubuk navigasyon ağacının dışında, App kabuğunda durur; yönlendirmeyi
 * `navigationRef` üzerinden yapar (bkz. navigationRef.ts).
 */

export type NavKey = 'home' | 'timeline' | 'reports' | 'account';

/** Çubuk gövdesinin yüksekliği (cihazın alt güvenli alanı hariç). */
export const NAV_HEIGHT = 64;

/** Ortadaki yuvarlak düğmenin çubuğun üstüne taştığı miktar. */
export const NAV_OVERHANG = 22;

/**
 * Ekranların alt payına eklenecek toplam: çubuk gövdesi + taşan düğme.
 * Cihazın `insets.bottom` değeri buna **dahil değildir**; onu `Screen` kendi
 * ekler, çünkü çubuğun olmadığı ekranlarda da gerekir.
 */
export const NAV_SPACE = NAV_HEIGHT + NAV_OVERHANG;

/**
 * Sekme ikonu.
 *
 * Önceden dört ikon `View`'lardan **elle çizilmişti** (üçgen çatı + kare gövde,
 * üç nokta-çizgi, üç çubuk…). Çalışıyordu ama ikonlar kaba duruyordu ve her
 * yeni sekme yeni bir çizim demekti. Artık uygulamanın geri kalanıyla aynı
 * setten geliyorlar (components/Icon.tsx).
 */
function TabIcon({ name, active }: { name: IconName; active: boolean }) {
  return <Icon name={name} size={26} color={active ? colors.navActive : colors.navIdle} />;
}

/**
 * Tek sekme. Modül düzeyinde tanımlı: `BottomNav` içinde tanımlansaydı her
 * render'da yeni bir bileşen tipi doğar ve React alt ağacı söküp yeniden
 * kurardı.
 */
function NavItem({
  nav,
  label,
  active,
  onNavigate,
  children,
}: {
  nav: NavKey;
  label: string;
  active: NavKey | null;
  onNavigate: (key: NavKey) => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={() => onNavigate(nav)}
      style={s.item}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active === nav }}
    >
      {children}
    </Pressable>
  );
}

export function BottomNav({
  active,
  onNavigate,
  onQuickAdd,
}: {
  active: NavKey | null;
  onNavigate: (key: NavKey) => void;
  onQuickAdd: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.bar, { paddingBottom: insets.bottom }]}>
      <View style={s.row}>
        <NavItem nav="home" label="Ana sayfa" active={active} onNavigate={onNavigate}>
          <TabIcon name="home" active={active === 'home'} />
        </NavItem>
        <NavItem nav="timeline" label="Günlük akış" active={active} onNavigate={onNavigate}>
          <TabIcon name="feed" active={active === 'timeline'} />
        </NavItem>

        {/* Ortadaki hızlı kayıt düğmesi çubuğun üstüne taşar. */}
        <View style={s.fabSlot}>
          <Pressable
            onPress={onQuickAdd}
            style={({ pressed }) => [s.fab, pressed && s.fabPressed]}
            accessibilityRole="button"
            accessibilityLabel="Hızlı kayıt ekle"
          >
            <Icon name="plus" size={30} color="#FFFFFF" />
          </Pressable>
        </View>

        <NavItem nav="reports" label="Raporlar" active={active} onNavigate={onNavigate}>
          <TabIcon name="reports" active={active === 'reports'} />
        </NavItem>
        <NavItem nav="account" label="Hesabım" active={active} onNavigate={onNavigate}>
          <TabIcon name="account" active={active === 'account'} />
        </NavItem>
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.raised,
  },
  row: { flexDirection: 'row', alignItems: 'center', height: NAV_HEIGHT },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },

  // ── orta düğme ──
  fabSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    // Çubuğun üstüne taşsın.
    marginTop: -NAV_OVERHANG,
    ...shadow.raised,
  },
  fabPressed: { opacity: 0.85 },
});
