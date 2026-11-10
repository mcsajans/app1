import type { ComponentType } from 'react';
import FeedingScreen from '../../modules/feeding/FeedingScreen';
import { FEEDING_TABS } from '../../modules/feeding/tabs';
import SleepScreen from '../../modules/sleep/SleepScreen';
import DiaperScreen from '../../modules/diaper/DiaperScreen';
import MusicScreen from '../../modules/music/MusicScreen';
import RemindersScreen from '../../modules/reminders/RemindersScreen';
import TimelineScreen from '../../modules/timeline/TimelineScreen';
import ReportsScreen from '../../modules/reports/ReportsScreen';
import FamilyScreen from '../../modules/family/FamilyScreen';
import BabiesScreen from '../../modules/babies/BabiesScreen';
import TasksScreen from '../../modules/tasks/TasksScreen';
import VaccinesScreen from '../../modules/vaccines/VaccinesScreen';
import GrowthScreen from '../../modules/growth/GrowthScreen';
import type { ModuleKey } from '../modules/types';

/**
 * Modül anahtarı -> ekran eşlemesi. Navigasyon ağacı bu haritadan ve
 * aktif modül listesinden runtime'da üretilir (bkz. RootNavigator).
 * 'babies' artık kendi ekranına sahip: şablonda ızgarada kendi kutusu var
 * ve üst şeritteki bebek alanı da oraya götürür.
 */
export const MODULE_SCREENS: Partial<Record<ModuleKey, ComponentType<object>>> = {
  /*
   * Beslenme sekmeleri: kendi ekranları var ama navigasyon ağacına
   * itilmezler (katalogda `parent` dolu). Haritada durmaları yine de
   * gerekiyor, çünkü hızlı kayıt sayfası "bu modülün ekranı var mı?" diye
   * buraya bakıyor.
   */
  ...FEEDING_TABS,
  babies: BabiesScreen,
  /** Beslenme bir kabuk: dört alt modülü sekme olarak kendi içinde çizer. */
  feeding: FeedingScreen,
  sleep: SleepScreen,
  diaper: DiaperScreen,
  music: MusicScreen,
  reminders: RemindersScreen,
  timeline: TimelineScreen,
  reports: ReportsScreen,
  family: FamilyScreen,
  tasks: TasksScreen,
  vaccines: VaccinesScreen,
  growth: GrowthScreen,
};
