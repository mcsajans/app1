import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MomentField, TimeField, toTimeValue } from '../../components/DateTimeField';
import { Icon } from '../../components/Icon';
import { TimerDisplay, humanDuration } from '../../components/records';
import { Button, ButtonRow, CheckRow, IconTabs } from '../../components/ui';
import {
  MAX_BREAST_SPAN_SEC, momentFromClock, validateWindow, type WindowIssue,
} from '../../core/records/manualWindow';
import { SIDE_LABEL } from '../../core/timers/liveTimer';
import { colors, radius, spacing, typography } from '../../core/theme';
import type { ManualBreastValues } from './ManualSessionSheet';

export type StartRequest = {
  side: 'left' | 'right';
  /** ISO 8601; `null` → kronometre şu andan başlar. */
  at: string | null;
  note: string | null;
};

/** Girişin iki biçimi: sayaç şimdi akar, ya da olup bitmiş kayıt yazılır. */
type Tab = 'now' | 'past';

const TABS = [
  { key: 'now' as const, icon: 'timer' as const, label: 'Anlık' },
  { key: 'past' as const, icon: 'backdate' as const, label: 'Geri tarihli' },
];

const MINUTE = 60_000;
const roundToMinute = (ms: number) => Math.floor(ms / MINUTE) * MINUTE;

/**
 * Emzirme sayacının başlangıç paneli — iki adım.
 *
 * 1. **Taraf seçimi.** Modüle girildiğinde ekranda yalnızca iki meme kutusu
 *    durur. Önceden burada dört düğme vardı (Sol, Sağ, "Geçmişten başlat",
 *    "Elle kayıt ekle") ve en sık yapılan iş (sayacı başlatmak) diğer üçüyle
 *    aynı görsel ağırlıktaydı. Emzirmeye başlarken bebek kucakta ve tek el
 *    boşta: büyük iki hedef, dört küçük düğmeden iyi.
 * 2. **Giriş.** Taraf seçilince ekran **iki sekmeye** ayrılır:
 *    - *Anlık* — sayaç 00:00'da bekler; not yazılabilir, istenirse
 *      "önceki bir zamandan başlat" kutucuğu işaretlenir. Emzirme **şu an
 *      sürüyor**.
 *    - *Geri tarihli* — emzirme **bitmiş**; başlangıç, bitiş ve not girilip
 *      kayıt doğrudan tamamlanmış yazılır.
 *
 * Ayrımı sekmeye taşımanın sebebi: ikisi de "geçmiş bir saat" soruyor ama
 * sonuçları bambaşka (biri açık seans, biri bitmiş kayıt). Aynı formda
 * yan yana durduklarında hangisinin ne yaptığı ancak düğme yazısından
 * anlaşılıyordu.
 *
 * Geri alma kolay: "Vazgeç" taraf seçimine döner, hiçbir istek gitmemiştir.
 */
export function StartPanel({
  nextSide,
  busy,
  disabled,
  onStart,
  onManual,
  onManualSave,
}: {
  /** Son emzirilen tarafın tersi — kutulardan biri "sırada" rozeti alır. */
  nextSide: 'left' | 'right' | null;
  busy: boolean;
  /** Salt okuma yetkisi — kutular görünür ama dokunulamaz. */
  disabled: boolean;
  onStart: (req: StartRequest) => void;
  /** İki memeli ayrıntılı kaydı açar (süre paylaştırmalı alt sayfa). */
  onManual: () => void;
  /** Geri tarihli sekmesinden gelen tamamlanmış seans. */
  onManualSave: (values: ManualBreastValues) => void;
}) {
  const [side, setSide] = useState<'left' | 'right' | null>(null);
  const [tab, setTab] = useState<Tab>('now');
  const [backdate, setBackdate] = useState(false);
  /** 'SS:DD'; yalnızca kutucuk işaretliyken kullanılır. */
  const [time, setTime] = useState<string | null>(null);
  /* Geri tarihli sekmesinin uçları; `NaN` → sekme hiç açılmadı. */
  const [startMs, setStartMs] = useState(Number.NaN);
  const [endMs, setEndMs] = useState(Number.NaN);
  /** Not iki sekmede de aynı kaydın notu; sekme değişince korunur. */
  const [note, setNote] = useState('');
  const [issue, setIssue] = useState<string | null>(null);
  const [windowIssue, setWindowIssue] = useState<WindowIssue | null>(null);

  const pick = (picked: 'left' | 'right') => {
    setSide(picked);
    setTab('now');
    setBackdate(false);
    setTime(null);
    setStartMs(Number.NaN);
    setEndMs(Number.NaN);
    setNote('');
    setIssue(null);
    setWindowIssue(null);
  };

  /*
   * Varsayılan saatler sekme AÇILIRKEN hesaplanır, bileşen monte edilirken
   * değil: panel boştaki kartın içinde saatlerce açık kalabiliyor ve
   * `useState` başlatıcısıyla hesaplanan "yarım saat önce" o sırada çoktan
   * eskimiş olurdu. Olay işleyicisinde `Date.now()` okumak ayrıca React
   * derleyicisinin saflık kuralına da takılmaz.
   */
  const openTab = (next: Tab) => {
    setTab(next);
    setIssue(null);
    setWindowIssue(null);
    if (next === 'past' && !Number.isFinite(startMs)) {
      const now = Date.now();
      setStartMs(roundToMinute(now - 30 * MINUTE));
      setEndMs(roundToMinute(now));
    }
  };

  const toggleBackdate = (next: boolean) => {
    setBackdate(next);
    // Varsayılan şu anki saat: kutucuğu işaretleyen çoğu kişi saati birkaç
    // dakika geri alacak, sıfırdan girmeyecek.
    if (next && time === null) setTime(toTimeValue(new Date()));
    setIssue(null);
  };

  const trimmedNote = () => (note.trim() ? note.trim() : null);

  const start = () => {
    if (side === null) return;

    if (!backdate) {
      onStart({ side, at: null, note: trimmedNote() });
      return;
    }

    const ms = momentFromClock(time);
    if (!Number.isFinite(ms)) {
      setIssue('Başlangıç saatini seç.');
      return;
    }
    /*
     * Sunucu da aynı tavanı uyguluyor (§10.6) ama oradan dönen hata
     * "aralığı aşıyor" diyor; burada sebebi saat alanının yanında söylemek
     * düzeltmeyi tek dokunuşa indiriyor.
     */
    if ((Date.now() - ms) / 1000 > MAX_BREAST_SPAN_SEC) {
      setIssue('Sayaç en fazla 6 saat öncesinden başlatılabilir.');
      return;
    }
    onStart({ side, at: new Date(ms).toISOString(), note: trimmedNote() });
  };

  const savePast = () => {
    if (side === null) return;
    const found = validateWindow({ startMs, endMs, maxSpanSec: MAX_BREAST_SPAN_SEC });
    if (found) {
      setWindowIssue(found);
      return;
    }
    onManualSave({
      startedAt: new Date(startMs).toISOString(),
      endedAt: new Date(endMs).toISOString(),
      // Tek taraf seçildi: ilk ve son emzirilen meme aynı.
      firstSide: side,
      note: trimmedNote(),
    });
  };

  if (side === null) {
    return (
      <>
        <Text style={s.label}>Hangi memeden başlanıyor?</Text>
        <View style={s.tiles}>
          <SideTile side="left" suggested={nextSide === 'left'} disabled={disabled || busy} onPress={pick} />
          <SideTile side="right" suggested={nextSide === 'right'} disabled={disabled || busy} onPress={pick} />
        </View>
        {/*
          Tek satır. "Öneri: son emzirilen tarafın tersi" cümlesi kaldırıldı:
          aynı şeyi kutunun üzerindeki "sırada" rozeti zaten söylüyor.
        */}
        <Text style={s.hint}>Biten bir emzirmeyi yazmak için de önce tarafı seç.</Text>
      </>
    );
  }

  const spanSec = Math.max(0, Math.round((endMs - startMs) / 1000));

  return (
    <>
      <Text style={s.heading}>{SIDE_LABEL[side]} meme</Text>

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
                label="Emzirmeye başlama saati"
                value={time}
                onChange={(t) => {
                  setTime(t);
                  setIssue(null);
                }}
                disabled={busy || disabled}
              />
              {/*
                Tarih bilerek sorulmuyor: sayaç en fazla 6 saat geriden
                başlayabiliyor, tarih alanı her seferinde boşuna bir dokunuş
                olurdu. Girilen saat ileride kalıyorsa dünkü emzirme sayılır
                (gece 00:10'da "23:50" yazmak beklenen bir durum).
              */}
              <Text style={s.hint}>Yalnızca saat; ileri bir saat girilirse dün sayılır.</Text>
            </>
          ) : null}
        </>
      ) : (
        <>
          <MomentField
            label="Emzirmeye başlama saati"
            value={startMs}
            onChange={(ms) => {
              setStartMs(ms);
              setWindowIssue(null);
            }}
            disabled={busy || disabled}
            error={windowIssue?.field === 'start' ? windowIssue.message : null}
          />
          <MomentField
            label="Emzirmeyi bitirme saati"
            value={endMs}
            onChange={(ms) => {
              setEndMs(ms);
              setWindowIssue(null);
            }}
            disabled={busy || disabled}
            error={windowIssue?.field === 'end' ? windowIssue.message : null}
          />
          <View style={s.duration}>
            <Text style={s.durationLabel}>Toplam süre</Text>
            <Text style={s.durationValue}>{spanSec > 0 ? humanDuration(spanSec) : '—'}</Text>
          </View>
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

      {/*
        Düğmeler tek satırda. "Geri tarihli" sekmesinde üç tane oluyor, bu
        yüzden ortadaki etiket kısaltıldı: "İki memeyi de emzirdim" üçte bir
        genişliğe sığmıyordu, "İkisi de emzirdim" iki satırda sığıyor.
      */}
      <ButtonRow>
        {tab === 'now' ? (
          <Button
            label={
              busy
                ? 'Başlatılıyor…'
                : backdate
                  ? 'Seçilen saatten başlat'
                  : `Başla — ${SIDE_LABEL[side]} meme`
            }
            onPress={start}
            disabled={busy || disabled}
          />
        ) : (
          <Button
            label={busy ? 'Kaydediliyor…' : 'Bilgileri kaydet'}
            onPress={savePast}
            disabled={busy || disabled}
          />
        )}
        {/*
          Tek taraf bu formda yeterli; "ikisi de emzirdim" süre
          paylaştırması istediği için ayrı sayfada kalıyor — kaydırıcıyı
          buraya koymak iki sekmeli ekranı üçüncü bir hâle sokardı.
        */}
        {tab === 'past' ? (
          <Button
            label="İkisi de emzirdim"
            variant="ghost"
            onPress={onManual}
            disabled={busy || disabled}
          />
        ) : null}
        <Button label="Vazgeç" variant="ghost" onPress={() => setSide(null)} disabled={busy} />
      </ButtonRow>
    </>
  );
}

/**
 * Tek bir meme kutusu.
 *
 * İkon `mother-nurse`; sol kutuda yatay **aynalanır**. Çizim tek yönlü
 * olduğu için iki kutu aynalanmadan birebir aynı görünüyordu ve "sol/sağ"
 * bilgisini yalnızca yazı taşıyordu. Anlamı hâlâ yazı veriyor, ayna
 * yalnızca gözün ayırt etmesini hızlandıran bir ipucu.
 */
function SideTile({
  side,
  suggested,
  disabled,
  onPress,
}: {
  side: 'left' | 'right';
  suggested: boolean;
  disabled: boolean;
  onPress: (side: 'left' | 'right') => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(side)}
      disabled={disabled}
      style={({ pressed }) => [
        s.tile,
        suggested && s.tileSuggested,
        pressed && s.tilePressed,
        disabled && s.tileDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${SIDE_LABEL[side]} memeden başla`}
    >
      <View style={[s.tileIcon, side === 'left' && s.tileIconMirror]}>
        <Icon name="breastfeeding" size={24} color={suggested ? colors.trackFeeding : colors.textFaint} />
      </View>
      <Text style={[s.tileLabel, suggested && s.tileLabelOn]}>{SIDE_LABEL[side]}</Text>
      {suggested ? <Text style={s.tileBadge}>sırada</Text> : <Text style={s.tileBadgeGhost}> </Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  label: { ...typography.small, color: colors.textSoft, fontWeight: '600' },
  heading: { ...typography.small, color: colors.primary, fontWeight: '700', textAlign: 'center' },
  hint: { ...typography.tiny, color: colors.textFaint, textAlign: 'center' },
  issue: { ...typography.small, color: colors.danger, textAlign: 'center' },

  tiles: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.xs },
  /*
   * Kutular bilerek sade: ikon 24 px, dolgu rengi yok, ince çerçeve. Önceki
   * hâlinde 40 px ikon ve dolu pembe zemin vardı; iki kutu kartın yarısını
   * kaplıyor ve ekranın asıl işi olan sayaçtan önce gereğinden fazla yer
   * tutuyordu. Sıradaki taraf artık yalnızca çerçeve rengi, ikon rengi ve
   * küçük bir rozetle ayrışıyor — fark seçmeye yetecek kadar, bağırmayacak
   * kadar.
   */
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  tileSuggested: { borderColor: colors.trackFeeding },
  tilePressed: { opacity: 0.75 },
  tileDisabled: { opacity: 0.4 },
  tileIcon: { alignItems: 'center', justifyContent: 'center' },
  tileIconMirror: { transform: [{ scaleX: -1 }] },
  tileLabel: { ...typography.h3, color: colors.textSoft },
  tileLabelOn: { color: colors.text },
  tileBadge: { ...typography.tiny, color: colors.trackFeeding, fontWeight: '700' },
  // Rozet olmayan kutu da aynı yüksekliği kaplasın: ikisi yan yana durduğu
  // için tek satırlık fark hizayı gözle görülür biçimde kaydırıyordu.
  tileBadgeGhost: { ...typography.tiny },

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
  },
});
