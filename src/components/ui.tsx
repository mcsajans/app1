import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput,
  View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from './Icon';
import { useBottomNavSpace } from './bottomNavSpace';
import { colors, radius, shadow, spacing, typography } from '../core/theme';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  /*
   * Alt çubuk `position: absolute` olduğu için yer kaplamaz; son kartın ve
   * düğmenin altında payı ekran bırakır. Pay üç parçadan oluşur ve üçü de
   * gereklidir: cihazın jest çubuğu (`insets.bottom`), gezinme çubuğunun
   * gövdesi ve üstüne taşan yuvarlak düğme (`navSpace`), bir de nefes payı.
   * Önceden tek bir sabit (64) yazıyordu — ilk ikisini saymadığı için
   * emülatörde "Görevi oluştur" düğmesi çubuğun arkasında kalıyordu.
   *
   * `navSpace` çubuğun olmadığı yerde 0'dır (giriş akışı, Modal sayfalar),
   * o yüzden aynı bileşen her iki durumda da doğru payı verir.
   */
  const navSpace = useBottomNavSpace();
  const pad = {
    paddingTop: insets.top + spacing.sm,
    paddingBottom: insets.bottom + navSpace + spacing.lg,
  };
  if (!scroll) return <View style={[s.screen, pad]}>{children}</View>;
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.scrollPad, pad]}
      /*
       * Klavye açıkken yapılan dokunuş **düğmeye ulaşmalı**.
       *
       * Varsayılan `'never'`: klavye açıkken ekrana yapılan ilk dokunuş
       * yalnızca klavyeyi kapatır ve çocuklara hiç iletilmez. Sonuç, her
       * formda sessiz bir "iki kez bas" davranışıydı — şifre alanına yazıp
       * "Giriş yap"a basan kullanıcının ilk dokunuşu kayboluyordu.
       * `'handled'` ile dokunuş hem klavyeyi kapatır hem de onu işleyen
       * bileşene iletilir; kimse işlemezse yine klavye kapanır.
       */
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <View style={s.sectionTitle}>
      <Text style={s.sectionText}>{children}</Text>
      {hint ? <Text style={s.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

export function Button({
  label, onPress, variant = 'primary', disabled,
}: { label: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean }) {
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : 'transparent';
  const fg = variant === 'ghost' ? colors.primary : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        variant === 'ghost' && s.btnGhost,
      ]}
    >
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({
  icon, title, detail,
}: { icon: IconName; title: string; detail?: string }) {
  return (
    <View style={s.empty}>
      {/* Boş ekranın ikonu büyük ama soluk: dikkat başlıkta kalmalı. */}
      <Icon name={icon} size={48} color={colors.textFaint} />
      <Text style={s.emptyTitle}>{title}</Text>
      {detail ? <Text style={s.emptyDetail}>{detail}</Text> : null}
    </View>
  );
}

export function Loading({ label = 'Yükleniyor…' }: { label?: string }) {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={s.emptyDetail}>{label}</Text>
    </View>
  );
}

export function Field({
  label, value, onChangeText, placeholder, error, secureTextEntry,
  keyboardType, autoCapitalize = 'none', autoComplete, textContentType, editable = true,
  revealable = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string | null;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  autoComplete?: 'email' | 'password' | 'name' | 'new-password' | 'off';
  textContentType?: 'emailAddress' | 'password' | 'name' | 'newPassword' | 'none';
  editable?: boolean;
  /**
   * Şifre alanına "şifremi göster" düğmesi ekler.
   *
   * `secureTextEntry` ile birlikte anlamlı; açıkken alan düz metne döner.
   * Varsayılan **kapalı**: her gizli alanın yanında göz simgesi istenmez
   * (örneğin bir doğrulama kodu), ve düğme yalnızca istendiği yerde çıksın
   * diye seçime bırakıldı.
   */
  revealable?: boolean;
}) {
  const [revealed, setRevealed] = React.useState(false);
  const secure = !!secureTextEntry && !(revealable && revealed);
  const showToggle = !!secureTextEntry && revealable;

  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={[
            s.input,
            !!error && s.inputError,
            !editable && s.inputDisabled,
            // Göz düğmesi girişin üzerinde durduğu için metin onun altına
            // kaymasın; uzun şifrede son karakterler simgenin arkasında kalırdı.
            showToggle && s.inputWithAction,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          editable={editable}
          autoCorrect={false}
        />
        {showToggle ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            disabled={!editable}
            // Dokunma alanı simgeden büyük tutulur; 20 px'lik bir göz
            // ikonuna isabet ettirmek zor.
            hitSlop={10}
            style={s.inputAction}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Şifreyi gizle' : 'Şifreyi göster'}
          >
            <Icon
              name={revealed ? 'eyeOff' : 'eye'}
              size={20}
              color={revealed ? colors.primary : colors.textFaint}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={s.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <View style={s.formError}>
      <Text style={s.formErrorText}>{message}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollPad: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    // Şablonda kartların çerçevesi yok; ayrımı yumuşak gölge yapıyor.
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  sectionTitle: { marginTop: spacing.md, gap: 2 },
  sectionText: { ...typography.h2, color: colors.text },
  sectionHint: { ...typography.small, color: colors.textSoft },
  btn: {
    height: 50, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg,
  },
  btnGhost: { borderWidth: 1.5, borderColor: colors.primary },
  btnText: { ...typography.h3 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },

  emptyTitle: { ...typography.h3, color: colors.text, textAlign: 'center' },
  emptyDetail: { ...typography.small, color: colors.textSoft, textAlign: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  field: { gap: 6 },
  fieldLabel: { ...typography.small, color: colors.textSoft, fontWeight: '600' },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger, borderWidth: 1 },
  inputDisabled: { opacity: 0.5 },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  inputWithAction: { paddingRight: 44 },
  inputAction: {
    position: 'absolute',
    right: 0,
    height: 50,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldError: { ...typography.tiny, color: colors.danger },
  formError: {
    backgroundColor: '#FDECEC',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  formErrorText: { ...typography.small, color: colors.danger },
});
