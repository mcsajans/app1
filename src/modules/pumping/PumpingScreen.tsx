import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  Chips, RecordRow, StatTile, TimerDisplay, clockOf, formatDuration, useElapsedSeconds,
} from '../../components/records';
import { RecordDetailSheet, fullMoment, type RecordDetail } from '../../components/RecordDetail';
import { Button, Card, EmptyState, FormError, Loading, Screen, SectionTitle } from '../../components/ui';
import { ReadOnlyBanner, useCanEdit } from '../../components/permission';
import { errorText } from '../../core/api/client';
import { STORAGE_LOCATIONS, iso, pumpingService, type PumpingRecord } from '../../core/api/modules';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { usePendingStop } from '../../core/timers/usePendingStop';
import { useLiveTimerStore } from '../../core/timers/useLiveTimerStore';
import { colors, radius, spacing, typography } from '../../core/theme';
import { withSaveFeedback } from '../../core/feedback/withSaveFeedback';

const STORAGE_LABELS: Record<string, string> = {
  fridge: 'Buzdolabı', freezer: 'Dondurucu', used_immediately: 'Hemen verildi',
};

/** Modül 12 — Süt Sağma. */
export default function PumpingScreen() {
  const baby = useBabyStore((s) => s.selected());
  const babyId = baby?.id ?? null;

  const canEdit = useCanEdit();

  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [storage, setStorage] = useState<(typeof STORAGE_LOCATIONS)[number]>('fridge');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  /**
   * Kronometreden gelen süre, kayıt yazılana kadar burada bekler.
   *
   * Sağmanın sunucuda **açık oturumu yok** (emzirme ve uykunun aksine):
   * kayıt ancak miktar girilince oluşuyor. Bu yüzden kronometre yerel ve
   * durduğunda süresini forma bırakıyor.
   */
  const [timedSec, setTimedSec] = useState<number | null>(null);

  const list = useAsyncData(
    () => (babyId ? pumpingService.list(babyId) : Promise.resolve({ pumping: [] })),
    [babyId],
  );
  const stash = useAsyncData(
    () => (babyId ? pumpingService.stash(babyId) : Promise.resolve(null)),
    [babyId],
  );

  const records = list.data?.pumping ?? [];
  const st = stash.data;

  /* ── sağma kronometresi (bildirimler.md → Ek geliştirme) ── */

  const timer = useLiveTimerStore((s) => s.timers.pumping ?? null);
  const timerRunning = timer !== null && timer.status === 'running';
  // Süre zaman damgasından okunur; duraklatıldığında açık segment yok ve
  // sayaç birikmiş değerde durur.
  const timerElapsed = useElapsedSeconds(
    timerRunning ? timer.segmentStartedAt : null,
    timer?.baseSec ?? 0,
  );

  const stopTimer = async () => {
    /*
     * Kronometre hangi bebek için başlatıldıysa süre yalnızca ona yazılır.
     * Aradan bebek değiştirilmişse süre forma **düşmez**: form seçili bebeğe
     * kaydediyor ve A bebeği için ölçülen süre B bebeğinin kaydına girerdi.
     */
    const ownerId = timer?.babyId ?? null;
    const total = await useLiveTimerStore.getState().stopPumping();
    const mine = ownerId === null || ownerId === babyId;
    // 0 saniye kaydetmenin anlamı yok; yanlışlıkla başlatıp hemen bitirmek
    // formda "00:00 ölçüldü" satırı bırakmasın.
    setTimedSec(mine && total > 0 ? total : null);
  };

  /*
   * Bildirimdeki "Bitir" düğmesi: kronometreyi durdurup süreyi forma bırakır.
   * Miktar hâlâ elle girilecek, bu yüzden kayıt burada yazılmıyor.
   */
  usePendingStop('pumping', timer !== null, () => void stopTimer());

  const refreshAll = () => {
    list.reload();
    stash.reload();
  };

  const parse = (v: string): number | null => {
    const t = v.trim().replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  };

  const save = async () => {
    if (!babyId) return;
    const l = parse(left);
    const r = parse(right);
    if (Number.isNaN(l) || Number.isNaN(r)) return setError('Miktarlar sayı olmalı.');
    if (l === null && r === null) return setError('En az bir göğüs için miktar gir.');

    setBusy(true);
    setError(null);
    try {
      await withSaveFeedback(() => pumpingService.create(babyId, {
        pumped_at: iso(),
        left_amount_ml: l,
        right_amount_ml: r,
        storage_location: storage,
        note: note.trim() || null,
        // Kronometre kullanılmadıysa alan hiç gönderilmez; `null` göndermek
        // kısmi güncellemede var olan süreyi silme riski taşıyor (§22.0).
        ...(timedSec === null ? {} : { duration_sec: timedSec }),
      }));
      setLeft('');
      setRight('');
      setNote('');
      setTimedSec(null);
      refreshAll();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleUsed = (r: PumpingRecord) => {
    void pumpingService
      .markUsed(r.id, !r.is_used)
      .then(refreshAll)
      .catch((e) => setError(errorText(e)));
  };

  const onDelete = (r: PumpingRecord) => {
    Alert.alert('Kaydı sil', 'Sağma kaydı silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void pumpingService.remove(r.id).then(refreshAll).catch((e) => setError(errorText(e)));
        },
      },
    ]);
  };

  /**
   * Geçmiş satırına dokununca açılan ayrıntılı rapor.
   *
   * "Kullanıldı işaretle" eskiden satıra dokunmakla yapılıyordu; dokunma
   * artık raporu açtığı için eylem buraya taşındı. Yanlışlıkla stok düşmesi
   * de böylece zorlaşıyor.
   */
  const detailOf = (r: PumpingRecord): RecordDetail => ({
    icon: r.is_used ? 'used' : 'pumping',
    title: `${r.total_amount_ml ?? 0} ml sağıldı`,
    subtitle: fullMoment(r.pumped_at) ?? undefined,
    stats: [
      { label: 'Toplam', value: `${r.total_amount_ml ?? 0} ml`, tone: 'good' },
      { label: 'Sol', value: `${r.left_amount_ml ?? 0} ml` },
      { label: 'Sağ', value: `${r.right_amount_ml ?? 0} ml` },
    ],
    rows: [
      { label: 'Sağma zamanı', value: fullMoment(r.pumped_at) },
      { label: 'Süre', value: r.duration_sec ? formatDuration(r.duration_sec) : null },
      { label: 'Saklama', value: STORAGE_LABELS[r.storage_location] ?? r.storage_location },
      { label: 'Durum', value: r.is_used ? 'Kullanıldı' : 'Stokta' },
      {
        label: 'Stoğa katkısı',
        value: r.storage_location === 'used_immediately'
          ? 'Yok (hemen verildi)'
          : r.is_used
            ? 'Yok (tüketildi)'
            : `${r.total_amount_ml ?? 0} ml`,
      },
    ],
    note: r.note,
    audit: r,
    recordId: r.id,
    actions: canEdit
      ? [
          {
            label: r.is_used ? 'Stoğa geri al' : 'Kullanıldı işaretle',
            variant: 'ghost' as const,
            onPress: () => {
              setDetail(null);
              toggleUsed(r);
            },
          },
        ]
      : [],
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
        <EmptyState icon="pumping" title="Önce bir bebek profili ekle" detail="Sağma kayıtları seçili bebeğe bağlı tutulur." />
      </Screen>
    );
  }

  return (
    <Screen>
      <ReadOnlyBanner />
      {error ? <FormError message={error} /> : null}

      {/* ── Süt stoğu ── */}
      <SectionTitle hint="Hemen verilen süt stoğa girmez.">Süt stoğu</SectionTitle>
      <Card>
        {stash.loading && !st ? (
          <Loading label="Stok yükleniyor…" />
        ) : (
          <View style={s.tiles}>
            <StatTile label="Buzdolabı" value={`${st?.fridge.amount_ml ?? 0} ml`} hint={`${st?.fridge.session_count ?? 0} kayıt`} />
            <StatTile label="Dondurucu" value={`${st?.freezer.amount_ml ?? 0} ml`} hint={`${st?.freezer.session_count ?? 0} kayıt`} />
            <StatTile label="Toplam" value={`${st?.total_available_ml ?? 0} ml`} tone="good" />
          </View>
        )}
      </Card>

      {/* ── Kronometre ── */}
      <SectionTitle hint="Süre kaydedilecek; miktarı sağma bitince gir.">Kronometre</SectionTitle>
      <Card>
        {timer ? (
          <>
            <Text style={s.runningLabel}>
              Sağma {timer.status === 'paused' ? '— duraklatıldı' : 'sürüyor'} ·{' '}
              {clockOf(timer.startedAt)}&apos;den beri
            </Text>
            <TimerDisplay seconds={timerElapsed} />
            <View style={s.amountRow}>
              <View style={s.amountCol}>
                <Button
                  label={timer.status === 'paused' ? 'Devam et' : 'Duraklat'}
                  variant="ghost"
                  onPress={() => {
                    const store = useLiveTimerStore.getState();
                    void (timer.status === 'paused' ? store.resumePumping() : store.pausePumping());
                  }}
                  disabled={busy || !canEdit}
                />
              </View>
              <View style={s.amountCol}>
                <Button
                  label="Bitir"
                  variant="danger"
                  onPress={() => void stopTimer()}
                  disabled={busy || !canEdit}
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={s.hint}>
              Sayaç telefon kilitliyken de bildirim çubuğunda görünür; oradan duraklatıp
              bitirebilirsin.
            </Text>
            <View style={s.gap} />
            <Button
              label="Sağmaya başla"
              onPress={() => {
                void useLiveTimerStore
                  .getState()
                  .startPumping(babyId, baby?.firstName ?? null);
              }}
              disabled={busy || !canEdit}
            />
          </>
        )}
      </Card>

      {/* ── Ekleme ── */}
      <SectionTitle>Sağma ekle</SectionTitle>
      <Card>
        {timedSec !== null ? (
          <View style={s.timedRow}>
            <Text style={s.timedText}>Ölçülen süre: {formatDuration(timedSec)}</Text>
            <Pressable onPress={() => setTimedSec(null)} hitSlop={8}>
              <Text style={s.timedClear}>kaldır</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={s.amountRow}>
          <View style={s.amountCol}>
            <Text style={s.label}>Sol (ml)</Text>
            <TextInput
              style={s.input}
              value={left}
              onChangeText={setLeft}
              placeholder="60"
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              editable={!busy}
            />
          </View>
          <View style={s.amountCol}>
            <Text style={s.label}>Sağ (ml)</Text>
            <TextInput
              style={s.input}
              value={right}
              onChangeText={setRight}
              placeholder="80"
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              editable={!busy}
            />
          </View>
        </View>

        <Text style={s.label}>Saklama yeri</Text>
        <Chips options={STORAGE_LOCATIONS} value={storage} onChange={(v) => v && setStorage(v)} labels={STORAGE_LABELS} disabled={busy || !canEdit} />

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
      <SectionTitle hint="Dokununca kullanıldı/stokta arasında geçer; uzun basıp silebilirsin.">
        Geçmiş
      </SectionTitle>
      <Card>
        {list.loading && records.length === 0 ? (
          <Loading label="Kayıtlar yükleniyor…" />
        ) : records.length === 0 ? (
          <Text style={s.hint}>Henüz sağma kaydı yok.</Text>
        ) : (
          records.map((r) => (
            <RecordRow
              key={r.id}
              icon={r.is_used ? 'used' : 'pumping'}
              title={`${r.total_amount_ml ?? 0} ml · ${STORAGE_LABELS[r.storage_location] ?? r.storage_location}`}
              detail={[
                `Sol ${r.left_amount_ml ?? 0} · Sağ ${r.right_amount_ml ?? 0}`,
                r.duration_sec ? formatDuration(r.duration_sec) : null,
                r.is_used ? 'kullanıldı' : 'stokta',
                r.note,
              ]
                .filter(Boolean)
                .join(' · ')}
              right={clockOf(r.pumped_at)}
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
  gap: { height: spacing.sm },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  amountRow: { flexDirection: 'row', gap: spacing.md },
  amountCol: { flex: 1 },
  runningLabel: {
    ...typography.small, color: colors.primary, fontWeight: '700', textAlign: 'center',
  },
  timedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  timedText: { ...typography.small, color: colors.primary, fontWeight: '700' },
  timedClear: { ...typography.tiny, color: colors.textSoft, fontWeight: '700' },
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
