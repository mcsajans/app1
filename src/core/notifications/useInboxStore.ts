import { create } from 'zustand';

import { errorText } from '../api/client';
import type { Id } from '../api/endpoints';
import { inboxService, type AppNotification } from '../api/modules';
import { playAlert, stopAlert } from './alertSound';

/**
 * Bildirim kutusu durumu (TEKNIK_DOKUMAN.md §22.13).
 *
 * **`useNotificationStore` ile karıştırılmamalı.** O komşu dosya cihazın
 * kendi bildirimlerini planlıyor: senin kurduğun hatırlatıcının vakti
 * geldiğinde telefon çalsın diye. Bu store ise sunucudaki kutuyu okuyor:
 * *başkasının* yaptığı işi haber veriyor ve okundu durumu tüm cihazlarında
 * aynı. İki ayrı dosya ve iki ayrı ad bilinçli — ikisi tek store'da
 * toplansaydı "izin verilmedi" durumuyla "ağ yok" durumu aynı bayrağı
 * paylaşırdı.
 *
 * Rozet yalnızca `unreadCount` üzerinden çizilir; listeyi saymak yanlış olurdu
 * çünkü liste `limit` ile kırpılıyor ve bebek süzgecine tabi.
 */

/**
 * Yeni bildirim sesi (`notification-voice.md` §2.1 → `bildirim8.mp3`, 2 tekrar).
 *
 * Tetikleyici **okunmamış sayısının artması**. Sunucuda push altyapısı yok;
 * kutu ön plana her gelişte ve zil açıldığında yoklanıyor
 * (`refreshBadge` / `load`), dolayısıyla "yeni satır düştü" bilgisinin tek
 * işareti sayacın yükselmesi.
 *
 * `null` başlangıç değeri şart: ilk yoklamada sayı 0'dan 3'e çıkmış gibi
 * görünürdü ve uygulama her açılışta, günler önce gelmiş bildirimler için
 * çalardı. Önceki sayı bilinmiyorken yalnızca kaydediliyor, ses çalmıyor.
 */
let lastUnread: number | null = null;

function announce(unread: number): void {
  const previous = lastUnread;
  lastUnread = unread;
  if (previous !== null && unread > previous) playAlert('inbox');
}

type State = {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  /** Listeyi ve rozeti birlikte tazeler. Zil açıldığında çağrılır. */
  load: (babyId?: Id | null) => Promise<void>;
  /** Yalnızca rozet — açılışta ve ön plana gelişte, liste çekmeden. */
  refreshBadge: () => Promise<void>;
  markRead: (id: Id) => Promise<void>;
  markAllRead: (babyId?: Id | null) => Promise<void>;
  remove: (id: Id) => Promise<void>;
  /** Çıkışta çağrılır; başka hesabın kutusu ekranda kalmasın. */
  clear: () => void;
};

export const useInboxStore = create<State>((set, get) => ({
  items: [],
  unreadCount: 0,
  loading: false,
  error: null,

  load: async (babyId) => {
    set({ loading: true, error: null });
    try {
      /*
       * Bebek süzgeci BİLEREK uygulanmıyor (`babyId` yalnızca ileride
       * gerekirse diye duruyor). Ebeveyn zili açtığında hangi bebekte
       * olduğuna bakmaksızın her şeyi görmek istiyor; süzülseydi diğer
       * bebeğin haberleri rozete sayılır ama listede hiç görünmezdi.
       */
      const res = await inboxService.list({ limit: 50 });
      announce(res.unread_count);
      set({
        items: res.notifications,
        unreadCount: res.unread_count,
        error: null,
      });
    } catch (err) {
      set({ error: errorText(err) });
    } finally {
      set({ loading: false });
    }
  },

  refreshBadge: async () => {
    try {
      const res = await inboxService.unreadCount();
      announce(res.unread_count);
      set({ unreadCount: res.unread_count });
    } catch {
      // Rozet tazelemesi sessizce başarısız olur: ağ yokken "bildirim sayısı
      // alınamadı" hatası göstermek, kullanıcının yapabileceği bir şey
      // olmadığı için yalnızca gürültü olurdu. Son bilinen sayı kalır.
    }
  },

  markRead: async (id) => {
    /*
     * Bildirime dokunmak sesi **anında** keser (§2.2.1) — satır zaten
     * okunmuş olsa bile. Koşul `before` denetiminin üstünde: okunmuş bir
     * satıra dokunan kullanıcı da kutuya bakmış sayılır ve sesin devam
     * etmesi için bir neden kalmaz.
     */
    stopAlert('inbox');

    const before = get().items.find((n) => n.id === id);
    if (!before || before.is_read) return;

    /*
     * İyimser güncelleme: rozet ve satır hemen değişir, sunucu sonra.
     * Kullanıcı bildirime dokunup ekrana gidiyor; o an bir ağ turu beklemek
     * dokunuşu geç hissettirirdi. Hata olursa eski hâle dönülür.
     */
    set((st) => ({
      items: st.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      unreadCount: Math.max(0, st.unreadCount - 1),
    }));
    try {
      await inboxService.read(id);
    } catch {
      set((st) => ({
        items: st.items.map((n) => (n.id === id ? { ...n, is_read: false } : n)),
        unreadCount: st.unreadCount + 1,
      }));
    }
  },

  markAllRead: async (babyId) => {
    stopAlert('inbox');
    const snapshot = get().items;
    const unread = get().unreadCount;
    lastUnread = 0;
    set((st) => ({
      items: st.items.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));
    try {
      await inboxService.readAll(babyId ?? undefined);
    } catch (err) {
      set({ items: snapshot, unreadCount: unread, error: errorText(err) });
    }
  },

  remove: async (id) => {
    const snapshot = get().items;
    const target = snapshot.find((n) => n.id === id);
    set((st) => ({
      items: st.items.filter((n) => n.id !== id),
      // Okunmamış bir satır silindiğinde rozet de düşmeli; okunmuşsa
      // değişmemeli.
      unreadCount: target && !target.is_read
        ? Math.max(0, st.unreadCount - 1)
        : st.unreadCount,
    }));
    try {
      await inboxService.remove(id);
    } catch (err) {
      set({ items: snapshot, error: errorText(err) });
      await get().refreshBadge();
    }
  },

  clear: () => {
    stopAlert('inbox');
    // Hesap değişiyor: önceki kullanıcının sayısı yeni hesapta "artış"
    // sayılmasın diye bilinmez hâle döner.
    lastUnread = null;
    set({ items: [], unreadCount: 0, error: null, loading: false });
  },
}));
