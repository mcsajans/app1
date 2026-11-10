import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { colors, radius, shadow, spacing, typography } from '../core/theme';

/**
 * Ana ekran bileşenleri — `modules_doc/tasarim.jpg` şablonundan.
 *
 * Üç parça: "Anlık Durum" kartları, "Hızlı İşlemler" ızgarası ve "Günlük Akış"
 * satırları. Üçü de yalnızca sunum yapar; veri çekme ana ekranın işi.
 */

/* ───────────────────────── Anlık Durum ───────────────────────── */

/**
 * Durum kartı: solda pastel yuvarlak ikon, sağda başlık ve göstergeler.
 *
 * Üç gösterge biçimi var ve hepsi isteğe bağlı:
 *  - `progress` sürekli bir oran (0–1) — dolu çubuk,
 *  - `segments` kesikli ölçek — şablondaki noktalı uyanıklık göstergesi,
 *  - `right` sağ üstte küçük bir değer (şablondaki "⏱ 10dk").
 */
export function StatusCard({
  tint,
  icon,
  title,
  subtitle,
  right,
  progress,
  progressColor,
  segments,
  onPress,
}: {
  tint: string;
  icon: IconName;
  title: string;
  subtitle?: string;
  right?: string;
  progress?: number;
  progressColor?: string;
  segments?: { filled: number; total: number; color: string };
  onPress?: () => void;
}) {
  // Oran sınır dışına taşarsa çubuk karttan çıkardı.
  const ratio = progress === undefined ? null : Math.min(1, Math.max(0, progress));

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.statusCard, pressed && onPress ? s.pressed : null]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={[s.chip, { backgroundColor: tint }]}>
        <Icon name={icon} size={22} color={colors.text} />
      </View>

      <View style={s.statusBody}>
        <View style={s.statusHead}>
          <Text style={s.statusTitle} numberOfLines={1}>
            {title}
          </Text>
          {right ? <Text style={s.statusRight}>{right}</Text> : null}
        </View>

        {subtitle ? (
          <Text style={s.statusSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}

        {ratio !== null ? (
          <View style={s.track}>
            <View
              style={[
                s.fill,
                { width: `${ratio * 100}%`, backgroundColor: progressColor ?? colors.primary },
              ]}
            />
          </View>
        ) : null}

        {segments ? (
          <View style={s.segments}>
            {Array.from({ length: segments.total }, (_, i) => (
              <View
                key={i}
                style={[
                  s.segment,
                  { backgroundColor: i < segments.filled ? segments.color : colors.border },
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/* ──────────────────────── Hızlı İşlemler ──────────────────────── */

/** Izgara kutusu: büyük pastel kare, altında başlık. */
export function ModuleTile({
  tint,
  icon,
  label,
  onPress,
}: {
  tint: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.tile, pressed && s.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[s.tileBox, { backgroundColor: tint }]}>
        {/* Pastel kutunun üstünde koyu çizgi ikon: dolu ikonlar ağır
            duruyordu (bkz. components/Icon.tsx). */}
        <Icon name={icon} size={32} color={colors.text} />
      </View>
      <Text style={s.tileLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ───────────────────────── Günlük Akış ───────────────────────── */

/**
 * Akıştaki `subtype` alanı ham veritabanı değeridir (`bottle_formula`,
 * `kaka`, `night`…). Kartta olduğu gibi göstermek teknik bir sızıntıydı;
 * burada okunur karşılıkları tutulur. Eşleşmeyen değer olduğu gibi gösterilir
 * — yeni bir tür eklendiğinde boş satır yerine ham ad görünsün.
 */
const SUBTYPE_LABELS: Record<string, string> = {
  // besleme
  breast: 'Emzirme',
  bottle_breastmilk: 'Anne sütü',
  bottle_formula: 'Formül mama',
  solid: 'Ek gıda',
  water: 'Su',
  // uyku
  night: 'Gece uykusu',
  nap: 'Şekerleme',
  // bez
  cis: 'Çiş',
  kaka: 'Kaka',
  karisik: 'Çiş + kaka',
  kuru: 'Kuru',
};

export function subtypeLabel(subtype: string | null | undefined): string | undefined {
  if (!subtype) return undefined;
  return SUBTYPE_LABELS[subtype] ?? subtype;
}


/**
 * Akış satırı: solda renkli dikey şerit, sonra pastel ikon kutusu, sonra
 * başlık/alt başlık ve sağda ayrıntılar. Şerit kayıt türünü renkle ayırır —
 * şablonda akışın tek görsel düzeni bu.
 */
export function TimelineCard({
  track,
  tint,
  icon,
  title,
  subtitle,
  right,
  onPress,
}: {
  track: string;
  tint: string;
  icon: IconName;
  title: string;
  subtitle?: string;
  right?: string[];
  onPress?: () => void;
}) {
  return (
    <View style={s.timelineRow}>
      <View style={[s.timelineTrack, { backgroundColor: track }]} />
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [s.timelineCard, pressed && onPress ? s.pressed : null]}
        accessibilityRole={onPress ? 'button' : undefined}
      >
        <View style={[s.timelineIcon, { backgroundColor: tint }]}>
          <Icon name={icon} size={22} color={colors.text} />
        </View>
        <View style={s.timelineBody}>
          <Text style={s.timelineTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={s.timelineSub} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right && right.length > 0 ? (
          <View style={s.timelineRight}>
            {right.map((line) => (
              <Text key={line} style={s.timelineRightText} numberOfLines={1}>
                {line}
              </Text>
            ))}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  pressed: { opacity: 0.7 },

  // ── durum kartı ──
  statusCard: {
    // 2x2 ızgara: `flex: 1` satır kırmazdı, hepsi tek satıra sıkışırdı.
    // `flexBasis` kırılma noktasını verir, `flexGrow` tek kalan kartı doldurur.
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 64,
    ...shadow.card,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBody: { flex: 1, gap: 3 },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statusTitle: { ...typography.small, color: colors.text, fontWeight: '700', flexShrink: 1 },
  statusRight: { ...typography.tiny, color: colors.textSoft, marginLeft: 'auto' },
  statusSub: { ...typography.tiny, color: colors.textFaint },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  segments: { flexDirection: 'row', gap: 2.5 },
  segment: { flex: 1, height: 6, borderRadius: 2 },

  // ── ızgara kutusu ──
  tile: {
    // Dört sütun: aradaki boşluk için biraz pay bırakılır.
    width: '22%',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tileBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  tileLabel: {
    ...typography.tiny,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── akış satırı ──
  timelineRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  timelineTrack: { width: 5, borderRadius: 3 },
  timelineCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  timelineIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineBody: { flex: 1 },
  timelineTitle: { ...typography.h3, color: colors.text },
  timelineSub: { ...typography.small, color: colors.textFaint, marginTop: 1 },
  timelineRight: { alignItems: 'flex-end', gap: 2, maxWidth: '38%' },
  timelineRightText: { ...typography.tiny, color: colors.textSoft },
});
