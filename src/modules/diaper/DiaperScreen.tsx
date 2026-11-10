import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Chips, RecordRow, StatTile, clockOf } from '../../components/records';
import { type IconName } from '../../components/Icon';
import { RecordDetailSheet, fullMoment, type RecordDetail } from '../../components/RecordDetail';
import { Button, Card, EmptyState, FormError, Loading, Screen, SectionTitle } from '../../components/ui';
import { ReadOnlyBanner, useCanEdit } from '../../components/permission';
import { errorText } from '../../core/api/client';
import {
  DIAPER_TYPES, POOP_COLORS, POOP_TEXTURES, RASH_LEVELS,
  diaperService, iso, localDate, type DiaperRecord,
} from '../../core/api/modules';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { colors, radius, spacing, typography } from '../../core/theme';
import { withSaveFeedback } from '../../core/feedback/withSaveFeedback';

const TYPE_LABELS: Record<string, string> = {
  cis: 'Çiş', kaka: 'Kaka', karisik: 'İkisi', kuru: 'Kuru',
};
const TYPE_ICONS: Record<string, IconName> = {
  cis: 'pee', kaka: 'poop', karisik: 'diaper', kuru: 'check',
};
const COLOR_LABELS: Record<string, string> = {
  sari: 'Sarı', yesil: 'Yeşil', kahverengi: 'Kahve', siyah: 'Siyah', kirmizi: 'Kırmızı', diger: 'Diğer',
};
const TEXTURE_LABELS: Record<string, string> = {
  normal: 'Normal', yumusak: 'Yumuşak', sulu: 'Sulu', sert: 'Sert',
};
const RASH_LABELS: Record<string, string> = { none: 'Yok', mild: 'Hafif', severe: 'Şiddetli' };

/** Kaka ayrıntıları yalnızca dışkı içeren türlerde anlamlıdır. */
const hasPoop = (t: string) => t === 'kaka' || t === 'karisik';

/** Modül 6 — Bez Değişimi. */
export default function DiaperScreen() {
  const baby = useBabyStore((s) => s.selected());
  const babyId = baby?.id ?? null;
  const today = localDate();

  const canEdit = useCanEdit();

  const [type, setType] = useState<(typeof DIAPER_TYPES)[number]>('cis');
  const [color, setColor] = useState<(typeof POOP_COLORS)[number] | null>(null);
  const [texture, setTexture] = useState<(typeof POOP_TEXTURES)[number] | null>(null);
  const [rash, setRash] = useState<(typeof RASH_LEVELS)[number]>('none');
  const [cream, setCream] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecordDetail | null>(null);

  const list = useAsyncData(
    () => (babyId ? diaperService.list(babyId) : Promise.resolve({ diapers: [] })),
    [babyId],
  );
  const summary = useAsyncData(
    () => (babyId ? diaperService.summary(babyId, today) : Promise.resolve(null)),
    [babyId, today],
  );

  const records = list.data?.diapers ?? [];
  const sum = summary.data;

  const refreshAll = () => {
    list.reload();
    summary.reload();
  };

  const save = async () => {
    if (!babyId) return;
    setBusy(true);
    setError(null);
    try {
      await withSaveFeedback(() => diaperService.create(babyId, {
        changed_at: iso(),
        diaper_type: type,
        // Kaka içermeyen türde renk/kıvam gönderilmez; aksi hâlde "kuru bez,
        // sarı, sulu" gibi anlamsız kayıtlar birikirdi.
        color: hasPoop(type) ? color : null,
        consistency: hasPoop(type) ? texture : null,
        rash_status: rash,
        cream_applied: cream,
        note: note.trim() || null,
      }));
      setColor(null);
      setTexture(null);
      setNote('');
      refreshAll();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = (r: DiaperRecord) => {
    Alert.alert('Kaydı sil', 'Bez değişimi kaydı silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void diaperService.remove(r.id).then(refreshAll).catch((e) => setError(errorText(e)));
        },
      },
    ]);
  };

  /** Geçmiş satırına dokununca açılan ayrıntılı rapor. */
  const detailOf = (r: DiaperRecord): RecordDetail => ({
    icon: TYPE_ICONS[r.diaper_type] ?? 'diaper',
    title: TYPE_LABELS[r.diaper_type] ?? r.diaper_type,
    subtitle: fullMoment(r.changed_at) ?? undefined,
    stats: [
      { label: 'Tip', value: TYPE_LABELS[r.diaper_type] ?? '—' },
      {
        label: 'Pişik',
        value: RASH_LABELS[r.rash_status] ?? '—',
        tone: r.rash_status === 'severe' ? 'warn' : r.rash_status === 'none' ? 'good' : 'neutral',
      },
      { label: 'Krem', value: r.cream_applied ? 'Sürüldü' : 'Sürülmedi' },
    ],
    // Şiddetli pişik hekime danışma eşiği; listede tek satıra sıkışıp
    // gözden kaçıyordu.
    warning: r.rash_status === 'severe' ? 'Şiddetli pişik kaydedilmiş. Sürüyorsa hekime danış.' : null,
    rows: [
      { label: 'Değişim zamanı', value: fullMoment(r.changed_at) },
      { label: 'Bez tipi', value: TYPE_LABELS[r.diaper_type] },
      { label: 'Renk', value: r.color ? COLOR_LABELS[r.color] : null },
      { label: 'Kıvam', value: r.consistency ? TEXTURE_LABELS[r.consistency] : null },
      { label: 'Pişik durumu', value: RASH_LABELS[r.rash_status] },
      { label: 'Krem', value: r.cream_applied ? 'Evet' : 'Hayır' },
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
        <EmptyState icon="diaper" title="Önce bir bebek profili ekle" detail="Bez kayıtları seçili bebeğe bağlı tutulur." />
      </Screen>
    );
  }

  return (
    <Screen>
      <ReadOnlyBanner />
      {error ? <FormError message={error} /> : null}

      {/* ── Günlük özet ── */}
      <Card>
        {summary.loading && !sum ? (
          <Loading label="Özet yükleniyor…" />
        ) : (
          <>
            <View style={s.tiles}>
              <StatTile label="Toplam" value={String(sum?.total_count ?? 0)} />
              <StatTile label="Çiş" value={String(sum?.wet_count ?? 0)} />
              <StatTile label="Kaka" value={String(sum?.dirty_count ?? 0)} />
              <StatTile
                label="Pişik"
                value={RASH_LABELS[sum?.worst_rash_status ?? 'none'] ?? '—'}
                tone={sum?.worst_rash_status === 'severe' ? 'warn' : 'neutral'}
              />
            </View>
            {/* 'İkisi' hem çiş hem kaka sayıldığı için toplamları aşabilir. */}
            <Text style={s.hint}>
              &quot;İkisi&quot; kayıtları hem çiş hem kaka olarak sayılır.
            </Text>
          </>
        )}
      </Card>

      {/* ── Hızlı ekleme ── */}
      <SectionTitle hint="Saat otomatik olarak şu an kaydedilir.">Bez değişimi ekle</SectionTitle>
      <Card>
        <Text style={s.label}>Tür</Text>
        <Chips options={DIAPER_TYPES} value={type} onChange={(v) => v && setType(v)} labels={TYPE_LABELS} disabled={busy || !canEdit} />

        {hasPoop(type) ? (
          <>
            <Text style={s.label}>Renk</Text>
            <Chips options={POOP_COLORS} value={color} onChange={setColor} labels={COLOR_LABELS} disabled={busy || !canEdit} allowClear />

            <Text style={s.label}>Kıvam</Text>
            <Chips options={POOP_TEXTURES} value={texture} onChange={setTexture} labels={TEXTURE_LABELS} disabled={busy || !canEdit} allowClear />
          </>
        ) : null}

        <Text style={s.label}>Pişik durumu</Text>
        <Chips options={RASH_LEVELS} value={rash} onChange={(v) => v && setRash(v)} labels={RASH_LABELS} disabled={busy || !canEdit} />

        <View style={s.switchRow}>
          <Text style={s.label}>Pişik kremi sürüldü</Text>
          <Switch
            value={cream}
            onValueChange={setCream}
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
          placeholder="İsteğe bağlı"
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
          <Text style={s.hint}>Henüz bez kaydı yok.</Text>
        ) : (
          records.map((r) => (
            <RecordRow
              key={r.id}
              icon={TYPE_ICONS[r.diaper_type] ?? 'diaper'}
              title={TYPE_LABELS[r.diaper_type] ?? r.diaper_type}
              detail={[
                r.color ? COLOR_LABELS[r.color] : null,
                r.consistency ? TEXTURE_LABELS[r.consistency] : null,
                r.rash_status !== 'none' ? `pişik: ${RASH_LABELS[r.rash_status]}` : null,
                r.cream_applied ? 'krem' : null,
                r.note,
              ]
                .filter(Boolean)
                .join(' · ')}
              right={clockOf(r.changed_at)}
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
  hint: { ...typography.tiny, color: colors.textFaint, marginTop: spacing.xs },
  gap: { height: spacing.sm },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
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
});
