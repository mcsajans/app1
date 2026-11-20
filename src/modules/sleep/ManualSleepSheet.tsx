import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { MomentField } from '../../components/DateTimeField';
import { Chips, humanDuration } from '../../components/records';
import { Button, ButtonRow, FormError } from '../../components/ui';
import {
  MAX_SLEEP_SPAN_SEC, suggestSleepType, validateWindow, type WindowIssue,
} from '../../core/records/manualWindow';
import { SLEEP_TYPE_LABEL } from '../../core/timers/liveTimer';
import { colors, radius, spacing, typography } from '../../core/theme';

const QUALITY_LABELS = { rahat: 'Rahat', huzursuz: 'Huzursuz', sik_uyandi: 'Sık uyandı' } as const;
const QUALITIES = ['rahat', 'huzursuz', 'sik_uyandi'] as const;

export type ManualSleepValues = {
  sleepType: 'night' | 'nap';
  /** ISO 8601. */
  startedAt: string;
  /** ISO 8601. */
  endedAt: string;
  quality: (typeof QUALITIES)[number] | null;
  note: string | null;
};

const MINUTE = 60_000;
/** Dakikaya yuvarlanmış "şu an" — saniyeli bir başlangıç saati okunmuyor. */
const roundToMinute = (ms: number) => Math.floor(ms / MINUTE) * MINUTE;

/**
 * Elle uyku girişi (§11.1) — kronometre hiç çalıştırılmadan girilen,
 * doğrudan tamamlanmış kayıt.
 *
 * Sayaç akarken açılan tek giriş yolu budur; sayaç boştayken aynı işi
 * başlangıç panelinin "Geri tarihli" sekmesi yapar. Sayfanın bir zamanlar
 * ikinci bir modu vardı ("sayacı geçmişten başlat"); o iş artık paneldeki
 * kutucukta.
 *
 * **Durum sıfırlaması bileşenin kendisinde değil.** Sayfa her açılışta yeni
 * bir `key` ile bağlanıyor (bkz. `SleepScreen`), böylece saat varsayılanları
 * `useState` başlatıcılarında bir kez hesaplanıyor. Önceki sürüm bunu
 * `visible` değişince setState eden bir efektle yapıyordu; o desen hem
 * React derleyicisinin uyardığı bir zincirleme çizim, hem de kullanıcı formu
 * doldururken alanların geri atma riski.
 *
 * Doğrulama hem burada hem sunucuda var; buradaki kopya kullanıcıya ağ
 * beklemeden cevap vermek için (`core/records/manualWindow.ts`).
 */
export function ManualSleepSheet({
  visible,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  busy: boolean;
  /** Sunucudan dönen hata — sayfa açık kalır ki değerler kaybolmasın. */
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ManualSleepValues) => void;
}) {
  /*
   * Varsayılanlar hemen geçerli bir kayıt verir: "bir saat önce başladı,
   * şimdi bitti". Boş bir form açıp kullanıcıyı dört alan doldurtmak, en sık
   * senaryoda (unutulmuş şekerleme) gereksiz iş.
   */
  const [startMs, setStartMs] = useState(() => roundToMinute(Date.now() - 60 * MINUTE));
  const [endMs, setEndMs] = useState(() => roundToMinute(Date.now()));
  const [sleepType, setSleepType] = useState<'night' | 'nap'>(() =>
    suggestSleepType(Date.now() - 60 * MINUTE));
  const [typeTouched, setTypeTouched] = useState(false);
  const [quality, setQuality] = useState<(typeof QUALITIES)[number] | null>(null);
  const [note, setNote] = useState('');
  const [issue, setIssue] = useState<WindowIssue | null>(null);

  const changeStart = (ms: number) => {
    setStartMs(ms);
    setIssue(null);
    // Tip yalnızca ÖNERİ: kullanıcı elle seçtiyse artık dokunulmaz.
    if (!typeTouched) setSleepType(suggestSleepType(ms));
  };

  const spanSec = Math.max(0, Math.round((endMs - startMs) / 1000));

  const save = () => {
    const found = validateWindow({ startMs, endMs, maxSpanSec: MAX_SLEEP_SPAN_SEC });
    if (found) {
      setIssue(found);
      return;
    }
    onSubmit({
      sleepType,
      startedAt: new Date(startMs).toISOString(),
      endedAt: new Date(endMs).toISOString(),
      quality,
      note: note.trim() ? note.trim() : null,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      busy={busy}
      onClose={onClose}
      title="Elle uyku kaydı"
      subtitle="Sayacı çalıştırmadıysan uykunun başlangıç ve bitiş saatini buradan gir."
    >
      {error ? <FormError message={error} /> : null}

      <Text style={s.label}>Uyku tipi</Text>
      <Chips
        options={['nap', 'night'] as const}
        value={sleepType}
        onChange={(v) => {
          if (!v) return;
          setSleepType(v);
          setTypeTouched(true);
        }}
        labels={SLEEP_TYPE_LABEL}
        disabled={busy}
      />

      <MomentField
        label="Uykuya daldı"
        value={startMs}
        onChange={changeStart}
        disabled={busy}
        error={issue?.field === 'start' ? issue.message : null}
      />

      <MomentField
        label="Uyandı"
        value={endMs}
        onChange={(ms) => {
          setEndMs(ms);
          setIssue(null);
        }}
        disabled={busy}
        error={issue?.field === 'end' ? issue.message : null}
      />

      <View style={s.duration}>
        <Text style={s.durationLabel}>Süre</Text>
        <Text style={s.durationValue}>
          {spanSec > 0 ? humanDuration(spanSec) : '—'}
        </Text>
      </View>

      <Text style={s.label}>Uyku kalitesi</Text>
      <Chips
        options={QUALITIES}
        value={quality}
        onChange={setQuality}
        labels={QUALITY_LABELS}
        disabled={busy}
        allowClear
      />

      <Text style={s.label}>Not</Text>
      <TextInput
        style={s.note}
        value={note}
        onChangeText={setNote}
        placeholder="İsteğe bağlı"
        placeholderTextColor={colors.textFaint}
        editable={!busy}
        multiline
        maxLength={500}
      />

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
  duration: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  durationLabel: { ...typography.small, color: colors.textSoft },
  durationValue: { ...typography.h3, color: colors.text },
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
