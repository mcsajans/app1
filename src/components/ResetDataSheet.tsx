import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { Button, FormError } from './ui';
import { errorText } from '../core/api/client';
import { babyService } from '../core/api/modules';
import { useBabyStore } from '../core/stores/useBabyStore';
import type { Baby } from '../core/types';
import { useLiveTimerStore } from '../core/timers/useLiveTimerStore';
import { colors, radius, spacing, typography } from '../core/theme';

/**
 * "Verileri sıfırla" onay penceresi.
 *
 * Üç şey bilerek böyle:
 *
 *  - **Tek dokunuşla silinmez.** İşlem geri alınamıyor; kullanıcı önce hangi
 *    bebeği seçtiğini, sonra neyin gideceğini görüyor ve ancak ondan sonra
 *    kırmızı düğmeye basabiliyor.
 *  - **Bebek seçimi yalnızca birden fazla bebek varsa sorulur.** Tek bebekte
 *    seçtirmek, kullanıcıya hiçbir karar bırakmayan fazladan bir adım olurdu.
 *  - **Neyin silinMEdiği de yazılıyor.** "Her şey gider" demek, profilin ve
 *    aile üyelerinin de gittiğini düşündürür; kullanıcı geri alınamaz bir
 *    işlemi yanlış beklentiyle onaylamamalı.
 */
export function ResetDataSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const babies = useBabyStore((s) => s.babies);
  const selectedId = useBabyStore((s) => s.selectedId);

  /** Sahibi olmadığım bebeğin verisini sunucu zaten sildirmez (owner şartı). */
  const mine = babies.filter((b) => b.isOwner);

  const [pickedId, setPickedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; total: number } | null>(null);

  // Pencere her açılışta temiz başlar; önceki denemenin hatası ya da başarı
  // ekranı yeni açılışta durmamalı.
  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (visible) {
      setError(null);
      setDone(null);
      setBusy(false);
      setPickedId(mine.length === 1 ? mine[0]!.id : selectedId);
    }
  }

  const target: Baby | null =
    mine.find((b) => b.id === pickedId) ?? (mine.length === 1 ? mine[0]! : null);

  const run = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const res = await babyService.resetData(target.id);
      /*
       * Çalışan sayaçlar sunucudaki kayıtlarına bağlıydı; kayıt silindiğine
       * göre kilit ekranındaki bildirim de kalkmalı. Yoksa "Emzirme sürüyor"
       * satırı artık var olmayan bir seansı göstermeye devam ederdi.
       */
      await useLiveTimerStore.getState().clearAll().catch(() => undefined);
      await useBabyStore.getState().hydrate().catch(() => undefined);
      setDone({ name: target.firstName, total: res.total ?? 0 });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.scrim}>
        <Pressable
          style={s.fill}
          onPress={busy ? undefined : onClose}
          accessibilityRole="button"
          accessibilityLabel="Pencereyi kapat"
        />
        <View style={[s.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={s.handle} />

          {done ? (
            <>
              <View style={[s.badge, s.badgeOk]}>
                <Icon name="check" size={28} color={colors.success} />
              </View>
              <Text style={s.title}>Veriler sıfırlandı</Text>
              <Text style={s.body}>
                <Text style={s.strong}>{done.name}</Text> için {done.total} kayıt kalıcı olarak
                silindi. Profil ve aile üyeleri olduğu gibi duruyor.
              </Text>
              <View style={s.gap} />
              <Button label="Kapat" onPress={onClose} />
            </>
          ) : (
            <>
              <View style={s.badge}>
                <Icon name="warning" size={28} color={colors.danger} />
              </View>
              <Text style={s.title}>Verileri sıfırla</Text>

              {mine.length === 0 ? (
                <Text style={s.body}>
                  Sıfırlanacak bebek yok. Bu işlemi yalnızca bebeğin **sahibi** yapabilir;
                  sana paylaşılan profillerde kullanılamaz.
                </Text>
              ) : (
                <>
                  {mine.length > 1 ? (
                    <>
                      <Text style={s.label}>Hangi bebeğin verileri silinsin?</Text>
                      <ScrollView style={s.pickBox} showsVerticalScrollIndicator={false}>
                        {mine.map((b) => {
                          const on = b.id === pickedId;
                          return (
                            <Pressable
                              key={b.id}
                              onPress={() => setPickedId(b.id)}
                              disabled={busy}
                              style={[s.pickRow, on && s.pickRowOn]}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: on }}
                            >
                              <Icon
                                name={on ? 'check' : 'babies'}
                                size={20}
                                color={on ? colors.primary : colors.textFaint}
                              />
                              <Text style={[s.pickText, on && s.pickTextOn]}>
                                {b.firstName}
                                {b.lastName ? ` ${b.lastName}` : ''}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </>
                  ) : null}

                  <Text style={s.body}>
                    <Text style={s.strong}>{target?.firstName ?? 'Bu bebek'}</Text> için girilmiş
                    tüm kayıtlar <Text style={s.strong}>kalıcı olarak silinecek</Text>:
                  </Text>

                  <View style={s.list}>
                    {[
                      'Beslenme, emzirme, biberon ve ek gıda kayıtları',
                      'Uyku ve bez değişimi kayıtları',
                      'Süt sağma kayıtları ve stok',
                      'Hatırlatıcılar, sessiz saatler ve görevler',
                      'Aşı takvimi kayıtları ve bildirim geçmişi',
                    ].map((line) => (
                      <View key={line} style={s.listRow}>
                        <Text style={s.bullet}>•</Text>
                        <Text style={s.listText}>{line}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={s.warn}>
                    Bu işlem geri alınamaz. Veriler sunucudan ve bu cihazdan silinir;
                    diğer aile üyelerinde de görünmez olur.
                  </Text>
                  <Text style={s.keep}>
                    Bebeğin profili, fotoğrafı ve aile üyeleri silinmez.
                  </Text>

                  {error ? <FormError message={error} /> : null}

                  <View style={s.gap} />
                  <Button
                    label={busy ? 'Siliniyor…' : 'Evet, tüm verileri sil'}
                    variant="danger"
                    onPress={() => void run()}
                    disabled={busy || !target}
                  />
                  <Button label="Vazgeç" variant="ghost" onPress={onClose} disabled={busy} />
                </>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(16,22,34,0.55)', justifyContent: 'flex-end' },
  fill: { ...StyleSheet.absoluteFill },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: 6,
  },
  handle: {
    alignSelf: 'center', width: 44, height: 4, borderRadius: radius.pill,
    backgroundColor: colors.border, marginBottom: spacing.sm,
  },
  badge: {
    alignSelf: 'center', width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#FDECEC', alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  badgeOk: { backgroundColor: '#E8F6EE' },
  title: { ...typography.h3, color: colors.text, textAlign: 'center' },
  label: { ...typography.small, color: colors.textSoft, fontWeight: '700', marginTop: spacing.sm },
  body: { ...typography.small, color: colors.textSoft, lineHeight: 20, marginTop: spacing.xs },
  strong: { color: colors.text, fontWeight: '800' },
  // Çok bebekli hesapta liste uzayabilir; pencere ekranı doldurmasın.
  pickBox: { maxHeight: 168, marginTop: spacing.xs },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.surfaceSoft, marginBottom: 6,
  },
  pickRowOn: { backgroundColor: colors.primarySoft },
  pickText: { ...typography.body, color: colors.textSoft },
  pickTextOn: { color: colors.text, fontWeight: '700' },
  list: { marginTop: spacing.xs, gap: 2 },
  listRow: { flexDirection: 'row', gap: 6 },
  bullet: { ...typography.small, color: colors.textFaint },
  listText: { ...typography.small, color: colors.textSoft, flex: 1, lineHeight: 19 },
  warn: {
    ...typography.small, color: colors.danger, fontWeight: '700',
    marginTop: spacing.sm, lineHeight: 19,
  },
  keep: { ...typography.tiny, color: colors.textFaint, marginTop: 4 },
  gap: { height: spacing.sm },
});
