import { create } from 'zustand';

/**
 * Kaydetme geri bildirimi — uygulama genelinde **tek** bir pencere.
 *
 * Her form kendi "kaydedildi" satırını yazsaydı onay metni ekrandan ekrana
 * değişirdi; burada kabukta tek bir pencere duruyor ve ekranlar yalnızca
 * kaydetme işini `withSaveFeedback` ile sarmalıyor.
 *
 * Mağaza React dışından da sürülebiliyor (`getState()`): kaydetme akışları
 * bileşen değil, düz `async` fonksiyonlar.
 */

export type SavePhase = 'hidden' | 'busy' | 'done';

/** Başarı metni; çağıran isterse kendi cümlesini verebilir. */
export const SAVE_DONE_TEXT = 'İşleminiz tamamlanmıştır';

type SaveFeedbackState = {
  phase: SavePhase;
  message: string;
  begin: () => void;
  succeed: (message?: string) => void;
  /** Hata ekranın kendi `FormError`'ında yazar; pencere sessizce kapanır. */
  fail: () => void;
  hide: () => void;
};

export const useSaveFeedbackStore = create<SaveFeedbackState>((set) => ({
  phase: 'hidden',
  message: SAVE_DONE_TEXT,
  begin: () => set({ phase: 'busy', message: SAVE_DONE_TEXT }),
  succeed: (message) => set({ phase: 'done', message: message ?? SAVE_DONE_TEXT }),
  fail: () => set({ phase: 'hidden' }),
  hide: () => set({ phase: 'hidden' }),
}));
