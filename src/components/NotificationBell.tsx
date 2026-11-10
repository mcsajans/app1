import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useInboxStore } from '../core/notifications/useInboxStore';
import { unreadLabel } from '../core/notifications/inboxFormat';
import { Icon } from './Icon';
import { colors, radius, typography } from '../core/theme';

/**
 * Üst şeritteki zil ve okunmamış rozeti (TEKNIK_DOKUMAN.md §22.13).
 *
 * Rozet **yalnızca** `unreadCount` üzerinden çizilir; listeyi saymak yanlış
 * olurdu çünkü liste `limit` ile kırpılıyor.
 *
 * Sayı 99'u aşarsa "99+" yazılır. Dört haneli bir sayı rozeti şeridin yarısı
 * kadar genişletir ve bebeğin adını sıkıştırırdı; kaldı ki 100'den sonrası
 * zaten "çok var" demekten öteye bilgi taşımıyor.
 */
export function NotificationBell({ onPress }: { onPress: () => void }) {
  const unread = useInboxStore((s) => s.unreadCount);
  const label = unreadLabel(unread);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.button, pressed && s.pressed]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0 ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'
      }
    >
      <Icon name="bell" size={24} color={colors.text} />
      {unread > 0 ? (
        <View style={[s.badge, unread > 9 && s.badgeWide]}>
          <Text style={s.badgeText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  badge: {
    position: 'absolute',
    // Zilin sağ üstüne oturur; ikonun kendisi 24 px ve kutu 42 px.
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    /*
     * Rozetin etrafındaki beyaz çerçeve, ikonun çizgilerinin rozete
     * değdiği yerde ikisini ayırıyor. Olmadığında "3" rakamı zilin sapıyla
     * birleşip okunmuyordu.
     */
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeWide: { paddingHorizontal: 5 },
  badgeText: {
    ...typography.tiny,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 10,
    lineHeight: 13,
  },
});
