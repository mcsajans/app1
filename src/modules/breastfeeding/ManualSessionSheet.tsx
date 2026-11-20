import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Slider from '@react-native-community/slider';

import { BottomSheet } from '../../components/BottomSheet';
import { MomentField } from '../../components/DateTimeField';
import { Chips, formatDuration, humanDuration } from '../../components/records';
import { Button, ButtonRow, FormError } from '../../components/ui';
import {
  MAX_BREAST_SPAN_SEC, splitWindow, validateWindow, type WindowIssue,
} from '../../core/records/manualWindow';
import { SIDE_LABEL } from '../../core/timers/liveTimer';
import { colors, radius, spacing, typography } from '../../core/theme';

/** Hangi meme(ler) emzirildi — "ikisi de" seçilirse süre paylaştırılır. */
const SIDE_MODES = ['left', 'right', 'both'] as const;
const SIDE_MODE_LABELS = { left: 'Sol', right: 'Sağ', both: 'İkisi de' } as const;

export type ManualBreastValues = {
  /** ISO 8601. */
  startedAt: string;
  /** ISO 8601. */
  endedAt: string;
  /** Önce emzirilen taraf; son taraf diğeri olur ve "sırada" rozetini belirler. */
  firstSide: 'left' | 'right';
  /** Yalnızca "ikisi de" seçildiğinde dolu; aksi hâlde sunucu pencereyi tek tarafa yazar. */
  leftSec?: number;
  rightSec?: number;
  note: string | null;
};

const MINUTE = 60_000;
const roundToMinute = (ms: number) => Math.floor(ms / MINUTE) * MINUTE;

/**
 * Elle emzirme girişi (§10.6) — kronometre hiç çalıştırılmadan girilen,
 * doğrudan tamamlanmış seans.
 *
 * **Durum sıfırlaması bileşenin kendisinde değil.** Sayfa her açılışta yeni
 * bir `key` ile bağlanıyor (bkz. `BreastfeedingScreen`), böylece saat
 * varsayılanları `useState` başlatıcılarında bir kez hesaplanıyor. Önceki
 * sürüm bunu `visible` değişince setState eden bir efektle yapıyordu;
 * React derleyicisi o deseni haklı olarak uyarıyor (zincirleme çizim) ve
 * kullanıcı formu doldururken alanların geri atma riski de oradaydı.
 *
 * Bir zamanlar bu sayfanın ikinci bir modu vardı ("sayacı geçmişten başlat");
 * o iş artık başlangıç panelindeki kutucukta, çünkü orada zaten taraf
 * seçilmiş ve sorulacak tek şey saat.
 *
 * **Dakika hesabı istenmez.** Anne "14:00–14:25, çoğunlukla sol" bilir; iki
 * memenin saniyesini ayrı ayrı sormak formu kullanılmaz hâle getirirdi.
 * "İkisi de" seçilirse pencere tek bir kaydırıcıyla paylaştırılır.
 *
 * Aktif/pasif düzeltmesi burada **sorulmaz**: pencerenin tamamı aktif emme
 * kabul edilir, anne isterse kayıt detayındaki mevcut "Aktif süreyi düzelt"
 * aksiyonunu kullanır (§10.2.1).
 */
export function ManualSessionSheet({
  visible,
  initialBoth,
  busy,
  error,
  nextSide,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  /**
   * Sayfa "İkisi de" seçiliyken açılsın mı. Başlangıç panelindeki "İki
   * memeyi de emzirdim" düğmesi buraya yönlendiriyor; varsayılan seçimi
   * tek memede bırakmak kullanıcıya aynı şeyi iki kez sordururdu.
   */
  initialBoth?: boolean;
  busy: boolean;
  error: string | null;
  /** Son emzirilen tarafın tersi — varsayılan seçim olarak kullanılır. */
  nextSide: 'left' | 'right' | null;
  onClose: () => void;
  onSubmit: (values: ManualBreastValues) => void;
}) {
  const [startMs, setStartMs] = useState(() => roundToMinute(Date.now() - 30 * MINUTE));
  const [endMs, setEndMs] = useState(() => roundToMinute(Date.now()));
  const [sideMode, setSideMode] = useState<(typeof SIDE_MODES)[number]>(
    initialBoth ? 'both' : (nextSide ?? 'left'),
  );
  const [firstSide, setFirstSide] = useState<'left' | 'right'>(nextSide ?? 'left');
  /** Sol memenin payı, yüzde. Kaydırıcı dakika yerine oran sorar. */
  const [leftPercent, setLeftPercent] = useState(50);
  const [note, setNote] = useState('');
  const [issue, setIssue] = useState<WindowIssue | null>(null);

  const spanSec = Math.max(0, Math.round((endMs - startMs) / 1000));
  const split = splitWindow(spanSec, leftPercent / 100);

  const save = () => {
    const found = validateWindow({ startMs, endMs, maxSpanSec: MAX_BREAST_SPAN_SEC });
    if (found) {
      setIssue(found);
      return;
    }

    const both = sideMode === 'both';
    onSubmit({
      startedAt: new Date(startMs).toISOString(),
      endedAt: new Date(endMs).toISOString(),
      // "İkisi de" değilse seçilen taraf hem ilk hem son taraftır.
      firstSide: both ? firstSide : (sideMode as 'left' | 'right'),
      ...(both ? { leftSec: split.leftSec, rightSec: split.rightSec } : {}),
      note: note.trim() ? note.trim() : null,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      busy={busy}
      onClose={onClose}
      title="Elle emzirme kaydı"
      subtitle="Kronometreyi çalıştırmadıysan emzirmenin saatlerini buradan gir."
    >
      {error ? <FormError message={error} /> : null}

      <Text style={s.label}>Hangi meme?</Text>
      <Chips
        options={SIDE_MODES}
        value={sideMode}
        onChange={(v) => {
          if (!v) return;
          setSideMode(v);
          setIssue(null);
        }}
        labels={SIDE_MODE_LABELS}
        disabled={busy}
      />

      <MomentField
        label="Başlangıç"
        value={startMs}
        onChange={(ms) => {
          setStartMs(ms);
          setIssue(null);
        }}
        disabled={busy}
        error={issue?.field === 'start' ? issue.message : null}
      />

      <MomentField
        label="Bitiş"
        value={endMs}
        onChange={(ms) => {
          setEndMs(ms);
          setIssue(null);
        }}
        disabled={busy}
        error={issue?.field === 'end' ? issue.message : null}
      />

      <View style={s.duration}>
        <Text style={s.durationLabel}>Toplam süre</Text>
        <Text style={s.durationValue}>{spanSec > 0 ? humanDuration(spanSec) : '—'}</Text>
      </View>

      {sideMode === 'both' ? (
        <View style={s.splitCard}>
          <View style={s.splitRow}>
            <Text style={s.splitSide}>Sol</Text>
            <Text style={s.splitValue}>{formatDuration(split.leftSec)}</Text>
            <Text style={s.splitSide}>Sağ</Text>
            <Text style={s.splitValue}>{formatDuration(split.rightSec)}</Text>
          </View>
          <Slider
            style={s.slider}
            minimumValue={0}
            maximumValue={100}
            step={5}
            value={leftPercent}
            onValueChange={(v) => setLeftPercent(Math.round(v))}
            minimumTrackTintColor={colors.trackFeeding}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.trackFeeding}
            disabled={busy}
          />
          <Text style={s.hint}>Kaydırıcı süreyi iki meme arasında paylaştırır.</Text>

          <Text style={s.label}>Önce hangi meme?</Text>
          <Chips
            options={['left', 'right'] as const}
            value={firstSide}
            onChange={(v) => v && setFirstSide(v)}
            labels={SIDE_LABEL}
            disabled={busy}
          />
          <Text style={s.hint}>
            Son emzirilen taraf {SIDE_LABEL[firstSide === 'left' ? 'right' : 'left']} olur;
            bir sonraki seans önerisi buna göre verilir.
          </Text>
        </View>
      ) : null}

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
  hint: { ...typography.tiny, color: colors.textFaint },
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
  splitCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  splitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  splitSide: { ...typography.small, color: colors.textSoft, fontWeight: '600' },
  splitValue: { ...typography.h3, color: colors.text },
  slider: { width: '100%', height: 40 },
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
