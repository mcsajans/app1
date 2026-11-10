import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError, errorText } from '../core/api/client';
import { useAuthStore } from '../core/auth/useAuthStore';
import { colors, spacing, typography } from '../core/theme';
import { Button, Card, Field, FormError, Screen } from '../components/ui';
import { BrandLogo } from '../components/Brand';
import { ForgotPasswordSheet } from '../components/ForgotPasswordSheet';

export default function LoginScreen({ onGoRegister }: { onGoRegister: () => void }) {
  const login = useAuthStore((s) => s.login);
  const notice = useAuthStore((s) => s.notice);
  const clearNotice = useAuthStore((s) => s.clearNotice);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [forgotOpen, setForgotOpen] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setFields({});
    clearNotice();
    try {
      await login(email, password);
      // Başarılıysa App.tsx oturum durumunu görüp navigasyonu değiştirir.
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
          <Text style={s.title}>Bebiqa</Text>
          <Text style={s.subtitle}>Devam etmek için hesabına giriş yap.</Text>
        </View>

        <Card>
          {notice ? <FormError message={notice} /> : null}
          {error ? <FormError message={error} /> : null}

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
            label="Şifre"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            revealable
            autoComplete="password"
            textContentType="password"
            error={fields.password}
            editable={!busy}
          />

          <View style={s.actions}>
            <Button
              label={busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
              onPress={submit}
              disabled={!canSubmit}
            />
          </View>

          <Pressable
            onPress={() => setForgotOpen(true)}
            disabled={busy}
            style={s.linkRow}
            accessibilityRole="button"
          >
            <Text style={s.link}>Şifremi unuttum</Text>
          </Pressable>

          <Pressable onPress={onGoRegister} disabled={busy} style={s.linkRow}>
            <Text style={s.linkMuted}>Hesabın yok mu? </Text>
            <Text style={s.link}>Kayıt ol</Text>
          </Pressable>
        </Card>

        <ForgotPasswordSheet
          visible={forgotOpen}
          onClose={() => setForgotOpen(false)}
          // Kullanıcı e-postasını zaten yazdıysa pencerede ikinci kez
          // yazdırmanın anlamı yok.
          initialEmail={email}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', gap: 4, paddingVertical: spacing.xl },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.small, color: colors.textSoft, textAlign: 'center' },
  actions: { marginTop: spacing.sm },
  linkRow: { flexDirection: 'row', justifyContent: 'center', paddingTop: spacing.sm },
  linkMuted: { ...typography.small, color: colors.textSoft },
  link: { ...typography.small, color: colors.primary, fontWeight: '700' },
  hint: { ...typography.tiny, color: colors.textFaint, textAlign: 'center', paddingHorizontal: spacing.md },
});
