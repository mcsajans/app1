import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RecordRow, TimerDisplay, clockOf, formatDuration, useElapsedSeconds } from '../../components/records';
import { RecordDetailSheet, fullMoment, type RecordDetail } from '../../components/RecordDetail';
import { Button, Card, EmptyState, FormError, Loading, Screen, SectionTitle } from '../../components/ui';
import { ReadOnlyBanner, useCanEdit } from '../../components/permission';
import { ActiveDurationSheet, type SessionSummary } from './ActiveDurationSheet';
import { ManualSessionSheet, type ManualBreastValues } from './ManualSessionSheet';
import { StartPanel, type StartRequest } from './StartPanel';
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
import { colors, spacing, typography } from '../../core/theme';
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
  /** Elle kayıt sayfası açık mı. */
  const [sheet, setSheet] = useState(false);
  /*
   * Sayfayı her açılışta yeniden bağlamak için artan sayaç. Sayfa saat
   * varsayılanlarını `useState` başlatıcısında hesaplıyor; `key` değişmezse
   * dün akşam açılıp kapatılan sayfa bugün eski saatlerle açılırdı.
   */
  const [sheetSeq, setSheetSeq] = useState(0);
  /** Başlangıç panelini sıfırlamak için artan sayaç (aynı `key` deseni). */
  const [panelSeq, setPanelSeq] = useState(0);
  /** Alt sayfa "İkisi de" seçiliyken mi açıldı. */
  const [sheetBoth, setSheetBoth] = useState(false);

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
  /*
   * Duraklatılmış seansta açık segment yoktur (`open_side` null) ama ekranda
   * hâlâ bir taraf gösterilmeli: "Emzirme — duraklatıldı" hangi memede
   * kalındığını söylemiyordu ve taraf değiştirme düğmesi de kayboluyordu.
   * Sunucu duraklatılmış seansta `switch` kabul ediyor (seansı sürdürür).
   */
  const shownSide = currentSide ?? session?.last_side ?? null;
  /** Emzirilen tarafın tersi — taraf değiştirme düğmesi yalnızca onu gösterir. */
  const other: 'left' | 'right' | null =
    shownSide === 'left' ? 'right' : shownSide === 'right' ? 'left' : null;

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

  /**
   * Ortak istek sarmalayıcısı. Başarıyı **döndürür**: elle giriş sayfası
   * yalnızca istek geçtiyse kapanmalı, yoksa kullanıcı doldurduğu formu
   * kaybeder ve hatayı arkadaki ekranda arar.
   */
  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      refreshAll();
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Sayacı başlatır ve **tam ekran reklam tetikler** (`timer_start`).
   *
   * Reklam kaydın ardından ve `await` edilmeden çağrılıyor: `showAdAfterAction`
   * hiç `throw` etmez ve sayaç her hâlükârda başlamış olur. Gecikme panelden
   * gelir (`action_delay_ms`, istenen davranış için **2000 ms**); tetiğin
   * kendisi de panelden açılıp kapanıyor (`trigger_timer_start`).
   *
   * Tetik yalnızca BAŞLATMADA atılıyor — taraf değiştirmede değil (bkz.
   * `onSwitch`). Üst üste gelen gösterimleri panelin frekans sınırı ve
   * oturum tavanı eliyor.
   */
  const onStart = (req: StartRequest) => {
    if (!babyId) return;
    void run(async () => {
      const res = await breastfeedingService.start(babyId, req.side, req.at ?? undefined, req.note);
      showAdAfterAction('timer_start');
      return res;
    });
  };

  /*
   * Ayrıntılı alt sayfa. `both`, panelin "İki memeyi de emzirdim" düğmesinden
   * gelir: sayfa o seçimle açılmazsa kullanıcı az önce söylediği şeyi bir kez
   * daha seçmek zorunda kalıyordu.
   */
  const openSheet = (both: boolean) => {
    setError(null);
    setSheetBoth(both);
    setSheetSeq((n) => n + 1);
    setSheet(true);
  };

  /**
   * Elle kayıt (§10.6) — seans doğrudan tamamlanmış yazılır.
   *
   * İki yerden çağrılır: başlangıç panelinin "Geri tarihli" sekmesi (tek
   * taraf, sık kullanılan hâl) ve iki memeli ayrıntılı alt sayfa. Gövdesi
   * aynı olduğu için tek yerde durur; çağıranlar yalnızca başarıdan sonra
   * ne kapatacaklarına karar verir.
   */
  const submitManual = (v: ManualBreastValues): Promise<boolean> => {
    if (!babyId) return Promise.resolve(false);
    return run(() => withSaveFeedback(() =>
      breastfeedingService.createManual(babyId, {
        started_at: v.startedAt,
        ended_at: v.endedAt,
        first_side: v.firstSide,
        ...(v.leftSec === undefined ? {} : { left_sec: v.leftSec }),
        ...(v.rightSec === undefined ? {} : { right_sec: v.rightSec }),
        note: v.note,
      })));
  };

  const onManualSubmit = (v: ManualBreastValues) => {
    void submitManual(v).then((saved) => {
      if (saved) setSheet(false);
    });
  };

  /*
   * Panelden gelen kayıt: başarıdan sonra panel `key` ile yeniden bağlanır,
   * yani taraf seçimine döner ve form boşalır. Kayıt zaten geçmişe düştü;
   * dolu formu ekranda bırakmak "kaydedildi mi?" sorusunu doğuruyordu.
   */
  const onPanelManualSave = (v: ManualBreastValues) => {
    void submitManual(v).then((saved) => {
      if (saved) setPanelSeq((n) => n + 1);
    });
  };

  /**
   * Taraf değiştirme — **reklam tetiklemez**.
   *
   * `timer_start` tetiği yalnızca sayacın BAŞLADIĞI anda atılıyor. Tarafı
   * değiştirmek emzirmenin ortasında bir an: tam ekran reklam hem ölçülen
   * süreyi gölgeler hem de bebeği kucağında tutan anneyi uygulamadan atar.
   */
  const onSwitch = (side: 'left' | 'right') => {
    if (!babyId || sid === null) return;
    void run(() => breastfeedingService.switchSide(babyId, sid, side));
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
  const sessions = history.data?.sessions ?? [];

  return (
    <Screen>
      <ReadOnlyBanner />
      {error ? <FormError message={error} /> : null}

      {/*
        ── Kronometre ──
        Üstte bir zamanlar "Son: Sol / Sırada: Sağ" rozet kartı vardı. Kaldırıldı:
        sıradaki taraf zaten başlangıç panelindeki kutunun rozetinde yazıyor,
        son emzirmenin saati ve süresi ise hemen aşağıdaki geçmiş listesinin ilk
        satırı. Aynı bilgiyi üç yerde göstermek ekranı uzatmaktan başka bir şey
        yapmıyordu.
      */}
      <Card>
        {active.loading && !session ? (
          <Loading label="Durum alınıyor…" />
        ) : running ? (
          <>
            <Text style={s.runningLabel}>
              {shownSide ? `${SIDE_LABEL[shownSide]} meme` : 'Emzirme'} {paused ? '— duraklatıldı' : 'sürüyor'}
            </Text>
            <TimerDisplay seconds={elapsed} />

            {/*
              Taraf değiştirme tek düğme: açık olan tarafa "geç" demek anlamsız
              ve devre dışı bir ikizi yan yana koymak ekranda yer kaplıyordu.
              Emzirilen taraf zaten üstteki başlıkta yazıyor.
            */}
            {other ? (
              <View style={s.switchRow}>
                <Button
                  label={`${SIDE_LABEL[other]}a geç`}
                  onPress={() => onSwitch(other)}
                  disabled={busy || !canEdit}
                />
              </View>
            ) : null}

            {/*
              Seans eylemleri tek satırda: alt alta üç düğme kartı gereksiz
              uzatıyor, taraf değiştirme satırıyla aynı ızgarada durunca
              "bu seansla ne yapabilirim" tek bakışta okunuyor. Dar sütuna
              sığmaları için `compact`.
              Sayaç akarken de geçmiş bir seans girilebilir (çakışmadığı sürece).
            */}
            <View style={s.sideRow}>
              <View style={s.sideCol}>
                <Button
                  label={paused ? 'Devam et' : 'Duraklat'}
                  variant="ghost"
                  compact
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
              </View>
              <View style={s.sideCol}>
                <Button
                  label={busy ? 'Bitiriliyor…' : 'Bitir'}
                  variant="danger"
                  compact
                  // Kayıt hemen yazılmaz: önce özet ve aktif süre düzeltme
                  // penceresi açılır (Modül 2 ek geliştirme).
                  onPress={openSummary}
                  disabled={busy || !canEdit}
                />
              </View>
              <View style={s.sideCol}>
                <Button
                  label="Elle kayıt"
                  variant="ghost"
                  compact
                  onPress={() => openSheet(false)}
                  disabled={busy || !canEdit}
                />
              </View>
            </View>
          </>
        ) : (
          <StartPanel
            key={panelSeq}
            nextSide={nextSide}
            busy={busy}
            disabled={!canEdit}
            onStart={onStart}
            onManual={() => openSheet(true)}
            onManualSave={onPanelManualSave}
          />
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
              /*
                Üst satır seansın SAAT ARALIĞI: "ne zaman emzirdim" sorusunun
                cevabı tek bakışta okunuyor, süre hesabı alt satıra kalıyor.
                Bitmemiş seansta bitiş saati yok; "beri" ile yazılır.
              */
              title={
                x.end_time
                  ? `${clockOf(x.start_time)} – ${clockOf(x.end_time)}`
                  : `${clockOf(x.start_time)}'ten beri`
              }
              // Alt satır hangi meme, ne kadar: dakika:saniye + "dk".
              detail={`Sol ${formatDuration(x.left_duration_seconds)} dk · Sağ ${formatDuration(x.right_duration_seconds)} dk${
                x.last_side ? ` · son ${SIDE_LABEL[x.last_side]}` : ''
              }${x.is_duration_adjusted ? ' · süre düzeltildi' : ''}`}
              right={x.status === 'completed' ? undefined : 'sürüyor'}
              onPress={() => setDetail(detailOf(x))}
            />
          ))
        )}
      </Card>

      <RecordDetailSheet detail={detail} onClose={() => setDetail(null)} />

      <ManualSessionSheet
        key={sheetSeq}
        visible={sheet}
        initialBoth={sheetBoth}
        busy={busy}
        error={sheet ? error : null}
        nextSide={nextSide}
        onClose={() => setSheet(false)}
        onSubmit={onManualSubmit}
      />

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
  switchRow: { marginVertical: spacing.sm },
});
