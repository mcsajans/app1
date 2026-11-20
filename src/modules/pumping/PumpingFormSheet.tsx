import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { Chips, formatDuration } from '../../components/records';
import { Button, ButtonRow, FormError } from '../../components/ui';
import { STORAGE_LOCATIONS } from '../../core/api/modules';
import { colors, radius, spacing, typography } from '../../core/theme';
import { STORAGE_LABELS } from './labels';

export type PumpingFormValues = {
  /** ml; en az biri dolu olmak zorunda. */
  leftMl: number | null;
  rightMl: number | null;
  storage: (typeof STORAGE_LOCATIONS)[number];
  note: string | null;
};

/**
 * Sağma kaydı formu — alt sayfa (modal).
 *
 * Ekranda sabit durduğunda süt stoğu, kronometre ve geçmiş arasında
 * sıkışıyordu; sağma biten anne miktarı girmek için ekranı tarıyordu. Artık
 * "+ Sağma ekle" ile açılıyor.
 *
 * **Ölçülen süre** forma dışarıdan geliyor (`timedSec`): kronometre
 * sunucuda değil yerelde çalışıyor ve bitince süresini ekrana bırakıyor;
 * kayıt ancak miktar girilince oluşuyor.
 *
 * Durum sıfırlaması bileşende değil: sayfa her açılışta yeni bir `key` ile
 * bağlanıyor (bkz. `PumpingScreen`).
 */
export function PumpingFormSheet({
  visible,
  busy,
  error,
  timedSec,
  onClearTimed,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  busy: boolean;
  error: string | null;
  /** Kronometrenin bıraktığı süre; `null` ise ölçüm yok. */
  timedSec: number | null;
  onClearTimed: () => void;
  onClose: () => void;
  onSubmit: (values: PumpingFormValues) => void;
}) {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [storage, setStorage] = useState<(typeof STORAGE_LOCATIONS)[number]>('fridge');
  const [note, setNote] = useState('');
  const [issue, setIssue] = useState<string | null>(null);

  /** Boş → `null`, sayı değilse `NaN` (çağıran ayırt edebilsin). */
  const parse = (v: string): number | null => {
    const t = v.trim().replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  };

  const save = () => {
    const l = parse(left);
    const r = parse(right);
    if (Number.isNaN(l) || Number.isNaN(r)) {
      setIssue('Miktarlar sayı olmalı.');
      return;
    }
    if (l === null && r === null) {
      setIssue('En az bir göğüs için miktar gir.');
      return;
    }
    onSubmit({ leftMl: l, rightMl: r, storage, note: note.trim() ? note.trim() : null });
  };

  return (
    <BottomSheet
      visible={visible}
      busy={busy}
      onClose={onClose}
      title="Sağma ekle"
      subtitle="Miktarı ml olarak gir; hemen verilen süt stoğa eklenmez."
    >
      {error ? <FormError message={error} /> : null}

      {timedSec !== null ? (
        <View style={s.timedRow}>
          <Text style={s.timedText}>Ölçülen süre: {formatDuration(timedSec)}</Text>
          <Pressable onPress={onClearTimed} hitSlop={8} disabled={busy}>
            <Text style={s.timedClear}>kaldır</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={s.amountRow}>
        <View style={s.amountCol}>
          <Text style={s.label}>Sol (ml)</Text>
          <TextInput
            style={s.input}
            value={left}
            onChangeText={(v) => { setLeft(v); setIssue(null); }}
            placeholder="60"
            placeholderTextColor={colors.textFaint}
            keyboardType="decimal-pad"
            editable={!busy}
          />
        </View>
        <View style={s.amountCol}>
          <Text style={s.label}>Sağ (ml)</Text>
          <TextInput
            style={s.input}
            value={right}
            onChangeText={(v) => { setRight(v); setIssue(null); }}
            placeholder="80"
            placeholderTextColor={colors.textFaint}
            keyboardType="decimal-pad"
            editable={!busy}
          />
        </View>
      </View>

      <Text style={s.label}>Saklama yeri</Text>
      <Chips
        options={STORAGE_LOCATIONS}
        value={storage}
        onChange={(v) => v && setStorage(v)}
        labels={STORAGE_LABELS}
        disabled={busy}
      />

      <Text style={s.label}>Not</Text>
      <TextInput
        style={s.input}
        value={note}
        onChangeText={setNote}
        placeholder="İsteğe bağlı"
        placeholderTextColor={colors.textFaint}
        editable={!busy}
      />

      {issue ? <Text style={s.issue}>{issue}</Text> : null}

      <View style={s.gap} />
      <ButtonRow>
        <Button label={busy ? 'Kaydediliyor…' : 'Kaydet'} onPress={save} disabled={busy} />
        <Button label="Vazgeç" variant="ghost" onPress={onClose} disabled={busy} />
      </ButtonRow>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  label: { ...typography.small, color: colors.textSoft, fontWeight: '600', marginTop: spacing.sm },
  issue: { ...typography.small, color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  amountRow: { flexDirection: 'row', gap: spacing.sm },
  amountCol: { flex: 1 },
  timedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  timedText: { ...typography.small, color: colors.primary, fontWeight: '600' },
  timedClear: { ...typography.small, color: colors.textSoft },
  gap: { height: spacing.xs },
});
