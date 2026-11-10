import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { Icon } from '../../components/Icon';
import { EmptyState, Screen } from '../../components/ui';
import { childModules, moduleLabel } from '../../core/modules/catalog';
import type { ModuleKey } from '../../core/modules/types';
import { useModuleStore } from '../../core/modules/useModuleStore';
import type { RootStackParamList } from '../../core/navigation/navigationRef';
import { FEEDING_TABS } from './tabs';
import { colors, radius, spacing, typography } from '../../core/theme';

/**
 * Beslenme — emzirme, biberon, ek gıda ve süt sağmanın ortak kabuğu.
 *
 * Ana ekrandaki ızgarada dördü için ayrı kutu vardı; dördü de aynı soruya
 * ("bebek ne aldı?") bakıyor ve ızgaranın yarısını yiyordu. Artık tek kutu
 * açılıyor, alt modüller burada sekme oluyor.
 *
 * **Sekmeler katalogdan türetilir.** Liste burada sabit yazılmadı: yönetim
 * panelinden kapatılan alt modülün sekmesi kendiliğinden çizilmez (ek gıda ve
 * sağma sistemde varsayılan olarak kapalı) ve yeni bir alt modül eklemek
 * yalnızca katalog satırı + `moduleScreens` kaydı gerektirir — bu dosyaya
 * dokunmak gerekmez (AGENTS.md).
 *
 * Alt ekranlar **olduğu gibi** çiziliyor; her biri kendi `Screen` kaydırma
 * alanını getiriyor. Bu yüzden kabuk kendi `Screen`'ini sarmıyor: iç içe iki
 * kaydırma alanı hem çift kenar boşluğu bırakır hem de sekme çubuğunu
 * içerikle birlikte yukarı kaydırırdı. Çubuk sabit, içerik kayar.
 */
export default function FeedingScreen() {
  const states = useModuleStore((s) => s.states);
  const route = useRoute<RouteProp<RootStackParamList, 'feeding'>>();
  const requested = route.params?.tab ?? null;

  const tabs = useMemo(() => childModules('feeding', states), [states]);

  /*
   * Seçili sekme. Başlangıç değeri yönlendirmeden gelebilir: hızlı kayıt
   * sayfasından "Biberon"a ya da canlı sayaç bildiriminden "Emzirme"ye
   * basıldığında ekran doğrudan o sekmede açılır.
   */
  const [picked, setPicked] = useState<ModuleKey | null>(null);
  const valid = (key: ModuleKey | null): ModuleKey | null =>
    key && tabs.some((t) => t.key === key) ? key : null;
  // Kapalı bir alt modülün anahtarı parametreyle gelirse (ya da seçiliyken
  // panelden kapatılırsa) ilk açık sekmeye düşülür; yoksa boş ekran kalırdı.
  const active: ModuleKey | null = valid(picked) ?? valid(requested) ?? tabs[0]?.key ?? null;

  if (tabs.length === 0 || active === null) {
    return (
      <Screen>
        <EmptyState
          icon="feeding"
          title="Beslenme modülleri kapalı"
          detail="Emzirme, biberon, ek gıda ve süt sağma sistem yöneticisi tarafından kapatılmış."
        />
      </Screen>
    );
  }

  const ActiveScreen = FEEDING_TABS[active];

  return (
    <View style={s.shell}>
      {/*
        Sekmeler yatay kayar: dört sekme dar ekranda sığıyor ama ileride beşinci
        bir alt modül eklenirse sığmayan sekme görünmez olurdu.
      */}
      <View style={s.tabBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabBar}
        >
          {tabs.map((m) => {
            const on = m.key === active;
            return (
              <Pressable
                key={m.key}
                onPress={() => setPicked(m.key)}
                style={({ pressed }) => [
                  s.tab,
                  // Seçili sekme modülün KENDİ pastel tonunu alır; ızgaradaki
                  // kutusu da aynı renkti, böylece hangi modülde olunduğu
                  // yazıdan önce renkten anlaşılıyor.
                  on && { backgroundColor: m.color },
                  pressed && s.pressed,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={m.title}
              >
                <Icon
                  name={m.key}
                  size={18}
                  color={on ? colors.text : colors.textSoft}
                />
                <Text style={[s.tabText, on && s.tabTextOn]} numberOfLines={1}>
                  {moduleLabel(m)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {ActiveScreen ? <ActiveScreen /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg },
  tabBarWrap: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  pressed: { opacity: 0.7 },
  tabText: { ...typography.small, color: colors.textSoft, fontWeight: '600' },
  tabTextOn: { color: colors.text, fontWeight: '700' },
});
