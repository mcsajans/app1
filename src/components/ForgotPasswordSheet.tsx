import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { Button, Field, FormError } from './ui';
import { ApiError, api, errorText } from '../core/api/client';
import { endpoints } from '../core/api/endpoints';
import { colors, radius, spacing, typography } from '../core/theme';

/**
 * Şifremi unuttum akışı — iki adım.
 *
 * Sunucu sıfırlama **kodunu e-postayla** gönderiyor (`passwordResetMail`);
 * burası o kodu isteyen ve yeni şifreyi alan ekran. Derin bağlantı (deep link)
 * altyapısı olmadığı için koda tıklayıp uygulamaya dönmek mümkün değil,
 * kullanıcı kodu elle yapıştırıyor.
 *
 * **Hesabın var olup olmadığı söylenmez.** Sunucu bilerek her durumda
 * `sent: true` dönüyor (§18) ve ekran da aynı dili kullanıyor: "kayıtlıysa
 * gönderildi". Aksi hâlde adres adres deneyerek hangi e-postaların kayıtlı
 * olduğu çıkarılabilirdi.
 */
export function ForgotPasswordSheet({
  visible,
  onClose,
  initialEmail,
}: {
  visible: boolean;
  onClose: () => void;
  initialEmail?: string;
}) {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<'ask' | 'code' | 'done'>('ask');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  // Her açılışta temiz başlar; önceki denemenin kodu ya da hatası kalmasın.
  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (visible) {
      setStep('ask');
      setEmail(initialEmail ?? '');
      setToken('');
      setPassword('');
      setError(null);
      setFields({});
      setBusy(false);
    }
  }

  const run = async (fn: () => Promise<unknown>, next: 'code' | 'done') => {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await fn();
      setStep(next);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFields(err.fields);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(
      () => api.post(endpoints.auth.forgotPassword, { email: email.trim().toLowerCase() }),
      'code',
    );

  const applyNew = () =>
    run(
      () => api.post(endpoints.auth.resetPassword, { token: token.trim(), password }),
      'done',
    );

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.scrim}>
        <Pressable
          style={s.fill}
          onPress={busy ? undefined : onClose}
          accessibilityRole="button"
          accessibilityLabel="Pencereyi kapat"
        />
        <View style={[s.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={s.handle} />

          {step === 'done' ? (
            <>
              <View style={[s.badge, s.badgeOk]}>
                <Icon name="check" size={28} color={colors.success} />
              </View>
              <Text style={s.title}>Şifren değişti</Text>
              <Text style={s.body}>
                Yeni şifrenle giriş yapabilirsin. Güvenlik için açık olan diğer tüm
                oturumlar kapatıldı.
              </Text>
              <View style={s.gap} />
              <Button label="Giriş ekranına dön" onPress={onClose} />
            </>
          ) : step === 'code' ? (
            <>
              <View style={s.badge}>
                <Icon name="key" size={26} color={colors.primary} />
              </View>
              <Text style={s.title}>Kodu gir</Text>
              <Text style={s.body}>
                <Text style={s.strong}>{email.trim()}</Text> adresi kayıtlıysa sıfırlama kodu
                gönderildi. Postadaki kodu buraya yapıştır ve yeni şifreni belirle.
                Kod <Text style={s.strong}>1 saat</Text> geçerli.
              </Text>

              <Field
                label="Sıfırlama kodu"
                value={token}
                onChangeText={setToken}
                placeholder="E-postadan kopyala"
                error={fields.token}
                editable={!busy}
              />
              <Field
                label="Yeni şifre"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                revealable
                autoComplete="new-password"
                textContentType="newPassword"
                error={fields.password}
                editable={!busy}
              />

              {error ? <FormError message={error} /> : null}

              <View style={s.gap} />
              <Button
                label={busy ? 'Kaydediliyor…' : 'Şifremi değiştir'}
                onPress={() => void applyNew()}
                disabled={busy || token.trim().length === 0 || password.length === 0}
              />
              {/* Kod gelmediyse adresi düzeltip yeniden istemek gerekebilir. */}
              <Button
                label="Adresi değiştir"
                variant="ghost"
                onPress={() => setStep('ask')}
                disabled={busy}
              />
            </>
          ) : (
            <>
              <View style={s.badge}>
                <Icon name="key" size={26} color={colors.primary} />
              </View>
              <Text style={s.title}>Şifremi unuttum</Text>
              <Text style={s.body}>
                Hesabının e-posta adresini yaz; sıfırlama kodunu oraya gönderelim.
              </Text>

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

              {error ? <FormError message={error} /> : null}

              <View style={s.gap} />
              <Button
                label={busy ? 'Gönderiliyor…' : 'Kodu gönder'}
                onPress={() => void sendCode()}
                disabled={busy || email.trim().length === 0}
              />
              <Button label="Vazgeç" variant="ghost" onPress={onClose} disabled={busy} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(16,22,34,0.55)', justifyContent: 'flex-end' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: 6,
  },
  handle: {
    alignSelf: 'center', width: 44, height: 4, borderRadius: radius.pill,
    backgroundColor: colors.border, marginBottom: spacing.sm,
  },
  badge: {
    alignSelf: 'center', width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  badgeOk: { backgroundColor: '#E8F6EE' },
  title: { ...typography.h3, color: colors.text, textAlign: 'center' },
  body: {
    ...typography.small, color: colors.textSoft, lineHeight: 20,
    marginTop: spacing.xs, marginBottom: spacing.sm,
  },
  strong: { color: colors.text, fontWeight: '700' },
  gap: { height: spacing.sm },
});
