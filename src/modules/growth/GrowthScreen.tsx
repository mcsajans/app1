import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chips } from '../../components/records';
import { DateField } from '../../components/DateTimeField';
import { Icon } from '../../components/Icon';
import { ReadOnlyBanner, useCanEdit } from '../../components/permission';
import { Button, Card, EmptyState, FormError, Loading, Screen, SectionTitle } from '../../components/ui';
import { errorText } from '../../core/api/client';
import { growthService, localDate, type GrowthMeasurement, type GrowthSeries } from '../../core/api/modules';
import { withSaveFeedback } from '../../core/feedback/withSaveFeedback';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { colors, moduleTint, radius, shadow, spacing, typography } from '../../core/theme';
import {
  GROWTH_METRICS, METRIC_BY_KEY, chartBars, dayText, formatDelta, formatMetric,
  formatPace, parseMeasure, spanText, valueOf, type MetricKey,
} from './growthFormat';

/**
 * Modül 15 — Gelişim Takibi.
 *
 * Kilo, boy ve baş çevresi. Diğer kayıt modüllerinden farkı, tek bir olayı
 * değil bir **eğriyi** anlatması: "6,2 kg" tek başına bir şey söylemez,
 * "12 günde 320 g aldı" söyler. Bu yüzden ekranın üstü ölçümlerin kendisi
 * değil **değişim** kartlarıdır.
 *
 * Ölçüm bir gün olayıdır (sunucuda `measured_on` DATE) ve **bir güne bir
 * ölçüm** kuralı var: aynı güne yeniden kaydetmek üzerine yazar. Geçmişten
 * bir satıra dokunmak o günü forma yükler — ayrı bir "düzenle" kipi yok,
 * çünkü kaydetmek zaten o günü güncellemek demek.
 */
export default function GrowthScreen() {
  const baby = useBabyStore((s) => s.selected());
  const babyId = baby?.id ?? null;
  const canEdit = useCanEdit();

  const [metric, setMetric] = useState<MetricKey>('weight');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── form ──
  const [day, setDay] = useState(localDate());
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [head, setHead] = useState('');
  const [note, setNote] = useState('');

  const list = useAsyncData(
    () => (babyId ? growthService.list(babyId) : Promise.resolve({ measurements: [] })),
    [babyId],
  );
  const summary = useAsyncData(
    () => (babyId ? growthService.summary(babyId) : Promise.resolve(null)),
    [babyId],
  );

  const rows = list.data?.measurements ?? [];
  const sum = summary.data;
  const bars = chartBars(rows, metric);

  const reload = () => {
    list.reload();
    summary.reload();
  };

  const clear = () => {
    setWeight('');
    setHeight('');
    setHead('');
    setNote('');
    setDay(localDate());
    setError(null);
  };

  /** Geçmişteki bir satır forma yüklenir; kaydetmek o günü günceller. */
  const loadRow = (row: GrowthMeasurement) => {
    setDay(row.measured_on);
    setWeight(row.weight_g === null ? '' : String(row.weight_g));
    setHeight(row.height_cm === null ? '' : String(row.height_cm).replace('.', ','));
    setHead(row.head_cm === null ? '' : String(row.head_cm).replace('.', ','));
    setNote(row.note ?? '');
    setError(null);
  };

  const save = () => {
    if (!babyId) return;

    const parsed = {
      weight: parseMeasure(weight, 'weight'),
      height: parseMeasure(height, 'height'),
      head: parseMeasure(head, 'head'),
    };
    const firstError = Object.values(parsed).find((p) => p.error)?.error;
    if (firstError) return setError(firstError);

    // Sunucu da aynı kuralı uyguluyor; burada erken söylemek ağ turunu önler.
    if (parsed.weight.value === null && parsed.height.value === null && parsed.head.value === null) {
      return setError('En az bir ölçü gir: kilo, boy ya da baş çevresi.');
    }

    setBusy(true);
    setError(null);
    void (async () => {
      try {
        await withSaveFeedback(() => growthService.save(babyId, {
          measured_on: day,
          weight_g: parsed.weight.value,
          height_cm: parsed.height.value,
          head_cm: parsed.head.value,
          note: note.trim() || null,
        }));
        clear();
        reload();
      } catch (err) {
        setError(errorText(err));
      } finally {
        setBusy(false);
      }
    })();
  };

  const onDelete = (row: GrowthMeasurement) => {
    Alert.alert('Ölçümü sil', `${dayText(row.measured_on)} ölçümü silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          void growthService
            .remove(row.id)
            .then(reload)
            .catch((e) => setError(errorText(e)))
            .finally(() => setBusy(false));
        },
      },
    ]);
  };

  if (!baby) {
    return (
      <Screen>
        <EmptyState
          icon="growth"
          title="Önce bir bebek profili ekle"
          detail="Ölçümler seçili bebeğe bağlı tutulur."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ReadOnlyBanner />
      {error ? <FormError message={error} /> : null}

      {/* ── Değişim kartları ── */}
      <SectionTitle hint="Son ölçüm ve bir öncekine göre değişim.">Şu an</SectionTitle>
      {summary.loading && !sum ? (
        <Card>
          <Loading label="Özet yükleniyor…" />
        </Card>
      ) : (
        <View style={s.cards}>
          {GROWTH_METRICS.map((m) => (
            <MetricCard key={m.key} metricKey={m.key} series={sum ? sum[m.key] : null} />
          ))}
        </View>
      )}

      {/* ── Grafik ── */}
      <SectionTitle hint="Son 12 ölçüm. Taban sıfır değil, en düşük ölçümdür.">
        Değişim grafiği
      </SectionTitle>
      <Card>
        <Chips
          options={GROWTH_METRICS.map((m) => m.key)}
          value={metric}
          onChange={(v) => v && setMetric(v)}
          labels={Object.fromEntries(GROWTH_METRICS.map((m) => [m.key, m.short])) as Record<MetricKey, string>}
          icons={Object.fromEntries(GROWTH_METRICS.map((m) => [m.key, m.icon])) as never}
        />
        <View style={s.gap} />
        {bars.length === 0 ? (
          <Text style={s.hint}>Bu ölçü için henüz kayıt yok.</Text>
        ) : (
          <>
            <View style={s.chart}>
              {bars.map((bar) => (
                <View key={bar.measured_on} style={s.barCol}>
                  <Text style={s.barValue} numberOfLines={1}>
                    {formatMetric(metric, bar.value)}
                  </Text>
                  {/*
                    Sütun yüksekliği oransal; `flex` yerine yüzde kullanılıyor
                    çünkü sütunun kendisi değil, SARMALAYICISI sabit yükseklikte.
                  */}
                  <View style={s.barTrack}>
                    <View
                      style={[
                        s.bar,
                        { height: `${Math.round(bar.ratio * 100)}%`, backgroundColor: colors.primary },
                      ]}
                    />
                  </View>
                  <Text style={s.barDay} numberOfLines={1}>
                    {bar.measured_on.slice(8, 10)}.{bar.measured_on.slice(5, 7)}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={s.hint}>
              {dayText(bars[0].measured_on)} → {dayText(bars[bars.length - 1].measured_on)}
            </Text>
          </>
        )}
      </Card>

      {/* ── Yeni ölçüm ── */}
      {canEdit ? (
        <>
          <SectionTitle hint="Aynı güne ikinci kez kaydetmek o günün ölçümünü günceller.">
            Ölçüm ekle
          </SectionTitle>
          <Card>
            <DateField label="Ölçüm tarihi" value={day} onChange={setDay} disabled={busy} />

            <Text style={s.label}>{METRIC_BY_KEY.weight.inputLabel}</Text>
            <TextInput
              style={s.input}
              value={weight}
              onChangeText={setWeight}
              keyboardType="number-pad"
              placeholder={METRIC_BY_KEY.weight.inputHint}
              placeholderTextColor={colors.textFaint}
              editable={!busy}
            />

            <View style={s.row}>
              <View style={s.col}>
                <Text style={s.label}>{METRIC_BY_KEY.height.inputLabel}</Text>
                <TextInput
                  style={s.input}
                  value={height}
                  onChangeText={setHeight}
                  keyboardType="decimal-pad"
                  placeholder={METRIC_BY_KEY.height.inputHint}
                  placeholderTextColor={colors.textFaint}
                  editable={!busy}
                />
              </View>
              <View style={s.col}>
                <Text style={s.label}>{METRIC_BY_KEY.head.inputLabel}</Text>
                <TextInput
                  style={s.input}
                  value={head}
                  onChangeText={setHead}
                  keyboardType="decimal-pad"
                  placeholder={METRIC_BY_KEY.head.inputHint}
                  placeholderTextColor={colors.textFaint}
                  editable={!busy}
                />
              </View>
            </View>

            <Text style={s.label}>Not</Text>
            <TextInput
              style={s.input}
              value={note}
              onChangeText={setNote}
              placeholder="Kontrol muayenesi, tartı markası…"
              placeholderTextColor={colors.textFaint}
              editable={!busy}
            />

            <View style={s.gap} />
            <Button label={busy ? 'Kaydediliyor…' : 'Kaydet'} onPress={save} disabled={busy} />
          </Card>
        </>
      ) : null}

      {/* ── Geçmiş ── */}
      <SectionTitle hint={canEdit ? 'Dokunup düzenle, uzun basıp sil.' : undefined}>
        Geçmiş
      </SectionTitle>
      <View style={s.feed}>
        {list.loading && rows.length === 0 ? (
          <Card>
            <Loading label="Ölçümler yükleniyor…" />
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <Text style={s.hint}>Henüz ölçüm girilmedi.</Text>
          </Card>
        ) : (
          rows.map((row) => (
            <Pressable
              key={row.id}
              onPress={canEdit ? () => loadRow(row) : undefined}
              onLongPress={canEdit ? () => onDelete(row) : undefined}
              disabled={busy}
              style={s.row2}
            >
              <View style={[s.rowIcon, { backgroundColor: moduleTint.growth }]}>
                <Icon name="growth" size={20} color={colors.text} />
              </View>
              <View style={s.rowText}>
                <Text style={s.rowTitle}>{dayText(row.measured_on)}</Text>
                <Text style={s.rowMeta} numberOfLines={1}>
                  {GROWTH_METRICS
                    .map((m) => {
                      const v = valueOf(row, m.key);
                      return v === null ? null : `${m.short}: ${formatMetric(m.key, v)}`;
                    })
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {row.note ? <Text style={s.rowNote}>{row.note}</Text> : null}
              </View>
            </Pressable>
          ))
        )}
      </View>
    </Screen>
  );
}

/**
 * Tek bir ölçünün kartı.
 *
 * Büyük sayı **son ölçüm**, altındaki satır değişim. Değişim yoksa (ilk
 * ölçüm) satır hiç yazılmaz; "+0" yazmak ilk ölçümü bir değişim gibi
 * gösterirdi.
 */
function MetricCard({ metricKey, series }: { metricKey: MetricKey; series: GrowthSeries | null }) {
  const meta = METRIC_BY_KEY[metricKey];
  const latest = series?.latest ?? null;
  const delta = series ? formatDelta(metricKey, series.change) : null;
  const span = series ? spanText(series) : null;
  const pace = series ? formatPace(metricKey, series.per_day) : null;
  const sinceBirth = series ? formatDelta(metricKey, series.since_birth) : null;

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={[s.cardIcon, { backgroundColor: moduleTint.growth }]}>
          <Icon name={meta.icon} size={18} color={colors.text} />
        </View>
        <Text style={s.cardLabel}>{meta.label}</Text>
      </View>

      <Text style={s.cardValue}>{formatMetric(metricKey, latest?.value ?? null)}</Text>
      {latest ? <Text style={s.cardDay}>{dayText(latest.measured_on)}</Text> : null}

      {delta ? (
        <Text style={[s.cardDelta, (series?.change ?? 0) < 0 && s.cardDeltaDown]}>
          {delta}
          {span ? ` · ${span}` : ''}
        </Text>
      ) : null}
      {pace ? <Text style={s.cardHint}>{pace}</Text> : null}
      {sinceBirth ? <Text style={s.cardHint}>doğumdan beri {sinceBirth}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  cards: { flexDirection: 'row', gap: spacing.sm },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
    ...shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: { ...typography.tiny, color: colors.textSoft, fontWeight: '700', flex: 1 },
  cardValue: { ...typography.h3, color: colors.text },
  cardDay: { ...typography.tiny, color: colors.textFaint },
  cardDelta: { ...typography.small, color: colors.success, fontWeight: '700', marginTop: 2 },
  cardDeltaDown: { color: colors.danger },
  cardHint: { ...typography.tiny, color: colors.textSoft },

  // ── grafik ──
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 150 },
  barCol: { flex: 1, alignItems: 'center', gap: 2 },
  barValue: { ...typography.tiny, color: colors.textSoft, fontSize: 9 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: radius.sm, minHeight: 4 },
  barDay: { ...typography.tiny, color: colors.textFaint, fontSize: 9 },

  // ── geçmiş ──
  feed: { gap: spacing.sm },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  rowMeta: { ...typography.small, color: colors.textSoft, marginTop: 1 },
  rowNote: { ...typography.tiny, color: colors.textFaint, marginTop: 2 },

  // ── form ──
  label: { ...typography.small, color: colors.textSoft, fontWeight: '600', marginTop: spacing.sm },
  hint: { ...typography.small, color: colors.textSoft },
  gap: { height: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
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
