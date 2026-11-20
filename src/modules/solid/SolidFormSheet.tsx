import React, { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { Chips } from '../../components/records';
import { Button, ButtonRow, FormError } from '../../components/ui';
import { FOOD_CATEGORIES, PORTION_UNITS, REACTIONS } from '../../core/api/modules';
import { colors, radius, spacing, typography } from '../../core/theme';
import { CATEGORY_LABELS, REACTION_LABELS, UNIT_LABELS } from './labels';

/** Sık kullanılan gıdalar — hızlı seçim etiketleri. */
const QUICK_FOODS = ['Havuç', 'Elma', 'Muz', 'Yoğurt', 'Pirinç', 'Brokoli', 'Yumurta', 'Avokado'];

export type SolidFormValues = {
  food: string;
  category: (typeof FOOD_CATEGORIES)[number] | null;
  reaction: (typeof REACTIONS)[number];
  /** `null` → miktar girilmedi; birim de gönderilmez. */
  amount: number | null;
  unit: (typeof PORTION_UNITS)[number];
  threeDay: boolean;
  note: string | null;
};

/**
 * Ek gıda ekleme formu — alt sayfa (modal).
 *
 * Form eskiden ekranın **ortasında** sabit duruyordu: geçmişi görmek için
 * yedi alanlık bir formu geçmek gerekiyordu ve asıl soru ("bugün ne yedi,
 * neye tepki verdi") ekranın altında kalıyordu. Artık ekran kayıtları
 * gösteriyor, form "+ Ek gıda ekle" ile açılıyor.
 *
 * Durum sıfırlaması bileşende değil: sayfa her açılışta yeni bir `key` ile
 * bağlanıyor (bkz. `SolidScreen`). Böylece bir önceki kaydın yiyecek adı ve
 * notu formda kalmıyor.
 */
export function SolidFormSheet({
  visible,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: SolidFormValues) => void;
}) {
  const [food, setFood] = useState('');
  const [category, setCategory] = useState<(typeof FOOD_CATEGORIES)[number] | null>(null);
  const [reaction, setReaction] = useState<(typeof REACTIONS)[number]>('neutral');
  const [unit, setUnit] = useState<(typeof PORTION_UNITS)[number]>('spoon');
  const [amount, setAmount] = useState('');
  const [threeDay, setThreeDay] = useState(false);
  const [note, setNote] = useState('');
  const [issue, setIssue] = useState<string | null>(null);

  const save = () => {
    if (!food.trim()) {
      setIssue('Yiyecek adı zorunlu.');
      return;
    }
    const parsed = amount.trim() === '' ? null : Number(amount.trim().replace(',', '.'));
    if (parsed !== null && !Number.isFinite(parsed)) {
      setIssue('Miktar sayı olmalı.');
      return;
    }

    onSubmit({
      food: food.trim(),
      category,
      reaction,
      amount: parsed,
      unit,
      threeDay,
      note: note.trim() ? note.trim() : null,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      busy={busy}
      onClose={onClose}
      title="Ek gıda ekle"
      subtitle="3 gün kuralı: yeni gıdayı üç gün tekrarlayıp tepki gözlemlemek."
    >
      {error ? <FormError message={error} /> : null}

      <Text style={s.label}>Yiyecek *</Text>
      <TextInput
        style={s.input}
        value={food}
        onChangeText={(v) => { setFood(v); setIssue(null); }}
        placeholder="Havuç püresi"
        placeholderTextColor={colors.textFaint}
        editable={!busy}
      />
      <View style={s.quick}>
        {QUICK_FOODS.map((q) => (
          <Text key={q} style={s.quickChip} onPress={() => !busy && setFood(q)}>
            {q}
          </Text>
        ))}
      </View>

      <Text style={s.label}>Kategori</Text>
      <Chips
        options={FOOD_CATEGORIES}
        value={category}
        onChange={setCategory}
        labels={CATEGORY_LABELS}
        disabled={busy}
        allowClear
      />

      <Text style={s.label}>Tepki *</Text>
      <Chips
        options={REACTIONS}
        value={reaction}
        onChange={(v) => v && setReaction(v)}
        labels={REACTION_LABELS}
        disabled={busy}
      />

      <Text style={s.label}>Miktar</Text>
      <TextInput
        style={s.input}
        value={amount}
        onChangeText={(v) => { setAmount(v); setIssue(null); }}
        placeholder="2"
        placeholderTextColor={colors.textFaint}
        keyboardType="decimal-pad"
        editable={!busy}
      />
      <View style={s.gapXs} />
      <Chips
        options={PORTION_UNITS}
        value={unit}
        onChange={(v) => v && setUnit(v)}
        labels={UNIT_LABELS}
        disabled={busy}
      />

      <View style={s.switchRow}>
        <View style={s.switchText}>
          <Text style={s.label}>3 gün kuralı denemesi</Text>
        </View>
        <Switch
          value={threeDay}
          onValueChange={setThreeDay}
          disabled={busy}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.surface}
        />
      </View>

      <Text style={s.label}>Not</Text>
      <TextInput
        style={s.input}
        value={note}
        onChangeText={setNote}
        placeholder="Gaz yaptı, döküntü oluştu…"
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
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  quickChip: {
    ...typography.small,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  switchText: { flex: 1 },
  gap: { height: spacing.xs },
  gapXs: { height: 2 },
});
