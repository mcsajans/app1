import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  RecordRow, StatTile, TimerDisplay,
  clockOf, formatDuration, humanDuration, useElapsedSeconds,
} from '../../components/records';
import { RecordDetailSheet, fullMoment, type RecordDetail } from '../../components/RecordDetail';
import {
  Button, ButtonRow, Card, EmptyState, FormError, Loading, Screen, SectionTitle,
} from '../../components/ui';
import { ReadOnlyBanner, useCanEdit } from '../../components/permission';
import { ManualSleepSheet, type ManualSleepValues } from './ManualSleepSheet';
import { SleepStartPanel, type SleepStartRequest } from './SleepStartPanel';
import { errorText } from '../../core/api/client';
import { localDate, sleepService, type SleepRecord } from '../../core/api/modules';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { SLEEP_TYPE_LABEL, sleepTimerOf } from '../../core/timers/liveTimer';
import { useLiveTimerStore } from '../../core/timers/useLiveTimerStore';
import { colors, spacing, typography } from '../../core/theme';
import { showAdAfterAction } from '../../core/ads/adService';
import { withSaveFeedback } from '../../core/feedback/withSaveFeedback';

/**
 * Etiketler `core/timers/liveTimer.ts`'ten geliyor: aynı metin kilit ekranı
 * bildiriminde de kullanılıyor ve iki kopya zamanla ayrışırdı.
 */
const TYPE_LABELS = SLEEP_TYPE_LABEL;

/**
 * Bu modülden açılan reklamların ortak ayarı.
 *
 * İki sapma var ve ikisi de uyku modülüne özgü:
 *
 *  - **3 saniye gecikme** (panelin 2 sn'si yerine): "Uykuya daldı"ya basan
 *    ebeveyn genelde telefonu bırakıp bebeği yatırıyor; bir saniye fazla
 *    bekleme, reklamın elin telefondan ayrıldığı anda açılmasını azaltıyor.
 *  - **Ses kapalı** (`muted`): bebeği uyutmaya çalışırken açılan sesli bir
 *    reklam modülün bütün amacını bozar. Ninni çalarken reklam zaten hiç
 *    gösterilmiyor (`adService` kapısı), ama ninni açık olmadan da uyku
 *    ortamı sessiz olmalı. Ses yalnızca bu gösterim boyunca kapalı kalır;
 *    reklam kapanınca `adService` geri açıyor.
 *
 * Panel ayarları (tetikleyici anahtarları, frekans sınırı, oturum tavanı)
 * aynen geçerli — buradan yalnızca gecikme ve ses değişiyor.
 */
const SLEEP_AD = { delayMs: 3000, muted: true } as const;
const QUALITY_LABELS = { rahat: 'Rahat', huzursuz: 'Huzursuz', sik_uyandi: 'Sık uyandı' } as const;

/**
 * Modül 5 — Uyku Takibi.
 *
 * Kronometre **sunucuda** yaşar: "uykuya daldı" bir `running` kayıt açar,
 * "uyandı" onu kapatır ve süreyi sunucu hesaplar. Böylece uygulama kapansa,
 * telefon yeniden başlasa ya da diğer ebeveyn kendi telefonundan baksa bile
 * aynı uyku görünür.
 */
export default function SleepScreen() {
  const baby = useBabyStore((s) => s.selected());
  const babyId = baby?.id ?? null;
  const today = localDate();

  const canEdit = useCanEdit();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  /** Elle kayıt sayfası açık mı. */
  const [sheet, setSheet] = useState(false);
  /*
   * Sayfayı ve paneli her açılışta yeniden bağlamak için artan sayaçlar.
   * İkisi de saat varsayılanlarını bir kez hesaplıyor; `key` değişmezse dün
   * akşam açılan form bugün eski saatlerle karşılıyor.
   */
  const [sheetSeq, setSheetSeq] = useState(0);
  const [panelSeq, setPanelSeq] = useState(0);

  const list = useAsyncData(
    () => (babyId ? sleepService.list(babyId) : Promise.resolve({ sleep: [] })),
    [babyId],
  );
  const summary = useAsyncData(
    () => (babyId ? sleepService.summary(babyId, today) : Promise.resolve(null)),
    [babyId, today],
  );

  const records = list.data?.sleep ?? [];
  const running = records.find((r) => r.status === 'running') ?? null;
  const elapsed = useElapsedSeconds(running?.started_at ?? null);

  const babyName = baby?.firstName ?? null;

  /* Kilit ekranı / bildirim çubuğu sayacı (bildirimler.md → Ek geliştirme). */
  useEffect(() => {
    useLiveTimerStore.getState().publish(
      'sleep',
      running ? sleepTimerOf(running, babyId, babyName) : null,
    );
  }, [running, babyId, babyName]);

  const refreshAll = () => {
    list.reload();
    summary.reload();
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

  const openSheet = () => {
    setError(null);
    setSheetSeq((n) => n + 1);
    setSheet(true);
  };

  /**
   * Elle kayıt (§11.1) — kayıt doğrudan tamamlanmış yazılır.
   *
   * İki yerden çağrılır: başlangıç panelinin "Geri tarihli" sekmesi ve sayaç
   * akarken açılan alt sayfa. Gövdesi aynı olduğu için tek yerde durur;
   * çağıranlar yalnızca başarıdan sonra ne kapatacaklarına karar verir.
   *
   * "Sayacı geçmişten başlat" artık burada değil: paneldeki kutucuk aynı işi
   * tek ekranda yapıyor.
   */
  const submitManual = (v: ManualSleepValues): Promise<boolean> => {
    if (!babyId) return Promise.resolve(false);
    return run(() => withSaveFeedback(
      () => sleepService.create(babyId, {
        sleep_type: v.sleepType,
        started_at: v.startedAt,
        ended_at: v.endedAt,
        quality: v.quality,
        note: v.note,
      }),
      undefined,
      'save',
      SLEEP_AD,
    ));
  };

  const onManualSubmit = (v: ManualSleepValues) => {
    void submitManual(v).then((saved) => {
      if (saved) setSheet(false);
    });
  };

  /*
   * Panelden gelen kayıt: başarıdan sonra panel `key` ile yeniden bağlanır,
   * yani form boşalır ve sekme "Anlık"a döner. Dolu formu ekranda bırakmak
   * "kaydedildi mi?" sorusunu doğuruyordu.
   */
  const onPanelManualSave = (v: ManualSleepValues) => {
    void submitManual(v).then((saved) => {
      if (saved) setPanelSeq((n) => n + 1);
    });
  };

  /**
   * "Uykuya daldı" — sayaç BAŞLATMA anı. Reklam tetiği panelde varsayılan
   * olarak KAPALI (`trigger_timer_start`, Reklam.md §0.3-C): geçiş reklamı
   * doğal bitiş noktalarına ait, akan bir sayacı kapatan reklam hem ölçümü
   * gölgeliyor hem politika riskinin en yüksek olduğu yer. Panelden açılırsa
   * burası çalışır; kayıt her hâlükârda önce ve `await` ile.
   */
  const onStart = (req: SleepStartRequest) => {
    if (!babyId) return;
    void run(async () => {
      const res = await sleepService.start(babyId, req.sleepType, req.at ?? undefined, req.note);
      showAdAfterAction('timer_start', SLEEP_AD);
      return res;
    });
  };

  const onStop = () => {
    if (!running) return;
    // "Uyandı" da bu modülün reklamı: aynı gecikme ve sessizlik geçerli.
    void run(() => withSaveFeedback(
      () => sleepService.stop(running.id, {}), undefined, 'save', SLEEP_AD,
    ));
  };

  const onDelete = (r: SleepRecord) => {
    Alert.alert('Kaydı sil', `${TYPE_LABELS[r.sleep_type]} kaydı silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => void run(() => sleepService.remove(r.id)) },
    ]);
  };

  /** Geçmiş satırına dokununca açılan ayrıntılı rapor. */
  const detailOf = (r: SleepRecord): RecordDetail => ({
    icon: r.sleep_type === 'night' ? 'night' : 'nap',
    title: TYPE_LABELS[r.sleep_type],
    subtitle: fullMoment(r.started_at) ?? undefined,
    stats: [
      { label: 'Süre', value: r.status === 'running' ? 'sürüyor' : humanDuration(r.duration_sec) },
      {
        label: 'Uyanma',
        value: String(r.wake_count),
        hint: r.wake_count === 0 ? 'kesintisiz' : undefined,
        tone: r.wake_count > 0 ? 'warn' : 'good',
      },
      { label: 'Kalite', value: r.quality ? QUALITY_LABELS[r.quality] : '—' },
    ],
    rows: [
      { label: 'Uykuya daldı', value: fullMoment(r.started_at) },
      { label: 'Uyandı', value: r.ended_at ? fullMoment(r.ended_at) : 'henüz uyanmadı' },
      { label: 'Uyku tipi', value: TYPE_LABELS[r.sleep_type] },
      { label: 'Uyanma sebebi', value: r.wake_reason },
      { label: 'Durum', value: r.status === 'running' ? 'Sürüyor' : 'Tamamlandı' },
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
        <EmptyState icon="sleep" title="Önce bir bebek profili ekle" detail="Uyku kayıtları seçili bebeğe bağlı tutulur." />
      </Screen>
    );
  }

  const sum = summary.data;

  return (
    <Screen>
      <ReadOnlyBanner />

      {error ? <FormError message={error} /> : null}

      {/* ── Kronometre ── */}
      <Card>
        {running ? (
          <>
            <Text style={s.runningLabel}>
              {TYPE_LABELS[running.sleep_type]} sürüyor · {clockOf(running.started_at)}&apos;den beri
            </Text>
            <TimerDisplay seconds={elapsed} />
            <ButtonRow>
              <Button label={busy ? 'Kaydediliyor…' : 'Uyandı'} onPress={onStop} disabled={busy || !canEdit} />
              {/* Sayaç akarken de geçmiş bir uyku girilebilir (çakışmadığı sürece). */}
              <Button
                label="Elle kayıt ekle"
                variant="ghost"
                onPress={openSheet}
                disabled={busy || !canEdit}
              />
            </ButtonRow>
          </>
        ) : (
          <SleepStartPanel
            key={panelSeq}
            busy={busy}
            disabled={!canEdit}
            onStart={onStart}
            onManualSave={onPanelManualSave}
          />
        )}
      </Card>

      {/* ── Uyanıklık penceresi ── */}
      {!running && sum?.awake_window_sec !== null && sum?.awake_window_sec !== undefined ? (
        <Card>
          <Text style={s.label}>Uyanıklık penceresi</Text>
          <Text style={s.awake}>{humanDuration(sum.awake_window_sec)}</Text>
          <Text style={s.hint}>Son uyanma: {clockOf(sum.last_wake_at)}</Text>
        </Card>
      ) : null}

      {/* ── Günlük özet ── */}
      <SectionTitle hint="Bugünün toplamları">Günlük özet</SectionTitle>
      <Card>
        {summary.loading && !sum ? (
          <Loading label="Özet yükleniyor…" />
        ) : summary.error ? (
          <Text style={s.hint}>{summary.error}</Text>
        ) : (
          <View style={s.tiles}>
            <StatTile label="Gece" value={humanDuration(sum?.night_sleep_sec)} />
            <StatTile label="Şekerleme" value={humanDuration(sum?.nap_sec)} hint={`${sum?.nap_count ?? 0} kez`} />
            <StatTile label="Toplam" value={humanDuration(sum?.total_sleep_sec)} tone="good" />
          </View>
        )}
      </Card>

      {/* ── Geçmiş ── */}
      <SectionTitle hint="Uzun basıp silebilirsin.">Geçmiş</SectionTitle>
      <Card>
        {list.loading && records.length === 0 ? (
          <Loading label="Kayıtlar yükleniyor…" />
        ) : records.length === 0 ? (
          <Text style={s.hint}>Henüz uyku kaydı yok.</Text>
        ) : (
          records.map((r) => (
            <RecordRow
              key={r.id}
              icon={r.sleep_type === 'night' ? 'night' : 'nap'}
              title={`${TYPE_LABELS[r.sleep_type]} · ${clockOf(r.started_at)}–${r.ended_at ? clockOf(r.ended_at) : '…'}`}
              detail={[
                r.status === 'running' ? 'sürüyor' : formatDuration(r.duration_sec),
                r.wake_count > 0 ? `${r.wake_count} uyanma` : null,
                r.quality ? QUALITY_LABELS[r.quality] : null,
                r.wake_reason,
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => setDetail(detailOf(r))}
              onLongPress={canEdit ? () => onDelete(r) : undefined}
            />
          ))
        )}
      </Card>

      <RecordDetailSheet detail={detail} onClose={() => setDetail(null)} />

      <ManualSleepSheet
        key={sheetSeq}
        visible={sheet}
        busy={busy}
        error={sheet ? error : null}
        onClose={() => setSheet(false)}
        onSubmit={onManualSubmit}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { ...typography.small, color: colors.textSoft, fontWeight: '600' },
  hint: { ...typography.small, color: colors.textSoft },
  gap: { height: spacing.sm },
  runningLabel: { ...typography.small, color: colors.primary, fontWeight: '700', textAlign: 'center' },
  awake: { ...typography.h1, color: colors.text },
  tiles: { flexDirection: 'row', gap: spacing.sm },
});
