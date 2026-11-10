import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { errorText } from '../../core/api/client';
import { imageSource } from '../../core/api/assets';
import { calcAge, calcCorrectedAge } from '../../core/utils/age';
import { useBabyStore, type BabyInput, type PhotoFile } from '../../core/stores/useBabyStore';
import { Icon } from '../../components/Icon';
import { colors, radius, spacing, typography } from '../../core/theme';
import { DateField, TimeField } from '../../components/DateTimeField';
import { Button, FormError } from '../../components/ui';
import { BLOOD_TYPES, type Baby, type BloodType, type Gender } from '../../core/types';
import { withSaveFeedback } from '../../core/feedback/withSaveFeedback';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'kiz', label: 'Kız' },
  { value: 'erkek', label: 'Erkek' },
  { value: 'belirtilmedi', label: 'Belirtmek istemiyorum' },
];

const isValidDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isValidTime = (v: string) => v === '' || /^\d{2}:\d{2}$/.test(v);

/**
 * Ölçü alanları: boş bırakılabilir, doluysa sayıya çevrilir. Sınırlar sunucuyla
 * aynıdır (§14.0.2); amaç birim hatasını kullanıcı göndermeden yakalamak.
 */
type NumField = { key: string; label: string; hint: string; min: number; max: number; integer: boolean };

const MEASURES: NumField[] = [
  { key: 'weight', label: 'Doğum kilosu (gram)', hint: 'örn. 3250', min: 200, max: 9000, integer: true },
  { key: 'height', label: 'Doğum boyu (cm)', hint: 'örn. 50.5', min: 20, max: 80, integer: false },
  { key: 'head', label: 'Baş çevresi (cm)', hint: 'örn. 34.5', min: 15, max: 60, integer: false },
];

function parseNum(raw: string, f: NumField): { value: number | null; error: string | null } {
  const t = raw.trim().replace(',', '.');
  if (t === '') return { value: null, error: null };
  const n = Number(t);
  if (!Number.isFinite(n)) return { value: null, error: 'Sayı gir' };
  if (f.integer && !Number.isInteger(n)) return { value: null, error: 'Tam sayı gir (gram)' };
  if (n < f.min || n > f.max) return { value: null, error: `${f.min}–${f.max} arası olmalı` };
  return { value: n, error: null };
}

const asText = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

export function BabyForm({ baby, onDone }: { baby?: Baby; onDone: () => void }) {
  const addBaby = useBabyStore((s) => s.addBaby);
  const updateBaby = useBabyStore((s) => s.updateBaby);
  const editing = baby !== undefined;

  const [firstName, setFirstName] = useState(baby?.firstName ?? '');
  const [lastName, setLastName] = useState(baby?.lastName ?? '');
  const [gender, setGender] = useState<Gender>(baby?.gender ?? 'belirtilmedi');
  const [birthDate, setBirthDate] = useState(baby?.birthDate ?? '');
  const [birthTime, setBirthTime] = useState((baby?.birthTime ?? '').slice(0, 5));
  const [weight, setWeight] = useState(asText(baby?.birthWeightG));
  const [height, setHeight] = useState(asText(baby?.birthHeightCm));
  const [head, setHead] = useState(asText(baby?.headCircumferenceCm));
  const [isPremature, setIsPremature] = useState(baby?.isPremature ?? false);
  const [weeks, setWeeks] = useState(asText(baby?.gestationalAgeWeeks));
  const [bloodType, setBloodType] = useState<BloodType | null>(baby?.bloodType ?? null);
  const [note, setNote] = useState(baby?.note ?? '');

  const [photo, setPhoto] = useState<PhotoFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const raw = { weight, height, head };
  const parsed = {
    weight: parseNum(weight, MEASURES[0]),
    height: parseNum(height, MEASURES[1]),
    head: parseNum(head, MEASURES[2]),
  };
  const setters: Record<string, (v: string) => void> = { weight: setWeight, height: setHeight, head: setHead };

  const dateOk = isValidDate(birthDate);
  const timeOk = isValidTime(birthTime);
  const weeksNum = weeks.trim() === '' ? null : Number(weeks);
  const weeksOk = !isPremature || (weeksNum !== null && Number.isInteger(weeksNum) && weeksNum >= 20 && weeksNum <= 42);

  const agePreview = dateOk ? calcAge(birthDate) : null;
  const correctedPreview =
    dateOk && isPremature && weeksOk && weeksNum !== null
      ? calcCorrectedAge(birthDate, { isPremature: true, gestationalAgeWeeks: weeksNum })
      : null;

  /**
   * Seçicinin ortak ayarları.
   *
   * `allowsEditing` + kare oran bilinçli: fotoğraf her yerde **dairesel**
   * gösteriliyor (üst şerit, aile listesi, ızgara). Kullanıcı kırpmayı kendi
   * yapmazsa uzun bir kare fotoğrafın kenarları daire içinde kesiliyor ve
   * bebeğin yüzü çerçeve dışında kalabiliyordu.
   *
   * `quality: 0.8` ile JPEG sıkıştırılır; sunucudaki 5 MB sınırı altında
   * kalmak için yeterli (TEKNIK_DOKUMAN §22.14).
   */
  const PICKER: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  };

  /** Seçilen varlığı multipart gövdenin beklediği biçime çevirir. */
  const takeAsset = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    // fileName ve mimeType null olabilir (dokümante edilmiş); multipart gövde
    // için ikisi de zorunlu olduğundan makul varsayılanlar konur.
    setPhoto({
      uri: asset.uri,
      name: asset.fileName ?? `baby-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    });
    setError(null);
  };

  const fromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Fotoğraf seçmek için galeri izni gerekli.');
      return;
    }
    takeAsset(await ImagePicker.launchImageLibraryAsync(PICKER));
  };

  const fromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Fotoğraf çekmek için kamera izni gerekli.');
      return;
    }
    takeAsset(await ImagePicker.launchCameraAsync(PICKER));
  };

  /**
   * Kaynak sorusu (şartname: "kamera/galeri erişim izinleri").
   *
   * İzin **seçimden sonra** isteniyor: kullanıcı neyi neden verdiğini bilsin
   * diye. Form açılır açılmaz iki izin birden sormak, fotoğraf eklemeyecek
   * ebeveyni de iki diyalogla karşılardı.
   */
  const pickPhoto = () => {
    Alert.alert('Fotoğraf', 'Nereden eklemek istersin?', [
      { text: 'Galeriden seç', onPress: () => void fromLibrary() },
      { text: 'Fotoğraf çek', onPress: () => void fromCamera() },
      ...(photo || baby?.photoUrl
        ? [{ text: 'Kaldır', style: 'destructive' as const, onPress: () => setPhoto(null) }]
        : []),
      { text: 'Vazgeç', style: 'cancel' as const },
    ]);
  };

  const submit = async () => {
    if (!firstName.trim()) return setError('İsim zorunlu.');
    if (!dateOk) return setError('Doğum tarihi YYYY-AA-GG biçiminde olmalı.');
    if (Date.parse(birthDate) > Date.now()) return setError('Doğum tarihi gelecekte olamaz.');
    if (!timeOk) return setError('Doğum saati SS:DD biçiminde olmalı.');
    if (!weeksOk) return setError('Prematüre işaretliyken gebelik haftası 20–42 arası olmalı.');

    const measureError = Object.values(parsed).find((p) => p.error);
    if (measureError) return setError('Ölçü alanlarını kontrol et.');

    setError(null);
    setBusy(true);
    try {
      const input: BabyInput = {
        firstName,
        lastName,
        gender,
        birthDate,
        birthTime,
        birthWeightG: parsed.weight.value,
        birthHeightCm: parsed.height.value,
        headCircumferenceCm: parsed.head.value,
        isPremature,
        gestationalAgeWeeks: isPremature ? weeksNum : null,
        bloodType,
        note,
      };

      /*
       * Fotoğraf kayıtla AYNI istekte gidiyor (TEKNIK_DOKUMAN §22.14).
       * Önceden oluşturmada iki tur gerekiyordu — önce kayıt, sonra
       * fotoğraf — ve ağ zayıfken ikincisi düşerse bebek fotoğrafsız
       * kalıyordu.
       */
      await withSaveFeedback(async () => {
        if (editing) await updateBaby(baby.id, input, photo);
        else await addBaby(input, photo);
      });

      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const preview = photo ? { uri: photo.uri } : imageSource(baby?.photoUrl);

  return (
    <View style={s.wrap}>
      {error ? <FormError message={error} /> : null}

      <Pressable onPress={pickPhoto} disabled={busy} style={s.photoRow}>
        <View style={s.photo}>
          {preview ? (
            <Image source={preview} style={s.photoImg} resizeMode="cover" />
          ) : (
            <Icon name="camera" size={28} color={colors.textFaint} />
          )}
        </View>
        <Text style={s.photoLabel}>{preview ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}</Text>
      </Pressable>

      <Text style={s.label}>İsim *</Text>
      <TextInput style={s.input} value={firstName} onChangeText={setFirstName} placeholder="Elif" placeholderTextColor={colors.textFaint} editable={!busy} />

      <Text style={s.label}>Soyisim</Text>
      <TextInput style={s.input} value={lastName} onChangeText={setLastName} placeholder="Yılmaz" placeholderTextColor={colors.textFaint} editable={!busy} />

      <Text style={s.label}>Cinsiyet</Text>
      <View style={s.chips}>
        {GENDERS.map((g) => (
          <Pressable key={g.value} onPress={() => setGender(g.value)} disabled={busy} style={[s.chip, gender === g.value && s.chipOn]}>
            <Text style={[s.chipText, gender === g.value && s.chipTextOn]}>{g.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Takvim/saat seçicisi: biçimi elle tutturmak gerekmiyor, dolayısıyla
          "YYYY-AA-GG olmalı" hatası da pratikte oluşmuyor. */}
      <DateField
        label="Doğum tarihi *"
        value={birthDate || null}
        onChange={setBirthDate}
        placeholder="Doğum tarihini seç"
        maximumDate={new Date()}
        disabled={busy}
      />

      <TimeField
        label="Doğum saati"
        value={birthTime || null}
        onChange={setBirthTime}
        placeholder="Doğum saatini seç"
        onClear={() => setBirthTime('')}
        disabled={busy}
      />

      {MEASURES.map((f) => {
        const p = parsed[f.key as keyof typeof parsed];
        return (
          <View key={f.key}>
            <Text style={s.label}>{f.label}</Text>
            <TextInput
              style={[s.input, !!p.error && s.inputError]}
              value={raw[f.key as keyof typeof raw]}
              onChangeText={setters[f.key]}
              placeholder={f.hint}
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              editable={!busy}
            />
            {p.error ? <Text style={s.fieldError}>{p.error}</Text> : null}
          </View>
        );
      })}

      <View style={s.switchRow}>
        <View style={s.switchText}>
          <Text style={s.label}>Prematüre doğdu</Text>
          <Text style={s.hint}>Gelişim, beklenen doğum tarihine göre de gösterilir.</Text>
        </View>
        <Switch
          value={isPremature}
          onValueChange={setIsPremature}
          disabled={busy}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.surface}
        />
      </View>

      {isPremature ? (
        <>
          <Text style={s.label}>Gebelik haftası * (20–42)</Text>
          <TextInput
            style={[s.input, !weeksOk && s.inputError]}
            value={weeks}
            onChangeText={setWeeks}
            placeholder="34"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            editable={!busy}
          />
        </>
      ) : null}

      <Text style={s.label}>Kan grubu</Text>
      <View style={s.chips}>
        {BLOOD_TYPES.map((bt) => (
          <Pressable key={bt} onPress={() => setBloodType(bloodType === bt ? null : bt)} disabled={busy} style={[s.chip, bloodType === bt && s.chipOn]}>
            <Text style={[s.chipText, bloodType === bt && s.chipTextOn]}>{bt}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Not</Text>
      <TextInput style={[s.input, s.multiline]} value={note} onChangeText={setNote} placeholder="Doğum ve sağlık notları" placeholderTextColor={colors.textFaint} multiline editable={!busy} />

      {agePreview ? (
        <View style={s.preview}>
          <Text style={s.previewText}>Yaş: {agePreview.label}</Text>
          {correctedPreview ? (
            <Text style={s.previewCorrected}>Düzeltilmiş: {correctedPreview.label}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={s.actions}>
        <Button
          label={busy ? 'Kaydediliyor…' : editing ? 'Değişiklikleri kaydet' : 'Kaydet'}
          onPress={submit}
          disabled={busy}
        />
        <Button label="İptal" variant="ghost" onPress={onDone} disabled={busy} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: spacing.xs, paddingBottom: spacing.lg },
  label: { ...typography.small, color: colors.textSoft, fontWeight: '600', marginTop: spacing.sm },
  hint: { ...typography.tiny, color: colors.textFaint },
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
  multiline: { height: 88, paddingTop: spacing.sm, textAlignVertical: 'top' },
  fieldError: { ...typography.tiny, color: colors.danger, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft ?? colors.surface },
  chipText: { ...typography.small, color: colors.textSoft },
  chipTextOn: { color: colors.primary, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  switchText: { flex: 1 },
  photoRow: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg: { width: '100%', height: '100%' },
  photoPlaceholder: { fontSize: 28 },
  photoLabel: { ...typography.small, color: colors.primary, fontWeight: '600' },
  preview: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    gap: 2,
  },
  previewText: { ...typography.small, color: colors.text, fontWeight: '600' },
  previewCorrected: { ...typography.tiny, color: colors.textSoft },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
