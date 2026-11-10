import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RecordRow, TimerDisplay, clockOf, formatDuration, useElapsedSeconds } from '../../components/records';
import { RecordDetailSheet, fullMoment, type RecordDetail } from '../../components/RecordDetail';
import { Button, Card, EmptyState, FormError, Loading, Screen, SectionTitle } from '../../components/ui';
import { ReadOnlyBanner, useCanEdit } from '../../components/permission';
import { ActiveDurationSheet, type SessionSummary } from './ActiveDurationSheet';
import { errorText } from '../../core/api/client';
import {
  breastfeedingService,
  type ActiveBreastSession,
  type BreastSession,
} from '../../core/api/modules';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { SIDE_LABEL, breastTimerOf } from '../../core/timers/liveTimer';
import { usePendingStop } from '../../core/timers/usePendingStop';
import { useLiveTimerStore } from '../../core/timers/useLiveTimerStore';
import { colors, radius, spacing, typography } from '../../core/theme';
import { showAdAfterAction } from '../../core/ads/adService';
import { withSaveFeedback } from '../../core/feedback/withSaveFeedback';

const sessionId = (s: ActiveBreastSession | null) => s?.session_id ?? null;

/**
 * Modül 2 — Emzirme Sayacı.
 *
 * Seans **sunucuda** yaşar (durum makinesi, §10.1). Ekran yalnızca komut
 * gönderir ve geçen süreyi zaman damgasından hesaplar; sayaç artırılmadığı
 * için uygulama arka plana geçse de süre doğru kalır.
 */
export default function BreastfeedingScreen() {
  const baby = useBabyStore((s) => s.selected());
  const babyId = baby?.id ?? null;

  const canEdit = useCanEdit();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  /**
   * Özet penceresi. İki yerden açılır:
   *  - "Bitir" → seans henüz açık, kaydetmek onu bitirir,
   *  - kayıt detayı → seans bitmiş, kaydetmek yalnızca aktif süreyi düzeltir.
   * `adjustId` bu ikisini ayırır.
   */
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [adjustId, setAdjustId] = useState<number | null>(null);

  const active = useAsyncData(
    () => (babyId ? breastfeedingService.active(babyId) : Promise.resolve({ session: null })),
    [babyId],
  );
  const last = useAsyncData(
    () => (babyId ? breastfeedingService.last(babyId) : Promise.resolve({ last: null, next_side: null })),
    [babyId],
  );
  const history = useAsyncData(
    () => (babyId ? breastfeedingService.list(babyId) : Promise.resolve({ sessions: [] })),
    [babyId],
  );

  const session = active.data?.session ?? null;
  const sid = sessionId(session);
  const running = session !== null && session.status !== 'completed';
  const paused = session?.status === 'paused';
  const currentSide = session?.open_side ?? null;

  // Çalışan segmentin başlangıcı; duraklatıldıysa sayaç ilerlemez.
  const segmentStart = running && !paused ? (session?.open_segment_started_at ?? null) : null;
  // Birikmiş süre kapanmış segmentlerden gelir; açık segment canlı eklenir.
  const elapsed = useElapsedSeconds(segmentStart, Number(session?.total_active_sec ?? 0));

  const babyName = baby?.firstName ?? null;

  /*
   * Kilit ekranı / bildirim çubuğu sayacı (bildirimler.md → Ek geliştirme).
   *
   * Ekran sunucudaki seansı zaten okuyor; aynı veriyi bildirime de yansıtmak
   * yeterli. Kabuk da aynı eşlemeyi kullanıyor (`refreshFromServer`), bu yüzden
   * ekran kapalıyken de bildirim doğru kalıyor.
   */
  useEffect(() => {
    useLiveTimerStore.getState().publish(
      'breastfeeding',
      session && session.status !== 'completed'
        ? breastTimerOf(session, babyId, babyName)
        : null,
    );
  }, [session, babyId, babyName]);

  const refreshAll = () => {
    active.reload();
    last.reload();
    history.reload();
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      refreshAll();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Sol / Sağ — sayaç başlatma ve meme değiştirme. Reklam tetiği panelde
   * varsayılan KAPALI (`trigger_timer_start`): tek bir emzirmede bu düğmeler
   * 3-4 kez basılıyor ve sayaç akarken ekranı kapatan reklam, ölçülen sürenin
   * doğruluğuna da gölge düşürüyor (Reklam.md §0.3-C). Açılırsa tek emniyet
   * panelin frekans sınırı olur.
   */
  const onStart = (side: 'left' | 'right') => {
    if (!babyId) return;
    void run(async () => {
      const res = await breastfeedingService.start(babyId, side);
      showAdAfterAction('timer_start');
      return res;
    });
  };

  const onSwitch = (side: 'left' | 'right') => {
    if (!babyId || sid === null) return;
    void run(async () => {
      const res = await breastfeedingService.switchSide(babyId, sid, side);
      showAdAfterAction('timer_start');
      return res;
    });
  };

  /**
   * "Bitir" özeti açar, kaydetmez.
   *
   * Geçen süre (duvar saati) ile ölçülen aktif süre farklıdır: duraklatılan
   * aralıklar ölçülene girmez ama duvar saatine girer. Pencere ikisini de
   * gösterir, anne aradan gerçek emme süresini seçer.
   */
  const openSummary = () => {
    if (!session) return;

    /*
     * `left_active_sec` / `right_active_sec` yalnızca KAPANMIŞ segmentleri
     * sayar; süren segment ancak durdurulduğunda eklenir. Özet penceresi bu
     * hâliyle tek segmentlik bir seansta "Sol 00:00 · Sağ 00:00" gösteriyordu.
     * Canlı segment kendi tarafına eklenir.
     */
    const closed = Number(session.total_active_sec ?? 0);
    const live = Math.max(0, elapsed - closed);
    const left = Number(session.left_active_sec ?? 0) + (session.open_side === 'left' ? live : 0);
    const right = Number(session.right_active_sec ?? 0) + (session.open_side === 'right' ? live : 0);
    const measured = Math.max(left + right, elapsed);
    const startedAt = session.started_at ? Date.parse(session.started_at) : NaN;
    const wall = Number.isFinite(startedAt)
      ? Math.round((Date.now() - startedAt) / 1000)
      : measured;

    setSummary({
      elapsedSec: Math.max(wall, measured),
      measuredSec: measured,
      leftSec: left,
      rightSec: right,
    });
  };

  /*
   * Bildirimdeki "Bitir" düğmesi.
   *
   * Bildirim seansı kendisi kapatmıyor, yalnızca niyeti bırakıyor: bitiş
   * annenin aktif süre düzeltmesini bekliyor (§10.2.1) ve o pencere bildirim
   * içine sığmaz. Ekran açıldığında özet burada açılır.
   *
   * `running` koşulu şart: seans yüklenmeden tüketilirse bayrak boşa gider,
   * başka bir yerden kapatıldıktan sonra tüketilirse boş pencere açardı.
   */
  usePendingStop('breastfeeding', running, openSummary);

  const saveSummary = (activeSec: number) => {
    if (!babyId) return;
    const close = () => {
      setSummary(null);
      setAdjustId(null);
    };

    if (adjustId !== null) {
      void run(() => withSaveFeedback(
        () => breastfeedingService.adjustActiveDuration(babyId, adjustId, activeSec),
      )).then(close);
      return;
    }
    if (sid === null) return;
    void run(() => withSaveFeedback(
      () => breastfeedingService.stop(babyId, sid, activeSec),
    )).then(close);
  };

  /**
   * Tamamlanmış bir seansın aktif süresini sonradan düzeltmek için açar.
   *
   * `x.id` FEEDING kimliğidir; seans uçları `session_id` ister. İlkini
   * göndermek `404 Seans bulunamadı` döndürüyordu.
   */
  const openAdjust = (x: BreastSession) => {
    if (x.session_id === null) return;
    setDetail(null);
    setAdjustId(x.session_id);
    setSummary({
      elapsedSec: x.total_elapsed_sec,
      measuredSec: x.measured_active_sec,
      leftSec: x.left_duration_seconds,
      rightSec: x.right_duration_seconds,
    });
  };

  /**
   * Geçmiş satırına dokununca açılan ayrıntılı rapor.
   *
   * Toplam süre saklanmaz, segmentlerden türetilir (§22.1); burada sol/sağ
   * dağılımı yüzdesiyle birlikte gösterilir — tek memeye yüklenme ebeveynin
   * fark etmek isteyeceği bir örüntü.
   */
  const detailOf = (x: BreastSession): RecordDetail => {
    const measured = x.measured_active_sec || 0;
    const share = (sec: number) => (measured > 0 ? ` · %${Math.round((sec / measured) * 100)}` : '');
    return {
      icon: 'breastfeeding',
      title: 'Emzirme seansı',
      subtitle: fullMoment(x.start_time) ?? undefined,
      stats: [
        // Bebeğin gerçek beslenme süresi öne çıkar.
        { label: 'Aktif emme', value: formatDuration(x.active_duration_sec), tone: 'good' },
        { label: 'Pasif / mola', value: formatDuration(x.passive_duration_sec) },
        { label: 'Geçen süre', value: formatDuration(x.total_elapsed_sec) },
      ],
      rows: [
        { label: 'Başlangıç', value: fullMoment(x.start_time) },
        { label: 'Bitiş', value: x.end_time ? fullMoment(x.end_time) : 'henüz bitmedi' },
        { label: 'Sol meme', value: `${formatDuration(x.left_duration_seconds)}${share(x.left_duration_seconds)}` },
        { label: 'Sağ meme', value: `${formatDuration(x.right_duration_seconds)}${share(x.right_duration_seconds)}` },
        {
          label: 'Kronometrenin ölçtüğü',
          value: formatDuration(measured),
        },
        {
          // Düzeltme yapıldıysa ölçülenle farkı açıkça söylenir; yapılmadıysa
          // satır çizilmez (boş değerler elenir).
          label: 'Aktif süre düzeltmesi',
          value: x.is_duration_adjusted
            ? `Anne ${formatDuration(x.active_duration_sec)} olarak ayarladı`
            : null,
        },
        { label: 'Son emen taraf', value: x.last_side === 'left' || x.last_side === 'right' ? SIDE_LABEL[x.last_side] : null },
        {
          label: 'Durum',
          value: x.status === 'completed' ? 'Tamamlandı' : x.status === 'paused' ? 'Duraklatıldı' : 'Sürüyor',
        },
      ],
      note: x.notes,
      audit: x,
      recordId: x.id,
      // "Sonradan düzeltme": özet penceresi oturum bitiminde çıkıyor ama anne
      // o an acele edebilir.
      actions: canEdit && x.status === 'completed' && x.session_id !== null
        ? [{ label: 'Aktif süreyi düzelt', variant: 'ghost' as const, onPress: () => openAdjust(x) }]
        : [],
    };
  };

  if (!baby) {
    return (
      <Screen>
        <EmptyState icon="breastfeeding" title="Önce bir bebek profili ekle" detail="Emzirme kayıtları seçili bebeğe bağlı tutulur." />
      </Screen>
    );
  }

  const nextSide = last.data?.next_side ?? null;
  const lastSession = last.data?.last ?? null;
  const sessions = history.data?.sessions ?? [];

  return (
    <Screen>
      <ReadOnlyBanner />
      {error ? <FormError message={error} /> : null}

      {/* ── Son emzirilen taraf rozeti ── */}
      {lastSession ? (
        <Card>
          <View style={s.badgeRow}>
            <View style={s.badge}>
              <Text style={s.badgeText}>
                Son: {lastSession.last_side ? SIDE_LABEL[lastSession.last_side] : '—'}
              </Text>
            </View>
            {nextSide ? (
              <View style={[s.badge, s.badgeNext]}>
                <Text style={[s.badgeText, s.badgeNextText]}>Sırada: {SIDE_LABEL[nextSide]}</Text>
              </View>
            ) : null}
          </View>
          <Text style={s.hint}>
            {clockOf(lastSession.start_time)} · {formatDuration(lastSession.total_duration_seconds)}
            {typeof lastSession.minutes_ago === 'number' ? ` · ${lastSession.minutes_ago} dk önce` : ''}
          </Text>
        </Card>
      ) : null}

      {/* ── Kronometre ── */}
      <Card>
        {active.loading && !session ? (
          <Loading label="Durum alınıyor…" />
        ) : running ? (
          <>
            <Text style={s.runningLabel}>
              {currentSide ? `${SIDE_LABEL[currentSide]} meme` : 'Emzirme'} {paused ? '— duraklatıldı' : 'sürüyor'}
            </Text>
            <TimerDisplay seconds={elapsed} />

            <View style={s.sideRow}>
              <View style={s.sideCol}>
                <Button
                  label="Sola geç"
                  variant={currentSide === 'left' ? 'ghost' : 'primary'}
                  onPress={() => onSwitch('left')}
                  disabled={busy || !canEdit || currentSide === 'left'}
                />
              </View>
              <View style={s.sideCol}>
                <Button
                  label="Sağa geç"
                  variant={currentSide === 'right' ? 'ghost' : 'primary'}
                  onPress={() => onSwitch('right')}
                  disabled={busy || !canEdit || currentSide === 'right'}
                />
              </View>
            </View>

            <Button
              label={paused ? 'Devam et' : 'Duraklat'}
              variant="ghost"
              onPress={() => {
                if (!babyId || sid === null) return;
                void run(() =>
                  paused
                    ? breastfeedingService.resume(babyId, sid)
                    : breastfeedingService.pause(babyId, sid),
                );
              }}
              disabled={busy || !canEdit}
            />
            <Button
              label={busy ? 'Bitiriliyor…' : 'Emzirmeyi bitir'}
              variant="danger"
              // Kayıt hemen yazılmaz: önce özet ve aktif süre düzeltme
              // penceresi açılır (Modül 2 ek geliştirme).
              onPress={openSummary}
              disabled={busy || !canEdit}
            />
          </>
        ) : (
          <>
            <Text style={s.label}>Hangi memeden başlanıyor?</Text>
            <View style={s.sideRow}>
              <View style={s.sideCol}>
                <Button
                  label={nextSide === 'left' ? 'Sol (sıra)' : 'Sol'}
                  onPress={() => onStart('left')}
                  disabled={busy || !canEdit}
                  variant={nextSide === 'left' ? 'primary' : 'ghost'}
                />
              </View>
              <View style={s.sideCol}>
                <Button
                  label={nextSide === 'right' ? 'Sağ (sıra)' : 'Sağ'}
                  onPress={() => onStart('right')}
                  disabled={busy || !canEdit}
                  variant={nextSide === 'right' ? 'primary' : 'ghost'}
                />
              </View>
            </View>
            {nextSide ? <Text style={s.hint}>Öneri: son emzirilen tarafın tersi.</Text> : null}
          </>
        )}
      </Card>

      {/* ── Geçmiş ── */}
      <SectionTitle>Geçmiş</SectionTitle>
      <Card>
        {history.loading && sessions.length === 0 ? (
          <Loading label="Kayıtlar yükleniyor…" />
        ) : sessions.length === 0 ? (
          <Text style={s.hint}>Henüz emzirme kaydı yok.</Text>
        ) : (
          sessions.map((x) => (
            <RecordRow
              key={x.id}
              icon="breastfeeding"
              // Bebeğin gerçek beslenme süresi öne çıkar; kronometrenin ölçtüğü
              // duvar saati ancak farklıysa parantez içinde gösterilir.
              title={`${clockOf(x.start_time)} · ${formatDuration(x.active_duration_sec)} aktif${
                x.total_elapsed_sec > x.active_duration_sec
                  ? ` (toplam ${formatDuration(x.total_elapsed_sec)})`
                  : ''
              }`}
              detail={`Sol ${formatDuration(x.left_duration_seconds)} · Sağ ${formatDuration(x.right_duration_seconds)}${
                x.last_side ? ` · son ${SIDE_LABEL[x.last_side]}` : ''
              }${x.is_duration_adjusted ? ' · süre düzeltildi' : ''}`}
              right={x.status === 'completed' ? undefined : 'sürüyor'}
              onPress={() => setDetail(detailOf(x))}
            />
          ))
        )}
      </Card>

      <RecordDetailSheet detail={detail} onClose={() => setDetail(null)} />

      <ActiveDurationSheet
        summary={summary}
        busy={busy}
        onCancel={() => {
          setSummary(null);
          setAdjustId(null);
        }}
        onSave={saveSummary}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { ...typography.small, color: colors.textSoft, fontWeight: '600' },
  hint: { ...typography.tiny, color: colors.textFaint, textAlign: 'center' },
  runningLabel: { ...typography.small, color: colors.primary, fontWeight: '700', textAlign: 'center' },
  sideRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm },
  sideCol: { flex: 1 },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
  },
  badgeNext: { backgroundColor: colors.primarySoft },
  badgeText: { ...typography.small, color: colors.textSoft, fontWeight: '700' },
  badgeNextText: { color: colors.primary },
});
