import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorText } from '../core/api/client';
import { useAuthStore } from '../core/auth/useAuthStore';
import { useConsentStore } from '../core/consents/useConsentStore';
import { colors, radius, shadow, spacing, typography } from '../core/theme';
import { ConsentChecks } from './ConsentChecks';
import { Button, ButtonRow, FormError } from './ui';

/**
 * Zorunlu yasal onayı eksik olan kullanıcıya açılışta çıkan onay penceresi.
 *
 * **Kapatılamaz.** Geri tuşu ve dışına dokunma kapatmaz; tek çıkış yolu
 * onaylamak ya da oturumu kapatmaktır. Gerekçe hukuki: aydınlatma ve açık
 * rıza olmadan çocuğa ait sağlık/gelişim verisi işlemenin dayanağı yok, bu
 * yüzden "sonra hatırlat" seçeneği olamaz — `PermissionsSheet`ten farkı bu
 * (izinler isteğe bağlı, onaylar değil).
 *
 * Zaten kayıtlı kullanıcılar ve metin sürümü panelde artırıldığında herkes bu
 * pencereyi görür.
 */
export function ConsentGate() {
  const insets = useSafeAreaInsets();
  const items = useConsentStore((s) => s.items);
  const pending = useConsentStore((s) => s.pending);
  const busy = useConsentStore((s) => s.busy);
  const accept = useConsentStore((s) => s.accept);
  const logout = useAuthStore((s) => s.logout);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  /** Henüz onaylanmamış tanımlar: zorunlular akışı kilitler, diğerleri kilitlemez. */
  const open = useMemo(() => items.filter((c) => !c.accepted), [items]);
  const canSubmit = pending.every((code) => checked.has(code)) && !busy;

  const toggle = (code: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const submit = () => {
    void (async () => {
      setError(null);
      try {
        await accept([...checked]);
      } catch (err) {
        setError(errorText(err));
      }
    })();
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android'de geri tuşu pencereyi KAPATMAMALI: onay vermeden içeri
      // girilemez. Boş geri çağrımı bilinçli.
      onRequestClose={() => {}}
    >
      <View style={s.scrim}>
        <View
          style={[
            s.sheet,
            { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
            <Text style={s.title}>Onayın gerekiyor</Text>
            <Text style={s.lead}>
              Bebiqa, bebeğine ait sağlık ve gelişim kayıtlarını tutuyor. Devam etmeden önce
              aşağıdaki metinleri okuyup onaylaman gerekiyor.
            </Text>

            <View style={s.card}>
              <ConsentChecks
                consents={open}
                checked={checked}
                onToggle={toggle}
                disabled={busy}
              />
            </View>

            {error ? <FormError message={error} /> : null}

            {/*
              Geri çekme hakkı KVKK m.7 ile var, ama uygulamanın içinde henüz
              bir geri çekme ekranı YOK: başvuru yolu aydınlatma metninde
              yazıyor. Burada "uygulamadan geri çekebilirsin" demek
              karşılığı olmayan bir söz olurdu.
            */}
            <Text style={s.note}>
              Açık rızanı geri çekme hakkın var; nasıl başvuracağın KVKK Aydınlatma
              Metni&apos;nde yazıyor. Geri çektiğinde uygulamayı kullanmaya devam edemezsin.
            </Text>
          </ScrollView>

          <View style={s.actions}>
            <ButtonRow>
              <Button
                label={busy ? 'Kaydediliyor…' : 'Onaylıyorum ve devam et'}
                onPress={submit}
                disabled={!canSubmit}
              />
              <Button
                label="Çıkış yap"
                variant="ghost"
                onPress={() => void logout()}
                disabled={busy}
              />
            </ButtonRow>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(16,24,40,0.35)' },
  sheet: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  body: { gap: spacing.md, paddingBottom: spacing.lg },
  title: { ...typography.h1, color: colors.text },
  lead: { ...typography.body, color: colors.textSoft },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  note: { ...typography.tiny, color: colors.textFaint, lineHeight: 18 },
  actions: { gap: spacing.xs, paddingTop: spacing.sm },
});
