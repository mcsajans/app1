import type { ComponentType } from 'react';

import BreastfeedingScreen from '../breastfeeding/BreastfeedingScreen';
import BottleScreen from '../bottle/BottleScreen';
import SolidScreen from '../solid/SolidScreen';
import PumpingScreen from '../pumping/PumpingScreen';
import type { ModuleKey } from '../../core/modules/types';

/**
 * Beslenme ekranının sekme bileşenleri.
 *
 * Ayrı dosyada duruyorlar çünkü aksi hâlde bir **require döngüsü** oluşuyordu:
 * `moduleScreens.ts` → `FeedingScreen` → `moduleScreens.ts`. Metro döngüye
 * izin veriyor ama ilk yüklenen tarafa yarı kurulmuş bir modül veriyor ve
 * uyarıyı konsola basıyor. Bu harita hiçbir şeyi içe aktarmayan bir yaprak
 * olduğu için ikisi de onu güvenle okuyabiliyor.
 *
 * Hangi sekmenin **çizileceğine** burası karar vermez; o, modül kataloğundaki
 * `parent` alanı ve yönetim panelindeki aç/kapa durumudur.
 */
export const FEEDING_TABS: Partial<Record<ModuleKey, ComponentType<object>>> = {
  breastfeeding: BreastfeedingScreen,
  bottle: BottleScreen,
  solid: SolidScreen,
  pumping: PumpingScreen,
};
