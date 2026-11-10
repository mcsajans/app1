import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Chips, StatTile, humanDuration } from '../../components/records';
import { DateField, toDateValue } from '../../components/DateTimeField';
import { Card, EmptyState, FormError, Loading, Screen, SectionTitle } from '../../components/ui';
import { reportService, type ReportRange, type TrendPoint } from '../../core/api/modules';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { colors, radius, spacing, typography } from '../../core/theme';

/**
 * Hızlı aralıklar — tarih kutularını **doldururlar**, ayrı bir kip değildir.
 *
 * Önceden dönem (`daily/weekly/monthly`) ve grafik gün sayısı (7/14/30) ayrı
 * iki çipti ve ikisi birbirinden bağımsız değişebiliyordu: üstteki özet "son 7
 * gün", alttaki grafik "son 30 gün" olabiliyordu. Artık tek bir pencere var ve
 * her şey ona bağlı.
 */
const QUICK_RANGES = ['today', 'week', 'month', 'quarter'] as const;
const QUICK_LABELS = {
  today: 'Bugün', week: 'Son 7 gün', month: 'Son 30 gün', quarter: 'Son 90 gün',
} as const;
const QUICK_DAYS: Record<(typeof QUICK_RANGES)[number], number> = {
  today: 1, week: 7, month: 30, quarter: 90,
};

/** Sunucudaki `MAX_RANGE_DAYS` ile aynı; aşılırsa istek `422` döner. */
const MAX_RANGE_DAYS = 92;

const dayMs = 86_400_000;
const todayValue = () => toDateValue(new Date());

/** Bugünden geriye `days` TAM gün (bugün dâhil) → başlangıç/bitiş. */
function lastDays(days: number): ReportRange {
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * dayMs);
  return { startDate: toDateValue(start), endDate: toDateValue(end) };
}

/** İki gün etiketi arasındaki gün sayısı (bitiş dâhil); geçersizse null. */
function rangeDays(range: ReportRange): number | null {
  const a = Date.parse(`${range.startDate}T12:00:00`);
  const b = Date.parse(`${range.endDate}T12:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / dayMs) + 1;
}

/** "1 Kas – 7 Kas" — başlıkta pencereyi tek satırda özetler. */
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
function prettyDay(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ''}`;
}

const METRICS = ['sleep', 'feeding', 'diaper'] as const;
const METRIC_LABELS = { sleep: 'Uyku', feeding: 'Besleme', diaper: 'Bez' } as const;

/** Grafikte gösterilecek alan ve ölçek — metriğe göre değişir. */
const METRIC_SERIES: Record<
  string,
  { key: string; label: string; color: string; format: (v: number) => string }[]
> = {
  // Grafikte modüllerin PASTEL tonları kullanılmaz: beyaz zeminde 5 piksel
  // genişliğindeki sütunlar neredeyse görünmez oluyordu. Akış şeritlerinin
  // doygun tonları hem okunur hem de aynı renk ailesinden.
  sleep: [
    { key: 'night_sec', label: 'Gece', color: colors.trackSleep, format: (v) => humanDuration(v) },
    { key: 'nap_sec', label: 'Şekerleme', color: colors.primary, format: (v) => humanDuration(v) },
  ],
  feeding: [
    { key: 'total_ml', label: 'ml', color: colors.warning, format: (v) => `${v} ml` },
    { key: 'count', label: 'kez', color: colors.trackFeeding, format: (v) => `${v}` },
  ],
  diaper: [
    { key: 'wet_count', label: 'Çiş', color: colors.trackSleep, format: (v) => `${v}` },
    { key: 'dirty_count', label: 'Kaka', color: colors.trackDiaper, format: (v) => `${v}` },
  ],
};

/**
 * Basit yığılmamış sütun grafiği.
 *
 * Harici grafik kütüphanesi eklenmedi: iki seri ve en fazla 30 gün için
 * `View` yükseklikleriyle çizmek yeterli, ve yeni bir native bağımlılık
 * (victory-native / chart-kit) build süresini ve bakım yükünü artırırdı.
 */
function BarChart({ series, points }: { series: typeof METRIC_SERIES[string]; points: TrendPoint[] }) {
  const max = Math.max(
    1,
    ...points.flatMap((p) => series.map((sr) => Number(p[sr.key] ?? 0))),
  );

  return (
    <View>
      <View style={s.chart}>
        {points.map((p, i) => (
          <View key={String(p.date ?? i)} style={s.barCol}>
            <View style={s.barStack}>
              {series.map((sr) => {
                const v = Number(p[sr.key] ?? 0);
                // Sıfır değerler ince bir çizgi olarak kalır; tamamen yok
                // etmek "o gün veri yok" ile "o gün sıfır" ayrımını siler.
                const h = v === 0 ? 2 : Math.max(3, Math.round((v / max) * 90));
                return <View key={sr.key} style={[s.bar, { height: h, backgroundColor: sr.color }]} />;
              })}
            </View>
            <Text style={s.barLabel} numberOfLines={1}>
              {String(p.date ?? '').slice(8)}
            </Text>
          </View>
        ))}
      </View>

      <View style={s.legend}>
        {series.map((sr) => (
          <View key={sr.key} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: sr.color }]} />
            <Text style={s.legendText}>{sr.label}</Text>
          </View>
        ))}
        <Text style={s.legendMax}>en yüksek: {series[0]?.format(max) ?? max}</Text>
      </View>
    </View>
  );
}

/** Modül 11 — Raporlar. */
export default function ReportsScreen() {
  const baby = useBabyStore((st) => st.selected());
  const babyId = baby?.id ?? null;

  /**
   * Rapor penceresi. Ekrandaki **tek** zaman ayarı budur: özet de, eğilim
   * grafiği de aynı aralığı kullanır. Varsayılan son 7 gün.
   */
  const [range, setRange] = useState<ReportRange>(() => lastDays(7));
  const [metric, setMetric] = useState<(typeof METRICS)[number]>('sleep');

  const days = rangeDays(range);
  const tooLong = days !== null && days > MAX_RANGE_DAYS;
  /*
   * Aralık geçersizken istek atılmaz: sunucu zaten `422` döner ve kullanıcı
   * tarihleri düzeltene kadar her dokunuşta hata kutusu görürdü.
   */
  const valid = days !== null && days >= 1 && !tooLong;
  const query = valid ? range : null;

  const summary = useAsyncData(
    () => (babyId && query ? reportService.summary(babyId, 'weekly', query) : Promise.resolve(null)),
    [babyId, query?.startDate, query?.endDate],
  );
  const trends = useAsyncData(
    () => (babyId && query
      ? reportService.trends(babyId, metric, 7, query)
      : Promise.resolve(null)),
    [babyId, metric, query?.startDate, query?.endDate],
  );

  /** Hızlı aralık çipi: hangisi seçiliyse o, elle tarih girildiyse hiçbiri. */
  const quick = useMemo(() => {
    const end = todayValue();
    if (range.endDate !== end) return null;
    const found = QUICK_RANGES.find((k) => QUICK_DAYS[k] === days);
    return found ?? null;
  }, [range.endDate, days]);

  if (!baby) {
    return (
      <Screen>
        <EmptyState icon="reports" title="Önce bir bebek profili ekle" detail="Raporlar seçili bebeğe göre hesaplanır." />
      </Screen>
    );
  }

  const sum = summary.data;
  const points = trends.data?.series ?? [];

  return (
    <Screen>
      {/* ── Tarih aralığı: ekrandaki her şey buna bağlı ── */}
      <SectionTitle hint="Aşağıdaki özet ve grafikler seçilen aralığa göre hesaplanır.">
        Tarih aralığı
      </SectionTitle>

      <Card>
        <Chips
          options={QUICK_RANGES}
          value={quick}
          onChange={(v) => v && setRange(lastDays(QUICK_DAYS[v]))}
          labels={QUICK_LABELS}
          allowClear={false}
        />
        <View style={s.gapXs} />
        <View style={s.dateRow}>
          <View style={s.dateCol}>
            <DateField
              label="Başlangıç"
              value={range.startDate}
              onChange={(v) => setRange((prev) => ({ ...prev, startDate: v }))}
              maximumDate={new Date()}
            />
          </View>
          <View style={s.dateCol}>
            <DateField
              label="Bitiş"
              value={range.endDate}
              onChange={(v) => setRange((prev) => ({ ...prev, endDate: v }))}
              // Bitiş başlangıçtan önce seçilemez: geçersiz aralık arayüzde
              // hiç kurulamazsa sunucuya sorulacak bir şey de kalmaz.
              minimumDate={new Date(`${range.startDate}T12:00:00`)}
              maximumDate={new Date()}
            />
          </View>
        </View>

        {tooLong ? (
          <Text style={s.warn}>
            Aralık en fazla {MAX_RANGE_DAYS} gün olabilir — şu an {days} gün seçili.
          </Text>
        ) : (
          <Text style={s.rangeHint}>
            {prettyDay(range.startDate)} – {prettyDay(range.endDate)}
            {days ? ` · ${days} gün` : ''}
          </Text>
        )}
      </Card>

      <SectionTitle hint="Seçilen aralığın toplamları.">Özet</SectionTitle>

      {summary.error ? <FormError message={summary.error} /> : null}

      <Card>
        {summary.loading && !sum ? (
          <Loading label="Özet yükleniyor…" />
        ) : (
          <>
            <Text style={s.group}>Uyku</Text>
            <View style={s.tiles}>
              <StatTile label="Gece" value={humanDuration(sum?.sleep.night_sec)} />
              <StatTile label="Şekerleme" value={humanDuration(sum?.sleep.nap_sec)} />
              <StatTile label="Günlük ort." value={humanDuration(sum?.sleep.avg_sec_per_day)} tone="good" />
            </View>

            <Text style={s.group}>Besleme</Text>
            <View style={s.tiles}>
              <StatTile label="Kez" value={String(sum?.feeding.count ?? 0)} />
              <StatTile label="Toplam" value={`${Math.round(sum?.feeding.total_ml ?? 0)} ml`} />
              <StatTile label="Emzirme" value={humanDuration(sum?.feeding.breastfeeding_sec)} />
            </View>

            <Text style={s.group}>Bez</Text>
            <View style={s.tiles}>
              <StatTile label="Toplam" value={String(sum?.diaper.count ?? 0)} />
              <StatTile label="Çiş / Kaka" value={`${sum?.diaper.wet_count ?? 0}/${sum?.diaper.dirty_count ?? 0}`} />
              <StatTile
                label="Pişikli"
                value={String(sum?.diaper.rash_count ?? 0)}
                tone={(sum?.diaper.rash_count ?? 0) > 0 ? 'warn' : 'neutral'}
              />
            </View>
          </>
        )}
      </Card>

      <SectionTitle hint="Veri olmayan günler sıfır olarak gösterilir.">Eğilim</SectionTitle>
      <Chips options={METRICS} value={metric} onChange={(v) => v && setMetric(v)} labels={METRIC_LABELS} />

      {trends.error ? <FormError message={trends.error} /> : null}

      <Card>
        {trends.loading && points.length === 0 ? (
          <Loading label="Grafik yükleniyor…" />
        ) : points.length === 0 ? (
          <Text style={s.hint}>Gösterilecek veri yok.</Text>
        ) : (
          <BarChart series={METRIC_SERIES[metric] ?? []} points={points} />
        )}
      </Card>

      <Text style={s.footnote}>
        PDF dışa aktarma bu sürümde yok — gerekçesi modules_doc/NOTLAR-ve-EKSIKLER.md §4&apos;te.
      </Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  group: { ...typography.small, color: colors.textSoft, fontWeight: '700', marginTop: spacing.sm },
  tiles: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  hint: { ...typography.small, color: colors.textSoft },
  gapXs: { height: spacing.xs },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateCol: { flex: 1 },
  rangeHint: { ...typography.tiny, color: colors.textFaint, marginTop: spacing.xs },
  warn: { ...typography.tiny, color: colors.danger, fontWeight: '700', marginTop: spacing.xs },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 120, marginTop: spacing.sm },
  barCol: { flex: 1, alignItems: 'center', gap: 2 },
  barStack: { flexDirection: 'row', alignItems: 'flex-end', gap: 1, height: 96 },
  bar: { width: 5, borderRadius: 2 },
  barLabel: { ...typography.tiny, color: colors.textFaint, fontSize: 9 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: radius.pill },
  legendText: { ...typography.tiny, color: colors.textSoft },
  legendMax: { ...typography.tiny, color: colors.textFaint, marginLeft: 'auto' },
  footnote: { ...typography.tiny, color: colors.textFaint, textAlign: 'center' },
});
