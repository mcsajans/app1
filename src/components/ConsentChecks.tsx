import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Consent } from '../core/consents/useConsentStore';
import { colors, radius, spacing, typography } from '../core/theme';
import { Icon } from './Icon';

/**
 * Yasal onay kutucukları — kayıt ekranı ile açılıştaki onay penceresi aynı
 * bileşeni kullanır.
 *
 * Tek kaynakta durmasının sebebi hukuki: kullanıcının işaretlediği beyan iki
 * ekranda birebir aynı cümle olmak zorunda. Metin de panelden geliyor
 * (`checkbox_label`), burada yeniden yazılmıyor.
 */

export function ConsentChecks({
  consents,
  checked,
  onToggle,
  disabled = false,
}: {
  consents: Consent[];
  /** İşaretli kodlar. */
  checked: Set<string>;
  onToggle: (code: string) => void;
  disabled?: boolean;
}) {
  if (consents.length === 0) return null;

  return (
    <View style={s.list}>
      {consents.map((c) => {
        const on = checked.has(c.code);
        return (
          <View key={c.code} style={s.row}>
            <Pressable
              onPress={() => onToggle(c.code)}
              disabled={disabled}
              style={s.hit}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled }}
              accessibilityLabel={c.checkbox_label}
            >
              <View style={[s.box, on && s.boxOn]}>
                {on ? <Icon name="tick" size={15} color="#FFFFFF" /> : null}
              </View>
              <View style={s.textCol}>
                <Text style={s.label}>
                  {c.checkbox_label}
                  {c.is_required ? <Text style={s.required}> *</Text> : null}
                </Text>
              </View>
            </Pressable>

            {/*
              Metnin tamamı sunucudaki sayfada; bağlantı kutucuğun DIŞINDA
              ayrı bir dokunma alanı. Aynı alanda olsaydı metni okumak için
              dokunan kullanıcı farkında olmadan kutucuğu işaretlerdi.
            */}
            {c.url ? (
              <Pressable
                onPress={() => void Linking.openURL(c.url!)}
                style={s.linkHit}
                accessibilityRole="link"
                accessibilityLabel={`${c.title} metnini aç`}
              >
                <Text style={s.link}>{c.title} metnini oku</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: spacing.md },
  row: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  hit: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.xs },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    backgroundColor: colors.surface,
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  textCol: { flex: 1 },
  label: { ...typography.small, color: colors.text, lineHeight: 20 },
  required: { color: colors.danger, fontWeight: '800' },
  linkHit: { paddingTop: spacing.xs, paddingBottom: spacing.xs, paddingLeft: 34 },
  link: { ...typography.small, color: colors.primary, fontWeight: '700' },
});
