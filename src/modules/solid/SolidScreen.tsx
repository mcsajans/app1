import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { RecordRow, amountText, clockOf } from '../../components/records';
import { RecordDetailSheet, fullMoment, type RecordDetail } from '../../components/RecordDetail';
import { Button, Card, EmptyState, FormError, Loading, Screen, SectionTitle } from '../../components/ui';
import { ReadOnlyBanner, useCanEdit } from '../../components/permission';
import { errorText } from '../../core/api/client';
import { iso, solidService, type SolidRecord } from '../../core/api/modules';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { colors, radius, spacing, typography } from '../../core/theme';
import { withSaveFeedback } from '../../core/feedback/withSaveFeedback';
import { SolidFormSheet, type SolidFormValues } from './SolidFormSheet';
import { CATEGORY_LABELS, REACTION_LABELS, UNIT_LABELS } from './labels';

/**
 * Modül 4 — Ek Gıda.
 *
 * Ekran **kayıtları** gösteriyor; ekleme formu "+ Ek gıda ekle" ile alt
 * sayfada açılıyor. Önceden yedi alanlık form ekranın ortasında sabitti ve
 * asıl soru — "bugün ne yedi, neye tepki verdi" — formun altında kalıyordu.
 */
export default function SolidScreen() {
  const baby = useBabyStore((s) => s.selected());
  const babyId = baby?.id ?? null;

  const canEdit = useCanEdit();

  /** Ekleme sayfası açık mı + her açılışta yeniden bağlama sayacı. */
  const [formOpen, setFormOpen] = useState(false);
  const [formSeq, setFormSeq] = useState(0);
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

  const openForm = () => {
    setError(null);
    setFormSeq((n) => n + 1);
    setFormOpen(true);
  };

  /**
   * Alt sayfadan gelen kayıt.
   *
   * Reklam `withSaveFeedback`in varsayılan `save` tetiğinden geliyor
   * (panelden açılıp kapanıyor, gecikmesi de orada). Sayfa yalnızca kayıt
   * **geçtiyse** kapanıyor: hata durumunda doldurulan form kaybolmamalı.
   */
  const save = (v: SolidFormValues) => {
    if (!babyId) return;
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        await withSaveFeedback(() => solidService.create(babyId, {
          started_at: iso(),
          food_name: v.food,
          food_category: v.category,
          reaction: v.reaction,
          is_three_day_rule: v.threeDay,
          // Birim yalnızca miktar varsa gönderilir; sunucu miktar olmadan
          // birim istemiyor ve ek gıdada hacim birimi reddediliyor (§22.2).
          amount: v.amount,
          amount_unit: v.amount === null ? null : v.unit,
          note: v.note,
        }));
        setFormOpen(false);
        refreshAll();
      } catch (err) {
        setError(errorText(err));
      } finally {
        setBusy(false);
      }
    })();
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

      {/*
        Ekleme formu alt sayfada: ekranın işi kayıtları göstermek.
        Düğme listenin ÜSTÜNDE duruyor — en sık yapılan iş o ve geçmiş
        uzadıkça aşağı kaymasın.
      */}
      <Button label="+ Ek gıda ekle" onPress={openForm} disabled={busy || !canEdit} />

      {/* ── Geçmiş ── */}
      <SectionTitle hint="Dokununca ayrıntı, uzun basınca silme.">Son kayıtlar</SectionTitle>
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

      <SolidFormSheet
        key={formSeq}
        visible={formOpen}
        busy={busy}
        error={formOpen ? error : null}
        onClose={() => setFormOpen(false)}
        onSubmit={save}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  hint: { ...typography.small, color: colors.textSoft },
  /* Alerji kartı: listenin üstünde, kırmızı çerçeveli uyarı. */
  alertCard: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  alertTitle: { ...typography.small, color: colors.danger, fontWeight: '700' },
  alertRow: { ...typography.small, color: colors.danger },
});
