import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chips, clockOf } from '../../components/records';
import { DateField, TimeField } from '../../components/DateTimeField';
import { ReadOnlyBanner, useCanEdit } from '../../components/permission';
import { Button, Card, EmptyState, FormError, Loading, Screen, SectionTitle } from '../../components/ui';
import { errorText } from '../../core/api/client';
import {
  TASK_TYPES, familyService, localDate, taskService, tzOffsetMin,
  type Task, type TaskDetails, type TaskType,
} from '../../core/api/modules';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { DEFAULT_OFFSETS, offsetsSummary } from '../../core/notifications/alarmPlan';
import { onTaskClosed, onTaskSaved } from '../../core/notifications/taskAlarms';
import { useAuthStore } from '../../core/auth/useAuthStore';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { Icon } from '../../components/Icon';
import { colors, moduleTint, radius, shadow, spacing, typography } from '../../core/theme';
import {
  TASK_STATUS_LABELS, TASK_TYPE_ICONS, TASK_TYPE_LABELS,
  canBecomeRecord, isOverdue, recipeLine,
} from './taskFormat';
import { showAdAfterAction } from '../../core/ads/adService';
import { withSaveFeedback } from '../../core/feedback/withSaveFeedback';

/**
 * Not alanının ipucu metni görev türüne göre değişir: mama tarifine ait
 * "önce sıcak suyu koy" ipucu bir banyo görevinde yanıltıcı duruyordu.
 */
const NOTE_PLACEHOLDER: Record<TaskType, string> = {
  formula_prep: 'Önce sıcak suyu koy, sonra mamayı ekle…',
  breast_milk_feed: 'Buzdolabından çıkarıp ılıt, mikrodalga kullanma…',
  medicine: 'Tok karnına ver…',
  care: 'Suyu fazla sıcak yapma…',
  vaccine: 'Aşı karnesini almayı unutma…',
  custom: 'Eklemek istediğin ayrıntı…',
};

/**
 * Formda sunulan uyarı seçenekleri.
 *
 * Şartnamedeki dörtlü (30/15/5/0) varsayılan olarak seçili gelir; 60 ve 120
 * dakika, mama hazırlığı gibi önceden iş gerektiren görevler için eklendi.
 * Liste kısa tutuldu — her ek seçenek bir bildirim demek ve iOS'ta toplam
 * bekleyen bildirim sayısı 64 ile sınırlı (scheduler.ts).
 */
const OFFSET_CHOICES = [120, 60, 30, 15, 5, 0];

/** Varsayılan saat: "şimdi"den sonraki tam saat — görev geçmişe düşmesin. */
function nextHour(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

/**
 * Modül 13 — Görevler.
 *
 * Aileden birine somut bir iş atar. Hatırlatıcıdan farkı: hatırlatıcı cihaza
 * alarm kurar, görev **kişiye** atanır ve durumu izlenir — kim üstlendi, bitti
 * mi, kim bitirdi.
 *
 * Mama görevinde tarif (ml / ölçek / sıcak-soğuk su) kartın üstünde belirgin
 * durur: bakıcının ihtiyacı olan tek şey o satırdır.
 */
export default function TasksScreen() {
  const baby = useBabyStore((s) => s.selected());
  const babyId = baby?.id ?? null;
  const myUserId = useAuthStore((s) => s.user?.id ?? null);
  const canEdit = useCanEdit();

  const [showDone, setShowDone] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Düzenlenen görev; null ise form "yeni görev" kipindedir. */
  const [editing, setEditing] = useState<Task | null>(null);

  // ── form ──
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('formula_prep');
  const [assignee, setAssignee] = useState<number | null>(null);
  const [date, setDate] = useState(localDate());
  const [time, setTime] = useState(nextHour());
  const [amount, setAmount] = useState('150');
  const [scoops, setScoops] = useState('5');
  const [hot, setHot] = useState('90');
  const [cold, setCold] = useState('60');
  const [dose, setDose] = useState('');
  const [note, setNote] = useState('');
  /** Kaç dakika önce uyarılacağı; boş liste "bildirim yok" demektir. */
  const [offsets, setOffsets] = useState<number[]>([...DEFAULT_OFFSETS]);
  const [deviceAlarm, setDeviceAlarm] = useState(true);

  const list = useAsyncData(
    () =>
      babyId
        ? taskService.list(babyId, {
            status: showDone ? ['completed', 'cancelled'] : ['pending', 'in_progress'],
          })
        : Promise.resolve({ tasks: [] }),
    [babyId, showDone],
  );
  const members = useAsyncData(
    () => (babyId ? familyService.members(babyId) : Promise.resolve(null)),
    [babyId],
  );

  const tasks = list.data?.tasks ?? [];
  const memberList = members.data?.members ?? [];
  /*
   * Seçenek listesinde olmayan bir ofset düzenlemede kaybolmasın: görev başka
   * bir istemciden gelmiş olabilir ve karşılığı yoksa kaydetmek onu sessizce
   * silerdi.
   */
  const offsetChoices = [...new Set([...OFFSET_CHOICES, ...offsets])].sort((a, b) => b - a);

  const reset = () => {
    setTitle('');
    setNote('');
    setDose('');
    setOpen(false);
    setEditing(null);
    setError(null);
  };

  /**
   * Görevi forma yükler.
   *
   * **Tüm** alanlar doldurulur. Yalnızca başlığı taşıyıp gerisini formun
   * varsayılanında bırakmak, kullanıcı sadece saati değiştirse bile tarifi
   * sessizce "150 ml / 5 ölçek"e döndürürdü.
   */
  const startEdit = (task: Task) => {
    const d = task.instruction_details;
    const text = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

    setEditing(task);
    setTitle(task.title);
    setType(task.task_type);
    setAssignee(task.assignee?.user_id ?? null);
    // `due_time` UTC gelir; form yerel tarih ve saatle çalışıyor.
    setDate(localDate(new Date(task.due_time)));
    setTime(clockOf(task.due_time));
    setAmount(text(d?.formula_amount_ml));
    setScoops(text(d?.formula_scoops));
    setHot(text(d?.hot_water_ml));
    setCold(text(d?.cold_water_ml));
    setDose(d?.dose ?? '');
    setNote(task.note ?? '');
    setOffsets(task.notification_offsets ?? []);
    setDeviceAlarm(task.enable_device_alarm);
    setError(null);
    setOpen(true);
  };

  /*
   * "Düzenle" yalnızca görevi AÇANA çıkar: atanan kişinin işi görevi yapmak,
   * kapsamını değiştirmek değil. Sunucu yetkiyi `editor` seviyesinde tutuyor
   * (TEKNIK_DOKUMAN §22.11) — bu kısıt arayüzün kararı.
   *
   * Aşı görevi dışarıda kalır: o, randevunun kopyasıdır
   * (`vaccines.assigned_task_id`) ve saatini buradan değiştirmek görevi
   * randevudan ayırırdı. Aşı görevi Aşı Takibi ekranından düzenlenir.
   */
  const canEditTask = (task: Task) =>
    task.creator.user_id === myUserId && task.task_type !== 'vaccine';

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

  /** Form alanlarından tarif nesnesini kurar; boş alanlar hiç gönderilmez. */
  const buildDetails = (): TaskDetails | null => {
    const n = (v: string) => {
      const parsed = Number(v.trim().replace(',', '.'));
      return v.trim() !== '' && Number.isFinite(parsed) ? parsed : undefined;
    };

    /*
     * Formda karşılığı OLMAYAN alanlar düzenlemede korunur: `special_notes`
     * ve `pumping_stash_id` başka uçlardan yazılıyor (sağılmış süt stoğu, dış
     * istemciler) ve yalnızca saati değiştiren bir düzenleme onları sessizce
     * silerdi. Tür değiştiyse taşınmaz — yeni türün şeması başka.
     */
    const kept: TaskDetails = editing && editing.task_type === type && editing.instruction_details
      ? {
          ...(editing.instruction_details.special_notes
            ? { special_notes: editing.instruction_details.special_notes }
            : {}),
          ...(editing.instruction_details.pumping_stash_id
            ? { pumping_stash_id: editing.instruction_details.pumping_stash_id }
            : {}),
        }
      : {};

    if (type === 'formula_prep') {
      return {
        ...kept,
        formula_amount_ml: n(amount),
        formula_scoops: n(scoops),
        hot_water_ml: n(hot),
        cold_water_ml: n(cold),
      };
    }
    if (type === 'breast_milk_feed') return { ...kept, formula_amount_ml: n(amount) };
    if (type === 'medicine') {
      const value = dose.trim() ? { ...kept, dose: dose.trim() } : kept;
      return Object.keys(value).length ? value : null;
    }
    return Object.keys(kept).length ? kept : null;
  };

  const save = () => {
    if (!babyId) return;
    if (!title.trim()) return setError('Görev başlığı zorunlu.');

    const details = buildDetails();
    if (type === 'formula_prep') {
      const total = details?.formula_amount_ml;
      if (!total) return setError('Mama görevinde toplam miktar zorunlu.');
      const water = (details?.hot_water_ml ?? 0) + (details?.cold_water_ml ?? 0);
      // Sunucu da aynı kuralı uygular; burada erken söylemek ağ turunu önler.
      if (water > total) return setError('Su miktarı toplam hacmi aşamaz — mama tozu da yer kaplar.');
    }

    const fields = {
      title: title.trim(),
      task_type: type,
      // Tarih ve saat ayrı seçiliyor; sunucu tek bir ISO an bekliyor.
      due_time: new Date(`${date}T${time}:00`).toISOString(),
      assigned_user_id: assignee,
      instruction_details: details,
      note: note.trim() || null,
      notification_offsets: offsets.length ? offsets : null,
      enable_device_alarm: deviceAlarm,
    };
    // Kayıt sırasında form sıfırlanıyor; hedef görev şimdi yakalanır.
    const target = editing;

    void run(
      async () => {
        const { task } = await withSaveFeedback(() => (target
          ? taskService.update(target.id, {
              ...fields,
              // Düzenlemede saat dilimi de tazelenir: görev başka bir yerde
              // açılmış olabilir ve günlük süzgeç bu alana bakıyor.
              tz_offset_min: tzOffsetMin(),
            })
          : taskService.create(babyId, fields)));
        /*
         * Alarm kurulumu kaydın başarısını etkilemez: izin verilmemişse ya da
         * takvim yoksa sessizce atlanır (taskAlarms.ts). Düzenlemede
         * `onTaskSaved` önce eski bildirimleri iptal eder, sonra yenilerini
         * kurar ve takvim kaydını **günceller** — ikinci etkinlik açılmaz.
         */
        await onTaskSaved(task);
        return task;
      },
      reset,
    );
  };

  /** Durum değişince bekleyen bildirimler ve takvim kaydı temizlenir. */
  const closeAlarms = async (task: Task) => {
    await onTaskClosed(task);
  };

  /**
   * "Tamamlandı" — reklam tetiği burada tek tek bağlanıyor çünkü bu akış
   * `withSaveFeedback` sarmalayıcısından GEÇMİYOR (Reklam.md §2 Adım 3).
   * Üç dalın hepsinde kural aynı: önce kayıt (`await`), sonra reklam.
   */
  const complete = (task: Task) => {
    if (!canBecomeRecord(task)) {
      void run(async () => {
        const res = await taskService.setStatus(task.id, 'completed');
        await closeAlarms(task);
        showAdAfterAction('complete');
        return res;
      });
      return;
    }
    // Miktar bilgisi taşıyan görev beslenme kaydına dönüşebilir; sessizce
    // kayıt üretmek "yapıldı" demek isteyen kullanıcıyı şaşırtırdı.
    const label = task.task_type === 'formula_prep' ? 'biberon' : 'anne sütü';
    Alert.alert(
      'Görevi tamamla',
      `${task.instruction_details?.formula_amount_ml} ml ${label} kaydı da oluşturulsun mu?`,
      [
        {
          text: 'Yalnızca görevi bitir',
          onPress: () => void run(async () => {
            const res = await taskService.setStatus(task.id, 'completed');
            await closeAlarms(task);
            showAdAfterAction('complete');
            return res;
          }),
        },
        {
          text: 'Kayıt da oluştur',
          onPress: () => void run(async () => {
            const res = await taskService.setStatus(task.id, 'completed', true);
            await closeAlarms(task);
            showAdAfterAction('complete');
            return res;
          }),
        },
        { text: 'Vazgeç', style: 'cancel' },
      ],
    );
  };

  const onDelete = (task: Task) => {
    Alert.alert('Görevi sil', `"${task.title}" silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        // Önce alarmlar temizlenir: silinmiş bir görevin `device_alarm_ids`
        // alanını güncellemeye çalışmak 404 verirdi (persist: false).
        onPress: () => void run(async () => {
          await onTaskClosed(task, false);
          return taskService.remove(task.id);
        }),
      },
    ]);
  };

  if (!baby) {
    return (
      <Screen>
        <EmptyState icon="tasks" title="Önce bir bebek profili ekle" detail="Görevler seçili bebeğe bağlı tutulur." />
      </Screen>
    );
  }

  /*
   * Form tek yerde tanımlanır, iki yerde çizilir: yeni görev listenin
   * ALTINDA, düzenleme listenin ÜSTÜNDE açılır. Düzenleme de altta açılsaydı
   * uzun bir listede ekranın dışında kalır ve "Düzenle" düğmesi hiçbir şey
   * yapmamış gibi görünürdü.
   */
  const form = (
    <>
      <SectionTitle
        hint={editing
          ? 'Değişiklik atanan kişiye ve görevi açana bildirilir.'
          : 'Atanan kişi görevi listesinde görür ve tamamlar.'}
      >
        {editing ? 'Görevi düzenle' : 'Yeni görev'}
      </SectionTitle>
      <Card>
        <Text style={s.label}>Görev türü</Text>
        <Chips
          options={TASK_TYPES}
          value={type}
          onChange={(v) => v && setType(v)}
          labels={TASK_TYPE_LABELS}
          // Tür chip'i, listedeki kartla aynı simgeyi gösterir; seçim
          // sonrası kartı görünce "doğru olanı seçmişim" hissi veriyor.
          icons={TASK_TYPE_ICONS}
          disabled={busy}
        />

        <Text style={s.label}>Başlık *</Text>
        <TextInput
          style={s.input}
          value={title}
          onChangeText={setTitle}
          placeholder={type === 'formula_prep' ? 'Akşam maması' : 'Görev başlığı'}
          placeholderTextColor={colors.textFaint}
          editable={!busy}
        />

        <Text style={s.label}>Kime atanacak</Text>
        <View style={s.chips}>
          <Pressable
            onPress={() => setAssignee(null)}
            disabled={busy}
            style={[s.chip, assignee === null && s.chipOn]}
          >
            <Text style={[s.chipText, assignee === null && s.chipTextOn]}>Herkes</Text>
          </Pressable>
          {memberList.map((m) => (
            <Pressable
              key={m.user_id}
              onPress={() => setAssignee(m.user_id)}
              disabled={busy}
              style={[s.chip, assignee === m.user_id && s.chipOn]}
            >
              <Text style={[s.chipText, assignee === m.user_id && s.chipTextOn]}>
                {m.relationship_label} {m.full_name.split(' ')[0]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={s.whenRow}>
          <View style={s.whenCol}>
            <DateField label="Tarih" value={date} onChange={setDate} disabled={busy} />
          </View>
          <View style={s.whenCol}>
            <TimeField label="Saat" value={time} onChange={setTime} disabled={busy} />
          </View>
        </View>

        {/* ── Mama tarifi ── */}
        {type === 'formula_prep' || type === 'breast_milk_feed' ? (
          <>
            <Text style={s.label}>Toplam miktar (ml) *</Text>
            <TextInput
              style={s.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textFaint}
              editable={!busy}
            />
          </>
        ) : null}

        {type === 'formula_prep' ? (
          <>
            <Text style={s.label}>Kaç ölçek mama</Text>
            <TextInput
              style={s.input}
              value={scoops}
              onChangeText={setScoops}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textFaint}
              editable={!busy}
            />

            <View style={s.whenRow}>
              <View style={s.whenCol}>
                <Text style={s.label}>Sıcak su (ml)</Text>
                <TextInput
                  style={s.input}
                  value={hot}
                  onChangeText={setHot}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textFaint}
                  editable={!busy}
                />
              </View>
              <View style={s.whenCol}>
                <Text style={s.label}>Soğuk su (ml)</Text>
                <TextInput
                  style={s.input}
                  value={cold}
                  onChangeText={setCold}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textFaint}
                  editable={!busy}
                />
              </View>
            </View>
          </>
        ) : null}

        {type === 'medicine' ? (
          <>
            <Text style={s.label}>Doz</Text>
            <TextInput
              style={s.input}
              value={dose}
              onChangeText={setDose}
              placeholder="5 damla"
              placeholderTextColor={colors.textFaint}
              editable={!busy}
            />
          </>
        ) : null}

        <Text style={s.label}>Ne zaman uyarılsın</Text>
        <View style={s.chips}>
          {offsetChoices.map((o) => {
            const on = offsets.includes(o);
            return (
              <Pressable
                key={o}
                onPress={() => setOffsets((prev) => (
                  prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
                ))}
                disabled={busy}
                style={[s.chip, on && s.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[s.chipText, on && s.chipTextOn]}>
                  {o === 0 ? 'Tam zamanında' : `${o} dk önce`}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.hint}>{offsetsSummary(offsets)}</Text>

        <Pressable
          onPress={() => setDeviceAlarm((v) => !v)}
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

        <Text style={s.label}>Not</Text>
        <TextInput
          style={s.input}
          value={note}
          onChangeText={setNote}
          placeholder={NOTE_PLACEHOLDER[type]}
          placeholderTextColor={colors.textFaint}
          editable={!busy}
        />

        <View style={s.gap} />
        <Button
          label={busy ? 'Kaydediliyor…' : editing ? 'Değişiklikleri kaydet' : 'Görevi oluştur'}
          onPress={save}
          disabled={busy}
        />
        <Button label="Vazgeç" variant="ghost" onPress={reset} disabled={busy} />
      </Card>
    </>
  );

  return (
    <Screen>
      <ReadOnlyBanner />
      {error ? <FormError message={error} /> : null}

      {editing ? form : null}

      <Chips
        options={['open', 'done'] as const}
        value={showDone ? 'done' : 'open'}
        onChange={(v) => v && setShowDone(v === 'done')}
        labels={{ open: 'Açık görevler', done: 'Tamamlananlar' }}
      />

      {/* ── Liste ── */}
      <View style={s.feed}>
        {list.loading && tasks.length === 0 ? (
          <Card>
            <Loading label="Görevler yükleniyor…" />
          </Card>
        ) : tasks.length === 0 ? (
          <Card>
            <Text style={s.hint}>
              {showDone ? 'Tamamlanmış görev yok.' : 'Açık görev yok.'}
            </Text>
          </Card>
        ) : (
          tasks.map((t) => {
            const recipe = recipeLine(t.task_type, t.instruction_details);
            const overdue = isOverdue(t);
            const mine = t.assignee?.user_id === myUserId;
            return (
              <View key={t.id} style={s.card}>
                <View style={s.head}>
                  <View style={[s.icon, { backgroundColor: moduleTint.tasks }]}>
                    <Icon name={TASK_TYPE_ICONS[t.task_type]} size={22} color={colors.text} />
                  </View>
                  <View style={s.headText}>
                    <Text style={s.title} numberOfLines={2}>
                      {t.title}
                    </Text>
                    <Text style={s.meta} numberOfLines={1}>
                      {clockOf(t.due_time)} · {TASK_TYPE_LABELS[t.task_type]}
                      {t.assignee ? ` · ${mine ? 'sana atandı' : t.assignee.display}` : ' · atanmadı'}
                    </Text>
                  </View>
                  <View style={[s.badge, overdue && s.badgeLate, t.status === 'completed' && s.badgeDone]}>
                    <Text style={[s.badgeText, overdue && s.badgeTextLate, t.status === 'completed' && s.badgeTextDone]}>
                      {overdue ? 'Gecikti' : TASK_STATUS_LABELS[t.status]}
                    </Text>
                  </View>
                </View>

                {/* Tarif satırı — bakıcının ihtiyacı olan tek bilgi. */}
                {recipe ? (
                  <View style={s.recipe}>
                    <Text style={s.recipeText}>{recipe}</Text>
                  </View>
                ) : null}

                {t.instruction_details?.special_notes ? (
                  <View style={s.noteRow}>
                    <Icon name="warning" size={16} color={colors.warning} />
                    <Text style={s.note}>{t.instruction_details.special_notes}</Text>
                  </View>
                ) : null}
                {t.note ? <Text style={s.note}>{t.note}</Text> : null}

                {t.status === 'completed' && t.completed_by_name ? (
                  <View style={s.noteRow}>
                    <Icon name="check" size={16} color={colors.success} />
                    <Text style={s.doneBy}>{t.completed_by_name} tamamladı</Text>
                  </View>
                ) : null}

                {canEdit && t.status !== 'completed' && t.status !== 'cancelled' ? (
                  <>
                    <View style={s.actions}>
                      <View style={s.actionCol}>
                        <Button
                          label="Tamamlandı"
                          onPress={() => complete(t)}
                          disabled={busy}
                        />
                      </View>
                    </View>
                    {/*
                      * İkinci sıra: ikisi de ikincil eylem. Üçünü tek sıraya
                      * dizmek "Tamamlandı" yazısını üç parçaya bölüyordu.
                      */}
                    <View style={s.actions}>
                      {canEditTask(t) ? (
                        <View style={s.actionCol}>
                          <Button
                            label="Düzenle"
                            variant="ghost"
                            onPress={() => startEdit(t)}
                            disabled={busy}
                          />
                        </View>
                      ) : null}
                      <View style={s.actionCol}>
                        <Button label="Sil" variant="ghost" onPress={() => onDelete(t)} disabled={busy} />
                      </View>
                    </View>
                  </>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      {/* ── Oluşturma formu ── */}
      {!canEdit || editing ? null : open ? form : (
        <Button label="+ Yeni görev" onPress={() => setOpen(true)} />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  feed: { gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1 },
  title: { ...typography.h3, color: colors.text },
  meta: { ...typography.tiny, color: colors.textSoft, marginTop: 1 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  badgeLate: { backgroundColor: '#FDECEC' },
  badgeDone: { backgroundColor: '#E6F6EC' },
  badgeText: { ...typography.tiny, color: colors.textSoft, fontWeight: '700' },
  badgeTextLate: { color: colors.danger },
  badgeTextDone: { color: colors.success },

  recipe: {
    backgroundColor: moduleTint.tasks,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  recipeText: { ...typography.body, color: colors.text, fontWeight: '700' },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  note: { ...typography.small, color: colors.textSoft },
  doneBy: { ...typography.tiny, color: colors.success, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionCol: { flex: 1 },

  label: { ...typography.small, color: colors.textSoft, fontWeight: '600', marginTop: spacing.sm },
  hint: { ...typography.small, color: colors.textSoft },
  gap: { height: spacing.sm },
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

  // ── takvim anahtarı ──
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
  tick: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', lineHeight: 18 },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { ...typography.body, color: colors.text, fontWeight: '600' },
  chipText: { ...typography.small, color: colors.textSoft },
  chipTextOn: { color: '#FFFFFF', fontWeight: '700' },
  whenRow: { flexDirection: 'row', gap: spacing.sm },
  whenCol: { flex: 1 },
});
