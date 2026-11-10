import * as Notifications from 'expo-notifications';
import { create } from 'zustand';

import { errorText } from '../api/client';
import type { Id } from '../api/endpoints';
import {
  quietHourService, reminderService, taskService, vaccineService, type QuietHour,
} from '../api/modules';
import { LIVE_TIMER_KIND } from '../timers/liveTimer';
import { alertKindOf } from './foregroundAlerts';
import { hideAllTaskNotices, syncTaskNotices } from './taskNotice';
import { clearOverdueLoops, syncOverdueLoops } from './taskOverdue';
import {
  getPermission, requestPermission as askPermission, syncReminders,
  cancelScheduled, type PermissionState, type SyncReport,
} from './scheduler';

/**
 * Uygulama ön plandayken gelen bildirim de görünsün.
 *
 * Handler kurulmazsa Android'de ön planda hiçbir şey gösterilmez: ebeveyn
 * uygulamayı açık tutarken hatırlatıcıyı hiç görmezdi. `shouldShowAlert`
 * kullanılmıyor — bu sürümde yerini `shouldShowBanner`/`shouldShowList` aldı.
 *
 * **Canlı sayaç bildirimi istisnadır.** O bildirim bir uyarı değil, durum
 * satırı: her meme değişiminde ve her duraklatmada yeniden sunuluyor
 * (`liveTimerNotice.ts`). Buradan geçerken banner açık kalsaydı emzirme
 * sırasında her dokunuşta ekranın üstüne kart düşerdi. Yalnızca listede
 * (gölgede) durur.
 *
 * **Ses ön planda sistemden değil uygulamadan çalar.** `shouldPlaySound`
 * kendi türlerimiz için `false`: sistem sesi bir kez çalıyor, oysa şartname
 * olaya göre 1/2/4 tekrar ve dokunuşta anında kesilme istiyor
 * (`notification-voice.md` §2.1-2.2). Tekrarı `foregroundAlerts.ts` uyguluyor.
 * İkisi birden açık kalsaydı ön planda her uyarı çift duyulurdu — Expo
 * belgesi `shouldPlaySound: false`'un kanal sesini de bastırdığını söylüyor.
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    // Durum satırları (canlı sayaç ve açık görev) banner açmaz: ikisi de her
    // eşitlemede yeniden sunuluyor, banner açık kalsaydı uygulama kullanılırken
    // ekranın üstüne sürekli kart düşerdi. Yalnızca gölgede dururlar.
    const quiet = data?.kind === LIVE_TIMER_KIND || data?.live === true;
    // Tekrarı uygulama çalacaksa sistem sesi bastırılır.
    const ownAlert = alertKindOf(data) !== null;
    return {
      shouldShowBanner: !quiet,
      shouldShowList: true,
      shouldPlaySound: !quiet && !ownAlert,
      shouldSetBadge: false,
    };
  },
});

type State = {
  permission: PermissionState;
  report: SyncReport | null;
  syncing: boolean;
  error: string | null;
  /**
   * Seçili bebeğin sessiz saat pencereleri — eşitlemede çekilen listenin
   * saklanmış hâli.
   *
   * Planlayıcı onu zaten `sync()` içinde kullanıyor; burada tutulmasının
   * sebebi **reklam servisi**: panelde `respect_quiet_hours` açıldığında
   * `adService` "şu an sessiz saatte miyiz" sorusunu ağa çıkmadan
   * cevaplayabilmeli. Reklam göstermek için istek atmak, en kötü anda
   * (bebek uyurken) gecikme ve veri harcaması olurdu.
   */
  quietHours: QuietHour[];
  /** İzin durumunu istem GÖSTERMEDEN okur. */
  check: () => Promise<PermissionState>;
  /** İzin ister; verilirse hemen eşitler. */
  request: (babyId: Id | null) => Promise<PermissionState>;
  /** Hatırlatıcıları ve sessiz saatleri çekip cihazda planlar. */
  sync: (babyId: Id | null) => Promise<void>;
};

export const useNotificationStore = create<State>((set, get) => ({
  permission: 'undetermined',
  report: null,
  syncing: false,
  error: null,
  quietHours: [],

  check: async () => {
    const permission = await getPermission();
    set({ permission });
    return permission;
  },

  request: async (babyId) => {
    const permission = await askPermission();
    set({ permission });
    if (permission === 'granted') await get().sync(babyId);
    return permission;
  },

  sync: async (babyId) => {
    const permission = await getPermission();
    set({ permission });

    if (permission !== 'granted') {
      // İzin geri alınmış olabilir; bekleyen kayıtlar temizlenir ki ayarlardan
      // izni kapatan kullanıcı eski alarmları almaya devam etmesin.
      await cancelScheduled().catch(() => undefined);
      // İzin geri alınmışsa uygulama içi uyarı turları da durmalı; yoksa
      // bildirim göstermeden ses çalmaya devam ederdi.
      clearOverdueLoops();
      await hideAllTaskNotices().catch(() => undefined);
      set({ report: null, quietHours: [] });
      return;
    }

    if (babyId === null) {
      await cancelScheduled().catch(() => undefined);
      clearOverdueLoops();
      // Bebek seçimi boşaldı: başka bebeğin görev satırları gölgede kalmasın.
      await hideAllTaskNotices().catch(() => undefined);
      set({ report: null, error: null, quietHours: [] });
      return;
    }

    set({ syncing: true, error: null });
    try {
      // Dört uç birbirinden bağımsız; sıralı beklemek gereksiz gecikme olurdu.
      const [reminders, quiet, tasks, vaccines] = await Promise.all([
        reminderService.list(babyId),
        quietHourService.list(babyId),
        // Yalnızca açık görevler: tamamlanan ya da iptal edilenin alarmı
        // zaten kurulmamalı (şartname, Otomatik Alarm Kapatma).
        taskService.list(babyId, { status: ['pending', 'in_progress'] }),
        // Aynı gerekçe: yapılmış ya da atlanmış aşının alarmı kurulmaz.
        vaccineService.list(babyId, { status: ['pending'] }),
      ]);
      // Pencereler planlamadan ÖNCE saklanır: planlama uzun sürebiliyor ve
      // bu arada bir kayıt düşerse reklam servisi güncel pencereyi görsün.
      set({ quietHours: quiet.quiet_hours });

      const report = await syncReminders(
        reminders.reminders,
        quiet.quiet_hours,
        tasks.tasks,
        vaccines.vaccines,
      );

      /*
       * Gecikmiş görev döngüsü aynı listeden besleniyor
       * (`notification-voice.md` §2.2.3): saati geçmiş ve hâlâ açık olan her
       * görev için 5 dakikalık uyarı turu kurulur. Ayrı bir istek atılmıyor —
       * `taskService.list` yukarıda zaten yalnızca açık görevleri çekti.
       */
      syncOverdueLoops(tasks.tasks);

      /*
       * Kalıcı satırlar aynı listeden hizalanır: açık her görev gölgede bir
       * satır alır, kapanan ya da silinen görevinki kalkar. Ses geçici,
       * satır kalıcı — ebeveyn uyarıyı kaçırsa bile görev telefonda durur.
       */
      await syncTaskNotices(tasks.tasks).catch(() => undefined);

      set({ report, error: null });
    } catch (err) {
      set({ error: errorText(err) });
    } finally {
      set({ syncing: false });
    }
  },
}));
