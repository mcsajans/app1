import React, { useEffect, useState } from 'react';
import {
  Animated, Easing, Modal, Pressable, ScrollView,
  StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RELATIONSHIP_LABELS, type AuditFields } from '../core/api/modules';
import { Icon, type IconName } from './Icon';
import { colors, radius, spacing, typography } from '../core/theme';
import { Button } from './ui';
import { StatTile } from './records';

const DURATION = 200;

export type DetailStat = { label: string; value: string; hint?: string; tone?: 'neutral' | 'warn' | 'good' };

/** Değeri boş olan satırlar çizilmez — "detaylı" demek "boş alan dolu" demek değil. */
export type DetailRow = { label: string; value: string | number | null | undefined };

export type RecordDetail = {
  icon: IconName;
  title: string;
  subtitle?: string;
  /** Üstte büyük rakamlar — en fazla üç tane sığar. */
  stats?: DetailStat[];
  rows?: DetailRow[];
  note?: string | null;
  /** Uyarı kutusu: alerji, şiddetli pişik gibi dikkat çekmesi gereken durumlar. */
  warning?: string | null;
  audit?: AuditFields;
  recordId?: number;
  /** Modüle özgü eylemler (ör. "Kullanıldı işaretle"); silmenin üstünde çizilir. */
  actions?: { label: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'danger' }[];
  onDelete?: () => void;
};

/** "2 Kasım 2026, 14:30" — detayda tarih de gerekir, saat tek başına belirsiz. */
export function fullMoment(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** "3 saat önce" — mutlak zamanın yanında göreli zaman okumayı kolaylaştırır. */
export function relativeMoment(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;

  const diffMin = Math.round((Date.now() - t) / 60_000);
  if (diffMin < 1) return 'az önce';
  if (diffMin < 60) return `${diffMin} dakika önce`;

  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} saat önce`;

  const diffDay = Math.round(diffHour / 24);
  return diffDay === 1 ? 'dün' : `${diffDay} gün önce`;
}

/**
 * Kayıt detay raporu — alttan açılan sayfa.
 *
 * Geçmiş listelerindeki satırlar tek satıra sığsın diye kırpılıyor; bu
 * yüzden renk, kıvam, uyanma sebebi, notu giren kişi gibi alanlar hiç
 * görünmüyordu. Burada kaydın **tamamı** gösterilir.
 *
 * Silme de buraya taşındı: önceden yalnızca uzun basmakla yapılabiliyordu ve
 * keşfedilebilir değildi. Uzun basma kısayol olarak kaldı.
 *
 * `AccountDrawer` ile aynı animasyon kalıbını kullanır: `Modal`'ın
 * görünürlüğü `visible`'dan ayrı tutulur ki kapanış animasyonu yutulmasın.
 */
export function RecordDetailSheet({
  detail,
  onClose,
}: {
  detail: RecordDetail | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const visible = detail !== null;

  const [progress] = useState(() => new Animated.Value(0));
  const [exiting, setExiting] = useState(false);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (!visible) setExiting(true);
  }

  /*
   * Kapanırken `detail` zaten null olur; son içeriği saklamazsak sayfa
   * kapanış animasyonu boyunca bomboş görünürdü.
   */
  const [shown, setShown] = useState(detail);
  if (detail !== null && detail !== shown) setShown(detail);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: DURATION,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setExiting(false);
    });
    return () => animation.stop();
  }, [visible, progress]);

  if (!visible && !exiting) return null;
  if (!shown) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });
  const rows = (shown.rows ?? []).filter(
    (r) => r.value !== null && r.value !== undefined && String(r.value).trim() !== '',
  );
  const actor = auditActor(shown.audit);
  /** Denetim bölümünde çizilecek en az bir satır var mı? */
  const hasAudit =
    actor !== null ||
    Boolean(shown.audit?.entry_source) ||
    Boolean(shown.audit?.created_at) ||
    wasEdited(shown.audit) ||
    shown.recordId !== undefined;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[s.scrim, { opacity: progress }]}>
        <Pressable
          style={s.fill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Kayıt detayını kapat"
        />
      </Animated.View>

      <Animated.View
        style={[
          s.sheet,
          { maxHeight: height * 0.85, paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] },
        ]}
      >
        <View style={s.handle} />

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* ── Başlık ── */}
          <View style={s.header}>
            <Icon name={shown.icon} size={34} color={colors.text} />
            <View style={s.headerText}>
              <Text style={s.title}>{shown.title}</Text>
              {shown.subtitle ? <Text style={s.subtitle}>{shown.subtitle}</Text> : null}
            </View>
          </View>

          {shown.warning ? (
            <View style={s.warn}>
              <Text style={s.warnText}>{shown.warning}</Text>
            </View>
          ) : null}

          {/* ── Öne çıkan rakamlar ── */}
          {shown.stats && shown.stats.length > 0 ? (
            <View style={s.stats}>
              {shown.stats.map((st) => (
                <StatTile key={st.label} label={st.label} value={st.value} hint={st.hint} tone={st.tone} />
              ))}
            </View>
          ) : null}

          {/* ── Ayrıntılar ── */}
          {rows.length > 0 ? (
            <View style={s.group}>
              {rows.map((r) => (
                <Row key={r.label} label={r.label} value={String(r.value)} />
              ))}
            </View>
          ) : null}

          {shown.note ? (
            <View style={s.noteBox}>
              <Text style={s.noteLabel}>Not</Text>
              <Text style={s.noteText}>{shown.note}</Text>
            </View>
          ) : null}

          {/*
            ── Denetim izi ──
            Bölüm yalnızca gösterecek bir şey varsa çizilir. Akış ekranı
            kayıtların **özetini** taşır ve `audit` vermez (TimelineScreen'deki
            `detailOf`); orada başlık boş bir kutunun üstünde asılı kalıyordu.
          */}
          {hasAudit ? (
          <>
          <Text style={s.sectionLabel}>Kayıt bilgisi</Text>
          <View style={s.group}>
            {actor ? <Row label="Giren kişi" value={actor} /> : null}
            {shown.audit?.entry_source ? (
              <Row
                label="Giriş şekli"
                value={shown.audit.entry_source === 'timer' ? 'Kronometreyle' : 'Elle girildi'}
              />
            ) : null}
            {shown.audit?.created_at ? (
              <Row
                label="Oluşturuldu"
                value={`${fullMoment(shown.audit.created_at)} · ${relativeMoment(shown.audit.created_at)}`}
              />
            ) : null}
            {/* Düzenlenmemiş kayıtta satır çizilmez — bkz. wasEdited(). */}
            {wasEdited(shown.audit) ? (
              <Row
                label="Güncellendi"
                value={`${fullMoment(shown.audit?.updated_at)} · ${relativeMoment(shown.audit?.updated_at)}`}
              />
            ) : null}
            {shown.recordId !== undefined ? <Row label="Kayıt no" value={`#${shown.recordId}`} /> : null}
          </View>
          </>
          ) : null}

          <View style={s.actions}>
            {(shown.actions ?? []).map((a) => (
              <Button key={a.label} label={a.label} variant={a.variant ?? 'primary'} onPress={a.onPress} />
            ))}
            {shown.onDelete ? (
              <Button label="Kaydı sil" variant="danger" onPress={shown.onDelete} />
            ) : null}
            <Button label="Kapat" variant="ghost" onPress={onClose} />
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

/**
 * Kayıt gerçekten düzenlenmiş mi?
 *
 * `updated_at !== created_at` karşılaştırması yetmiyor: satır transaction
 * içinde önce eklenip sonra dokunulduğu için ikisi **milisaniye** farkla
 * yazılabiliyor ve hiç düzenlenmemiş kayıtlarda bile "Güncellendi" satırı
 * çiziliyordu. Saniye çözünürlüğünde karşılaştırmak bu gürültüyü eler;
 * aynı saniye içinde yapılan gerçek bir düzenlemeyi kaçırmak ise zararsız.
 */
function wasEdited(audit: AuditFields | undefined): boolean {
  if (!audit?.updated_at || !audit.created_at) return false;
  const sec = (iso: string) => Math.floor(Date.parse(iso) / 1000);
  return sec(audit.updated_at) !== sec(audit.created_at);
}

/** "Baba Mehmet" — yakınlık bilinmiyorsa yalnızca ad. */
function auditActor(audit: AuditFields | undefined): string | null {
  if (!audit?.actor_name) return null;
  const rel = audit.actor_relationship ? RELATIONSHIP_LABELS[audit.actor_relationship] : null;
  return rel ? `${rel} ${audit.actor_name}` : audit.actor_name;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  content: { gap: spacing.md, paddingBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1 },
  title: { ...typography.h3, color: colors.text },
  subtitle: { ...typography.small, color: colors.textSoft, marginTop: 2 },
  warn: { backgroundColor: '#FDECEC', borderRadius: radius.md, padding: spacing.md },
  warnText: { ...typography.small, color: colors.danger, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: spacing.sm },
  sectionLabel: {
    ...typography.small,
    color: colors.textSoft,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { ...typography.small, color: colors.textSoft, flexShrink: 0 },
  rowValue: {
    ...typography.small,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  noteBox: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md },
  noteLabel: { ...typography.tiny, color: colors.textSoft, fontWeight: '700' },
  noteText: { ...typography.body, color: colors.text, marginTop: 2 },
  actions: { gap: spacing.xs, marginTop: spacing.xs },
});
