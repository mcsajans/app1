import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { MomentField, TimeField, toTimeValue } from '../../components/DateTimeField';
import { Chips, TimerDisplay, humanDuration } from '../../components/records';
import { Button, CheckRow, IconTabs } from '../../components/ui';
import {
  MAX_SLEEP_SPAN_SEC, momentFromClock, suggestSleepType, validateWindow, type WindowIssue,
} from '../../core/records/manualWindow';
import { SLEEP_TYPE_LABEL } from '../../core/timers/liveTimer';
import { colors, radius, spacing, typography } from '../../core/theme';
import type { ManualSleepValues } from './ManualSleepSheet';

const QUALITY_LABELS = { rahat: 'Rahat', huzursuz: 'Huzursuz', sik_uyandi: 'Sık uyandı' } as const;
const QUALITIES = ['rahat', 'huzursuz', 'sik_uyandi'] as const;

export type SleepStartRequest = {
  sleepType: 'night' | 'nap';
  /** ISO 8601; `null` → kronometre şu andan başlar. */
  at: string | null;
  note: string | null;
};

/** Girişin iki biçimi: sayaç şimdi akar, ya da olup bitmiş uyku yazılır. */
type Tab = 'now' | 'past';

const TABS = [
  { key: 'now' as const, icon: 'timer' as const, label: 'Anlık' },
  { key: 'past' as const, icon: 'backdate' as const, label: 'Geri tarihli' },
];

const MINUTE = 60_000;
const roundToMinute = (ms: number) => Math.floor(ms / MINUTE) * MINUTE;

/**
 * Uyku sayacının başlangıç paneli — emzirmedeki (§10.6) düzenin aynısı.
 *
 * Eskiden boştaki kartta üç düğme vardı: "Uykuya daldı", "Geçmişten başlat",
 * "Elle kayıt ekle". Sonuncu ikisi aynı alt sayfanın iki moduydu ve ikisi de
 * "saati elle giriyorum" diyordu; aralarındaki asıl fark — biri **açık**
 * kayıt açıyor, diğeri **bitmiş** kayıt yazıyor — ancak düğme yazısından
 * anlaşılıyordu. Artık ayrım sekmede:
 *
 * - *Anlık* — bebek **şu an uyuyor**. Sayaç çalışır; istenirse birkaç saat
 *   geriden başlatılır (kutucuk).
 * - *Geri tarihli* — uyku **bitti**. Başlangıç, bitiş, kalite ve not girilir,
 *   kayıt doğrudan tamamlanmış yazılır.
 *
 * Uyku tipi sekmelerin **üstünde** durur: iki biçimde de sorulan tek alan o.
 */
export function SleepStartPanel({
  busy,
  disabled,
  onStart,
  onManualSave,
}: {
  busy: boolean;
  /** Salt okuma yetkisi — alanlar görünür ama dokunulamaz. */
  disabled: boolean;
  onStart: (req: SleepStartRequest) => void;
  /** Geri tarihli sekmesinden gelen tamamlanmış kayıt. */
  onManualSave: (values: ManualSleepValues) => void;
}) {
  const [tab, setTab] = useState<Tab>('now');
  const [sleepType, setSleepType] = useState<'night' | 'nap'>(() => suggestSleepType(Date.now()));
  /** Tip ÖNERİ: kullanıcı elle seçtiyse saatten bir daha türetilmez. */
  const [typeTouched, setTypeTouched] = useState(false);
  const [backdate, setBackdate] = useState(false);
  /** 'SS:DD'; yalnızca kutucuk işaretliyken kullanılır. */
  const [time, setTime] = useState<string | null>(null);
  /* Geri tarihli sekmesinin uçları; `NaN` → sekme hiç açılmadı. */
  const [startMs, setStartMs] = useState(Number.NaN);
  const [endMs, setEndMs] = useState(Number.NaN);
  const [quality, setQuality] = useState<(typeof QUALITIES)[number] | null>(null);
  /** Not iki sekmede de aynı kaydın notu; sekme değişince korunur. */
  const [note, setNote] = useState('');
  const [issue, setIssue] = useState<string | null>(null);
  const [windowIssue, setWindowIssue] = useState<WindowIssue | null>(null);

  /*
   * Varsayılan saatler sekme AÇILIRKEN hesaplanır, bileşen monte edilirken
   * değil: panel boştaki kartın içinde saatlerce açık kalabiliyor ve
   * `useState` başlatıcısıyla hesaplanan "bir saat önce" o sırada çoktan
   * eskimiş olurdu. Olay işleyicisinde `Date.now()` okumak ayrıca React
   * derleyicisinin saflık kuralına da takılmaz.
   */
  const openTab = (next: Tab) => {
    setTab(next);
    setIssue(null);
    setWindowIssue(null);
    if (next === 'past' && !Number.isFinite(startMs)) {
      const now = Date.now();
      const start = roundToMinute(now - 60 * MINUTE);
      setStartMs(start);
      setEndMs(roundToMinute(now));
      if (!typeTouched) setSleepType(suggestSleepType(start));
    }
  };

  const toggleBackdate = (next: boolean) => {
    setBackdate(next);
    // Varsayılan şu anki saat: kutucuğu işaretleyen çoğu kişi saati birkaç
    // dakika geri alacak, sıfırdan girmeyecek.
    if (next && time === null) setTime(toTimeValue(new Date()));
    setIssue(null);
  };

  const changeStart = (ms: number) => {
    setStartMs(ms);
    setWindowIssue(null);
    if (!typeTouched) setSleepType(suggestSleepType(ms));
  };

  const trimmedNote = () => (note.trim() ? note.trim() : null);

  const start = () => {
    if (!backdate) {
      onStart({ sleepType, at: null, note: trimmedNote() });
      return;
    }

    const ms = momentFromClock(time);
    if (!Number.isFinite(ms)) {
      setIssue('Uykuya dalma saatini seç.');
      return;
    }
    /*
     * Sunucu da aynı tavanı uyguluyor (§11.1); burada söylemek düzeltmeyi
     * tek dokunuşa indiriyor. Saat-yalnız giriş zaten en fazla 24 saat
     * geriye gidebiliyor, yani bu sınır pratikte "dün bu saatten önce"yi
     * eler.
     */
    if ((Date.now() - ms) / 1000 > MAX_SLEEP_SPAN_SEC) {
      setIssue('Sayaç en fazla 24 saat öncesinden başlatılabilir.');
      return;
    }
    onStart({ sleepType, at: new Date(ms).toISOString(), note: trimmedNote() });
  };

  const savePast = () => {
    const found = validateWindow({ startMs, endMs, maxSpanSec: MAX_SLEEP_SPAN_SEC });
    if (found) {
      setWindowIssue(found);
      return;
    }
    onManualSave({
      sleepType,
      startedAt: new Date(startMs).toISOString(),
      endedAt: new Date(endMs).toISOString(),
      quality,
      note: trimmedNote(),
    });
  };

  const spanSec = Math.max(0, Math.round((endMs - startMs) / 1000));

  return (
    <>
      <Text style={s.label}>Uyku tipi</Text>
      <Chips
        options={['nap', 'night'] as const}
        value={sleepType}
        onChange={(v) => {
          if (!v) return;
          setSleepType(v);
          setTypeTouched(true);
        }}
        labels={SLEEP_TYPE_LABEL}
        disabled={busy || disabled}
      />

      <View style={s.gap} />
      <IconTabs tabs={TABS} value={tab} onChange={openTab} disabled={busy} />

      {tab === 'now' ? (
        <>
          <TimerDisplay seconds={0} />

          <CheckRow
            label="Sayacı önceki bir zamandan başlat"
            checked={backdate}
            onToggle={toggleBackdate}
            disabled={busy || disabled}
          />

          {backdate ? (
            <>
              <TimeField
                label="Uykuya dalma saati"
                value={time}
                onChange={(t) => {
                  setTime(t);
                  setIssue(null);
                }}
                disabled={busy || disabled}
              />
              {/*
                Tarih bilerek sorulmuyor: girilen saat ileride kalıyorsa dünkü
                uyku sayılır. Gece uykusunda en sık senaryo tam da bu — sabah
                07:00'de "22:00'de daldı" demek.
              */}
              <Text style={s.hint}>Yalnızca saat; ileri bir saat girilirse dün sayılır.</Text>
            </>
          ) : null}
        </>
      ) : (
        <>
          <MomentField
            label="Uykuya daldı"
            value={startMs}
            onChange={changeStart}
            disabled={busy || disabled}
            error={windowIssue?.field === 'start' ? windowIssue.message : null}
          />
          <MomentField
            label="Uyandı"
            value={endMs}
            onChange={(ms) => {
              setEndMs(ms);
              setWindowIssue(null);
            }}
            disabled={busy || disabled}
            error={windowIssue?.field === 'end' ? windowIssue.message : null}
          />
          <View style={s.duration}>
            <Text style={s.durationLabel}>Süre</Text>
            <Text style={s.durationValue}>{spanSec > 0 ? humanDuration(spanSec) : '—'}</Text>
          </View>

          {/* Kalite yalnızca burada sorulur: anlık sayaçta uyku daha bitmedi. */}
          <Text style={s.label}>Uyku kalitesi</Text>
          <Chips
            options={QUALITIES}
            value={quality}
            onChange={setQuality}
            labels={QUALITY_LABELS}
            disabled={busy || disabled}
            allowClear
          />
        </>
      )}

      <TextInput
        style={s.note}
        value={note}
        onChangeText={setNote}
        placeholder="Notunuz varsa buraya yazınız"
        placeholderTextColor={colors.textFaint}
        editable={!busy && !disabled}
        multiline
        maxLength={500}
      />

      {issue ? <Text style={s.issue}>{issue}</Text> : null}

      <Button
        label={
          tab === 'now'
            ? busy
              ? 'Başlatılıyor…'
              : backdate
                ? 'Seçilen saatten başlat'
                : 'Uykuya daldı'
            : busy
              ? 'Kaydediliyor…'
              : 'Bilgileri kaydet'
        }
        onPress={tab === 'now' ? start : savePast}
        disabled={busy || disabled}
      />
    </>
  );
}

const s = StyleSheet.create({
  label: { ...typography.small, color: colors.textSoft, fontWeight: '600', marginTop: spacing.sm },
  hint: { ...typography.tiny, color: colors.textFaint, textAlign: 'center' },
  issue: { ...typography.small, color: colors.danger, textAlign: 'center' },
  gap: { height: spacing.xs },
  duration: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  durationLabel: { ...typography.small, color: colors.textSoft },
  durationValue: { ...typography.h3, color: colors.text },
  note: {
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    textAlignVertical: 'top',
    marginTop: spacing.sm,
  },
});
