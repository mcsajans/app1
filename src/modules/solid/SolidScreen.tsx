import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Chips, RecordRow, amountText, clockOf } from '../../components/records';
import { RecordDetailSheet, fullMoment, type RecordDetail } from '../../components/RecordDetail';
import { Button, Card, EmptyState, FormError, Loading, Screen, SectionTitle } from '../../components/ui';
import { ReadOnlyBanner, useCanEdit } from '../../components/permission';
import { errorText } from '../../core/api/client';
import {
  FOOD_CATEGORIES, PORTION_UNITS, REACTIONS,
  iso, solidService, type SolidRecord,
} from '../../core/api/modules';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { colors, radius, spacing, typography } from '../../core/theme';
import { withSaveFeedback } from '../../core/feedback/withSaveFeedback';

const CATEGORY_LABELS: Record<string, string> = {
  vegetable: 'Sebze', fruit: 'Meyve', cereal: 'Tahıl',
  protein: 'Protein', dairy: 'Süt ürünü', snack: 'Atıştırmalık', other: 'Diğer',
};
const REACTION_LABELS: Record<string, string> = {
  loved: 'Sevdi', neutral: 'Nötr', disliked: 'Sevmedi', allergic: 'Alerji',
};
const UNIT_LABELS: Record<string, string> = {
  spoon: 'kaşık', gram: 'gram', bowl: 'kâse', piece: 'adet',
};

/** Sık kullanılan gıdalar — hızlı seçim etiketleri. */
const QUICK_FOODS = ['Havuç', 'Elma', 'Muz', 'Yoğurt', 'Pirinç', 'Brokoli', 'Yumurta', 'Avokado'];

/** Modül 4 — Ek Gıda. */
export default function SolidScreen() {
  const baby = useBabyStore((s) => s.selected());
  const babyId = baby?.id ?? null;

  const canEdit = useCanEdit();

  const [food, setFood] = useState('');
  const [category, setCategory] = useState<(typeof FOOD_CATEGORIES)[number] | null>(null);
  const [reaction, setReaction] = useState<(typeof REACTIONS)[number]>('neutral');
  const [unit, setUnit] = useState<(typeof PORTION_UNITS)[number]>('spoon');
  const [amount, setAmount] = useState('');
  const [threeDay, setThreeDay] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecordDetail | null>(null);

  const list = useAsyncData(
    () => (babyId ? solidService.list(babyId) : Promise.resolve({ feedings: [] })),
    [babyId],
  );
  const allergies = useAsyncData(
    () => (babyId ? solidService.allergies(babyId) : Promise.resolve({ foods: [] })),
    [babyId],
  );

  const records = list.data?.feedings ?? [];
  const allergyRows = allergies.data?.foods ?? [];

  const refreshAll = () => {
    list.reload();
    allergies.reload();
  };

  const save = async () => {
    if (!babyId) return;
    if (!food.trim()) return setError('Yiyecek adı zorunlu.');

    const parsed = amount.trim() === '' ? null : Number(amount.replace(',', '.'));
    if (parsed !== null && !Number.isFinite(parsed)) return setError('Miktar sayı olmalı.');

    setBusy(true);
    setError(null);
    try {
      await withSaveFeedback(() => solidService.create(babyId, {
        started_at: iso(),
        food_name: food.trim(),
        food_category: category,
        reaction,
        is_three_day_rule: threeDay,
        // Birim yalnızca miktar varsa gönderilir; sunucu miktar olmadan birim
        // istemiyor ve ek gıdada hacim birimi reddediliyor (§22.2).
        amount: parsed,
        amount_unit: parsed === null ? null : unit,
        note: note.trim() || null,
      }));
      setFood('');
      setAmount('');
      setNote('');
      setThreeDay(false);
      refreshAll();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = (r: SolidRecord) => {
    Alert.alert('Kaydı sil', `${r.food_name ?? 'Kayıt'} silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void solidService.remove(r.id).then(refreshAll).catch((e) => setError(errorText(e)));
        },
      },
    ]);
  };

  /** Geçmiş satırına dokununca açılan ayrıntılı rapor. */
  const detailOf = (r: SolidRecord): RecordDetail => ({
    icon: r.reaction === 'allergic' ? 'allergy' : r.reaction === 'loved' ? 'loved' : 'solid',
    title: r.food_name ?? 'Ek gıda',
    subtitle: fullMoment(r.started_at) ?? undefined,
    stats: [
      {
        label: 'Tepki',
        value: r.reaction ? REACTION_LABELS[r.reaction].replace(/^\S+\s/, '') : '—',
        tone: r.reaction === 'allergic' ? 'warn' : r.reaction === 'loved' ? 'good' : 'neutral',
      },
      {
        label: 'Miktar',
        value: r.amount != null ? `${amountText(r.amount)} ${UNIT_LABELS[r.amount_unit ?? ''] ?? ''}`.trim() : '—',
      },
      { label: '3 gün kuralı', value: r.is_three_day_rule ? 'Evet' : 'Hayır' },
    ],
    warning: r.reaction === 'allergic'
      ? 'Bu gıdada alerjik tepki kaydedilmiş. Tekrar vermeden önce hekime danış.'
      : null,
    rows: [
      { label: 'Yiyecek', value: r.food_name },
      { label: 'Kategori', value: r.food_category ? CATEGORY_LABELS[r.food_category] : null },
      { label: 'Verilme zamanı', value: fullMoment(r.started_at) },
      {
        label: 'Porsiyon',
        value: r.amount != null ? `${amountText(r.amount)} ${UNIT_LABELS[r.amount_unit ?? ''] ?? ''}`.trim() : null,
      },
      { label: 'Tepki', value: r.reaction ? REACTION_LABELS[r.reaction] : null },
      {
        label: '3 gün kuralı',
        value: r.is_three_day_rule ? 'Deneme kaydı (üç gün tekrarlanıyor)' : 'Hayır',
      },
      // Porsiyon birimleri ml'ye çevrilemez; rapordaki sıvı toplamına girmez.
      { label: 'Sıvı toplamına', value: 'Girmez (porsiyon birimi)' },
    ],
    note: r.note,
    audit: r,
    recordId: r.id,
    // Salt okuyan üyeye silme hiç sunulmaz; sunucu da reddederdi (§5.5).
    onDelete: canEdit
      ? () => {
          setDetail(null);
          onDelete(r);
        }
      : undefined,
  });

  if (!baby) {
    return (
      <Screen>
        <EmptyState icon="solid" title="Önce bir bebek profili ekle" detail="Ek gıda kayıtları seçili bebeğe bağlı tutulur." />
      </Screen>
    );
  }

  return (
    <Screen>
      <ReadOnlyBanner />
      {error ? <FormError message={error} /> : null}

      {/* ── Alerji uyarı kartı ── */}
      {allergyRows.length > 0 ? (
        <View style={s.alertCard}>
          <Text style={s.alertTitle}>Alerji / reaksiyon gösterilen gıdalar</Text>
          {allergyRows.map((a) => (
            <Text key={`${a.food_name}-${a.reaction}`} style={s.alertRow}>
              • {a.food_name}
              {a.occurrence_count > 1 ? ` (${a.occurrence_count} kez)` : ''}
              {a.last_note ? ` — ${a.last_note}` : ''}
            </Text>
          ))}
        </View>
      ) : null}

      {/* ── Ekleme formu ── */}
      <SectionTitle hint="3 gün kuralı: yeni gıdayı üç gün tekrarlayıp tepki gözlemlemek.">
        Ek gıda ekle
      </SectionTitle>
      <Card>
        <Text style={s.label}>Yiyecek *</Text>
        <TextInput
          style={s.input}
          value={food}
          onChangeText={setFood}
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
        <Chips options={FOOD_CATEGORIES} value={category} onChange={setCategory} labels={CATEGORY_LABELS} disabled={busy || !canEdit} allowClear />

        <Text style={s.label}>Tepki *</Text>
        <Chips options={REACTIONS} value={reaction} onChange={(v) => v && setReaction(v)} labels={REACTION_LABELS} disabled={busy || !canEdit} />

        <Text style={s.label}>Miktar</Text>
        <TextInput
          style={s.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="2"
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
          editable={!busy}
        />
        <View style={s.gapXs} />
        <Chips options={PORTION_UNITS} value={unit} onChange={(v) => v && setUnit(v)} labels={UNIT_LABELS} disabled={busy || !canEdit} />

        <View style={s.switchRow}>
          <View style={s.switchText}>
            <Text style={s.label}>3 gün kuralı denemesi</Text>
          </View>
          <Switch
            value={threeDay}
            onValueChange={setThreeDay}
            disabled={busy || !canEdit}
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

        <View style={s.gap} />
        <Button label={busy ? 'Kaydediliyor…' : 'Kaydet'} onPress={save} disabled={busy || !canEdit} />
      </Card>

      {/* ── Geçmiş ── */}
      <SectionTitle hint="Uzun basıp silebilirsin.">Geçmiş</SectionTitle>
      <Card>
        {list.loading && records.length === 0 ? (
          <Loading label="Kayıtlar yükleniyor…" />
        ) : records.length === 0 ? (
          <Text style={s.hint}>Henüz ek gıda kaydı yok.</Text>
        ) : (
          records.map((r) => (
            <RecordRow
              key={r.id}
              icon={r.reaction === 'allergic' ? 'allergy' : r.reaction === 'loved' ? 'loved' : 'solid'}
              title={r.food_name ?? 'Ek gıda'}
              detail={[
                r.food_category ? CATEGORY_LABELS[r.food_category]?.replace(/^\S+\s/, '') : null,
                r.amount != null ? `${amountText(r.amount)} ${UNIT_LABELS[r.amount_unit ?? ''] ?? ''}`.trim() : null,
                r.is_three_day_rule ? '3 gün kuralı' : null,
                r.note,
              ]
                .filter(Boolean)
                .join(' · ')}
              right={clockOf(r.started_at)}
              onPress={() => setDetail(detailOf(r))}
              onLongPress={canEdit ? () => onDelete(r) : undefined}
            />
          ))
        )}
      </Card>

      <RecordDetailSheet detail={detail} onClose={() => setDetail(null)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { ...typography.small, color: colors.textSoft, fontWeight: '600', marginTop: spacing.sm },
  hint: { ...typography.small, color: colors.textSoft },
  gap: { height: spacing.sm },
  gapXs: { height: spacing.xs },
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
    ...typography.tiny,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  switchText: { flex: 1 },
  alertCard: {
    backgroundColor: '#FDECEC',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
  },
  alertTitle: { ...typography.small, color: colors.danger, fontWeight: '700' },
  alertRow: { ...typography.small, color: colors.danger },
});
