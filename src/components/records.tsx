import React, { useCallback, useSyncExternalStore } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, type AppStateStatus } from 'react-native';

import { Icon, type IconName } from './Icon';
import { colors, radius, spacing, typography } from '../core/theme';

/* ───────────────────────── kronometre ───────────────────────── */

/**
 * Zaman damgası tabanlı kronometre.
 *
 * Sayaç **artırılmaz**, her tikte `now - startedAt` yeniden hesaplanır. Bunun
 * nedeni, `setInterval`'in arka planda kısılması veya hiç çalışmaması: sayacı
 * saniye saniye artırmak, uygulama arka plandayken geçen süreyi kaybederdi.
 * Ön plana dönüldüğünde süre kendiliğinden doğru olur.
 *
 * `startedAt` null ise sayaç durur ve 0 döner.
 */
/**
 * Saniye çözünürlüğünde saat kaynağı.
 *
 * `useSyncExternalStore` ile abone olunur: saat React'in dışındaki değişken
 * bir kaynaktır ve render sırasında `Date.now()` çağırmak render'ı saf
 * olmaktan çıkarır. Anlık görüntü saniyeye yuvarlandığı için aynı saniye
 * içindeki çağrılar aynı değeri döndürür ve sonsuz render oluşmaz.
 */
function subscribeToClock(onChange: () => void): () => void {
  const id = setInterval(onChange, 1000);

  // Ön plana dönüşte beklemeden tazele; arka planda tik gelmemiş olabilir.
  const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'active') onChange();
  });

  return () => {
    clearInterval(id);
    sub.remove();
  };
}

const clockSnapshot = () => Math.floor(Date.now() / 1000);

/**
 * Zaman damgası tabanlı geçen süre.
 *
 * Sayaç **artırılmaz**, her tikte `now - startedAt` yeniden hesaplanır: arka
 * planda `setInterval` kısıldığı için saniye saniye artırmak geçen süreyi
 * kaybederdi. Ön plana dönüldüğünde süre kendiliğinden doğru olur.
 *
 * `startedAt` null ise sayaç durur ve yalnızca `extraSec` döner.
 */
export function useElapsedSeconds(startedAt: string | null, extraSec = 0): number {
  // Durmuş sayaçta saate abone olmaya gerek yok; boş abonelik kullanılır.
  const subscribe = useCallback(
    (onChange: () => void) => (startedAt ? subscribeToClock(onChange) : () => undefined),
    [startedAt],
  );

  const nowSec = useSyncExternalStore(subscribe, clockSnapshot, clockSnapshot);

  if (!startedAt) return extraSec;
  const startedSec = Math.floor(new Date(startedAt).getTime() / 1000);
  return Math.max(0, nowSec - startedSec) + extraSec;
}

/** `01:23:45` ya da `23:45` — saat yoksa gösterilmez. */
export function formatDuration(totalSec: number | null | undefined): string {
  const s = Math.max(0, Math.floor(totalSec ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** "2 sa 15 dk" — özet kartlarında okunaklı süre. */
export function humanDuration(totalSec: number | null | undefined): string {
  const s = Math.max(0, Math.floor(totalSec ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h === 0) return `${m} dk`;
  return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
}

/**
 * DECIMAL sütunları mysql2'den `"120.00"` biçiminde dizge gelir; olduğu gibi
 * basmak listede "120.00 ml", "2.00 kaşık" gösteriyordu. Gereksiz ondalık
 * kırpılır, anlamlı olan (örn. 7,5 ml ilaç ölçüsü) korunur.
 */
export function amountText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '?';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return String(Number(n.toFixed(2)));
}

export function clockOf(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ───────────────────────── bileşenler ───────────────────────── */

export function Chips<T extends string>({
  options,
  value,
  onChange,
  labels,
  icons,
  disabled,
  allowClear = false,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T | null) => void;
  labels?: Record<string, string>;
  /**
   * Seçeneklere ikon ekler. İsteğe bağlı: çoğu chip grubu kısa metinlerden
   * oluşuyor ve ikon onları kalabalıklaştırırdı. Seçenekler bir **türü**
   * temsil ediyorsa (görev tipi gibi) ikon, listedeki kartla aynı simgeyi
   * gösterip seçimi hızlandırıyor.
   */
  icons?: Partial<Record<T, IconName>>;
  disabled?: boolean;
  allowClear?: boolean;
}) {
  return (
    <View style={s.chips}>
      {options.map((opt) => {
        const on = value === opt;
        return (
          <Pressable
            key={opt}
            disabled={disabled}
            onPress={() => onChange(allowClear && on ? null : opt)}
            style={[s.chip, on && s.chipOn]}
          >
            {icons?.[opt] ? (
              /*
               * Seçili chip'in zemini `primarySoft` (açık mavi), yazısı
               * `primary`. İkon da yazıyla aynı rengi alır; beyaz denendiğinde
               * o açık zeminde görünmüyordu.
               */
              <Icon
                name={icons[opt]!}
                size={16}
                color={on ? colors.primary : colors.textSoft}
              />
            ) : null}
            <Text style={[s.chipText, on && s.chipTextOn]}>{labels?.[opt] ?? opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'warn' | 'good';
}) {
  const color = tone === 'warn' ? colors.danger : tone === 'good' ? colors.primary : colors.text;
  return (
    <View style={s.tile}>
      <Text style={[s.tileValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={s.tileLabel}>{label}</Text>
      {hint ? <Text style={s.tileHint}>{hint}</Text> : null}
    </View>
  );
}

export function RecordRow({
  icon,
  title,
  detail,
  right,
  onPress,
  onLongPress,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  right?: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [s.row, pressed && onPress ? s.rowPressed : null]}
    >
      {/* Kayıt satırının ikonu listede sabit genişlikte durmalı; emoji
          yazı tipine göre kayıyordu (bkz. components/Icon.tsx). */}
      <View style={s.rowIcon}>
        <Icon name={icon} size={22} color={colors.textSoft} />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text style={s.rowDetail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {right ? <Text style={s.rowRight}>{right}</Text> : null}
    </Pressable>
  );
}

/** Büyük kronometre göstergesi. */
export function TimerDisplay({ seconds, label }: { seconds: number; label?: string }) {
  return (
    <View style={s.timer}>
      <Text style={s.timerText}>{formatDuration(seconds)}</Text>
      {label ? <Text style={s.timerLabel}>{label}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { ...typography.small, color: colors.textSoft },
  chipTextOn: { color: colors.primary, fontWeight: '700' },

  tile: { flex: 1, alignItems: 'center', gap: 2, minWidth: 72 },
  tileValue: { ...typography.h2 },
  tileLabel: { ...typography.tiny, color: colors.textSoft },
  tileHint: { ...typography.tiny, color: colors.textFaint },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowPressed: { opacity: 0.6 },
  rowIcon: { width: 28, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  rowDetail: { ...typography.tiny, color: colors.textSoft, marginTop: 1 },
  rowRight: { ...typography.small, color: colors.textSoft },

  timer: { alignItems: 'center', paddingVertical: spacing.md },
  timerText: { ...typography.h1, fontSize: 48, color: colors.text, fontVariant: ['tabular-nums'] },
  timerLabel: { ...typography.small, color: colors.textSoft },
});
