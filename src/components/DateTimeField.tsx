import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Icon } from './Icon';
import { colors, radius, spacing, typography } from '../core/theme';

/**
 * Tarih ve saat girişi — **sistem seçicisi** ile.
 *
 * Önceden bunlar düz metin kutularıydı ve kullanıcıdan `YYYY-AA-GG` /`SS:DD`
 * biçimini elle tutturması bekleniyordu; yanlış yazım ancak kaydetmeye
 * basınca hata olarak dönüyordu. Sistem seçicisi biçim hatasını tamamen
 * ortadan kaldırır ve takvim/saat arayüzü platformun alışık olunan hâlidir.
 *
 * `@react-native-community/datetimepicker` bildirimsel kullanılır: açıkken
 * bileşen monte edilir, Android'de bu bir modal iletişim kutusu açar.
 * İmperatif `DateTimePickerAndroid.open()` yalnızca Android'de var; tek bir
 * kod yolu tutmak için bildirimsel biçim tercih edildi.
 */

/** 'YYYY-AA-GG' → Date; geçersizse bugün. */
function parseDate(value: string | null | undefined): Date {
  if (value) {
    const d = new Date(`${value}T12:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** 'SS:DD' → Date (yalnızca saat kısmı anlamlı); geçersizse şu an. */
function parseTime(value: string | null | undefined): Date {
  const d = new Date();
  if (value) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (m) {
      d.setHours(Number(m[1]), Number(m[2]), 0, 0);
      return d;
    }
  }
  d.setSeconds(0, 0);
  return d;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export const toDateValue = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const toTimeValue = (d: Date): string => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** 'YYYY-AA-GG' → "2 Kasım 2026"; boşsa yer tutucu. */
function prettyDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function FieldShell({
  label,
  text,
  placeholder,
  onPress,
  onClear,
  disabled,
}: {
  label?: string;
  text: string | null;
  placeholder: string;
  onPress: () => void;
  onClear?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.row}>
        <Pressable
          onPress={onPress}
          disabled={disabled}
          style={({ pressed }) => [s.field, pressed && s.fieldPressed, disabled && s.fieldDisabled]}
          accessibilityRole="button"
          accessibilityLabel={label ? `${label}: ${text ?? placeholder}` : undefined}
        >
          <Text style={[s.value, !text && s.placeholder]} numberOfLines={1}>
            {text ?? placeholder}
          </Text>
        </Pressable>
        {/* Temizleme yalnızca isteğe bağlı alanlarda sunulur. */}
        {onClear && text ? (
          <Pressable onPress={onClear} disabled={disabled} hitSlop={8} style={s.clear}>
            <Icon name="close" size={14} color={colors.textSoft} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Tarih seç',
  minimumDate,
  maximumDate,
  disabled,
  onClear,
}: {
  label?: string;
  /** 'YYYY-AA-GG' */
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);

  // `onChange` kullanımdan kaldırıldı (olay tipini event.type ile taşıyordu);
  // yerine ayrı dinleyiciler geldi. İkisi de seçiciyi kapatır.
  const pick = (_event: unknown, picked: Date) => {
    setOpen(false);
    onChange(toDateValue(picked));
  };

  return (
    <>
      <FieldShell
        label={label}
        text={prettyDate(value)}
        placeholder={placeholder}
        onPress={() => setOpen(true)}
        onClear={onClear}
        disabled={disabled}
      />
      {open ? (
        <DateTimePicker
          value={parseDate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onValueChange={pick}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function TimeField({
  label,
  value,
  onChange,
  placeholder = 'Saat seç',
  disabled,
  onClear,
}: {
  label?: string;
  /** 'SS:DD' */
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);

  const pick = (_event: unknown, picked: Date) => {
    setOpen(false);
    onChange(toTimeValue(picked));
  };

  return (
    <>
      <FieldShell
        label={label}
        text={value}
        placeholder={placeholder}
        onPress={() => setOpen(true)}
        onClear={onClear}
        disabled={disabled}
      />
      {open ? (
        <DateTimePicker
          value={parseTime(value)}
          mode="time"
          // Türkiye 24 saat kullanır; cihaz 12 saate ayarlı olsa da kayıtlar
          // SS:DD saklandığı için seçici de 24 saat gösterir.
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={pick}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Birden fazla saat — hatırlatıcıların `fixed_times` alanı için.
 *
 * Virgülle ayrılmış metin kutusu yerine rozetler: her saat silinebilir,
 * yeni saat sistem seçicisiyle eklenir. Sıralı tutulur ve aynı saat iki kez
 * eklenmez; sunucu zaten en fazla 12 saat kabul ediyor.
 */
export function TimeListField({
  label,
  values,
  onChange,
  disabled,
  max = 12,
}: {
  label?: string;
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  max?: number;
}) {
  const [open, setOpen] = useState(false);

  const add = (_event: unknown, picked: Date) => {
    setOpen(false);
    const next = toTimeValue(picked);
    // Aynı saat iki kez eklenmez; liste sıralı tutulur.
    if (values.includes(next)) return;
    onChange([...values, next].sort());
  };

  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.chips}>
        {values.map((t) => (
          <Pressable
            key={t}
            onPress={() => !disabled && onChange(values.filter((v) => v !== t))}
            style={s.chip}
            accessibilityRole="button"
            accessibilityLabel={`${t} saatini kaldır`}
          >
            <Text style={s.chipText}>{t}</Text>
            <Icon name="close" size={14} color={colors.primary} />
          </Pressable>
        ))}
        {values.length < max ? (
          <Pressable
            onPress={() => setOpen(true)}
            disabled={disabled}
            style={[s.chip, s.chipAdd]}
            accessibilityRole="button"
            accessibilityLabel="Saat ekle"
          >
            <Text style={s.chipAddText}>+ Saat ekle</Text>
          </Pressable>
        ) : null}
      </View>
      {values.length === 0 ? <Text style={s.hint}>En az bir saat seçmelisin.</Text> : null}

      {open ? (
        <DateTimePicker
          value={parseTime(null)}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={add}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6 },
  label: { ...typography.small, color: colors.textSoft, fontWeight: '600', marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  field: {
    flex: 1,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  fieldPressed: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  fieldDisabled: { opacity: 0.5 },
  value: { ...typography.body, color: colors.text },
  placeholder: { color: colors.textFaint },
  clear: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
  },
  clearText: { ...typography.small, color: colors.textSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  chipText: { ...typography.small, color: colors.primary, fontWeight: '700' },
  chipX: { ...typography.tiny, color: colors.primary },
  chipAdd: { backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },
  chipAddText: { ...typography.small, color: colors.textSoft, fontWeight: '600' },
  hint: { ...typography.tiny, color: colors.danger },
});
