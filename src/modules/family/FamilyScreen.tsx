import React, { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chips } from '../../components/records';
import { Button, Card, EmptyState, FormError, Loading, Screen, SectionTitle } from '../../components/ui';
import { errorText } from '../../core/api/client';
import {
  GRANTABLE_PERMISSIONS, RELATIONSHIPS, RELATIONSHIP_LABELS,
  familyService,
  type Invitation, type Member, type MyInvitation, type Permission, type Relationship,
} from '../../core/api/modules';
import { useAuthStore } from '../../core/auth/useAuthStore';
import { useAsyncData } from '../../core/hooks/useAsyncData';
import { refreshAll } from '../../core/sync/refreshAll';
import { useBabyStore } from '../../core/stores/useBabyStore';
import { colors, radius, spacing, typography } from '../../core/theme';
import { withSaveFeedback } from '../../core/feedback/withSaveFeedback';

const PERMISSION_LABELS: Record<Permission, string> = {
  owner: 'Sahip',
  editor: 'Düzenleyebilir',
  viewer: 'Yalnızca görebilir',
};

const GRANTABLE_LABELS = {
  editor: 'Düzenleyebilir',
  viewer: 'Yalnızca görebilir',
} as const;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function dateOf(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('tr-TR');
}

/**
 * Modül 10 — Aile ve Yetkiler.
 *
 * Yetki modeli sunucuda tek noktadan uygulanır (`requireBaby`, §5.5); ekran
 * yalnızca **gösterir**. `my_permission` sahip değilse yönetim kontrolleri hiç
 * çizilmez — gizlemek güvenlik değildir, asıl engel sunucudadır; amaç
 * kullanıcıya kesin reddedilecek bir düğme sunmamaktır.
 *
 * Davet kodu yanıtta bir kez döndüğü için oluşturulduğu anda kart hâlinde
 * gösterilir ve paylaşma düğmesi sunulur; ekran yenilenirse kod geri gelmez.
 */
export default function FamilyScreen() {
  const baby = useBabyStore((s) => s.selected());
  const babyId = baby?.id ?? null;
  const myUserId = useAuthStore((s) => s.user?.id ?? null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('diger');
  const [permission, setPermission] = useState<'editor' | 'viewer'>('viewer');
  const [freshCode, setFreshCode] = useState<{ code: string; email: string } | null>(null);

  const [joinCode, setJoinCode] = useState('');

  const members = useAsyncData(
    () => (babyId ? familyService.members(babyId) : Promise.resolve(null)),
    [babyId],
  );
  const invitations = useAsyncData(
    // Davet listesi yalnızca sahibe açık; yetkisiz çağrı 404 döneceği için
    // sahip olmadığımız biliniyorsa hiç istenmez.
    () => (babyId && members.data?.my_permission === 'owner'
      ? familyService.invitations(babyId)
      : Promise.resolve({ invitations: [] })),
    [babyId, members.data?.my_permission],
  );
  const mine = useAsyncData(() => familyService.myInvitations(), []);

  const memberRows = members.data?.members ?? [];
  const myPermission = members.data?.my_permission ?? 'viewer';
  const isOwner = myPermission === 'owner';
  const pending = (invitations.data?.invitations ?? []).filter((i) => i.status === 'pending');
  const myInvites = mine.data?.invitations ?? [];

  const reloadAll = () => {
    members.reload();
    invitations.reload();
    mine.reload();
  };

  const run = async (fn: () => Promise<unknown>, after: () => void = reloadAll) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      after();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const sendInvite = () => {
    if (!babyId) return;
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError('Geçerli bir e-posta gir.');
      return;
    }
    void run(
      async () => {
        const res = await withSaveFeedback(
          () => familyService.invite(babyId, { email: value, relationship, permission }),
          // Panelde "Davet Oluştur" tetikleyicisi ayrı açılıp kapatılıyor
          // (Reklam.md §0.3-C); 'save' geçersek o anahtar hiç işlemezdi.
          undefined,
          'invite',
        );
        setFreshCode({ code: res.code, email: res.email });
        setEmail('');
        setInviteOpen(false);
      },
      reloadAll,
    );
  };

  const shareCode = (code: string) => {
    const name = baby?.firstName ?? 'bebeğim';
    void Share.share({
      message:
        `Bebiqa'te "${name}" kaydına davetlisin. ` +
        `Uygulamada "Davet kodumu gir" alanına şu kodu yaz: ${code}`,
    }).catch(() => undefined);
  };

  const changePermission = (m: Member, next: 'editor' | 'viewer') => {
    if (!babyId) return;
    void run(() => familyService.updateMember(babyId, m.user_id, { permission: next }));
  };

  const changeRelationship = (m: Member, next: Relationship) => {
    if (!babyId) return;
    void run(() => familyService.updateMember(babyId, m.user_id, { relationship: next }));
  };

  const removeMember = (m: Member) => {
    if (!babyId) return;
    Alert.alert(
      'Aileden çıkar',
      `${m.display_name} bu bebeğin kayıtlarına artık erişemeyecek. Devam edilsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkar',
          style: 'destructive',
          onPress: () => void run(() => familyService.removeMember(babyId, m.user_id)),
        },
      ],
    );
  };

  const transfer = (m: Member) => {
    if (!babyId) return;
    Alert.alert(
      'Sahipliği devret',
      `"${m.display_name}" sahip olacak, sen düzenleyici olacaksın. Bu işlem geri alınamaz — ` +
        'yetkiyi geri almak için yeni sahibin devretmesi gerekir.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Devret',
          style: 'destructive',
          onPress: () => void run(() => familyService.transferOwnership(babyId, m.user_id)),
        },
      ],
    );
  };

  const revoke = (inv: Invitation) => {
    if (!babyId) return;
    void run(() => familyService.revokeInvitation(babyId, inv.id));
  };

  const leave = () => {
    if (!babyId) return;
    Alert.alert(
      'Aileden ayrıl',
      `"${baby?.firstName ?? 'Bu bebek'}" kayıtlarına erişimini kaybedeceksin. Devam edilsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Ayrıl',
          style: 'destructive',
          onPress: () => void run(
            () => familyService.leave(babyId),
            // Ayrıldıktan sonra bebek listesi değişir; bebek deposu yenilenmeli
            // yoksa artık erişimi olmayan bebek seçili kalırdı.
            () => void refreshAll({ includePrivate: true }),
          ),
        },
      ],
    );
  };

  const acceptInvite = (by: { code?: string; invitation_id?: number }) => {
    void run(
      () => withSaveFeedback(() => familyService.accept(by)),
      () => {
        setJoinCode('');
        void refreshAll({ includePrivate: true });
        reloadAll();
      },
    );
  };

  const declineInvite = (inv: MyInvitation) => {
    void run(() => familyService.decline({ invitation_id: inv.id }));
  };

  /* ── bana gelen davetler bebek seçili olmasa da gösterilmeli ── */
  const incomingSection = (
    <>
      <SectionTitle hint="Kabul edince o bebeğin kayıtlarına erişirsin.">
        Bana gelen davetler
      </SectionTitle>
      <Card>
        {mine.loading && myInvites.length === 0 ? (
          <Loading label="Davetler yükleniyor…" />
        ) : myInvites.length === 0 ? (
          <Text style={s.hint}>Bekleyen davet yok.</Text>
        ) : (
          myInvites.map((inv) => (
            <View key={inv.id} style={s.row}>
              <View style={s.rowBody}>
                <Text style={s.rowTitle}>
                  {inv.baby_name} · {RELATIONSHIP_LABELS[inv.relationship]}
                </Text>
                <Text style={s.rowDetail}>
                  {inv.invited_by_name} davet etti · {PERMISSION_LABELS[inv.permission]}
                  {inv.expires_at ? ` · ${dateOf(inv.expires_at)} tarihine kadar` : ''}
                </Text>
              </View>
            </View>
          ))
        )}

        {myInvites.map((inv) => (
          <View key={`act-${inv.id}`} style={s.actionRow}>
            <View style={s.actionCol}>
              <Button
                label={`${inv.baby_name} · Kabul et`}
                onPress={() => acceptInvite({ invitation_id: inv.id })}
                disabled={busy}
              />
            </View>
            <View style={s.actionCol}>
              <Button label="Reddet" variant="ghost" onPress={() => declineInvite(inv)} disabled={busy} />
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={s.label}>Davet kodumu gir</Text>
        <Text style={s.hint}>
          E-postayla gelen daveti göremiyorsan, davet eden kişiden kodu isteyip buraya yaz.
        </Text>
        <TextInput
          style={s.input}
          value={joinCode}
          onChangeText={setJoinCode}
          placeholder="ABC123"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!busy}
        />
        <View style={s.gapXs} />
        <Button
          label={busy ? 'Katılıyor…' : 'Davete katıl'}
          onPress={() => {
            const code = joinCode.trim().toUpperCase();
            if (code.length < 6) {
              setError('Davet kodu en az 6 karakter.');
              return;
            }
            acceptInvite({ code });
          }}
          disabled={busy || joinCode.trim().length === 0}
        />
      </Card>
    </>
  );

  if (!baby) {
    return (
      <Screen>
        {error ? <FormError message={error} /> : null}
        <EmptyState
          icon="family"
          title="Henüz bebek profilin yok"
          detail="Kendi bebeğini ekleyebilir ya da sana gelen bir daveti kabul edebilirsin."
        />
        {incomingSection}
      </Screen>
    );
  }

  return (
    <Screen>
      {error ? <FormError message={error} /> : null}

      {/* ── Yeni davet kodu (bir kez gösterilir) ── */}
      {freshCode ? (
        <View style={s.codeCard}>
          <Text style={s.codeTitle}>Davet kodu oluşturuldu</Text>
          <Text style={s.code}>{freshCode.code}</Text>
          <Text style={s.codeHint}>
            {freshCode.email} adresine ait. Bu kod bir daha gösterilmez — şimdi paylaş.
          </Text>
          <View style={s.gapXs} />
          <Button label="Kodu paylaş" onPress={() => shareCode(freshCode.code)} />
          <Button label="Kapat" variant="ghost" onPress={() => setFreshCode(null)} />
        </View>
      ) : null}

      {/* ── Üyeler ── */}
      <SectionTitle hint={isOwner ? 'Yetkileri yalnızca sahip değiştirebilir.' : `Bu bebekteki rolün: ${PERMISSION_LABELS[myPermission]}`}>
        Aile üyeleri
      </SectionTitle>
      <Card>
        {members.loading && memberRows.length === 0 ? (
          <Loading label="Üyeler yükleniyor…" />
        ) : members.error ? (
          <Text style={s.hint}>{members.error}</Text>
        ) : (
          memberRows.map((m) => {
            const isMe = m.user_id === myUserId;
            const manageable = isOwner && !isMe && m.permission !== 'owner';
            return (
              <View key={m.user_id} style={s.member}>
                <View style={s.row}>
                  <View style={s.rowBody}>
                    <Text style={s.rowTitle}>
                      {m.display_name}
                      {isMe ? ' (sen)' : ''}
                    </Text>
                    <Text style={s.rowDetail}>
                      {m.email} · katıldı {dateOf(m.joined_at)}
                    </Text>
                  </View>
                  <View style={[s.badge, m.permission === 'owner' && s.badgeOwner]}>
                    <Text style={[s.badgeText, m.permission === 'owner' && s.badgeTextOwner]}>
                      {PERMISSION_LABELS[m.permission]}
                    </Text>
                  </View>
                </View>

                {manageable ? (
                  <>
                    <Text style={s.label}>Yetki</Text>
                    <Chips
                      options={GRANTABLE_PERMISSIONS}
                      value={m.permission === 'editor' ? 'editor' : 'viewer'}
                      onChange={(v) => v && v !== m.permission && changePermission(m, v)}
                      labels={GRANTABLE_LABELS}
                      disabled={busy}
                    />
                    <Text style={s.label}>Yakınlık</Text>
                    <Chips
                      options={RELATIONSHIPS}
                      value={m.relationship}
                      onChange={(v) => v && v !== m.relationship && changeRelationship(m, v)}
                      labels={RELATIONSHIP_LABELS}
                      disabled={busy}
                    />
                    <View style={s.actionRow}>
                      <View style={s.actionCol}>
                        <Button label="Sahipliği devret" variant="ghost" onPress={() => transfer(m)} disabled={busy} />
                      </View>
                      <View style={s.actionCol}>
                        <Button label="Aileden çıkar" variant="ghost" onPress={() => removeMember(m)} disabled={busy} />
                      </View>
                    </View>
                  </>
                ) : null}
              </View>
            );
          })
        )}
      </Card>

      {/* ── Davet et (yalnızca sahip) ── */}
      {isOwner ? (
        <>
          <SectionTitle hint="Davet 7 gün geçerlidir; e-posta ile eşleşmesi gerekir.">
            Davet et
          </SectionTitle>

          {inviteOpen ? (
            <Card>
              <Text style={s.label}>E-posta *</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="babasi@ornek.com"
                placeholderTextColor={colors.textFaint}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
              />

              <Text style={s.label}>Yakınlık</Text>
              <Chips
                options={RELATIONSHIPS}
                value={relationship}
                onChange={(v) => v && setRelationship(v)}
                labels={RELATIONSHIP_LABELS}
                disabled={busy}
              />

              <Text style={s.label}>Yetki</Text>
              <Chips
                options={GRANTABLE_PERMISSIONS}
                value={permission}
                onChange={(v) => v && setPermission(v)}
                labels={GRANTABLE_LABELS}
                disabled={busy}
              />

              <View style={s.gap} />
              <Button label={busy ? 'Gönderiliyor…' : 'Davet oluştur'} onPress={sendInvite} disabled={busy} />
              <Button label="Vazgeç" variant="ghost" onPress={() => setInviteOpen(false)} disabled={busy} />
            </Card>
          ) : (
            <Button label="+ Aileye birini davet et" variant="ghost" onPress={() => setInviteOpen(true)} />
          )}

          <Card>
            <Text style={s.label}>Bekleyen davetler</Text>
            {invitations.loading && pending.length === 0 ? (
              <Loading label="Yükleniyor…" />
            ) : pending.length === 0 ? (
              <Text style={s.hint}>Bekleyen davet yok.</Text>
            ) : (
              pending.map((inv) => (
                <Pressable key={inv.id} style={s.row} onLongPress={() => revoke(inv)}>
                  <View style={s.rowBody}>
                    <Text style={s.rowTitle}>{inv.email}</Text>
                    <Text style={s.rowDetail}>
                      {RELATIONSHIP_LABELS[inv.relationship]} · {PERMISSION_LABELS[inv.permission]}
                      {inv.expires_at ? ` · ${dateOf(inv.expires_at)} tarihine kadar` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => revoke(inv)} hitSlop={8} disabled={busy}>
                    <Text style={s.revoke}>İptal</Text>
                  </Pressable>
                </Pressable>
              ))
            )}
          </Card>
        </>
      ) : (
        <Card>
          <Text style={s.label}>Aileden ayrıl</Text>
          <Text style={s.hint}>
            Bu bebeğin kayıtlarına erişimini bırakırsın. Kayıtlar silinmez.
          </Text>
          <View style={s.gapXs} />
          <Button label="Aileden ayrıl" variant="ghost" onPress={leave} disabled={busy} />
        </Card>
      )}

      {incomingSection}
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { ...typography.small, color: colors.textSoft, fontWeight: '600', marginTop: spacing.sm },
  hint: { ...typography.small, color: colors.textSoft },
  gap: { height: spacing.sm },
  gapXs: { height: spacing.xs },
  member: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  rowBody: { flex: 1 },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  rowDetail: { ...typography.tiny, color: colors.textSoft, marginTop: 1 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  badgeOwner: { backgroundColor: colors.primarySoft },
  badgeText: { ...typography.tiny, color: colors.textSoft, fontWeight: '700' },
  badgeTextOwner: { color: colors.primary },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionCol: { flex: 1 },
  revoke: { ...typography.small, color: colors.danger, fontWeight: '700' },
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
  codeCard: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.md },
  codeTitle: { ...typography.small, color: colors.primary, fontWeight: '700' },
  code: {
    ...typography.h1,
    color: colors.text,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
    marginVertical: spacing.xs,
  },
  codeHint: { ...typography.tiny, color: colors.textSoft },
});
