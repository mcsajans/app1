import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { DateField, TimeListField, toDateValue } from '../../components/DateTimeField';
import { Chips } from '../../components/records';
import { Button, ButtonRow, FormError } from '../../components/ui';
import {
  DOSE_UNITS, MEDICATION_FORMS, MEDICATION_ROUTES, SCHEDULE_TYPES,
  type DoseUnit, type Medication, type MedicationForm, type MedicationInput,
  type MedicationRoute, type ScheduleType,
} from '../../core/api/modules';
import { colors, radius, spacing, typography } from '../../core/theme';
import { FORM_LABEL, ROUTE_LABEL, SCHEDULE_LABEL, UNIT_LABEL } from './labels';

/**
 * İlaç/kür tanımı — ekleme ve düzenleme (Modül 16, §3d).
 *
 * **Burada doz hesaplanmaz.** `default_amount` ebeveynin bir kez yazdığı
 * değerdir ve sonraki dozlarda hazır gelsin diye saklanır; uygulama
 * kilograma göre mg önermez (`modules_doc/ilac-takibi.md` §3a). Bu yüzden
 * formda "kilo" diye bir alan da yok.
 *
 * Program üç biçimden biri; hangisinin seçildiğine göre **tek** ek alan
 * açılır. Üçünün alanlarını birden göstermek, "gerektikçe" kullanan
 * (en sık hâl: ateş düşürücü) kişiye hiç dolduramayacağı iki alan sunardı.
 *
 * Durum sıfırlaması bileşende değil: sayfa her açılışta yeni bir `key` ile
 * bağlanıyor (bkz. `MedicationScreen`), böylece varsayılanlar `useState`
 * başlatıcısında bir kez hesaplanıyor.
 */
export function MedicationFormSheet({
  visible,
  busy,
  error,
  /** Dolu ise düzenleme kipinde açılır. */
  editing,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  busy: boolean;
  error: string | null;
  editing: Medication | null;
  onClose: () => void;
  onSubmit: (values: MedicationInput) => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [form, setForm] = useState<MedicationForm>(editing?.form ?? 'syrup');
  const [strength, setStrength] = useState(editing?.strength ?? '');
  const [route, setRoute] = useState<MedicationRoute>(editing?.route ?? 'oral');
  const [amount, setAmount] = useState(
    editing?.default_amount === null || editing?.default_amount === undefined
      ? ''
      : String(editing.default_amount).replace('.', ','),
  );
  const [unit, setUnit] = useState<DoseUnit>(editing?.amount_unit ?? 'ml');
  const [schedule, setSchedule] = useState<ScheduleType>(editing?.schedule_type ?? 'as_needed');
  const [intervalHours, setIntervalHours] = useState(
    editing?.interval_hours ? String(editing.interval_hours).replace('.', ',') : '',
  );
  const [times, setTimes] = useState<string[]>(editing?.fixed_times ?? []);
  const [minInterval, setMinInterval] = useState(
    editing?.min_interval_hours ? String(editing.min_interval_hours).replace('.', ',') : '',
  );
  const [maxPerDay, setMaxPerDay] = useState(
    editing?.max_doses_per_day ? String(editing.max_doses_per_day) : '',
  );
  const [startedOn, setStartedOn] = useState(editing?.started_on ?? toDateValue(new Date()));
  const [endsOn, setEndsOn] = useState<string | null>(editing?.ends_on ?? null);
  const [prescriber, setPrescriber] = useState(editing?.prescriber ?? '');
  const [reason, setReason] = useState(editing?.reason ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [issue, setIssue] = useState<string | null>(null);

  /** "4,5" → 4.5; boş ya da geçersizse `null`. */
  const decimal = (value: string): number | null => {
    const trimmed = value.trim().replace(',', '.');
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const save = () => {
    if (!name.trim()) {
      setIssue('İlaç adı gerekli.');
      return;
    }
    if (schedule === 'interval' && decimal(intervalHours) === null) {
      setIssue('Kaç saatte bir verileceğini yaz.');
      return;
    }
    if (schedule === 'fixed_times' && times.length === 0) {
      setIssue('En az bir saat seç.');
      return;
    }
    if (endsOn && endsOn < startedOn) {
      setIssue('Bitiş tarihi başlangıçtan önce olamaz.');
      return;
    }

    const text = (v: string) => (v.trim() ? v.trim() : null);
    onSubmit({
      name: name.trim(),
      form,
      strength: text(strength),
      route,
      default_amount: decimal(amount),
      amount_unit: unit,
      schedule_type: schedule,
      fixed_times: schedule === 'fixed_times' ? times : null,
      interval_hours: schedule === 'interval' ? decimal(intervalHours) : null,
      min_interval_hours: decimal(minInterval),
      max_doses_per_day: maxPerDay.trim() ? Number(maxPerDay.trim()) : null,
      started_on: startedOn,
      ends_on: endsOn,
      prescriber: text(prescriber),
      reason: text(reason),
      note: text(note),
    });
  };

  return (
    <BottomSheet
      visible={visible}
      busy={busy}
      onClose={onClose}
      title={editing ? 'İlacı düzenle' : 'İlaç ekle'}
      subtitle="Doz ve program bilgisi yalnızca hatırlatma içindir; uygulama doz önermez."
    >
      {error ? <FormError message={error} /> : null}

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

      <Text style={s.label}>Biçim</Text>
      <Chips
        options={MEDICATION_FORMS}
        value={form}
        onChange={(v) => v && setForm(v)}
        labels={FORM_LABEL}
        disabled={busy}
      />

      <Text style={s.label}>Kuvvet (kutudaki yazı)</Text>
      <TextInput
        style={s.input}
        value={strength}
        onChangeText={setStrength}
        placeholder="120 mg/5 ml"
        placeholderTextColor={colors.textFaint}
        editable={!busy}
        maxLength={60}
      />

      <Text style={s.label}>Veriliş yolu</Text>
      <Chips
        options={MEDICATION_ROUTES}
        value={route}
        onChange={(v) => v && setRoute(v)}
        labels={ROUTE_LABEL}
        disabled={busy}
      />

      <Text style={s.label}>Tek doz</Text>
      <View style={s.row}>
        <TextInput
          style={[s.input, s.amountInput]}
          value={amount}
          onChangeText={setAmount}
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
      <Text style={s.hint}>Doktorun söylediği miktar; her doz kaydında hazır gelir.</Text>

      <Text style={s.label}>Program</Text>
      <Chips
        options={SCHEDULE_TYPES}
        value={schedule}
        onChange={(v) => { if (v) { setSchedule(v); setIssue(null); } }}
        labels={SCHEDULE_LABEL}
        disabled={busy}
      />

      {schedule === 'interval' ? (
        <>
          <Text style={s.label}>Kaç saatte bir</Text>
          <TextInput
            style={s.input}
            value={intervalHours}
            onChangeText={(v) => { setIntervalHours(v); setIssue(null); }}
            placeholder="6"
            placeholderTextColor={colors.textFaint}
            keyboardType="decimal-pad"
            editable={!busy}
            maxLength={5}
          />
        </>
      ) : null}

      {schedule === 'fixed_times' ? (
        <TimeListField
          label="Saatler"
          values={times}
          onChange={(v) => { setTimes(v); setIssue(null); }}
          disabled={busy}
        />
      ) : null}

      {/*
        İki güvenlik alanı da İSTEĞE BAĞLI ve ikisi de **engel değil**: dolu
        olduklarında doz kaydı yine yazılır, yalnızca uyarı çıkar (§3b).
      */}
      <Text style={s.label}>En az kaç saat arayla</Text>
      <TextInput
        style={s.input}
        value={minInterval}
        onChangeText={setMinInterval}
        placeholder="4"
        placeholderTextColor={colors.textFaint}
        keyboardType="decimal-pad"
        editable={!busy}
        maxLength={5}
      />

      <Text style={s.label}>Günde en fazla kaç doz</Text>
      <TextInput
        style={s.input}
        value={maxPerDay}
        onChangeText={setMaxPerDay}
        placeholder="4"
        placeholderTextColor={colors.textFaint}
        keyboardType="number-pad"
        editable={!busy}
        maxLength={2}
      />
      <Text style={s.hint}>Bu iki alan kaydı engellemez; aşılırsa uyarı gösterilir.</Text>

      <DateField
        label="Başlangıç"
        value={startedOn}
        onChange={(v) => { setStartedOn(v); setIssue(null); }}
        disabled={busy}
      />
      <DateField
        label="Bitiş (boşsa süresiz)"
        value={endsOn}
        onChange={(v) => { setEndsOn(v); setIssue(null); }}
        onClear={() => setEndsOn(null)}
        placeholder="Süresiz"
        disabled={busy}
      />

      <Text style={s.label}>Kim yazdı</Text>
      <TextInput
        style={s.input}
        value={prescriber}
        onChangeText={setPrescriber}
        placeholder="Aile hekimi"
        placeholderTextColor={colors.textFaint}
        editable={!busy}
        maxLength={120}
      />

      <Text style={s.label}>Sebep</Text>
      <TextInput
        style={s.input}
        value={reason}
        onChangeText={setReason}
        placeholder="Ateş"
        placeholderTextColor={colors.textFaint}
        editable={!busy}
        maxLength={200}
      />

      <Text style={s.label}>Not</Text>
      <TextInput
        style={s.note}
        value={note}
        onChangeText={setNote}
        placeholder="Tok karnına, buzdolabında saklanacak…"
        placeholderTextColor={colors.textFaint}
        editable={!busy}
        multiline
        maxLength={500}
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
  hint: { ...typography.tiny, color: colors.textFaint },
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
