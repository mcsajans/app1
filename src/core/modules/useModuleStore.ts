import { create } from 'zustand';

import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import { getDb } from '../db';
import { MODULE_BY_KEY, defaultStates } from './catalog';
import type { ModuleKey, ModuleStates } from './types';

/** GET /modules yanıtındaki tek modül. */
type ServerModule = {
  module_key: string;
  title: string;
  description: string | null;
  is_core: boolean;
  is_enabled: boolean;
  sort_order: number;
};

type ModulesResponse = { scope: string; modules: ServerModule[] };

type CacheRow = { module_key: string; is_enabled: number };

type ModuleStore = {
  states: ModuleStates;
  hydrated: boolean;
  /** Son tazelemede sunucuya ulaşılabildi mi (Ayarlar'da gösterilir). */
  fromCache: boolean;

  /** Önbellekten okur — açılışta ağ beklemeden arayüz çizilsin diye. */
  hydrate: () => Promise<void>;
  /** Sunucudan tazeler; ulaşılamazsa önbellek korunur. */
  refresh: () => Promise<void>;
};

/**
 * Modül aktifliği SİSTEM GENELİDİR ve yalnızca yönetim panelinden değişir
 * (TEKNIK_DOKUMAN.md §9.1). Uygulamada aç/kapa arayüzü yoktur; burada
 * yalnızca sunucudan okuma ve yerel önbellekleme vardır.
 */
export const useModuleStore = create<ModuleStore>((set) => ({
  states: defaultStates(),
  hydrated: false,
  fromCache: true,

  hydrate: async () => {
    const db = await getDb();
    const rows = await db.getAllAsync<CacheRow>(
      'SELECT module_key, is_enabled FROM module_catalog',
    );

    // Önbellek boşsa katalog varsayılanlarıyla başlanır.
    if (rows.length === 0) {
      set({ states: defaultStates(), hydrated: true, fromCache: true });
      return;
    }

    const states = defaultStates();
    for (const r of rows) {
      if (r.module_key in MODULE_BY_KEY) {
        states[r.module_key as ModuleKey] = r.is_enabled === 1;
      }
    }
    set({ states, hydrated: true, fromCache: true });
  },

  refresh: async () => {
    const data = await api.get<ModulesResponse>(endpoints.modules.list);

    const states = defaultStates();
    for (const m of data.modules) {
      // Sunucu katalogu mobilden geniş (ör. 'diaper', 'family'); bilinmeyeni atla.
      if (m.module_key in MODULE_BY_KEY) {
        states[m.module_key as ModuleKey] = m.is_enabled;
      }
    }

    const db = await getDb();
    const now = new Date().toISOString();
    // withTransactionAsync özel DEĞİL ve araya başka sorgular girebilir; iki store
    // aynı anda tazelenirken bu sessiz hataya yol açıyordu. Exclusive sürüm
    // yazımları sıraya sokar (expo-sqlite SDK 58 dokümanı).
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('DELETE FROM module_catalog');
      for (const m of data.modules) {
        await txn.runAsync(
          `INSERT INTO module_catalog
             (module_key, title, description, is_core, is_enabled, sort_order, fetched_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            m.module_key,
            m.title,
            m.description,
            m.is_core ? 1 : 0,
            m.is_enabled ? 1 : 0,
            m.sort_order,
            now,
          ],
        );
      }
    });

    set({ states, hydrated: true, fromCache: false });
  },
}));
