import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PERMISSIONS, usePermissionStore,
  type PermissionKey, type PermissionState,
} from '../core/permissions/usePermissionStore';
import { Icon } from './Icon';
import { colors, radius, shadow, spacing, typography } from '../core/theme';
import { Button } from './ui';

/**
 * Kurulumdan sonra bir kez gösterilen izin sayfası.
 *
 * İşletim sistemi istemleri gerekçesiz çıktığında reddedilme oranı yüksek ve
 * **ikinci bir şans yok**: Android'de bir kez "izin verme" denen izin bir daha
 * sorulamıyor, kullanıcı ayarlara gitmek zorunda kalıyor. Bu yüzden sistem
 * istemlerinden önce ne için istendiği ve verilmezse ne kaybedileceği
 * yazılıyor.
 *
 * Sayfa **engelleyici değildir**: "Şimdi değil" ile geçilebilir ve uygulamanın
 * tamamı izinsiz de çalışır. İzinler sonradan Ayarlar'dan da istenebilir.
 */

const STATE_LABEL: Record<PermissionState, string> = {
  granted: 'İzin verildi',
  denied: 'Reddedildi',
  undetermined: 'Sorulmadı',
};

function Dot({ state }: { state: PermissionState }) {
  const tint =
    state === 'granted' ? colors.success : state === 'denied' ? colors.danger : colors.textFaint;
  return <View style={[s.dot, { backgroundColor: tint }]} />;
}

export function PermissionsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const statuses = usePermissionStore((st) => st.statuses);
  const asking = usePermissionStore((st) => st.asking);
  const askAll = usePermissionStore((st) => st.askAll);
  const ask = usePermissionStore((st) => st.ask);
  const refresh = usePermissionStore((st) => st.refresh);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (visible) void refresh();
  }, [visible, refresh]);

  if (!visible) return null;

  const allAnswered = PERMISSIONS.every((p) => statuses[p.key] !== 'undetermined');

  const onAskAll = () => {
    void (async () => {
      await askAll();
      setDone(true);
    })();
  };

  const onAskOne = (key: PermissionKey) => {
    void ask(key);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.scrim}>
        <View style={[s.sheet, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
          <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
            <Text style={s.title}>Başlamadan önce</Text>
            <Text style={s.lead}>
              Bebiqa üç izin istiyor. Hepsi isteğe bağlı — vermezsen uygulama yine çalışır,
              yalnızca ilgili özellik sessiz kalır.
            </Text>

            {PERMISSIONS.map((p) => {
              const state = statuses[p.key];
              return (
                <View key={p.key} style={s.card}>
                  <View style={s.head}>
                    <Icon name={p.icon} size={26} color={colors.primary} />
                    <View style={s.headText}>
                      <Text style={s.name}>{p.title}</Text>
                      <View style={s.statusRow}>
                        <Dot state={state} />
                        <Text style={s.status}>{STATE_LABEL[state]}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={s.reason}>{p.reason}</Text>
                  <Text style={s.denied}>Verilmezse: {p.ifDenied}</Text>

                  {state === 'undetermined' ? (
                    <Pressable
                      onPress={() => onAskOne(p.key)}
                      disabled={asking}
                      style={s.single}
                      accessibilityRole="button"
                    >
                      <Text style={s.singleText}>İzin ver</Text>
                    </Pressable>
                  ) : null}

                  {state === 'denied' ? (
                    <Text style={s.hint}>
                      Telefonun Ayarlar → Uygulamalar → Bebiqa ekranından sonradan
                      açabilirsin.
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>

          <View style={s.actions}>
            {allAnswered || done ? (
              <Button label="Devam et" onPress={onClose} />
            ) : (
              <Button
                label={asking ? 'İzinler isteniyor…' : 'İzinleri ver'}
                onPress={onAskAll}
                disabled={asking}
              />
            )}
            <Button label="Şimdi değil" variant="ghost" onPress={onClose} disabled={asking} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(16,24,40,0.35)' },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  body: { gap: spacing.md, paddingBottom: spacing.lg },
  title: { ...typography.h1, color: colors.text },
  lead: { ...typography.body, color: colors.textSoft, marginBottom: spacing.sm },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  icon: { fontSize: 28 },
  name: { ...typography.h3, color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { ...typography.tiny, color: colors.textSoft },

  reason: { ...typography.body, color: colors.text, marginTop: spacing.xs },
  denied: { ...typography.small, color: colors.textSoft },
  hint: { ...typography.small, color: colors.textFaint, marginTop: spacing.xs },

  single: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  singleText: { ...typography.small, color: colors.primary, fontWeight: '700' },

  actions: { gap: spacing.xs, paddingTop: spacing.sm },
});
