import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '../theme';
import { MODULE_BY_KEY, topLevelModules } from '../modules/catalog';
import { useModuleStore } from '../modules/useModuleStore';
import { MODULE_SCREENS } from './moduleScreens';
import type { RootStackParamList } from './navigationRef';
import HomeScreen from '../../screens/HomeScreen';
import SettingsScreen from '../../screens/SettingsScreen';
import ProfileScreen from '../../screens/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Tek düzeyli yığın.
 *
 * Alt sekme çubuğu **kaldırıldı**: modül sayısı arttıkça sekmeler sığmıyor ve
 * bir kısmı Ayarlar'ın içine saklanıyordu — aynı modüle iki ayrı yoldan
 * ulaşılması kafa karıştırıcıydı. Artık tüm açık modüller ana ekranda kare
 * ızgarada duruyor ve buradan itiliyor; hesap/ayar işleri üst şeritteki
 * profil düğmesinden açılan panelde.
 *
 * Modül listesi runtime'da katalogdan türetildiği için yeni modül eklemek
 * burada bir değişiklik gerektirmez (bkz. AGENTS.md).
 */
export function RootNavigator() {
  const states = useModuleStore((st) => st.states);

  /*
   * Yalnızca üst düzey modüller yığına girer. Alt modüller (emzirme, biberon,
   * ek gıda, sağma) üst modülün ekranında sekme olarak çiziliyor; ağaca ayrıca
   * eklenselerdi aynı ekrana iki ayrı yoldan ulaşılırdı — alt sekme çubuğu tam
   * bu yüzden kaldırılmıştı (yukarıdaki not).
   */
  const pushable = useMemo(
    () => topLevelModules(states).filter((m) => MODULE_SCREENS[m.key]),
    [states],
  );

  const detailOptions = (title: string) => ({
    headerShown: true,
    title,
    headerTintColor: colors.text,
    headerStyle: { backgroundColor: colors.surface },
  });

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" component={HomeScreen} />
      <Stack.Screen name="profile" component={ProfileScreen} options={detailOptions('Profilim')} />
      <Stack.Screen name="settings" component={SettingsScreen} options={detailOptions('Ayarlar')} />
      {pushable.map((m) => (
        <Stack.Screen
          key={m.key}
          name={m.key}
          component={MODULE_SCREENS[m.key]!}
          options={detailOptions(MODULE_BY_KEY[m.key].title)}
        />
      ))}
    </Stack.Navigator>
  );
}
