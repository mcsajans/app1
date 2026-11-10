import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chips } from '../../components/records';
import { DateField, TimeField } from '../../components/DateTimeField';
import { ReadOnlyBanner, useCanEdit } from '../../components/permission';
import {
  Button, Card, EmptyState, FormError, Loading, Screen, SectionTitle,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { errorText } from '../../core/api/client';
import {
  VACCINE_CATEGORIES, familyService, localDate, vaccineService,
  type SideEffects, type Vaccine, type VaccineCategory, type VaccineDefinition,
} from '../../core/api/modules';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { VACCINE_OFFSETS, offsetsSummary } from '../../core/notifications/alarmPlan';
import { onVaccineClosed, onVaccineSaved } from '../../core/notifications/vaccineAlarms';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { colors, moduleTint, radius, shadow, spacing, typography } from '../../core/theme';
import {
  CATEGORY_LABELS, CATEGORY_SHORT, ageLabel, effectiveStatus, groupByMonth,
  listSummary, sideEffectSummary, statusLabel, whenLabel,
  type EffectiveStatus,
} from './vaccineFormat';
import { withSaveFeedback } from '../../core/feedback/withSaveFeedback';

/**
 * Modül 14 — Aşı Takibi.
 *
 * Üç sekme şartnamedeki adlandırma: **Ulusal Aşı Takvimi** (Bakanlık takvimi,
 * bebek oluşturulduğunda otomatik planlanır), **Özel Aşılar** (ücretli;
 * kütüphaneden eklenir) ve **Diğer / Manuel** (elle girilen).
 *
 * Kartlar **aya göre gruplanır**. Yirmi kartlık düz bir liste okunamıyordu;
 * ebeveyn "2. ayda neler var" diye bakıyor. Gruplama hedef aya göre yapılır,
 * planlanan tarihe göre değil: randevu öne alınsa bile aşı hâlâ "2. ayın
 * aşısı"dır (`groupByMonth`).
 *
 * Randevu ve tamamlama panelleri **kartın içinde** açılır, ayrı sayfada değil.
 * Aşı kaydının bağlamı (hangi doz, hangi ay, ne zamandı) formu doldururken
 * görünür kalmalı; ayrı bir sayfa bu bağlamı ekrandan silerdi.
 */

/** Durum rozetinin rengi ve simgesi. */
const STATUS_STYLE: Record<EffectiveStatus, { bg: string; fg: string; icon: 'clock' | 'upcoming' | 'warning' | 'check' | 'skipped' }> = {
  pending: { bg: colors.border, fg: colors.textSoft, icon: 'clock' },
  upcoming: { bg: '#FDF1DE', fg: colors.warning, icon: 'upcoming' },
  delayed: { bg: '#FDECEC', fg: colors.danger, icon: 'warning' },
  completed: { bg: '#E6F6EC', fg: colors.success, icon: 'check' },
  skipped: { bg: colors.surfaceSoft, fg: colors.textFaint, icon: 'skipped' },
};

/**
 * Formda sunulan uyarı seçenekleri — **gün** cinsinden.
 *
 * Şartnamedeki üçlü (7 / 2 / 1 gün) varsayılan olarak seçili gelir. 14 gün,
 * izin/randevu ayarlaması gerekebilen aileler için eklendi; "aynı gün" ise
 * randevuyu sabah hatırlatır. Liste kısa tutuldu: her seçenek bir bildirim
 * demek ve iOS'ta bekleyen bildirim sayısı 64 ile sınırlı (scheduler.ts).
 */
const OFFSET_CHOICES = [
  { min: 20160, label: '14 gün önce' },
  { min: 10080, label: '7 gün önce' },
  { min: 2880, label: '2 gün önce' },
  { min: 1440, label: '1 gün önce' },
  { min: 0, label: 'Aynı gün' },
];

type SideEffectKey = 'fever' | 'swelling' | 'redness' | 'irritability';

const SIDE_EFFECT_LABELS: Record<SideEffectKey, string> = {
  fever: 'Ateş',
  swelling: 'Şişlik',
  redness: 'Kızarıklık',
  irritability: 'Huzursuzluk',
};

const EMPTY_SIDE_EFFECTS: Record<SideEffectKey, boolean> = {
  fever: false, swelling: false, redness: false, irritability: false,
};

export default function VaccinesScreen() {
  const baby = useBabyStore((s) => s.selected());
  const babyId = baby?.id ?? null;
  const canEdit = useCanEdit();

  const [tab, setTab] = useState<VaccineCategory>('mandatory');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Randevu paneli açık olan aşı. Tek seferde bir tane: ekran zaten uzun. */
  const [planId, setPlanId] = useState<number | null>(null);
  /** Tamamlama paneli açık olan aşı. */
  const [doneId, setDoneId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // ── randevu formu ──
  const [date, setDate] = useState(localDate());
  const [time, setTime] = useState<string | null>(null);
  const [place, setPlace] = useState('');
  const [assignTask, setAssignTask] = useState(false);
  const [assignee, setAssignee] = useState<number | null>(null);
  const [offsets, setOffsets] = useState<number[]>([...VACCINE_OFFSETS]);
  const [deviceAlarm, setDeviceAlarm] = useState(true);

  // ── tamamlama formu ──
  const [doctor, setDoctor] = useState('');
  const [effects, setEffects] = useState<Record<SideEffectKey, boolean>>({ ...EMPTY_SIDE_EFFECTS });
  const [effectNote, setEffectNote] = useState('');

  // ── ekleme formu ──
  const [addMode, setAddMode] = useState<'library' | 'manual'>('library');
  const [defId, setDefId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newDose, setNewDose] = useState('1');
  const [newDate, setNewDate] = useState(localDate());

  const list = useAsyncData(
    () =>
      babyId
        ? vaccineService.list(babyId, { category: [tab] })
        : Promise.resolve({ vaccines: [] }),
    [babyId, tab],
  );
  const members = useAsyncData(
    () => (babyId ? familyService.members(babyId) : Promise.resolve(null)),
    [babyId],
  );
  /*
   * Kütüphane yalnızca ekleme paneli açıkken çekilir: 30 satırlık bir liste
   * her sekme değişiminde gereksiz bir istek olurdu. `addOpen` bağımlılıkta
   * olduğu için panel ilk açıldığında yükleniyor.
   */
  const library = useAsyncData(
    () => (addOpen ? vaccineService.library('optional') : Promise.resolve(null)),
    [addOpen],
  );

  /*
   * `?? []` doğrudan yazılsaydı her render'da yeni bir dizi üretir ve aşağıdaki
   * useMemo'ları her seferinde yeniden hesaplardı (eslint react-hooks bunu
   * uyarı olarak yakalıyor). Boş dizi de bellekte sabit tutuluyor.
   */
  const vaccineData = list.data?.vaccines;
  const definitionData = library.data?.definitions;
  const vaccines = useMemo(() => vaccineData ?? [], [vaccineData]);
  const definitions = useMemo(() => definitionData ?? [], [definitionData]);
  const memberList = members.data?.members ?? [];
  const groups = useMemo(() => groupByMonth(vaccines), [vaccines]);

  /** Kütüphanede olup bu bebekte henüz planlanmamış aşılar. */
  const addable = useMemo<VaccineDefinition[]>(() => {
    const taken = new Set(vaccines.map((v) => v.vaccine_definition_id));
    return definitions.filter((d) => !taken.has(d.id));
  }, [definitions, vaccines]);

  const run = async (fn: () => Promise<unknown>, after: () => void = () => undefined) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      list.reload();
      after();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  /** Randevu panelini aşının mevcut değerleriyle açar. */
  const openPlan = (v: Vaccine) => {
    setDoneId(null);
    setPlanId(v.id);
    setError(null);
    setDate(v.planned_date);
    setTime(v.planned_time);
    setPlace(v.location ?? '');
    setAssignTask(v.assigned_task !== null);
    setAssignee(v.assigned_task?.assignee?.user_id ?? null);
    setOffsets(v.notification_offsets ?? []);
    setDeviceAlarm(v.enable_device_alarm);
  };

  const openDone = (v: Vaccine) => {
    setPlanId(null);
    setDoneId(v.id);
    setError(null);
    setDoctor(v.doctor_name ?? '');
    setEffects({
      fever: v.side_effects?.fever ?? false,
      swelling: v.side_effects?.swelling ?? false,
      redness: v.side_effects?.redness ?? false,
      irritability: v.side_effects?.irritability ?? false,
    });
    setEffectNote(v.side_effects?.note ?? '');
  };

  const savePlan = (v: Vaccine) => {
    if (!place.trim() && assignTask) {
      // Görev bakıcıya "nereye" bilgisi olmadan gidiyorsa işe yaramıyor.
      setError('Görev atamak için yapılacağı yeri de yaz.');
      return;
    }
    void run(
      async () => {
        const { vaccine } = await withSaveFeedback(() => vaccineService.schedule(v.id, {
          planned_date: date,
          planned_time: time,
          location: place.trim() || null,
          assign_task: assignTask,
          assigned_user_id: assignTask ? assignee : null,
          // Tarih ve saat ayrı seçiliyor; sunucu görev için tek bir ISO an
          // bekliyor. Saat yoksa 09:00 — sağlık ocağı açılışı.
          task_due_time: new Date(`${date}T${time ?? '09:00'}:00`).toISOString(),
          notification_offsets: offsets.length ? offsets : null,
          enable_device_alarm: deviceAlarm,
        }));
        // Alarm kurulumu kaydın başarısını etkilemez: izin verilmemişse ya da
        // takvim yoksa sessizce atlanır (vaccineAlarms.ts).
        await onVaccineSaved(vaccine);
        return vaccine;
      },
      () => setPlanId(null),
    );
  };

  const saveDone = (v: Vaccine) => {
    const sideEffects: SideEffects = {
      ...effects,
      note: effectNote.trim() || null,
    };
    void run(
      async () => {
        /*
         * `location` BİLEREK gönderilmiyor. Tamamlama panelinde yer alanı yok;
         * randevu formundaki `place` durumu ise son açılan karta ait. Buradan
         * gönderildiğinde bir aşının yeri başka bir aşının kaydına yazılıyordu
         * (emülatörde görüldü: Hepatit B için girilen merkez, BCG kartında
         * belirdi). Sunucu alanı `COALESCE` ile güncellediği için
         * gönderilmemesi "var olanı koru" demek.
         */
        const { vaccine } = await withSaveFeedback(
          () => vaccineService.complete(v.id, {
            doctor_name: doctor.trim() || null,
            side_effects: sideEffects,
          }),
          // Şartnamedeki "Tamamlandı" listesi aşı tamamlama modalını da
          // kapsıyor; panelde o tetikleyici ayrı duruyor.
          undefined,
          'complete',
        );
        await onVaccineClosed(vaccine);
        return vaccine;
      },
      () => setDoneId(null),
    );
  };

  const setStatus = (v: Vaccine, status: 'pending' | 'skipped') => {
    void run(async () => {
      const { vaccine } = await vaccineService.setStatus(v.id, status);
      // Atlanan aşının alarmı kalkar; geri alınan aşının alarmı yeniden kurulur.
      if (status === 'skipped') await onVaccineClosed(vaccine);
      else await onVaccineSaved(vaccine);
      return vaccine;
    });
  };

  const onDelete = (v: Vaccine) => {
    Alert.alert(
      'Takvimden çıkar',
      `"${v.name}" aşısı takvimden çıkarılsın mı? Kayıt geçmişte görünmeye devam eder.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkar',
          style: 'destructive',
          // Önce alarmlar temizlenir: silinmiş bir kaydın alanını güncellemeye
          // çalışmak 404 verirdi (persist: false).
          onPress: () => void run(async () => {
            await onVaccineClosed(v, false);
            return vaccineService.remove(v.id);
          }),
        },
      ],
    );
  };

  const resetAdd = () => {
    setAddOpen(false);
    setDefId(null);
    setNewName('');
    setNewDose('1');
    setError(null);
  };

  const saveNew = () => {
    if (!babyId) return;
    if (addMode === 'library' && !defId) return setError('Kütüphaneden bir aşı seç.');
    if (addMode === 'manual' && !newName.trim()) return setError('Aşı adı zorunlu.');

    const dose = Number(newDose.trim());
    void run(
      async () => {
        const { vaccine } = await withSaveFeedback(() => vaccineService.create(babyId, {
          vaccine_definition_id: addMode === 'library' ? defId : null,
          custom_vaccine_name: addMode === 'manual' ? newName.trim() : null,
          custom_dose_number:
            addMode === 'manual' && Number.isFinite(dose) && dose > 0 ? dose : null,
          planned_date: newDate,
          notification_offsets: [...VACCINE_OFFSETS],
        }));
        await onVaccineSaved(vaccine);
        return vaccine;
      },
      () => {
        resetAdd();
        // Eklenen aşı hangi sekmeye düştüyse oraya geçilir; aksi hâlde
        // kullanıcı "kaydettim ama görünmüyor" diye düşünürdü.
        setTab(addMode === 'library' ? 'optional' : 'custom');
      },
    );
  };

  if (!baby) {
    return (
      <Screen>
        <EmptyState
          icon="vaccines"
          title="Önce bir bebek profili ekle"
          detail="Aşı takvimi doğum tarihine göre hesaplanır."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ReadOnlyBanner />
      {error ? <FormError message={error} /> : null}

      <Chips
        options={VACCINE_CATEGORIES}
        value={tab}
        onChange={(v) => {
          if (!v) return;
          setTab(v);
          setPlanId(null);
          setDoneId(null);
        }}
        labels={CATEGORY_SHORT}
        disabled={busy}
      />

      <SectionTitle hint={vaccines.length ? listSummary(vaccines) : undefined}>
        {CATEGORY_LABELS[tab]}
      </SectionTitle>

      {/* ── Liste ── */}
      {list.loading && vaccines.length === 0 ? (
        <Card>
          <Loading label="Aşı takvimi yükleniyor…" />
        </Card>
      ) : vaccines.length === 0 ? (
        <Card>
          <Text style={s.hint}>
            {tab === 'mandatory'
              ? 'Ulusal takvim boş görünüyor. Bebek profili eklendiğinde otomatik oluşur.'
              : tab === 'optional'
                ? 'Henüz özel aşı eklenmemiş. Aşağıdaki düğmeyle kütüphaneden ekleyebilirsin.'
                : 'Elle girilmiş aşı yok.'}
          </Text>
        </Card>
      ) : (
        groups.map((group) => (
          <View key={group.key} style={s.group}>
            <Text style={s.groupTitle}>{group.title}</Text>

            {group.items.map((v) => {
              const st = effectiveStatus(v);
              const tone = STATUS_STYLE[st];
              const se = sideEffectSummary(v);
              const closed = v.status !== 'pending';

              return (
                <View key={v.id} style={s.card}>
                  <View style={s.head}>
                    <View style={[s.icon, { backgroundColor: moduleTint.vaccines }]}>
                      <Icon name="vaccines" size={20} color={colors.text} />
                    </View>
                    <View style={s.headText}>
                      <Text style={s.title} numberOfLines={2}>
                        {v.name}
                        {v.dose_number ? ` · ${v.dose_number}. doz` : ''}
                      </Text>
                      <Text style={s.meta} numberOfLines={1}>
                        {whenLabel(v)}
                      </Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: tone.bg }]}>
                      <Icon name={tone.icon} size={12} color={tone.fg} />
                      <Text style={[s.badgeText, { color: tone.fg }]}>{statusLabel(v)}</Text>
                    </View>
                  </View>

                  {v.description ? <Text style={s.note}>{v.description}</Text> : null}

                  {v.location ? (
                    <View style={s.noteRow}>
                      <Icon name="location" size={14} color={colors.textSoft} />
                      <Text style={s.note}>{v.location}</Text>
                    </View>
                  ) : null}

                  {v.doctor_name ? (
                    <View style={s.noteRow}>
                      <Icon name="doctor" size={14} color={colors.textSoft} />
                      <Text style={s.note}>{v.doctor_name}</Text>
                    </View>
                  ) : null}

                  {se ? (
                    <View style={s.noteRow}>
                      <Icon name="fever" size={14} color={colors.warning} />
                      <Text style={s.note}>{se}</Text>
                    </View>
                  ) : null}

                  {/* Atanan görev — aşı kartından kimin götüreceği görünür. */}
                  {v.assigned_task ? (
                    <View style={s.taskRow}>
                      <Icon name="taskVaccine" size={14} color={colors.primary} />
                      <Text style={s.taskText} numberOfLines={1}>
                        {v.assigned_task.assignee
                          ? `${v.assigned_task.assignee.display} götürecek`
                          : 'Göreve atanmadı — aileden herkes üstlenebilir'}
                        {v.assigned_task.status === 'completed' ? ' · tamam' : ''}
                      </Text>
                    </View>
                  ) : null}

                  {v.note ? <Text style={s.note}>{v.note}</Text> : null}

                  {canEdit ? (
                    <View style={s.actions}>
                      {closed ? (
                        <View style={s.actionCol}>
                          <Button
                            label="Geri al"
                            variant="ghost"
                            onPress={() => setStatus(v, 'pending')}
                            disabled={busy}
                          />
                        </View>
                      ) : (
                        <>
                          <View style={s.actionCol}>
                            <Button
                              label="Yapıldı"
                              onPress={() => (doneId === v.id ? setDoneId(null) : openDone(v))}
                              disabled={busy}
                            />
                          </View>
                          <View style={s.actionCol}>
                            <Button
                              label="Randevu"
                              variant="ghost"
                              onPress={() => (planId === v.id ? setPlanId(null) : openPlan(v))}
                              disabled={busy}
                            />
                          </View>
                        </>
                      )}
                    </View>
                  ) : null}

                  {/* ── Randevu ve görev atama paneli ── */}
                  {canEdit && planId === v.id ? (
                    <View style={s.panel}>
                      <Text style={s.panelTitle}>Randevu ve görev</Text>

                      <View style={s.whenRow}>
                        <View style={s.whenCol}>
                          <DateField label="Tarih" value={date} onChange={setDate} disabled={busy} />
                        </View>
                        <View style={s.whenCol}>
                          <TimeField
                            label="Saat (isteğe bağlı)"
                            value={time}
                            onChange={setTime}
                            onClear={() => setTime(null)}
                            disabled={busy}
                          />
                        </View>
                      </View>
                      <Text style={s.hint}>
                        Saat girilmezse uyarılar sabah 09:00&apos;a göre kurulur.
                      </Text>

                      <Text style={s.label}>Yapılacağı yer</Text>
                      <TextInput
                        style={s.input}
                        value={place}
                        onChangeText={setPlace}
                        placeholder="Aile Sağlığı Merkezi"
                        placeholderTextColor={colors.textFaint}
                        editable={!busy}
                      />

                      <Pressable
                        onPress={() => setAssignTask((x) => !x)}
                        disabled={busy}
                        style={s.toggleRow}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: assignTask }}
                      >
                        <View style={[s.box, assignTask && s.boxOn]}>
                          {assignTask ? <Icon name="tick" size={15} color="#FFFFFF" /> : null}
                        </View>
                        <View style={s.toggleText}>
                          <Text style={s.toggleLabel}>Görevi aile üyesine ata</Text>
                          <Text style={s.hint}>
                            Görevler listesinde çıkar; aşı yapıldı işaretlenince kendiliğinden kapanır.
                          </Text>
                        </View>
                      </Pressable>

                      {assignTask ? (
                        <View style={s.chips}>
                          <Pressable
                            onPress={() => setAssignee(null)}
                            disabled={busy}
                            style={[s.chip, assignee === null && s.chipOn]}
                          >
                            <Text style={[s.chipText, assignee === null && s.chipTextOn]}>
                              Herkes
                            </Text>
                          </Pressable>
                          {memberList.map((m) => (
                            <Pressable
                              key={m.user_id}
                              onPress={() => setAssignee(m.user_id)}
                              disabled={busy}
                              style={[s.chip, assignee === m.user_id && s.chipOn]}
                            >
                              <Text
                                style={[s.chipText, assignee === m.user_id && s.chipTextOn]}
                              >
                                {m.relationship_label} {m.full_name.split(' ')[0]}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}

                      <Text style={s.label}>Ne zaman uyarılsın</Text>
                      <View style={s.chips}>
                        {OFFSET_CHOICES.map((o) => {
                          const on = offsets.includes(o.min);
                          return (
                            <Pressable
                              key={o.min}
                              onPress={() => setOffsets((prev) => (
                                prev.includes(o.min)
                                  ? prev.filter((x) => x !== o.min)
                                  : [...prev, o.min]
                              ))}
                              disabled={busy}
                              style={[s.chip, on && s.chipOn]}
                              accessibilityRole="button"
                              accessibilityState={{ selected: on }}
                            >
                              <Text style={[s.chipText, on && s.chipTextOn]}>{o.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text style={s.hint}>{offsetsSummary(offsets)}</Text>

                      <Pressable
                        onPress={() => setDeviceAlarm((x) => !x)}
                        disabled={busy}
                        style={s.toggleRow}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: deviceAlarm }}
                      >
                        <View style={[s.box, deviceAlarm && s.boxOn]}>
                          {deviceAlarm ? <Icon name="tick" size={15} color="#FFFFFF" /> : null}
                        </View>
                        <View style={s.toggleText}>
                          <Text style={s.toggleLabel}>Telefonun takvimine de ekle</Text>
                          <Text style={s.hint}>
                            Uygulama hiç açılmasa da uyarı verir. İlk kullanımda takvim izni istenir.
                          </Text>
                        </View>
                      </Pressable>

                      <View style={s.gap} />
                      <Button
                        label={busy ? 'Kaydediliyor…' : 'Randevuyu kaydet'}
                        onPress={() => savePlan(v)}
                        disabled={busy}
                      />
                      <Button
                        label="Vazgeç"
                        variant="ghost"
                        onPress={() => setPlanId(null)}
                        disabled={busy}
                      />
                      <Pressable
                        onPress={() => setStatus(v, 'skipped')}
                        disabled={busy}
                        style={s.linkRow}
                        accessibilityRole="button"
                      >
                        <Icon name="skipped" size={14} color={colors.textSoft} />
                        <Text style={s.link}>Bu aşıyı atla</Text>
                      </Pressable>
                      {v.category !== 'mandatory' ? (
                        <Pressable
                          onPress={() => onDelete(v)}
                          disabled={busy}
                          style={s.linkRow}
                          accessibilityRole="button"
                        >
                          <Icon name="trash" size={14} color={colors.danger} />
                          <Text style={[s.link, { color: colors.danger }]}>
                            Takvimden çıkar
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}

                  {/* ── Tamamlama paneli ── */}
                  {canEdit && doneId === v.id ? (
                    <View style={s.panel}>
                      <Text style={s.panelTitle}>Aşı yapıldı</Text>

                      <Text style={s.label}>Doktor</Text>
                      <TextInput
                        style={s.input}
                        value={doctor}
                        onChangeText={setDoctor}
                        placeholder="Dr. Ad Soyad"
                        placeholderTextColor={colors.textFaint}
                        editable={!busy}
                      />

                      <Text style={s.label}>Yan etki gözlendi mi</Text>
                      <View style={s.chips}>
                        {(Object.keys(SIDE_EFFECT_LABELS) as SideEffectKey[]).map((k) => {
                          const on = effects[k];
                          return (
                            <Pressable
                              key={k}
                              onPress={() => setEffects((prev) => ({ ...prev, [k]: !prev[k] }))}
                              disabled={busy}
                              style={[s.chip, on && s.chipOn]}
                              accessibilityRole="button"
                              accessibilityState={{ selected: on }}
                            >
                              <Text style={[s.chipText, on && s.chipTextOn]}>
                                {SIDE_EFFECT_LABELS[k]}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text style={s.hint}>
                        Hiçbirini seçmezsen &quot;yan etki yok&quot; olarak kaydedilir.
                      </Text>

                      <Text style={s.label}>Not</Text>
                      <TextInput
                        style={s.input}
                        value={effectNote}
                        onChangeText={setEffectNote}
                        placeholder="Akşam 38 derece ateş, parasetamol verildi…"
                        placeholderTextColor={colors.textFaint}
                        editable={!busy}
                      />

                      <View style={s.gap} />
                      <Button
                        label={busy ? 'Kaydediliyor…' : 'Yapıldı olarak işaretle'}
                        onPress={() => saveDone(v)}
                        disabled={busy}
                      />
                      <Button
                        label="Vazgeç"
                        variant="ghost"
                        onPress={() => setDoneId(null)}
                        disabled={busy}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))
      )}

      {/* ── Aşı ekleme ── */}
      {!canEdit ? null : addOpen ? (
        <>
          <SectionTitle hint="Ulusal takvim otomatik oluşur; buradan yalnızca ek aşı girilir.">
            Aşı ekle
          </SectionTitle>
          <Card>
            <Chips
              options={['library', 'manual'] as const}
              value={addMode}
              onChange={(v) => {
                if (!v) return;
                setAddMode(v);
                setError(null);
              }}
              labels={{ library: 'Kütüphaneden', manual: 'Elle gir' }}
              disabled={busy}
            />

            {addMode === 'library' ? (
              <>
                <Text style={s.label}>Özel / ücretli aşılar</Text>
                {library.loading ? (
                  <Loading label="Kütüphane yükleniyor…" />
                ) : addable.length === 0 ? (
                  <Text style={s.hint}>
                    Kütüphanedeki tüm özel aşılar bu bebek için zaten ekli.
                  </Text>
                ) : (
                  <View style={s.chips}>
                    {addable.map((d) => {
                      const on = defId === d.id;
                      return (
                        <Pressable
                          key={d.id}
                          onPress={() => setDefId(d.id)}
                          disabled={busy}
                          style={[s.chip, on && s.chipOn]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                        >
                          <Text style={[s.chipText, on && s.chipTextOn]}>
                            {d.name} · {d.dose_number}. doz
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                {/* Seçilen tanımın açıklaması ve önerilen yaşı hemen altta. */}
                {defId
                  ? (() => {
                      const d = addable.find((x) => x.id === defId);
                      if (!d) return null;
                      return (
                        <Text style={s.hint}>
                          {ageLabel(d.target_month)}
                          {d.description ? ` — ${d.description}` : ''}
                        </Text>
                      );
                    })()
                  : null}
              </>
            ) : (
              <>
                <Text style={s.label}>Aşı adı *</Text>
                <TextInput
                  style={s.input}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Seyahat aşısı"
                  placeholderTextColor={colors.textFaint}
                  editable={!busy}
                />

                <Text style={s.label}>Kaçıncı doz</Text>
                <TextInput
                  style={s.input}
                  value={newDose}
                  onChangeText={setNewDose}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textFaint}
                  editable={!busy}
                />
              </>
            )}

            <DateField label="Planlanan tarih" value={newDate} onChange={setNewDate} disabled={busy} />
            <Text style={s.hint}>
              Tarih, saat ve yer ayrıntısını kaydettikten sonra &quot;Randevu&quot; ile
              düzenleyebilirsin.
            </Text>

            <View style={s.gap} />
            <Button
              label={busy ? 'Kaydediliyor…' : 'Takvime ekle'}
              onPress={saveNew}
              disabled={busy}
            />
            <Button label="Vazgeç" variant="ghost" onPress={resetAdd} disabled={busy} />
          </Card>
        </>
      ) : (
        <Button label="+ Aşı ekle" onPress={() => setAddOpen(true)} />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  group: { gap: spacing.sm },
  groupTitle: {
    ...typography.small,
    color: colors.textSoft,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1 },
  title: { ...typography.h3, color: colors.text },
  meta: { ...typography.tiny, color: colors.textSoft, marginTop: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: { ...typography.tiny, fontWeight: '700' },

  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  note: { ...typography.small, color: colors.textSoft, flex: 1 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  taskText: { ...typography.tiny, color: colors.primary, fontWeight: '600', flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionCol: { flex: 1 },

  // ── kart içi panel ──
  panel: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
    marginTop: spacing.xs,
  },
  panelTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },

  label: { ...typography.small, color: colors.textSoft, fontWeight: '600', marginTop: spacing.sm },
  hint: { ...typography.small, color: colors.textSoft },
  gap: { height: spacing.sm },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.small, color: colors.textSoft },
  chipTextOn: { color: '#FFFFFF', fontWeight: '700' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { ...typography.body, color: colors.text, fontWeight: '600' },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  link: { ...typography.small, color: colors.textSoft, fontWeight: '600' },

  whenRow: { flexDirection: 'row', gap: spacing.sm },
  whenCol: { flex: 1 },
});
