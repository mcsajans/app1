import { create } from 'zustand';

import { api } from '../api/client';
import { toDeviceUrl } from '../api/assets';
import { endpoints } from '../api/endpoints';
import { APP_VERSION } from '../config';

/**
 * Yasal onaylar — KVKK aydınlatma beyanı ve açık rıza (sunucu: `migrations/022`).
 *
 * Tanımlar yönetim panelinden yazılır ve açık uçtan okunur; modüller ile
 * reklam ayarlarıyla aynı desen (AGENTS.md). İki yerde kullanılır:
 *  - **Kayıt ekranı**: kutucuklar, oturum açılmadan `list` ucundan.
 *  - **Açılış**: zorunlu onayı eksik olan kullanıcıya kapatılamayan pencere.
 *
 * SQLite'a ÖNBELLEKLENMEZ. Bekleyen onay bilgisi yalnızca sunucudan gelen
 * taze yanıtla anlamlı: eski bir önbellekle uygulamayı kilitlemek, ağı
 * olmayan kullanıcının kendi verisine erişememesi demek olurdu. Yanıt
 * alınamadıysa `checked` false kalır ve pencere açılmaz.
 */

export type ConsentKind = 'aydinlatma' | 'acik_riza';

export type Consent = {
  code: string;
  title: string;
  /** Kutucuğun yanında birebir gösterilen beyan. */
  checkbox_label: string;
  kind: ConsentKind;
  is_required: boolean;
  version: number;
  /** Metnin tamamının yayınlandığı sayfa; panelde tanımlı değilse null. */
  url: string | null;
  accepted?: boolean;
  accepted_at?: string | null;
};

type ListResponse = { items: Consent[] };
type StateResponse = { items: Consent[]; pending: string[] };

type ConsentStore = {
  /** Aktif tanımlar. Oturum açıkken kullanıcının durumu da işlenmiş olur. */
  items: Consent[];
  /** Zorunlu olup onaylanmamış kodlar. */
  pending: string[];
  /** Sunucudan en az bir kez yanıt alındı mı. */
  checked: boolean;
  busy: boolean;

  /** Kayıt ekranı için: oturumsuz tanım listesi. */
  loadPublic: () => Promise<void>;
  /** Oturum açıkken: bekleyen onayları tazeler. */
  refreshMine: () => Promise<void>;
  /** Onayları yazar ve dönen güncel durumu uygular. */
  accept: (codes: string[]) => Promise<void>;
  /** Hesap değişiminde önceki kullanıcının durumu kalmasın diye. */
  reset: () => void;
};

/**
 * Sayfa adresi sunucunun kendi `PUBLIC_BASE_URL` değeriyle geliyor
 * (ör. `http://bebektakip.test/...`), istemci ise başka bir origin'e
 * bağlanabiliyor. `toDeviceUrl` bunu cihazın ulaşabildiği adrese taşır —
 * yüklenen görsellerde olduğu gibi.
 */
function withDeviceUrl(item: Consent): Consent {
  return { ...item, url: item.url ? toDeviceUrl(item.url) : null };
}

export const useConsentStore = create<ConsentStore>((set, get) => ({
  items: [],
  pending: [],
  checked: false,
  busy: false,

  loadPublic: async () => {
    const data = await api.get<ListResponse>(endpoints.consents.list, { auth: false });
    set({ items: data.items.map(withDeviceUrl) });
  },

  refreshMine: async () => {
    const data = await api.get<StateResponse>(endpoints.consents.mine);
    set({ items: data.items.map(withDeviceUrl), pending: data.pending, checked: true });
  },

  accept: async (codes) => {
    if (get().busy) return;
    set({ busy: true });
    try {
      const data = await api.post<StateResponse>(endpoints.consents.accept, {
        codes,
        app_version: APP_VERSION,
      });
      set({ items: data.items.map(withDeviceUrl), pending: data.pending, checked: true });
    } finally {
      set({ busy: false });
    }
  },

  reset: () => set({ items: [], pending: [], checked: false, busy: false }),
}));

/** Zorunlu onayı eksik mi — uygulama kabuğu bunu görünce pencereyi açar. */
export function consentsBlocking(s: ConsentStore): boolean {
  return s.checked && s.pending.length > 0;
}
