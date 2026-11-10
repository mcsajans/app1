import React, { useEffect, useState } from 'react';
import {
  Animated, Easing, Modal, Pressable, ScrollView,
  StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDuration, humanDuration } from '../../components/records';
import { Button } from '../../components/ui';
import { colors, moduleTint, radius, shadow, spacing, typography } from '../../core/theme';

const DURATION = 200;

/** Hızlı seçim oranları — slider'a dokunmadan tek dokunuşla ayarlamak için. */
const QUICK = [
  { label: '%100', ratio: 1 },
  { label: '%80', ratio: 0.8 },
  { label: '%60', ratio: 0.6 },
  { label: '%50', ratio: 0.5 },
] as const;

/**
 * Süre gösterimi. Bir dakikanın altındaki seanslarda `humanDuration` "0 dk"
 * diyor ve pencere baştan sona sıfır görünüyordu; kısa süreler MM:SS olarak
 * yazılır.
 */
function dur(sec: number): string {
  return sec < 60 ? formatDuration(sec) : humanDuration(sec);
}

export type SessionSummary = {
  /** Duvar saati: başlangıçtan bitişe, duraklamalar dâhil. */
  elapsedSec: number;
  /** Kronometrenin duraklatılmadan saydığı saniye. */
  measuredSec: number;
  leftSec: number;
  rightSec: number;
};

/**
 * Oturum özeti ve **aktif süre düzeltme** penceresi (Modül 2 ek geliştirme).
 *
 * Kronometrenin ölçtüğü süre ile bebeğin gerçekten emdiği süre aynı değildir:
 * bebek memede uyuklar, arada mola verir. "Bitir"e basınca kayıt hemen
 * yazılmaz; anne önce gerçek emme süresini aşağı çekebilir.
 *
 * Varsayılan **ölçülen değerdir**: hiçbir şeye dokunmadan "Kaydet" demek,
 * düzeltme yapılmamış sayılır ve sunucu `adjusted_active_sec`'i NULL bırakır.
 * Böylece "kronometre ne ölçtü" ile "anne ne dedi" ayrımı kaybolmaz.
 *
 * Slider'ın üst sınırı **duvar saatidir**, ölçülen değer değil: duraklatılmış
 * bir seansta anne "aslında molada da emiyordu" diyebilmeli.
 */
export function ActiveDurationSheet({
  summary,
  busy,
  onCancel,
  onSave,
}: {
  summary: SessionSummary | null;
  busy: boolean;
  onCancel: () => void;
  /** `activeSec` ölçülenle aynıysa düzeltme yapılmamış sayılır. */
  onSave: (activeSec: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const visible = summary !== null;

  const [progress] = useState(() => new Animated.Value(0));
  const [exiting, setExiting] = useState(false);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (!visible) setExiting(true);
  }

  // Kapanırken `summary` null olur; son içerik saklanmazsa pencere kapanış
  // animasyonu boyunca boş görünürdü.
  const [shown, setShown] = useState(summary);
  if (summary !== null && summary !== shown) setShown(summary);

  /*
   * Slider değeri DAKİKA cinsinden tutulur. Saniye üzerinden kaydırmak
   * kullanıcıya hiçbir şey kazandırmaz ama "17 dk 43 sn" gibi okunmayan
   * değerler üretirdi.
   */
  const [minutes, setMinutes] = useState(0);
  const [touched, setTouched] = useState(false);

  // Yeni bir özet geldiğinde slider ölçülen değere kurulur.
  const [forSummary, setForSummary] = useState<SessionSummary | null>(null);
  if (summary !== null && summary !== forSummary) {
    setForSummary(summary);
    setMinutes(Math.round(summary.measuredSec / 60));
    setTouched(false);
  }

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: DURATION,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setExiting(false);
    });
    return () => animation.stop();
  }, [visible, progress]);

  if (!visible && !exiting) return null;
  if (!shown) return null;

  const maxMin = Math.max(1, Math.round(shown.elapsedSec / 60));
  const activeSec = minutes * 60;
  const passiveSec = Math.max(0, shown.elapsedSec - activeSec);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });

  const save = () => {
    // Dokunulmadıysa ölçülen değer gönderilir → sunucu düzeltme saymaz.
    onSave(touched ? activeSec : shown.measuredSec);
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <Animated.View style={[s.scrim, { opacity: progress }]}>
        <Pressable
          style={s.fill}
          onPress={busy ? undefined : onCancel}
          accessibilityRole="button"
          accessibilityLabel="Özeti kapat"
        />
      </Animated.View>

      <Animated.View
        style={[
          s.sheet,
          {
            maxHeight: height * 0.9,
            paddingBottom: insets.bottom + spacing.lg,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={s.handle} />

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>Emzirme tamamlandı</Text>
          <Text style={s.subtitle}>
            Bebeğin gerçekten emdiği süreyi ayarlayabilirsin. Dokunmazsan kronometrenin
            ölçtüğü süre kaydedilir.
          </Text>

          {/* ── Özet ── */}
          <View style={s.totals}>
            <Total label="Geçen süre" value={dur(shown.elapsedSec)} />
            <Total label="Sol" value={dur(shown.leftSec)} />
            <Total label="Sağ" value={dur(shown.rightSec)} />
          </View>

          {/* ── Aktif / pasif ── */}
          <View style={s.splitCard}>
            <View style={s.splitRow}>
              <View style={[s.dot, { backgroundColor: colors.trackFeeding }]} />
              <Text style={s.splitLabel}>Aktif emme süresi</Text>
              <Text style={s.splitValue}>{dur(activeSec)}</Text>
            </View>
            <View style={s.splitRow}>
              <View style={[s.dot, { backgroundColor: colors.border }]} />
              <Text style={s.splitLabel}>Pasif / mola süresi</Text>
              <Text style={[s.splitValue, s.splitValueSoft]}>{dur(passiveSec)}</Text>
            </View>

            {/* Oran çubuğu: iki süreyi yan yana görmek sayıdan hızlı okunuyor. */}
            <View style={s.bar}>
              <View
                style={[
                  s.barActive,
                  { flex: Math.max(activeSec, 1), backgroundColor: colors.trackFeeding },
                ]}
              />
              <View style={[s.barPassive, { flex: Math.max(passiveSec, 0.0001) }]} />
            </View>

            <Slider
              style={s.slider}
              minimumValue={0}
              maximumValue={maxMin}
              step={1}
              value={minutes}
              onValueChange={(v) => {
                setMinutes(Math.round(v));
                setTouched(true);
              }}
              minimumTrackTintColor={colors.trackFeeding}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.trackFeeding}
              disabled={busy}
            />
            <View style={s.scaleRow}>
              <Text style={s.scaleText}>0 dk</Text>
              <Text style={s.scaleText}>{maxMin} dk</Text>
            </View>
          </View>

          {/* ── Hızlı oranlar ── */}
          <Text style={s.quickLabel}>Hızlı seçim</Text>
          <View style={s.quickRow}>
            {QUICK.map((q) => {
              const target = Math.round((shown.measuredSec / 60) * q.ratio);
              const on = touched && minutes === target;
              return (
                <Pressable
                  key={q.label}
                  disabled={busy}
                  onPress={() => {
                    setMinutes(target);
                    setTouched(true);
                  }}
                  style={[s.quickChip, on && s.quickChipOn]}
                >
                  <Text style={[s.quickText, on && s.quickTextOn]}>{q.label}</Text>
                  <Text style={[s.quickMin, on && s.quickTextOn]}>{target} dk</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={s.gap} />
          <Button
            label={busy ? 'Kaydediliyor…' : 'Kaydet'}
            onPress={save}
            disabled={busy}
          />
          <Button label="Vazgeç" variant="ghost" onPress={onCancel} disabled={busy} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.total}>
      <Text style={s.totalValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={s.totalLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    ...shadow.raised,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  content: { gap: spacing.md, paddingBottom: spacing.md },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.small, color: colors.textSoft },

  totals: { flexDirection: 'row', gap: spacing.sm },
  total: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    ...shadow.card,
  },
  totalValue: { ...typography.h3, color: colors.text },
  totalLabel: { ...typography.tiny, color: colors.textSoft, marginTop: 2 },

  splitCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadow.card,
  },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  splitLabel: { ...typography.small, color: colors.textSoft, flex: 1 },
  splitValue: { ...typography.h3, color: colors.text },
  splitValueSoft: { color: colors.textFaint },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: spacing.xs,
    backgroundColor: colors.border,
  },
  barActive: { height: '100%' },
  barPassive: { height: '100%', backgroundColor: colors.border },
  slider: { width: '100%', height: 40 },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleText: { ...typography.tiny, color: colors.textFaint },

  quickLabel: { ...typography.small, color: colors.textSoft, fontWeight: '600' },
  quickRow: { flexDirection: 'row', gap: spacing.xs },
  quickChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: moduleTint.breastfeeding,
  },
  quickChipOn: { backgroundColor: colors.trackFeeding },
  quickText: { ...typography.small, color: colors.text, fontWeight: '700' },
  quickMin: { ...typography.tiny, color: colors.textSoft },
  quickTextOn: { color: '#FFFFFF' },
  gap: { height: spacing.xs },
});
