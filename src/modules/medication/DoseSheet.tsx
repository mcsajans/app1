import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { MomentField } from '../../components/DateTimeField';
import { Chips, clockOf } from '../../components/records';
import { Button, ButtonRow, FormError, IconTabs } from '../../components/ui';
import {
  DOSE_UNITS, type DoseInput, type DoseUnit, type Medication,
} from '../../core/api/modules';
import { colors, radius, spacing, typography } from '../../core/theme';
import { amountLabel, UNIT_LABEL } from './labels';

/** Girişin iki biçimi — emzirme ve uykudaki düzenin aynısı. */
type Tab = 'now' | 'past';

const TABS = [
  { key: 'now' as const, icon: 'timer' as const, label: 'Anlık' },
  { key: 'past' as const, icon: 'backdate' as const, label: 'Geri tarihli' },
];

const STATUSES = ['given', 'skipped'] as const;
const STATUS_LABELS = { given: 'Verildi', skipped: 'Atlandı' } as const;

const MINUTE = 60_000;
const roundToMinute = (ms: number) => Math.floor(ms / MINUTE) * MINUTE;

/**
 * Doz kaydı sayfası (Modül 16).
 *
 * Ekrandaki "Verildi" düğmesi tek dokunuşla kaydediyor; bu sayfa yalnızca
 * **farklı bir şey** söylenecekse açılır: doz değişti, saat geçmişte, ilaç
 * atlandı ya da not yazılacak.
 *
 * Sekme ayrımı emzirme (§10.6) ve uykudakiyle (§11.1) aynı: *Anlık* kaydı
 * şu ana yazar, *Geri tarihli* tarih+saat sorar. Üçüncü bir soru yok çünkü
 * doz bir ANdır — başlangıcı ve bitişi olan bir aralık değil.
 */
export function DoseSheet({
  visible,
  busy,
  error,
  medication,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  busy: boolean;
  error: string | null;
  /** `null` → kür tanımı olmadan tek seferlik doz (§3d). */
  medication: Medication | null;
  onClose: () => void;
  onSubmit: (values: DoseInput) => void;
}) {
  const [tab, setTab] = useState<Tab>('now');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('given');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(
    medication?.default_amount === null || medication?.default_amount === undefined
      ? ''
      : String(medication.default_amount).replace('.', ','),
  );
  const [unit, setUnit] = useState<DoseUnit>(medication?.amount_unit ?? 'ml');
  /** Geri tarihli sekmesinin anı; `NaN` → sekme hiç açılmadı. */
  const [givenMs, setGivenMs] = useState(Number.NaN);
  const [skipReason, setSkipReason] = useState('');
  const [note, setNote] = useState('');
  const [issue, setIssue] = useState<string | null>(null);

  /*
   * Varsayılan saat sekme AÇILIRKEN hesaplanır, bileşen bağlanırken değil:
   * sayfa açık kalıp sonra geri tarihli sekmesine geçilirse "şimdi" eski
   * bir an olmamalı. Olay işleyicisinde `Date.now()` okumak React
   * derleyicisinin saflık kuralına da takılmaz.
   */
  const openTab = (next: Tab) => {
    setTab(next);
    setIssue(null);
    if (next === 'past' && !Number.isFinite(givenMs)) setGivenMs(roundToMinute(Date.now()));
  };

  const decimal = (value: string): number | null => {
    const trimmed = value.trim().replace(',', '.');
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const save = () => {
    if (!medication && !name.trim()) {
      setIssue('İlaç adını yaz.');
      return;
    }
    if (tab === 'past' && !Number.isFinite(givenMs)) {
      setIssue('Veriliş zamanını seç.');
      return;
    }
    if (tab === 'past' && givenMs > Date.now() + 120_000) {
      setIssue('Veriliş zamanı gelecekte olamaz.');
      return;
    }
    if (status === 'given' && amount.trim() && decimal(amount) === null) {
      setIssue('Doz miktarı sayı olmalı.');
      return;
    }

    onSubmit({
      ...(medication ? { medication_id: medication.id } : { name: name.trim() }),
      given_at: new Date(tab === 'past' ? givenMs : Date.now()).toISOString(),
      ...(status === 'given' ? { amount: decimal(amount), amount_unit: unit } : {}),
      status,
      skip_reason: status === 'skipped' && skipReason.trim() ? skipReason.trim() : null,
      note: note.trim() ? note.trim() : null,
    });
  };

  const lastDose = medication?.last_dose_at ? clockOf(medication.last_dose_at) : null;
  const defaultLabel = medication
    ? amountLabel(medication.default_amount, medication.amount_unit)
    : null;

  return (
    <BottomSheet
      visible={visible}
      busy={busy}
      onClose={onClose}
      title={medication ? medication.name : 'Tek seferlik doz'}
      subtitle={
        lastDose
          ? `Son doz ${lastDose}${defaultLabel ? ` · tek doz ${defaultLabel}` : ''}`
          : 'Kürü olmayan bir ilacı buradan tek seferlik kaydedebilirsin.'
      }
    >
      {error ? <FormError message={error} /> : null}

      {!medication ? (
        <>
          <Text style={s.label}>İlaç adı</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={(v) => { setName(v); setIssue(null); }}
            placeholder="Parol Şurup"
            placeholderTextColor={colors.textFaint}
            editable={!busy}
            maxLength={120}
          />
        </>
      ) : null}

      <Text style={s.label}>Durum</Text>
      <Chips
        options={STATUSES}
        value={status}
        onChange={(v) => { if (v) { setStatus(v); setIssue(null); } }}
        labels={STATUS_LABELS}
        disabled={busy}
      />

      <View style={s.gap} />
      <IconTabs tabs={TABS} value={tab} onChange={openTab} disabled={busy} />

      {tab === 'past' ? (
        <MomentField
          label="Veriliş zamanı"
          value={givenMs}
          onChange={(ms) => { setGivenMs(ms); setIssue(null); }}
          disabled={busy}
        />
      ) : (
        <Text style={s.hint}>Kayıt şu ana yazılır.</Text>
      )}

      {status === 'given' ? (
        <>
          <Text style={s.label}>Verilen doz</Text>
          <View style={s.row}>
            <TextInput
              style={[s.input, s.amountInput]}
              value={amount}
              onChangeText={(v) => { setAmount(v); setIssue(null); }}
              placeholder="4"
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              editable={!busy}
              maxLength={7}
            />
            <View style={s.unitCol}>
              <Chips
                options={DOSE_UNITS}
                value={unit}
                onChange={(v) => v && setUnit(v)}
                labels={UNIT_LABEL}
                disabled={busy}
              />
            </View>
          </View>
        </>
      ) : (
        <>
          <Text style={s.label}>Neden atlandı</Text>
          <TextInput
            style={s.input}
            value={skipReason}
            onChangeText={setSkipReason}
            placeholder="Ateş düşmüştü"
            placeholderTextColor={colors.textFaint}
            editable={!busy}
            maxLength={200}
          />
          {/*
            Atlanan doz da kayıttır (§3e): "vermedim çünkü…" bilgisi, hiç
            yazılmamış bir dozdan ayırt edilebilmeli.
          */}
          <Text style={s.hint}>Atlanan doz da geçmişte görünür.</Text>
        </>
      )}

      <Text style={s.label}>Not</Text>
      <TextInput
        style={s.note}
        value={note}
        onChangeText={setNote}
        placeholder="Notunuz varsa buraya yazınız"
        placeholderTextColor={colors.textFaint}
        editable={!busy}
        multiline
        maxLength={500}
      />

      {issue ? <Text style={s.issue}>{issue}</Text> : null}

      <View style={s.gap} />
      <ButtonRow>
        <Button
          label={busy ? 'Kaydediliyor…' : tab === 'past' ? 'Bilgileri kaydet' : 'Kaydet'}
          onPress={save}
          disabled={busy}
        />
        <Button label="Vazgeç" variant="ghost" onPress={onClose} disabled={busy} />
      </ButtonRow>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  label: { ...typography.small, color: colors.textSoft, fontWeight: '600', marginTop: spacing.sm },
  hint: { ...typography.tiny, color: colors.textFaint, textAlign: 'center', marginTop: spacing.sm },
  issue: { ...typography.small, color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  amountInput: { width: 86 },
  unitCol: { flex: 1 },
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
  note: {
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    textAlignVertical: 'top',
  },
  gap: { height: spacing.xs },
});
