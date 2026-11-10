import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  Chips, RecordRow, StatTile, TimerDisplay,
  amountText, clockOf, formatDuration, humanDuration, useElapsedSeconds,
} from '../../components/records';
import { RecordDetailSheet, fullMoment, type RecordDetail } from '../../components/RecordDetail';
import { Button, Card, EmptyState, FormError, Loading, Screen, SectionTitle } from '../../components/ui';
import { ReadOnlyBanner, useCanEdit } from '../../components/permission';
import { errorText } from '../../core/api/client';
import {
  BOTTLE_CONTENTS, VOLUME_UNITS,
  bottleService, iso, localDate,
  type BottleContent, type BottleRecord, type VolumeUnit,
} from '../../core/api/modules';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { colors, radius, spacing, typography } from '../../core/theme';
import { withSaveFeedback } from '../../core/feedback/withSaveFeedback';

const CONTENT_LABELS: Record<BottleContent, string> = {
  bottle_breastmilk: 'Anne sütü',
  bottle_formula: 'Formül',
  water: 'Su',
};

/** Listede yer kazanmak için kısa biçim. */
const CONTENT_SHORT: Record<BottleContent, string> = {
  bottle_breastmilk: 'Anne sütü',
  bottle_formula: 'Formül',
  water: 'Su',
};

const UNIT_LABELS: Record<VolumeUnit, string> = { ml: 'ml', cl: 'cl' };

/** Şartnamedeki sık kullanılan miktarlar. */
const QUICK_ML = [60, 90, 120, 150] as const;

/**
 * Modül 3 — Biberon.
 *
 * Kayıt `feedings` tablosuna gider: biberon, emzirme ve ek gıda aynı tabloyu
 * paylaşır ve `feed_type` ile ayrılır. Böylece raporlardaki "toplam alınan ml"
 * tek sorguyla hesaplanabiliyor.
 *
 * Miktar **ml veya cl** girilebilir; sunucudaki `amount_ml` üretilen sütunu
 * dönüşümü kendisi yapar, bu yüzden istemci cl'yi ml'ye çevirmez — iki yerde
 * çevirim olsa biri değişince toplamlar sessizce kayardı.
 *
 * Süre isteğe bağlıdır: kronometre kullanılırsa `entry_source='timer'` ve
 * başlangıç/bitiş birlikte gönderilir, aksi hâlde yalnızca an kaydedilir.
 */
export default function BottleScreen() {
  const baby = useBabyStore((s) => s.selected());
  const babyId = baby?.id ?? null;
  const today = localDate();

  const canEdit = useCanEdit();

  const [content, setContent] = useState<BottleContent>('bottle_formula');
  const [unit, setUnit] = useState<VolumeUnit>('ml');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecordDetail | null>(null);

  /** Kronometre başlangıcı; null ise süre kaydedilmez. */
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const elapsed = useElapsedSeconds(startedAt);

  const list = useAsyncData(
    () => (babyId ? bottleService.list(babyId) : Promise.resolve({ feedings: [] })),
    [babyId],
  );
  const summary = useAsyncData(
    () => (babyId ? bottleService.summary(babyId, today) : Promise.resolve(null)),
    [babyId, today],
  );

  const records = list.data?.feedings ?? [];
  const sum = summary.data;

  // Son öğünden beri geçen süre canlı aksın: özetin anlık değeri saniyeler
  // içinde eskiyor ve "3 saat önce" bilgisi ekran açık kaldıkça yanlışlaşırdı.
  const sinceLast = useElapsedSeconds(sum?.last_bottle_at ?? null);

  const refreshAll = () => {
    list.reload();
    summary.reload();
  };

  const save = async () => {
    if (!babyId) return;

    const parsed = Number(amount.trim().replace(',', '.'));
    if (!amount.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setError('Miktar sıfırdan büyük bir sayı olmalı.');
      return;
    }
    // Sunucu üst sınırı 5000; burada da durdurulur ki kullanıcı formu
    // doldurduktan sonra ağ turu bekleyip hata görmesin.
    if (parsed > 5000) {
      setError('Miktar en fazla 5000 olabilir.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await withSaveFeedback(() => bottleService.create(babyId, {
        feed_type: content,
        amount: parsed,
        amount_unit: unit,
        ...(startedAt
          ? { started_at: startedAt, ended_at: iso(), duration_sec: elapsed, entry_source: 'timer' as const }
          : {}),
        note: note.trim() || null,
      }));
      setAmount('');
      setNote('');
      setStartedAt(null);
      refreshAll();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = (r: BottleRecord) => {
    const label = CONTENT_SHORT[r.feed_type] ?? 'Kayıt';
    Alert.alert('Kaydı sil', `${label} kaydı silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void bottleService.remove(r.id).then(refreshAll).catch((e) => setError(errorText(e)));
        },
      },
    ]);
  };

  /** Geçmiş satırına dokununca açılan ayrıntılı rapor. */
  const detailOf = (r: BottleRecord): RecordDetail => {
    const ml = r.amount_ml === null || r.amount_ml === undefined ? null : Number(r.amount_ml);
    return {
      icon: r.feed_type === 'water' ? 'water' : r.feed_type === 'bottle_breastmilk' ? 'breastfeeding' : 'bottle',
      title: CONTENT_SHORT[r.feed_type] ?? 'Biberon',
      subtitle: fullMoment(r.started_at) ?? undefined,
      stats: [
        { label: 'Miktar', value: `${amountText(r.amount)} ${r.amount_unit ?? ''}`.trim() },
        // cl girildiyse ml karşılığı ayrıca gösterilir; dönüşüm sunucuda yapılır.
        { label: 'Mililitre', value: ml === null ? '—' : `${Math.round(ml)} ml`, tone: 'good' },
        { label: 'Süre', value: r.duration_sec ? formatDuration(r.duration_sec) : '—' },
      ],
      rows: [
        { label: 'İçerik', value: CONTENT_LABELS[r.feed_type] },
        { label: 'Başlangıç', value: fullMoment(r.started_at) },
        { label: 'Bitiş', value: r.ended_at ? fullMoment(r.ended_at) : null },
        { label: 'Girilen miktar', value: `${amountText(r.amount)} ${r.amount_unit ?? ''}`.trim() },
        { label: 'Toplama giren', value: r.feed_type === 'water' ? 'Hayır (su ayrı sayılır)' : `${Math.round(ml ?? 0)} ml` },
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
    };
  };

  if (!baby) {
    return (
      <Screen>
        <EmptyState icon="bottle" title="Önce bir bebek profili ekle" detail="Biberon kayıtları seçili bebeğe bağlı tutulur." />
      </Screen>
    );
  }

  const quickUnitHint = unit === 'cl' ? ' (birim ml’ye alınır)' : '';

  return (
    <Screen>
      <ReadOnlyBanner />
      {error ? <FormError message={error} /> : null}

      {/* ── Son öğün ── */}
      {sum?.last_bottle_at ? (
        <Card>
          <Text style={s.label}>Son biberondan beri</Text>
          <Text style={s.since}>{humanDuration(sinceLast)}</Text>
          <Text style={s.hint}>
            {clockOf(sum.last_bottle_at)}
            {sum.avg_interval_sec ? ` · bugün ortalama ${humanDuration(sum.avg_interval_sec)} arayla` : ''}
          </Text>
        </Card>
      ) : null}

      {/* ── Ekleme formu ── */}
      <SectionTitle hint="Miktarı ml veya cl girebilirsin; toplamlar ml olarak hesaplanır.">
        Biberon ekle
      </SectionTitle>
      <Card>
        <Text style={s.label}>İçerik</Text>
        <Chips
          options={BOTTLE_CONTENTS}
          value={content}
          onChange={(v) => v && setContent(v)}
          labels={CONTENT_LABELS}
          disabled={busy || !canEdit}
        />

        <Text style={s.label}>Miktar *</Text>
        <TextInput
          style={s.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="120"
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
          editable={!busy}
        />
        <View style={s.gapXs} />
        <Chips
          options={VOLUME_UNITS}
          value={unit}
          onChange={(v) => v && setUnit(v)}
          labels={UNIT_LABELS}
          disabled={busy || !canEdit}
        />

        <Text style={s.label}>Hızlı miktar{quickUnitHint}</Text>
        <View style={s.quick}>
          {QUICK_ML.map((v) => (
            <Pressable
              key={v}
              disabled={busy || !canEdit}
              onPress={() => {
                // Hızlı butonlar ml cinsindendir; cl seçiliyken birim de
                // ml'ye alınır, yoksa "120 cl" gibi 1,2 litrelik bir kayıt
                // oluşurdu.
                setAmount(String(v));
                setUnit('ml');
              }}
              style={({ pressed }) => [s.quickChip, pressed && s.quickChipOn]}
            >
              <Text style={s.quickText}>{v} ml</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>Süre (isteğe bağlı)</Text>
        {startedAt ? (
          <View style={s.timerBox}>
            <TimerDisplay seconds={elapsed} />
            <Button label="Süreyi iptal et" variant="ghost" onPress={() => setStartedAt(null)} disabled={busy || !canEdit} />
          </View>
        ) : (
          <Button label="⏱ Süreyi başlat" variant="ghost" onPress={() => setStartedAt(iso())} disabled={busy || !canEdit} />
        )}

        <Text style={s.label}>Not</Text>
        <TextInput
          style={s.input}
          value={note}
          onChangeText={setNote}
          placeholder="Yarısını bıraktı, geğirtildi…"
          placeholderTextColor={colors.textFaint}
          editable={!busy}
        />

        <View style={s.gap} />
        <Button label={busy ? 'Kaydediliyor…' : 'Kaydet'} onPress={save} disabled={busy || !canEdit} />
      </Card>

      {/* ── Günlük özet ── */}
      <SectionTitle hint="Su, biberon ml toplamına dâhil edilmez.">Bugün</SectionTitle>
      <Card>
        {summary.loading && !sum ? (
          <Loading label="Özet yükleniyor…" />
        ) : summary.error ? (
          <Text style={s.hint}>{summary.error}</Text>
        ) : (
          <>
            <View style={s.tiles}>
              <StatTile label="Öğün" value={String(sum?.bottle_count ?? 0)} />
              <StatTile label="Toplam" value={`${sum?.bottle_total_ml ?? 0} ml`} tone="good" />
              <StatTile label="Ortalama" value={`${sum?.avg_ml ?? 0} ml`} />
            </View>
            <View style={s.tilesGap} />
            <View style={s.tiles}>
              <StatTile
                label="Anne sütü"
                value={`${sum?.breastmilk_ml ?? 0} ml`}
                hint={`${sum?.breastmilk_count ?? 0} öğün`}
              />
              <StatTile
                label="Formül"
                value={`${sum?.formula_ml ?? 0} ml`}
                hint={`${sum?.formula_count ?? 0} öğün`}
              />
              <StatTile
                label="Su"
                value={`${sum?.water_ml ?? 0} ml`}
                hint={`${sum?.water_count ?? 0} kez`}
              />
            </View>
          </>
        )}
      </Card>

      {/* ── Geçmiş ── */}
      <SectionTitle hint="Uzun basıp silebilirsin.">Geçmiş</SectionTitle>
      <Card>
        {list.loading && records.length === 0 ? (
          <Loading label="Kayıtlar yükleniyor…" />
        ) : records.length === 0 ? (
          <Text style={s.hint}>Henüz biberon kaydı yok.</Text>
        ) : (
          records.map((r) => (
            <RecordRow
              key={r.id}
              icon={r.feed_type === 'water' ? 'water' : r.feed_type === 'bottle_breastmilk' ? 'breastfeeding' : 'bottle'}
              title={`${CONTENT_SHORT[r.feed_type] ?? 'Biberon'} · ${amountText(r.amount)} ${r.amount_unit ?? ''}`.trim()}
              detail={[
                r.duration_sec ? formatDuration(r.duration_sec) : null,
                r.note,
                r.actor_name,
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
  since: { ...typography.h1, color: colors.text },
  gap: { height: spacing.sm },
  gapXs: { height: spacing.xs },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tilesGap: { height: spacing.sm },
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
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  // Basılıyken zemini koyultmak metni gizlerdi (ikisi de primary tonu).
  quickChipOn: { opacity: 0.55 },
  quickText: { ...typography.small, color: colors.primary, fontWeight: '700' },
  timerBox: { gap: spacing.xs },
});
