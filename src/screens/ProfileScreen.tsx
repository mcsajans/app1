import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { api, ApiError, errorText } from '../core/api/client';
import { endpoints } from '../core/api/endpoints';
import { useAuthStore, type AuthUser } from '../core/auth/useAuthStore';
import { colors, spacing, typography } from '../core/theme';
import { Button, Card, Field, FormError, Screen, SectionTitle } from '../components/ui';
import { withSaveFeedback } from '../core/feedback/withSaveFeedback';

const MIN_PASSWORD = 8;

/**
 * Kullanıcı kendi bilgilerini buradan günceller:
 *   PUT /auth/me           → ad soyad, telefon
 *   PUT /auth/me/password  → şifre (TÜM oturumları iptal eder, §5.6)
 */
export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SectionTitle hint="E-posta adresi değiştirilemez; hesabın kimliği olarak kullanılır.">
          Bilgilerim
        </SectionTitle>
        <ProfileForm user={user} />

        <SectionTitle hint="Şifreni değiştirdiğinde güvenlik gereği tüm cihazlardaki oturumların kapanır.">
          Şifre değiştir
        </SectionTitle>
        <PasswordForm />
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ProfileForm({ user }: { user: AuthUser | null }) {
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const changed = fullName.trim() !== (user?.full_name ?? '') || phone.trim() !== (user?.phone ?? '');
  const canSubmit = fullName.trim().length >= 2 && changed && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setDone(false);
    setFields({});
    try {
      const data = await withSaveFeedback(() => api.put<{ user: AuthUser }>(endpoints.auth.me, {
        full_name: fullName.trim(),
        phone: phone.trim() === '' ? null : phone.trim(),
      }));
      // Store'u sunucunun döndürdüğü hâlle eşitle; ekranlar anında güncellenir.
      useAuthStore.setState({ user: data.user });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFields(err.fields);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      {error ? <FormError message={error} /> : null}
      {done ? <Text style={s.ok}>Bilgilerin güncellendi.</Text> : null}

      <Field
        label="Ad soyad"
        value={fullName}
        onChangeText={(v) => {
          setFullName(v);
          setDone(false);
        }}
        autoCapitalize="words"
        autoComplete="name"
        error={fields.full_name}
        editable={!busy}
      />

      <Field
        label="Telefon"
        value={phone}
        onChangeText={(v) => {
          setPhone(v);
          setDone(false);
        }}
        placeholder="0555 000 00 00"
        autoComplete="off"
        error={fields.phone}
        editable={!busy}
      />

      <View style={s.readonly}>
        <Text style={s.readonlyLabel}>E-posta</Text>
        <Text style={s.readonlyValue}>{user?.email ?? '—'}</Text>
      </View>

      <Button
        label={busy ? 'Kaydediliyor…' : 'Kaydet'}
        onPress={submit}
        disabled={!canSubmit}
      />
    </Card>
  );
}

function PasswordForm() {
  const logout = useAuthStore((s) => s.logout);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const mismatch = again.length > 0 && next !== again;
  const canSubmit = current.length > 0 && next.length >= MIN_PASSWORD && !mismatch && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api.put(endpoints.auth.password, {
        current_password: current,
        new_password: next,
      });

      // Sunucu bu uçta kullanıcının TÜM refresh token'larını iptal ediyor —
      // elimizdeki de dahil. Sessizce bozuk bir oturumla devam etmek yerine
      // kullanıcıyı bilgilendirip temiz bir çıkış yapıyoruz.
      Alert.alert(
        'Şifren değişti',
        'Güvenlik gereği tüm cihazlardaki oturumların kapatıldı. Yeni şifrenle tekrar giriş yap.',
        [{ text: 'Tamam', onPress: () => void logout() }],
      );
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFields(err.fields);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      {error ? <FormError message={error} /> : null}

      <Field
        label="Mevcut şifre"
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        error={fields.current_password}
        editable={!busy}
      />

      <Field
        label={`Yeni şifre (en az ${MIN_PASSWORD} karakter)`}
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        error={fields.new_password}
        editable={!busy}
      />

      <Field
        label="Yeni şifre (tekrar)"
        value={again}
        onChangeText={setAgain}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        error={mismatch ? 'Şifreler eşleşmiyor' : undefined}
        editable={!busy}
      />

      <Button
        label={busy ? 'Değiştiriliyor…' : 'Şifreyi değiştir'}
        onPress={submit}
        disabled={!canSubmit}
      />
    </Card>
  );
}

const s = StyleSheet.create({
  ok: { ...typography.small, color: colors.primary, fontWeight: '700' },
  readonly: { gap: 6, paddingVertical: spacing.xs },
  readonlyLabel: { ...typography.small, color: colors.textSoft, fontWeight: '600' },
  readonlyValue: { ...typography.body, color: colors.textFaint },
});
