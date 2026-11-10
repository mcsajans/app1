import { create } from 'zustand';

import { api } from '../api/client';
import { toDeviceUrl } from '../api/assets';
import { endpoints } from '../api/endpoints';
import { getDb } from '../db';

type BrandingResponse = { project_logo: string | null; app_logo: string | null };

type Row = { slot: string; url: string | null };

type BrandingStore = {
  /** Proje logosu — giriş ekranı, sol üst köşe, uygulama içi süreçler. */
  projectLogo: string | null;
  /** Uygulama logosu — uygulamanın kendi kimliği (açılış/yükleme ekranı). */
  appLogo: string | null;
  hydrated: boolean;

  /** Önbellekten okur; ağ beklemeden logo gösterilebilsin diye. */
  hydrate: () => Promise<void>;
  /** `GET /branding` ile tazeler. Kimlik doğrulaması gerektirmez. */
  refresh: () => Promise<void>;
};

/**
 * Logolar yönetim panelinden yüklenir (`/admin/system`) ve sistem geneli
 * geçerlidir — tıpkı modüller gibi (TEKNIK_DOKUMAN.md §7.5).
 */
export const useBrandingStore = create<BrandingStore>((set) => ({
  projectLogo: null,
  appLogo: null,
  hydrated: false,

  hydrate: async () => {
    const db = await getDb();
    const rows = await db.getAllAsync<Row>('SELECT slot, url FROM branding_cache');
    const bySlot = new Map(rows.map((r) => [r.slot, r.url]));
    set({
      projectLogo: bySlot.get('project') ?? null,
      appLogo: bySlot.get('app') ?? null,
      hydrated: true,
    });
  },

  refresh: async () => {
    // Giriş yapılmamışken de çağrılır; uç kimlik doğrulaması istemiyor.
    const data = await api.get<BrandingResponse>(endpoints.branding, { auth: false });

    const project = toDeviceUrl(data.project_logo);
    const app = toDeviceUrl(data.app_logo);
    const now = new Date().toISOString();

    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('DELETE FROM branding_cache');
      await txn.runAsync(
        'INSERT INTO branding_cache (slot, url, fetched_at) VALUES (?, ?, ?), (?, ?, ?)',
        ['project', project, now, 'app', app, now],
      );
    });

    set({ projectLogo: project, appLogo: app, hydrated: true });
  },
}));
