import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError, errorText } from '../core/api/client';
import {
  RELATIONSHIP_LABELS, SIGNUP_RELATIONSHIPS, type Relationship,
} from '../core/api/modules';
import { useAuthStore } from '../core/auth/useAuthStore';
import { colors, radius, spacing, typography } from '../core/theme';
import { Button, Card, Field, FormError, Screen } from '../components/ui';
import { BrandLogo } from '../components/Brand';

const MIN_PASSWORD = 8;

export default function RegisterScreen({ onGoLogin }: { onGoLogin: () => void }) {
  const register = useAuthStore((s) => s.register);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  /**
   * Yakınlık derecesi. Varsayılan seçili gelmez: ilk seçeneği hazır
   * işaretlemek, kullanıcı hiç bakmadan geçtiğinde onu yanlış bir değerle
   * kaydetmek demekti. Seçim zorunlu tutuluyor.
   */
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  // Sunucu da aynı kuralları uygular; buradaki kontrol yalnızca erken geri bildirim.
  const mismatch = password2.length > 0 && password !== password2;
  const canSubmit =
    fullName.trim().length >= 2 &&
    email.trim().length > 0 &&
    password.length >= MIN_PASSWORD &&
    relationship !== null &&
    !mismatch &&
    !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await register(fullName, email, password, relationship!);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFields(err.fields);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.hero}>
          <BrandLogo slot="project" size={96} />
          <Text style={s.title}>Hesap oluştur</Text>
          <Text style={s.subtitle}>
            Kayıt olduktan sonra bebek profilini ekleyip takibe başlayabilirsin.
          </Text>
        </View>

        <Card>
          {error ? <FormError message={error} /> : null}

          <Field
            label="Ad soyad"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Ayşe Yılmaz"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            error={fields.full_name}
            editable={!busy}
          />

          <Text style={s.label}>Bebeğe yakınlığın *</Text>
          <Text style={s.hint}>
            Kayıtlarda adının yanında bu görünür. Sonradan aile ekranından
            değiştirebilirsin.
          </Text>
          <View style={s.chips}>
            {SIGNUP_RELATIONSHIPS.map((r) => {
              const on = relationship === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRelationship(r)}
                  disabled={busy}
                  style={[s.chip, on && s.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[s.chipText, on && s.chipTextOn]}>
                    {RELATIONSHIP_LABELS[r]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {fields.relationship ? (
            <Text style={s.fieldError}>{fields.relationship}</Text>
          ) : null}

          <Field
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@eposta.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            error={fields.email}
            editable={!busy}
          />

          <Field
            label={`Şifre (en az ${MIN_PASSWORD} karakter)`}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            error={fields.password}
            editable={!busy}
          />

          <Field
            label="Şifre (tekrar)"
            value={password2}
            onChangeText={setPassword2}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            error={mismatch ? 'Şifreler eşleşmiyor' : undefined}
            editable={!busy}
          />

          <View style={s.actions}>
            <Button
              label={busy ? 'Hesap oluşturuluyor…' : 'Kayıt ol'}
              onPress={submit}
              disabled={!canSubmit}
            />
          </View>

          <Pressable onPress={onGoLogin} disabled={busy} style={s.linkRow}>
            <Text style={s.linkMuted}>Zaten hesabın var mı? </Text>
            <Text style={s.link}>Giriş yap</Text>
          </Pressable>
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', gap: 4, paddingVertical: spacing.lg },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.small, color: colors.textSoft, textAlign: 'center' },
  actions: { marginTop: spacing.sm },

  // ── yakınlık seçimi ──
  label: { ...typography.small, color: colors.text, fontWeight: '600', marginTop: spacing.sm },
  hint: { ...typography.tiny, color: colors.textSoft, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.small, color: colors.textSoft },
  chipTextOn: { color: '#FFFFFF', fontWeight: '700' },
  fieldError: { ...typography.tiny, color: colors.danger, marginTop: spacing.xs },
  linkRow: { flexDirection: 'row', justifyContent: 'center', paddingTop: spacing.sm },
  linkMuted: { ...typography.small, color: colors.textSoft },
  link: { ...typography.small, color: colors.primary, fontWeight: '700' },
});
