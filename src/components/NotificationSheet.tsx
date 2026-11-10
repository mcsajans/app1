import React, { useEffect, useState } from 'react';
import {
  Animated, Easing, Modal, Pressable, ScrollView,
  StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stopAlert } from '../core/notifications/alertSound';
import { useInboxStore } from '../core/notifications/useInboxStore';
import { NOTIFICATION_TYPE_ICONS, timeAgo } from '../core/notifications/inboxFormat';
import { useModuleStore } from '../core/modules/useModuleStore';
import { isModuleActive } from '../core/modules/catalog';
import { MODULE_SCREENS } from '../core/navigation/moduleScreens';
import { navigateTo } from '../core/navigation/navigationRef';
import { Icon } from './Icon';
import { Loading } from './ui';
import { colors, moduleTint, radius, shadow, spacing, typography } from '../core/theme';
import type { AppNotification, NotificationType } from '../core/api/modules';
import type { ModuleKey } from '../core/modules/types';

const DURATION = 200;

/**
 * Tür rozetinin zemin rengi.
 *
 * İkon adı ve etiket `inboxFormat.ts`'te (React'siz, test edilebilir); renk
 * burada, çünkü temaya bağlı ve çizimle birlikte değişiyor. Tonlar modül
 * ızgarasındaki pastel aileden alındı — kullanıcı aynı rengi ana ekranda da
 * görüyor ve tür bir bakışta tanınıyor.
 */
const TYPE_TINT: Record<NotificationType, string> = {
  vaccine: moduleTint.vaccines,
  task: moduleTint.tasks,
  reminder: moduleTint.reminders,
  routine: moduleTint.timeline,
  family: moduleTint.family,
};

/**
 * Alttan açılan bildirim listesi (TEKNIK_DOKUMAN.md §22.13).
 *
 * Ayrı bir ekran yerine alt çekmece: zil navigasyon ağacının **dışında**, üst
 * şeritte duruyor ve ağaca yeni bir ekran eklemek modül ızgarasında da
 * görünmesine yol açardı. Çekmece ayrıca "bak ve kapat" davranışına daha
 * uygun — kullanıcı bildirime bakıp bulunduğu ekrana dönüyor.
 */
export function NotificationSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const items = useInboxStore((s) => s.items);
  const unread = useInboxStore((s) => s.unreadCount);
  const loading = useInboxStore((s) => s.loading);
  const error = useInboxStore((s) => s.error);
  const states = useModuleStore((s) => s.states);

  const [progress] = useState(() => new Animated.Value(0));
  const [exiting, setExiting] = useState(false);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (!visible) setExiting(true);
  }

  // Çekmece her açılışta tazelenir: rozet arka planda güncelleniyor olsa bile
  // listenin kendisi eski kalabilir ve kullanıcı sayıyla içeriği uyuşmaz görür.
  useEffect(() => {
    if (!visible) return;
    /*
     * Çekmecenin açılması sesi **anında** keser (notification-voice.md §2.2.1):
     * kullanıcı bildirime baktığı an uyarının işi bitmiştir, tekrar sayısı
     * dolmamış olsa bile. Kesme `load()`'dan önce: ağ turunu beklemek, zile
     * basıldıktan sonra saniyelerce çalan bir ses demek olurdu.
     */
    stopAlert('inbox');
    void useInboxStore.getState().load();
  }, [visible]);

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

  /**
   * Bildirime dokunma: okundu işaretle ve hedef ekrana git.
   *
   * Hedef modül **kapalıysa** yönlendirme yapılmaz; ağaçta o ekran hiç
   * kayıtlı değil ve `navigate` sessizce hiçbir şey yapardı. Satır yine de
   * okundu sayılır — kullanıcı onu görmüş oluyor.
   */
  const open = (n: AppNotification) => {
    void useInboxStore.getState().markRead(n.id);
    const target = n.target_screen as ModuleKey | null;
    if (!target) {
      onClose();
      return;
    }
    const reachable = MODULE_SCREENS[target] && isModuleActive(target, states);
    onClose();
    if (reachable) navigateTo(target);
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[s.scrim, { opacity: progress }]}>
        <Pressable
          style={s.fill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Bildirimleri kapat"
        />
      </Animated.View>

      <Animated.View
        style={[
          s.sheet,
          { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] },
        ]}
      >
        <View style={s.handle} />

        <View style={s.head}>
          <Text style={s.title}>Bildirimler</Text>
          {unread > 0 ? (
            <Pressable
              onPress={() => void useInboxStore.getState().markAllRead()}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={s.action}>Tümünü okundu işaretle</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {loading && items.length === 0 ? (
          <Loading label="Bildirimler yükleniyor…" />
        ) : items.length === 0 ? (
          <View style={s.empty}>
            <Icon name="bell" size={44} color={colors.textFaint} />
            <Text style={s.emptyTitle}>Henüz bildirim yok</Text>
            <Text style={s.emptyDetail}>
              Aileden biri kayıt eklediğinde, sana görev atandığında ya da aşı
              randevusu girildiğinde burada görünür.
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {items.map((n) => {
              const tint = TYPE_TINT[n.type] ?? TYPE_TINT.routine;
              const icon = NOTIFICATION_TYPE_ICONS[n.type] ?? NOTIFICATION_TYPE_ICONS.routine;
              return (
                <Pressable
                  key={n.id}
                  onPress={() => open(n)}
                  style={({ pressed }) => [
                    s.row,
                    !n.is_read && s.rowUnread,
                    pressed && s.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${n.title}. ${n.body}`}
                >
                  <View style={[s.icon, { backgroundColor: tint }]}>
                    <Icon name={icon} size={18} color={colors.text} />
                  </View>

                  <View style={s.rowText}>
                    <Text style={[s.rowTitle, !n.is_read && s.rowTitleUnread]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    <Text style={s.rowBody} numberOfLines={2}>
                      {n.body}
                    </Text>
                    <Text style={s.rowMeta} numberOfLines={1}>
                      {timeAgo(n.created_at)}
                      {/* Birden fazla bebeği olan ebeveyn hangisi olduğunu
                          görmeli; tek bebekte bu satır gereksiz gürültü. */}
                      {n.baby_name ? ` · ${n.baby_name}` : ''}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => void useInboxStore.getState().remove(n.id)}
                    hitSlop={10}
                    style={s.remove}
                    accessibilityRole="button"
                    accessibilityLabel="Bildirimi sil"
                  >
                    <Icon name="close" size={16} color={colors.textFaint} />
                  </Pressable>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
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
    // Liste uzun olabilir; çekmece ekranın dörtte üçünü aşmaz ki altındaki
    // bağlam tamamen kaybolmasın.
    maxHeight: '75%',
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
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  title: { ...typography.h3, color: colors.text },
  action: { ...typography.small, color: colors.primary, fontWeight: '700' },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  /*
   * Okunmamış satırın sol kenarında mavi şerit. Kalın yazı tek başına
   * yetmiyordu: iki satır yan yana geldiğinde fark ancak dikkatle bakınca
   * görülüyordu.
   */
  rowUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  pressed: { opacity: 0.7 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...typography.small, color: colors.textSoft, fontWeight: '600' },
  rowTitleUnread: { color: colors.text, fontWeight: '800' },
  rowBody: { ...typography.body, color: colors.text },
  rowMeta: { ...typography.tiny, color: colors.textFaint },
  remove: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyTitle: { ...typography.h3, color: colors.text, textAlign: 'center' },
  emptyDetail: {
    ...typography.small,
    color: colors.textSoft,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
