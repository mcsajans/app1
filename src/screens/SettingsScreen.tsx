import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError, checkHealth } from '../core/api';
import { useAuthStore } from '../core/auth/useAuthStore';
import { API_BASE_URL, API_CANONICAL_BASE_URL, APP_NAME, APP_VERSION, DB_NAME } from '../core/config';
import { useBabyStore } from '../core/stores/useBabyStore';
import { activeModules } from '../core/modules/catalog';
import { useModuleStore } from '../core/modules/useModuleStore';
import { MODULE_SCREENS } from '../core/navigation/moduleScreens';
import {
  PERMISSIONS, usePermissionStore, type PermissionState,
} from '../core/permissions/usePermissionStore';
import { Icon, type IconName } from '../components/Icon';
import { colors, spacing, typography } from '../core/theme';
import { Button, Card, Screen, SectionTitle } from '../components/ui';
import { ResetDataSheet } from '../components/ResetDataSheet';

/**
 * Ayarlar.
 *
 * İki şey bilinçli olarak burada DEĞİL:
 *  - **Modül aç/kapa**: aktiflik sistem genelidir ve yalnızca yönetim
 *    panelinden (`/admin/modules`) değiştirilir (TEKNIK_DOKUMAN.md §9.1).
 *  - **Hesap bilgileri ve çıkış**: üst şeritteki profil düğmesinden açılan
 *    hesap panelinde. Aynı eylemin iki ayrı yerde durması, hangisinin
 *    yetkili olduğunu belirsizleştiriyordu.
 *
 * Modül kısayolları da kaldırıldı: alt sekme çubuğu kalktıktan sonra tüm açık
 * modüller ana ekrandaki ızgarada duruyor.
 */
export default function SettingsScreen() {
  const [resetOpen, setResetOpen] = useState(false);
  const babies = useBabyStore((s) => s.babies);
  const moduleStates = useModuleStore((st) => st.states);
  const user = useAuthStore((s) => s.user);
  const apiStatus = useApiStatus();

  const openCount = activeModules(moduleStates).filter((m) => MODULE_SCREENS[m.key]).length;

  const permStatuses = usePermissionStore((st) => st.statuses);
  const askPermission = usePermissionStore((st) => st.ask);
  const refreshPermissions = usePermissionStore((st) => st.refresh);

  // Kullanıcı telefonun ayarlarından izni açıp geri dönmüş olabilir; ekran
  // her açıldığında gerçek durum okunur.
  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);

  return (
    <Screen>
      <SectionTitle hint="Hesabını üst şeritteki profil düğmesinden yönetebilirsin.">
        Hesap
      </SectionTitle>
      <Card>
        <Info label="Ad soyad" value={user?.full_name ?? '—'} />
        <Info label="E-posta" value={user?.email ?? '—'} />
        <Info label="Telefon" value={user?.phone ?? '—'} />
        <Info label="Kayıtlı bebek" value={`${babies.length}`} />
      </Card>

      <SectionTitle hint="Vermediğin izinler yalnızca ilgili özelliği susturur; uygulamanın geri kalanı çalışır.">
        İzinler
      </SectionTitle>
      <Card>
        {PERMISSIONS.map((p) => (
          <PermissionRow
            key={p.key}
            icon={p.icon}
            title={p.title}
            reason={p.reason}
            state={permStatuses[p.key]}
            onAsk={() => void askPermission(p.key)}
          />
        ))}
      </Card>

      <SectionTitle hint="Hangi modüllerin açık olduğu sistem yöneticisi tarafından belirlenir.">
        Ortam
      </SectionTitle>
      <Card>
        <Info label="Uygulama" value={`${APP_NAME} v${APP_VERSION}`} />
        <Info label="Açık modül" value={`${openCount}`} />
        <Info label="Yerel veritabanı" value={`${DB_NAME} (SQLite)`} />
        <Info label="API adresi" value={API_CANONICAL_BASE_URL} />
        <Info label="Bağlantı" value={API_BASE_URL} />
        <Pressable onPress={apiStatus.recheck}>
          <Info label="API durumu" value={apiStatus.label} />
        </Pressable>
      </Card>

      {/*
        Veri sıfırlama en SONDA duruyor: geri alınamaz bir işlem, ayarların
        tepesinde yanlışlıkla dokunulabilecek bir yerde olmamalı. Düğmeye
        basmak hiçbir şey silmez, yalnızca onay penceresini açar.
      */}
      <SectionTitle hint="Bebeğin profili ve aile üyeleri silinmez; yalnızca girilen kayıtlar temizlenir.">
        Veriler
      </SectionTitle>
      <Card>
        <Text style={styles.resetText}>
          Seçtiğin bebeğe ait tüm kayıtları (beslenme, uyku, bez, sağma, görev,
          hatırlatıcı ve aşı) kalıcı olarak siler. Bu işlem geri alınamaz.
        </Text>
        <View style={styles.resetGap} />
        <Button label="Verileri sıfırla" variant="danger" onPress={() => setResetOpen(true)} />
      </Card>

      <ResetDataSheet visible={resetOpen} onClose={() => setResetOpen(false)} />
    </Screen>
  );
}

const PERM_LABEL: Record<PermissionState, string> = {
  granted: 'Verildi',
  denied: 'Reddedildi',
  undetermined: 'Sorulmadı',
};

/**
 * Tek izin satırı.
 *
 * Reddedilmiş bir izni uygulama **yeniden soramaz** (Android'de sistem istemi
 * bir daha görünmez), bu yüzden orada düğme yerine telefonun ayarlarına
 * yönlendiren bir açıklama gösterilir — tıklanıp hiçbir şey olmaması
 * kullanıcıyı uygulamanın bozuk olduğuna inandırırdı.
 */
function PermissionRow({
  icon, title, reason, state, onAsk,
}: {
  icon: IconName;
  title: string;
  reason: string;
  state: PermissionState;
  onAsk: () => void;
}) {
  const tint =
    state === 'granted' ? colors.success : state === 'denied' ? colors.danger : colors.textFaint;

  return (
    <View style={styles.permRow}>
      <View style={styles.permIcon}>
        <Icon name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.permText}>
        <Text style={styles.permTitle}>{title}</Text>
        <Text style={styles.permReason}>{reason}</Text>
        {state === 'denied' ? (
          <Text style={styles.permHint}>
            Telefonun Ayarlar → Uygulamalar → Bebiqa ekranından açabilirsin.
          </Text>
        ) : null}
      </View>
      {state === 'undetermined' ? (
        <Pressable onPress={onAsk} style={styles.permBtn} accessibilityRole="button">
          <Text style={styles.permBtnText}>İzin ver</Text>
        </Pressable>
      ) : (
        <Text style={[styles.permState, { color: tint }]}>{PERM_LABEL[state]}</Text>
      )}
    </View>
  );
}

/**
 * `GET /api/v1/health` ile sunucuya erişilebildiğini doğrular.
 * Satıra dokunulduğunda yeniden denenir.
 */
function useApiStatus() {
  const [label, setLabel] = useState('kontrol ediliyor…');
  const [attempt, setAttempt] = useState(0);

  const recheck = useCallback(() => {
    setLabel('kontrol ediliyor…');
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    checkHealth()
      .then((data) => {
        if (!cancelled) setLabel(`bağlı (${data.status} · ${data.api})`);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const reason = err instanceof ApiError ? err.code : 'BİLİNMEYEN_HATA';
        setLabel(`bağlanamadı — ${reason} (yenilemek için dokun)`);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { label, recheck };
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  resetText: { ...typography.small, color: colors.textSoft, lineHeight: 19 },
  resetGap: { height: spacing.sm },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  infoLabel: { ...typography.small, color: colors.textSoft },

  // ── izin satırı ──
  permRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  permIcon: { fontSize: 22, marginTop: 1 },
  permText: { flex: 1, gap: 2 },
  permTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  permReason: { ...typography.small, color: colors.textSoft },
  permHint: { ...typography.tiny, color: colors.textFaint, marginTop: 2 },
  permState: { ...typography.tiny, fontWeight: '700', marginTop: 4 },
  permBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  permBtnText: { ...typography.tiny, color: colors.primary, fontWeight: '700' },
  infoValue: { ...typography.small, color: colors.text, fontWeight: '600', flexShrink: 1 },
});
