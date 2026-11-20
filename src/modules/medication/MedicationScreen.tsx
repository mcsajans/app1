import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { RecordRow, clockOf, useNowMs } from '../../components/records';
import { RecordDetailSheet, fullMoment, type RecordDetail } from '../../components/RecordDetail';
import { ReadOnlyBanner, useCanEdit } from '../../components/permission';
import {
  Button, ButtonRow, Card, EmptyState, FormError, Loading, Screen, SectionTitle,
} from '../../components/ui';
import { errorText } from '../../core/api/client';
import {
  medicationService, type DoseInput, type Medication, type MedicationDose,
  type MedicationInput,
} from '../../core/api/modules';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { withSaveFeedback } from '../../core/feedback/withSaveFeedback';
import { syncMedicationAlarms } from '../../core/notifications/medicationAlarms';
import { colors, radius, spacing, typography } from '../../core/theme';
import { DoseSheet } from './DoseSheet';
import { MedicationFormSheet } from './MedicationFormSheet';
import {
  FORM_LABEL, ROUTE_LABEL, STATUS_LABEL, amountLabel, dueLabel, scheduleLabel,
} from './labels';

/**
 * Modül 16 — İlaç Takibi.
 *
 * Analiz ve gerekçeler: `modules_doc/ilac-takibi.md`. Ekranın üç ilkesi:
 *
 *  1. **"Verildi" tek dokunuştur.** Varsayılan dozu ve şu anı kullanır, form
 *     açmaz: ilaç verilirken bir el bebekte. Farklı bir şey söylenecekse
 *     (doz değişti, saat geçmişte, atlandı) alt sayfa açılır.
 *  2. **Uyarılar kaydı engellemez.** Erken doz ve günlük sınır aşımı sunucuda
 *     kabul edilir, yanıtla birlikte gelen metin burada sarı kutuda gösterilir.
 *     İlaç gerçekte verilmiştir; kaydı reddetmek onu geri almaz.
 *  3. **Reklam var (2026-11-21).** Başta kapalıydı (sağlık bağlamı); ürün
 *     kararıyla diğer modüllerle aynı hâle getirildi: kür ve doz kaydından
 *     sonra `save` tetiği atılıyor ve panelden kapatılabiliyor.
 */
export default function MedicationScreen() {
  const baby = useBabyStore((s) => s.selected());
  const babyId = baby?.id ?? null;
  const canEdit = useCanEdit();

  /* Göreli "sonraki doz" metni için saniyelik saat (render'da Date.now() yok). */
  const nowMs = useNowMs();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Sunucudan gelen uyarılar — hata değil, kayıt yazıldı. */
  const [warnings, setWarnings] = useState<string[]>([]);
  const [detail, setDetail] = useState<RecordDetail | null>(null);

  /* Alt sayfalar: `key` ile her açılışta yeniden bağlanırlar (saat ve
     varsayılanlar bir kez hesaplansın diye). */
  const [formOpen, setFormOpen] = useState(false);
  const [formSeq, setFormSeq] = useState(0);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [doseOpen, setDoseOpen] = useState(false);
  const [doseSeq, setDoseSeq] = useState(0);
  const [doseFor, setDoseFor] = useState<Medication | null>(null);

  const list = useAsyncData(
    () => (babyId ? medicationService.list(babyId, 'all') : Promise.resolve({ medications: [] })),
    [babyId],
  );
  const history = useAsyncData(
    () => (babyId ? medicationService.doses(babyId, { limit: 30 }) : Promise.resolve({ doses: [] })),
    [babyId],
  );

  const medications = list.data?.medications ?? [];
  const active = medications.filter((m) => m.status === 'active');
  const closed = medications.filter((m) => m.status !== 'active');
  const doses = history.data?.doses ?? [];

  const refreshAll = () => {
    list.reload();
    history.reload();
  };

  /*
   * Sıradaki doz uyarıları liste her tazelendiğinde yeniden kurulur.
   *
   * Tek tek değil toptan: "sonraki doz" son doza bağlı olduğu için bir doz
   * yazıldığında o kürün bütün gelecek uyarıları kayıyor. Hesap sunucuda
   * (`/medications/due`), burada yalnızca planlama var.
   */
  useEffect(() => {
    void syncMedicationAlarms(babyId);
    // Bağımlılık türetilmiş dizi değil `list.data`: dizi her çizimde yeniden
    // kurulduğu için etki sonsuz tetiklenirdi.
  }, [babyId, list.data]);

  /** Ortak istek sarmalayıcısı — başarıyı döndürür ki sayfa yalnızca geçtiyse kapansın. */
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

  const openForm = (medication: Medication | null) => {
    setError(null);
    setEditing(medication);
    setFormSeq((n) => n + 1);
    setFormOpen(true);
  };

  const openDose = (medication: Medication | null) => {
    setError(null);
    setWarnings([]);
    setDoseFor(medication);
    setDoseSeq((n) => n + 1);
    setDoseOpen(true);
  };

  const saveMedication = (values: MedicationInput) => {
    if (!babyId) return;
    const target = editing;
    void (async () => {
      const saved = await run(() => withSaveFeedback(
        () => (target
          ? medicationService.update(target.id, values)
          : medicationService.create(babyId, values)),
      ));
      if (saved) setFormOpen(false);
    })();
  };

  /**
   * Doz yazar ve sunucunun döndürdüğü uyarıları ekrana taşır.
   *
   * Uyarı listesi **başarılı** yanıtın parçası: `warnings` dolu olsa bile
   * kayıt yazılmıştır. Hata yolu ayrı (`run` içindeki `catch`).
   */
  const submitDose = async (values: DoseInput): Promise<boolean> => {
    if (!babyId) return false;
    setWarnings([]);
    setBusy(true);
    setError(null);
    try {
      const res = await withSaveFeedback(() => medicationService.addDose(babyId, values));
      setWarnings(res.warnings ?? []);
      refreshAll();
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** Tek dokunuş: varsayılan doz, şu an. */
  const quickGive = (m: Medication) => {
    void submitDose({
      medication_id: m.id,
      given_at: new Date().toISOString(),
      amount: m.default_amount,
      amount_unit: m.amount_unit,
      status: 'given',
    });
  };

  const onDoseSubmit = (values: DoseInput) => {
    void submitDose(values).then((saved) => {
      if (saved) setDoseOpen(false);
    });
  };

  const finishMedication = (m: Medication) => {
    Alert.alert(
      'Kürü bitir',
      `${m.name} kürü tamamlandı olarak işaretlensin mi? Kayıtlar geçmişte kalır.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Bitir', onPress: () => void run(() => medicationService.finish(m.id)) },
      ],
    );
  };

  const deleteMedication = (m: Medication) => {
    Alert.alert(
      'İlacı sil',
      `${m.name} silinsin mi? Verilmiş dozların geçmişte kalmaya devam eder.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => void run(() => medicationService.remove(m.id)),
        },
      ],
    );
  };

  const deleteDose = (d: MedicationDose) => {
    Alert.alert('Doz kaydını sil', `${d.name} kaydı silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => void run(() => medicationService.removeDose(d.id)),
      },
    ]);
  };

  const doseDetail = (d: MedicationDose): RecordDetail => ({
    icon: 'medication',
    title: d.name,
    subtitle: fullMoment(d.given_at) ?? undefined,
    rows: [
      { label: 'Durum', value: d.status === 'given' ? 'Verildi' : 'Atlandı' },
      { label: 'Doz', value: amountLabel(d.amount, d.amount_unit) },
      { label: 'Atlama sebebi', value: d.skip_reason },
      { label: 'Zaman', value: fullMoment(d.given_at) },
    ],
    note: d.note,
    // Erken doz uyarısı kayıtta da görünür: doktora anlatılacak şey bu.
    warning: d.is_early ? 'Bu doz, belirlenen en az aralıktan önce verildi.' : null,
    audit: d,
    recordId: d.id,
    onDelete: canEdit
      ? () => {
        setDetail(null);
        deleteDose(d);
      }
      : undefined,
  });

  const medicationDetail = (m: Medication): RecordDetail => ({
    icon: 'medication',
    title: m.name,
    subtitle: [FORM_LABEL[m.form], m.strength].filter(Boolean).join(' · ') || undefined,
    rows: [
      { label: 'Tek doz', value: amountLabel(m.default_amount, m.amount_unit) },
      { label: 'Program', value: scheduleLabel(m) },
      { label: 'Veriliş yolu', value: ROUTE_LABEL[m.route] },
      {
        label: 'En az aralık',
        value: m.min_interval_hours ? `${String(m.min_interval_hours).replace('.', ',')} saat` : null,
      },
      {
        label: 'Günlük sınır',
        value: m.max_doses_per_day ? `${m.max_doses_per_day} doz` : null,
      },
      { label: 'Başlangıç', value: m.started_on },
      { label: 'Bitiş', value: m.ends_on ?? 'süresiz' },
      { label: 'Kim yazdı', value: m.prescriber },
      { label: 'Sebep', value: m.reason },
      { label: 'Durum', value: STATUS_LABEL[m.status] },
    ],
    note: m.note,
    audit: m,
    recordId: m.id,
    actions: canEdit
      ? [
        { label: 'Düzenle', variant: 'ghost' as const, onPress: () => { setDetail(null); openForm(m); } },
        ...(m.status === 'active'
          ? [{ label: 'Kürü bitir', variant: 'ghost' as const, onPress: () => { setDetail(null); finishMedication(m); } }]
          : []),
      ]
      : [],
    onDelete: canEdit
      ? () => {
        setDetail(null);
        deleteMedication(m);
      }
      : undefined,
  });

  if (!baby) {
    return (
      <Screen>
        <EmptyState
          icon="medication"
          title="Önce bir bebek profili ekle"
          detail="İlaç kayıtları seçili bebeğe bağlı tutulur."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ReadOnlyBanner />
      {error ? <FormError message={error} /> : null}

      {/*
        Uyarı kutusu hatadan AYRI: kayıt yazıldı, yalnızca dikkat çekilecek
        bir durum var (erken doz, günlük sınır, biten kür).
      */}
      {warnings.length > 0 ? (
        <View style={s.warnBox}>
          {warnings.map((w) => (
            <Text key={w} style={s.warnText}>{w}</Text>
          ))}
          <Text style={s.warnHint}>Kayıt yine de alındı.</Text>
        </View>
      ) : null}

      {/*
        Ekleme düğmeleri listenin DIŞINDA ve en üstte.
        Önceden ilaç kartının içinde, son ilacın altında duruyorlardı:
        "Verildi / Doz kaydı / Ayrıntı" satırının hemen altına gelen
        "İlaç ekle / Tek seferlik doz" ikilisi aynı ilaca aitmiş gibi
        okunuyordu. Artık ekranın en üstünde, hangi ilaca ait olmadıkları
        açık.
      */}
      <ButtonRow>
        <Button label="+ İlaç ekle" onPress={() => openForm(null)} disabled={busy || !canEdit} />
        {/* Kür tanımı olmadan, tek seferlik bir doz: en telaşlı anda dört
            alanlı bir form açtırmamak için (§3d). */}
        <Button
          label="Tek seferlik doz"
          variant="ghost"
          onPress={() => openDose(null)}
          disabled={busy || !canEdit}
        />
      </ButtonRow>

      <SectionTitle hint="Dokunarak ayrıntıyı aç.">Süren ilaçlar</SectionTitle>
      {list.loading && medications.length === 0 ? (
        <Card>
          <Loading label="İlaçlar yükleniyor…" />
        </Card>
      ) : active.length === 0 ? (
        <Card>
          <Text style={s.hint}>Şu an sürmekte olan bir ilaç yok.</Text>
        </Card>
      ) : (
        <View style={s.medList}>
          {active.map((m) => (
            /* Her ilaç KENDİ kartında: üç düğmeli satırlar tek kartta alt
               alta dizildiğinde hangi düğmenin hangi ilaca ait olduğu
               karışıyordu. */
            <Card key={m.id}>
              <Text style={s.medName} onPress={() => setDetail(medicationDetail(m))}>
                {m.name}
                {m.strength ? <Text style={s.medStrength}>{`  ${m.strength}`}</Text> : null}
              </Text>
              <Text style={s.medMeta}>
                {[amountLabel(m.default_amount, m.amount_unit), scheduleLabel(m)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text style={s.medState}>
                {m.last_dose_at ? `Son doz ${clockOf(m.last_dose_at)}` : 'Henüz doz verilmedi'}
                {dueLabel(m.next_due_at, nowMs) ? ` · Sonraki ${dueLabel(m.next_due_at, nowMs)}` : ''}
                {m.today_given ? ` · bugün ${m.today_given} doz` : ''}
              </Text>
              <ButtonRow>
                <Button
                  label="Verildi"
                  onPress={() => quickGive(m)}
                  disabled={busy || !canEdit}
                />
                <Button
                  label="Doz kaydı"
                  variant="ghost"
                  onPress={() => openDose(m)}
                  disabled={busy || !canEdit}
                />
                <Button
                  label="Ayrıntı"
                  variant="ghost"
                  onPress={() => setDetail(medicationDetail(m))}
                  disabled={busy}
                />
              </ButtonRow>
            </Card>
          ))}
        </View>
      )}

      <SectionTitle hint="Son 30 kayıt">Verilen dozlar</SectionTitle>
      <Card>
        {history.loading && doses.length === 0 ? (
          <Loading label="Dozlar yükleniyor…" />
        ) : doses.length === 0 ? (
          <Text style={s.hint}>Henüz doz kaydı yok.</Text>
        ) : (
          doses.map((d) => (
            <RecordRow
              key={d.id}
              icon="medication"
              title={`${clockOf(d.given_at)} · ${d.name}`}
              detail={[
                d.status === 'skipped' ? 'atlandı' : amountLabel(d.amount, d.amount_unit),
                d.is_early ? 'erken' : null,
                d.skip_reason,
                d.creator_name,
              ].filter(Boolean).join(' · ')}
              right={d.is_early ? 'erken' : undefined}
              onPress={() => setDetail(doseDetail(d))}
              onLongPress={canEdit ? () => deleteDose(d) : undefined}
            />
          ))
        )}
      </Card>

      {closed.length > 0 ? (
        <>
          <SectionTitle hint="Tamamlanan ve bırakılan kürler">Geçmiş ilaçlar</SectionTitle>
          <Card>
            {closed.map((m) => (
              <RecordRow
                key={m.id}
                icon="medication"
                title={m.name}
                detail={`${m.started_on} – ${m.ends_on ?? '…'} · ${scheduleLabel(m)}`}
                right={STATUS_LABEL[m.status]}
                onPress={() => setDetail(medicationDetail(m))}
              />
            ))}
          </Card>
        </>
      ) : null}

      <RecordDetailSheet detail={detail} onClose={() => setDetail(null)} />

      <MedicationFormSheet
        key={`form-${formSeq}`}
        visible={formOpen}
        busy={busy}
        error={formOpen ? error : null}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={saveMedication}
      />

      <DoseSheet
        key={`dose-${doseSeq}`}
        visible={doseOpen}
        busy={busy}
        error={doseOpen ? error : null}
        medication={doseFor}
        onClose={() => setDoseOpen(false)}
        onSubmit={onDoseSubmit}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  hint: { ...typography.small, color: colors.textSoft },
  medList: { gap: spacing.sm },
  medName: { ...typography.h3, color: colors.text },
  medStrength: { ...typography.small, color: colors.textFaint, fontWeight: '400' },
  medMeta: { ...typography.small, color: colors.textSoft },
  medState: { ...typography.tiny, color: colors.textFaint },
  warnBox: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.surface,
  },
  warnText: { ...typography.small, color: colors.text },
  warnHint: { ...typography.tiny, color: colors.textSoft },
});
