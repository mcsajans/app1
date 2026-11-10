import { createNavigationContainerRef } from '@react-navigation/native';

import type { ModuleKey } from '../modules/types';

export type RootStackParamList = {
  home: undefined;
  profile: undefined;
  settings: undefined;
  /**
   * Beslenme ekranı hangi sekmeyle açılsın (alt modül anahtarı).
   *
   * `Record<ModuleKey, undefined>` kümesinden **dışlanır**: kesişim alınsaydı
   * `undefined & {tab?}` = `undefined` olur ve parametre tipi sessizce yok
   * olurdu.
   */
  feeding: { tab?: ModuleKey } | undefined;
} & Record<Exclude<ModuleKey, 'feeding'>, undefined>;

/**
 * Navigasyon ağacının **dışından** yönlendirme yapmak için.
 *
 * Hesap paneli (sağdan açılan menü) üst şeritte, yani hiçbir ekranın içinde
 * değil; bu yüzden `useNavigation` kullanamaz. Ref, React Navigation'ın bu
 * durum için önerdiği yoldur.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Ağaç hazır değilken çağrı sessizce yutulur (açılış yarışı). */
export function navigateTo(name: keyof RootStackParamList, params?: object): void {
  if (!navigationRef.isReady()) return;
  // `navigate` aşırı yüklemeleri rota adını sabit (literal) bekliyor; ad
  // runtime'da modül kataloğundan geldiği için tek bir çağrı imzasına
  // indirgeniyor.
  (navigationRef.navigate as (route: string, params?: object) => void)(name, params);
}

/**
 * Alt modülü üst modülünün sekmesinde açar.
 *
 * Emzirme, biberon, ek gıda ve sağma artık ağaçta kendi ekranı olmayan alt
 * modüller; onlara yönlendiren her yer (hızlı kayıt sayfası, canlı sayaç
 * bildirimi) buradan geçer. Modülün üst modülü yoksa doğrudan kendisine
 * gidilir, böylece çağıranın `parent` bilgisini bilmesi gerekmez.
 */
export function openModule(key: ModuleKey, parent?: ModuleKey): void {
  if (parent) navigateTo(parent, { tab: key });
  else navigateTo(key);
}
