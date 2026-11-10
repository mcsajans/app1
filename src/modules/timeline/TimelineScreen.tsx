import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { clockOf, formatDuration } from '../../components/records';
import { RecordDetailSheet, fullMoment, type RecordDetail } from '../../components/RecordDetail';
import { TimelineCard, subtypeLabel } from '../../components/home';
import { Button, Card, EmptyState, FormError, Loading, Screen, SectionTitle } from '../../components/ui';
import { localDate, timelineService, type TimelineEntry } from '../../core/api/modules';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { Icon, type IconName } from '../../components/Icon';
import { colors, moduleTint, radius, spacing, typography } from '../../core/theme';

/**
 * Tür başına görsel kimlik. `tint` ikon kutusunun pastel zemini, `track`
 * kartın solundaki doygun şerit — şablonda akışı okunur kılan ayrım bu.
 */
const KIND_META: Record<string, { icon: IconName; label: string; tint: string; track: string }> = {
  feeding: { icon: 'bottle', label: 'Beslenme', tint: moduleTint.bottle, track: colors.trackFeeding },
  sleep: { icon: 'sleep', label: 'Uyku', tint: moduleTint.sleep, track: colors.trackSleep },
  diaper: { icon: 'diaper', label: 'Bez Değişimi', tint: moduleTint.diaper, track: colors.trackDiaper },
  music: { icon: 'music', label: 'Müzik', tint: moduleTint.music, track: colors.trackOther },
  notification: { icon: 'reminders', label: 'Bildirim', tint: moduleTint.reminders, track: colors.trackOther },
};

const FILTERS = ['feeding', 'sleep', 'diaper', 'music'] as const;

const shiftDate = (date: string, days: number): string => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
};

const prettyDate = (date: string): string => {
  const today = localDate();
  if (date === today) return 'Bugün';
  if (date === shiftDate(today, -1)) return 'Dün';
  return new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', weekday: 'short',
  });
};

/** Modül 9 — Günlük Akış. */
export default function TimelineScreen() {
  const baby = useBabyStore((s) => s.selected());
  const babyId = baby?.id ?? null;

  const [date, setDate] = useState(localDate());
  const [active, setActive] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<RecordDetail | null>(null);

  const feed = useAsyncData(
    () =>
      babyId
        ? timelineService.feed(babyId, { date, page, limit: 20, categories: active })
        : Promise.resolve(null),
    [babyId, date, page, active.join(',')],
  );

  const entries = feed.data?.entries ?? [];
  const hasMore = feed.data?.has_more ?? false;

  const toggleFilter = (k: string) => {
    // Filtre değişince sayfa başa döner; yoksa 3. sayfada boş liste görünürdü.
    setPage(1);
    setActive((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  const goDate = (days: number) => {
    setPage(1);
    setDate((d) => shiftDate(d, days));
  };

  /**
   * Kartın sağ sütunu — şablonda burası tek satır değil, kısa satırlar
   * yığını. Saat her zaman ilk satır; kalanı kaydın taşıdığına göre.
   */
  const describeLines = (e: TimelineEntry): string[] => {
    const lines = [clockOf(e.started_at)];
    // Emzirmede bebeğin gerçek beslenme süresi öne çıkar; kronometrenin
    // ölçtüğü duvar saati ancak farklıysa ikinci satırda görünür.
    if (e.duration_sec) {
      const isBreast = e.subtype === 'breast';
      lines.push(isBreast ? `${formatDuration(e.duration_sec)} aktif` : formatDuration(e.duration_sec));
      if (isBreast && e.total_elapsed_sec && e.total_elapsed_sec > e.duration_sec) {
        lines.push(`toplam ${formatDuration(e.total_elapsed_sec)}`);
      }
    }
    if (e.amount_ml) lines.push(`${e.amount_ml} ml`);
    lines.push(e.actor.is_me ? 'sen' : e.actor.display);
    return lines;
  };

  /**
   * Akış satırına dokununca açılan ayrıntılı rapor.
   *
   * Akış kayıtların **özetini** taşır (tür, süre, miktar, not, aktör); modüle
   * özgü alanlar (bez rengi, uyku kalitesi…) burada yoktur. Bu yüzden rapor
   * da özet düzeyinde kalır ve silme sunmaz — akış salt okunur bir görünümdür,
   * silme kaydın kendi modülünden yapılır.
   */
  const detailOf = (e: TimelineEntry): RecordDetail => {
    const meta = KIND_META[e.kind] ?? { icon: '•', label: e.kind, color: colors.textSoft };
    return {
      icon: meta.icon,
      title: meta.label,
      subtitle: fullMoment(e.started_at) ?? undefined,
      stats: [
        { label: 'Saat', value: clockOf(e.started_at) },
        { label: 'Süre', value: e.duration_sec ? formatDuration(e.duration_sec) : '—' },
        { label: 'Miktar', value: e.amount_ml ? `${e.amount_ml} ml` : '—' },
      ],
      rows: [
        { label: 'Tür', value: meta.label },
        { label: 'Alt tür', value: subtypeLabel(e.subtype) },
        { label: 'Başlangıç', value: fullMoment(e.started_at) },
        { label: 'Bitiş', value: e.ended_at ? fullMoment(e.ended_at) : null },
        { label: 'Giren kişi', value: e.actor.is_me ? `${e.actor.display} (sen)` : e.actor.display },
        { label: 'Kaynak kayıt', value: `${meta.label} #${e.ref_id}` },
      ],
      note: e.note,
    };
  };

  if (!baby) {
    return (
      <Screen>
        <EmptyState icon="timeline" title="Önce bir bebek profili ekle" detail="Akış seçili bebeğe bağlı gösterilir." />
      </Screen>
    );
  }

  return (
    <Screen>

      {/* ── Tarih şeridi ── */}
      <Card style={s.dateCard}>
        <Pressable onPress={() => goDate(-1)} hitSlop={12}>
          <Text style={s.arrow}>‹</Text>
        </Pressable>
        <View style={s.dateMid}>
          <Text style={s.dateText}>{prettyDate(date)}</Text>
          <Text style={s.dateSub}>{date}</Text>
        </View>
        <Pressable onPress={() => goDate(1)} hitSlop={12} disabled={date >= localDate()}>
          <Text style={[s.arrow, date >= localDate() && s.arrowOff]}>›</Text>
        </Pressable>
      </Card>

      {/* ── Kategori filtresi ── */}
      <View style={s.filters}>
        {FILTERS.map((k) => {
          const on = active.includes(k);
          return (
            <Pressable key={k} onPress={() => toggleFilter(k)} style={[s.filter, on && s.filterOn]}>
              {KIND_META[k] ? (
                <Icon
                  name={KIND_META[k].icon}
                  size={16}
                  color={on ? colors.primary : colors.textSoft}
                />
              ) : null}
              <Text style={[s.filterText, on && s.filterTextOn]}>{KIND_META[k]?.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {feed.error ? <FormError message={feed.error} /> : null}

      <SectionTitle hint={active.length ? 'Filtre açık.' : undefined}>Akış</SectionTitle>
      {feed.loading && entries.length === 0 ? (
        <Card>
          <Loading label="Akış yükleniyor…" />
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <Text style={s.hint}>Bu gün için kayıt yok.</Text>
        </Card>
      ) : (
        <View style={s.feed}>
          {entries.map((e) => {
            const meta = KIND_META[e.kind] ?? {
              icon: '•', label: e.kind, tint: colors.surfaceSoft, track: colors.trackOther,
            };
            return (
              <TimelineCard
                key={`${e.kind}-${e.ref_id}`}
                track={meta.track}
                tint={meta.tint}
                icon={meta.icon}
                title={meta.label}
                subtitle={subtypeLabel(e.subtype)}
                right={describeLines(e)}
                onPress={() => setDetail(detailOf(e))}
              />
            );
          })}
        </View>
      )}

      {/* ── Sayfalama ── */}
      {page > 1 || hasMore ? (
        <View style={s.pager}>
          <View style={s.pagerCol}>
            <Button label="‹ Önceki" variant="ghost" onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} />
          </View>
          <Text style={s.pageNum}>{page}</Text>
          <View style={s.pagerCol}>
            <Button label="Sonraki ›" variant="ghost" onPress={() => setPage((p) => p + 1)} disabled={!hasMore} />
          </View>
        </View>
      ) : null}

      <RecordDetailSheet detail={detail} onClose={() => setDetail(null)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  feed: { gap: spacing.sm },
  dateCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dateMid: { flex: 1, alignItems: 'center' },
  dateText: { ...typography.h3, color: colors.text },
  dateSub: { ...typography.tiny, color: colors.textFaint },
  arrow: { ...typography.h1, color: colors.primary, paddingHorizontal: spacing.sm },
  arrowOff: { color: colors.border },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  filterText: { ...typography.small, color: colors.textSoft },
  filterTextOn: { color: colors.primary, fontWeight: '700' },
  hint: { ...typography.small, color: colors.textSoft },
  pager: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pagerCol: { flex: 1 },
  pageNum: { ...typography.small, color: colors.textSoft, minWidth: 24, textAlign: 'center' },
});
