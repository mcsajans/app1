import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BabyAvatar } from '../../components/BabyBar';
import { Button, Card, EmptyState, FormError, Screen, SectionTitle } from '../../components/ui';
import { errorText } from '../../core/api/client';
import { familyService } from '../../core/api/modules';
import { refreshAll } from '../../core/sync/refreshAll';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { calcAge, calcCorrectedAge } from '../../core/utils/age';
import { Icon } from '../../components/Icon';
import { colors, moduleTint, radius, spacing, typography } from '../../core/theme';
import type { Baby, Permission } from '../../core/types';
import { BabyForm } from './BabyForm';
import { withSaveFeedback } from '../../core/feedback/withSaveFeedback';

const GENDER_LABELS: Record<string, string> = {
  kiz: 'Kız', erkek: 'Erkek', belirtilmedi: 'Belirtilmedi',
};

const PERMISSION_LABELS: Record<Permission, string> = {
  owner: 'Sahip',
  editor: 'Düzenleyebilir',
  viewer: 'Yalnızca görüntüleme',
};

/** Davet kodları büyük harf + rakam, en az 6 karakter (sunucu da böyle üretir). */
const MIN_CODE = 6;

/** Ekranın hangi kipte olduğu: liste, iki seçenekli menü, kod girişi, form. */
type Mode = 'list' | 'choose' | 'code' | 'create' | 'edit';

/**
 * Modül 1 — Bebek Profilleri.
 *
 * "Bebek ekle" iki yoldan ilerler: yeni profil oluşturmak ya da **paylaşım
 * kodu** ile var olan bir bebeğe katılmak. İkincisi eskiden yalnızca Aile ve
 * Yetkiler ekranının en altındaydı; oysa daveti alan kişinin aradığı yer
 * "bebek ekle" düğmesidir — bebeği olmayan yeni bir kullanıcı Aile ekranına
 * gitmeyi düşünmez.
 *
 * Katıldıktan sonra bebek listeye, davette verilen yetkiyle düşer; `viewer`
 * olan üyeye düzenleme yolu hiç gösterilmez (asıl engel sunucuda, §5.5).
 */
export default function BabiesScreen() {
  const babies = useBabyStore((s) => s.babies);
  const selectedId = useBabyStore((s) => s.selectedId);
  const selectBaby = useBabyStore((s) => s.selectBaby);

  const [mode, setMode] = useState<Mode>('list');
  const [editing, setEditing] = useState<Baby | null>(null);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);

  const backToList = () => {
    setMode('list');
    setEditing(null);
    setCode('');
    setError(null);
  };

  const join = async () => {
    const value = code.trim().toUpperCase();
    if (value.length < MIN_CODE) {
      setError(`Davet kodu en az ${MIN_CODE} karakter olmalı.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await withSaveFeedback(() => familyService.accept({ code: value }));
      // Bebek listesi sunucudan yeniden çekilmeli; yeni bebek ancak
      // tazelemeden sonra yerel aynaya düşer.
      await refreshAll({ includePrivate: true });
      setJoined(value);
      backToList();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  /* ── Yeni profil / düzenleme formu ── */
  if (mode === 'create' || mode === 'edit') {
    return (
      <Screen>
        <SectionTitle hint={editing ? 'Bilgileri güncelle.' : 'Tüm kayıtlar seçili bebeğe bağlı tutulur.'}>
          {editing ? `${editing.firstName} profilini düzenle` : 'Yeni bebek ekle'}
        </SectionTitle>
        <Card>
          <BabyForm baby={editing ?? undefined} onDone={backToList} />
        </Card>
        <Button label="Vazgeç" variant="ghost" onPress={backToList} />
      </Screen>
    );
  }

  /* ── Paylaşım kodu girişi ── */
  if (mode === 'code') {
    return (
      <Screen>
        <SectionTitle hint="Kodu, bebeği paylaşan kişi uygulamadan oluşturur.">
          Paylaşım kodu ile ekle
        </SectionTitle>

        {error ? <FormError message={error} /> : null}

        <Card>
          <Text style={s.label}>Davet kodu</Text>
          <TextInput
            style={s.codeInput}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="ABC123"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            maxLength={12}
          />
          <Text style={s.hint}>
            Kod yalnızca davet edildiğin e-posta adresiyle çalışır ve 7 gün
            geçerlidir. Katıldığında bebek, sana verilen yetkiyle listene eklenir.
          </Text>

          <View style={s.gap} />
          <Button
            label={busy ? 'Katılınıyor…' : 'Bebeğe katıl'}
            onPress={() => void join()}
            disabled={busy || code.trim().length === 0}
          />
        </Card>

        <Button label="Vazgeç" variant="ghost" onPress={backToList} disabled={busy} />
      </Screen>
    );
  }

  /* ── İki seçenekli menü ── */
  if (mode === 'choose') {
    return (
      <Screen>
        <SectionTitle hint="Yeni bir profil oluştur ya da paylaşılan bir bebeğe katıl.">
          Bebek ekle
        </SectionTitle>

        <Pressable
          onPress={() => setMode('create')}
          style={({ pressed }) => [s.option, pressed && s.optionPressed]}
          accessibilityRole="button"
        >
          <View style={[s.optionIcon, { backgroundColor: moduleTint.babies }]}>
            <Icon name="babies" size={28} color={colors.primary} />
          </View>
          <View style={s.optionBody}>
            <Text style={s.optionTitle}>Yeni bebek ekle</Text>
            <Text style={s.optionDetail}>
              Kendi bebeğinin profilini oluştur. Sahibi sen olursun ve başkalarını davet edebilirsin.
            </Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => setMode('code')}
          style={({ pressed }) => [s.option, pressed && s.optionPressed]}
          accessibilityRole="button"
        >
          <View style={[s.optionIcon, { backgroundColor: moduleTint.family }]}>
            <Icon name="key" size={28} color={colors.primary} />
          </View>
          <View style={s.optionBody}>
            <Text style={s.optionTitle}>Paylaşım kodum var</Text>
            <Text style={s.optionDetail}>
              Sana verilen davet kodunu gir; bebek, verilen yetkiyle listene eklensin.
            </Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        <Button label="Vazgeç" variant="ghost" onPress={backToList} />
      </Screen>
    );
  }

  /* ── Liste ── */
  return (
    <Screen>
      <SectionTitle hint="Dokunarak aktif bebeği değiştirebilirsin.">Bebek profilleri</SectionTitle>

      {joined ? (
        <View style={s.success}>
          <Text style={s.successText}>Davet kabul edildi, bebek listene eklendi.</Text>
          <Pressable onPress={() => setJoined(null)} hitSlop={8}>
            <Icon name="close" size={16} color={colors.success} />
          </Pressable>
        </View>
      ) : null}

      {babies.length === 0 ? (
        <Card>
          <EmptyState
            icon="babies"
            title="Henüz bebek profilin yok"
            detail="Kendi profilini oluşturabilir ya da sana verilen paylaşım koduyla var olan bir bebeğe katılabilirsin."
          />
        </Card>
      ) : (
        <Card>
          {babies.map((b) => {
            const active = b.id === selectedId;
            const corrected = calcCorrectedAge(b.birthDate, {
              isPremature: b.isPremature,
              gestationalAgeWeeks: b.gestationalAgeWeeks,
            });
            // Salt okuyan üyeye düzenleme yolu hiç gösterilmez.
            const canEdit = b.myPermission !== 'viewer';
            return (
              <Pressable
                key={b.id}
                onPress={() => selectBaby(b.id)}
                style={({ pressed }) => [s.row, active && s.rowActive, pressed && s.rowPressed]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <BabyAvatar baby={b} size={46} />
                <View style={s.info}>
                  <Text style={s.name} numberOfLines={1}>
                    {b.firstName}
                    {b.lastName ? ` ${b.lastName}` : ''}
                    {active ? ' · aktif' : ''}
                  </Text>
                  <Text style={s.detail} numberOfLines={1}>
                    {calcAge(b.birthDate).label}
                    {corrected ? ` · düzeltilmiş ${corrected.label}` : ''}
                    {' · '}
                    {GENDER_LABELS[b.gender] ?? b.gender}
                  </Text>
                  <View style={s.badges}>
                    <View style={[s.badge, b.isOwner && s.badgeOwner]}>
                      <Text style={[s.badgeText, b.isOwner && s.badgeTextOwner]}>
                        {PERMISSION_LABELS[b.myPermission]}
                      </Text>
                    </View>
                    {/* Paylaşılan bebekte kimin paylaştığı önemli bilgi. */}
                    {!b.isOwner && b.ownerName ? (
                      <Text style={s.shared} numberOfLines={1}>
                        {b.ownerName} paylaştı
                      </Text>
                    ) : null}
                    {b.memberCount > 1 ? (
                      <Text style={s.shared}>{b.memberCount} kişi</Text>
                    ) : null}
                  </View>
                </View>
                {canEdit ? (
                  <Pressable
                    onPress={() => {
                      setEditing(b);
                      setMode('edit');
                    }}
                    hitSlop={8}
                    style={s.edit}
                    accessibilityRole="button"
                    accessibilityLabel={`${b.firstName} profilini düzenle`}
                  >
                    <Text style={s.editText}>Düzenle</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
        </Card>
      )}

      <Button label="+ Bebek ekle" onPress={() => setMode('choose')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  rowActive: { backgroundColor: colors.primarySoft },
  rowPressed: { opacity: 0.7 },
  info: { flex: 1, gap: 2 },
  name: { ...typography.body, color: colors.text, fontWeight: '700' },
  detail: { ...typography.tiny, color: colors.textSoft },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  badgeOwner: { backgroundColor: colors.primarySoft },
  badgeText: { ...typography.tiny, color: colors.textSoft, fontWeight: '700' },
  badgeTextOwner: { color: colors.primary },
  shared: { ...typography.tiny, color: colors.textFaint },
  edit: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  editText: { ...typography.small, color: colors.primary, fontWeight: '700' },

  // ── iki seçenekli menü ──
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  optionPressed: { opacity: 0.7 },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionEmoji: { fontSize: 26 },
  optionBody: { flex: 1, gap: 2 },
  optionTitle: { ...typography.h3, color: colors.text },
  optionDetail: { ...typography.tiny, color: colors.textSoft },
  chevron: { ...typography.h2, color: colors.textFaint },

  // ── kod girişi ──
  label: { ...typography.small, color: colors.textSoft, fontWeight: '600' },
  codeInput: {
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.md,
    ...typography.h2,
    color: colors.text,
    letterSpacing: 4,
    textAlign: 'center',
  },
  hint: { ...typography.tiny, color: colors.textFaint, marginTop: spacing.xs },
  gap: { height: spacing.sm },

  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#E6F6EC',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  successText: { ...typography.small, color: colors.success, fontWeight: '600', flex: 1 },
  successClose: { ...typography.small, color: colors.success },
});
