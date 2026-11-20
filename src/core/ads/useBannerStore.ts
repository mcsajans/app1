import { create } from 'zustand';

/**
 * Alt banner reklamının kabuk durumu.
 *
 * Banner `App` kabuğunda, gezinme çubuğunun **altında** duruyor ve ekranların
 * kullanılabilir yüksekliğini daraltıyor. Üç bilgi React ağacının farklı
 * yerlerinde gerekli olduğu için depoya alındı:
 *
 *  - `collapsed` — kullanıcı çubuğu kapattı mı. Kapatma kalıcı DEĞİL:
 *    her ekran değişiminde `reopen()` çağrılıyor (bkz. `App.tsx`,
 *    `NavigationContainer.onStateChange`). Böylece "bir ekranda yer açmak
 *    için kapat" mümkün, ama kapalı kalıp görünmez olmuyor.
 *  - `height` — bannerın **iç** yüksekliği (cihazın alt güvenli alanı hariç;
 *    onu çubuğun kendi dolgusu karşılıyor). Ekranlar bu kadar daha alt pay
 *    bırakıyor, gezinme çubuğu da bu kadar yukarı kayıyor.
 *  - `seq` — yeniden bağlama sayacı. Reklam yüklenemediğinde alan kapanıyor;
 *    bir sonraki ekran değişiminde `seq` artıyor ve `BannerAd` yeni bir
 *    istekle baştan kuruluyor. Aksi hâlde tek bir başarısız istek, oturum
 *    boyunca banner'ı kapalı bırakırdı.
 */
type BannerStore = {
  collapsed: boolean;
  /** Reklam yüklenemedi — boş bir şerit bırakmamak için alan kapatılır. */
  failed: boolean;
  height: number;
  seq: number;

  setCollapsed: (collapsed: boolean) => void;
  setFailed: (failed: boolean) => void;
  setHeight: (height: number) => void;
  /** Ekran değişiminde: kapalıysa aç, başarısızsa yeniden dene. */
  reopen: () => void;
};

export const useBannerStore = create<BannerStore>((set, get) => ({
  collapsed: false,
  failed: false,
  height: 0,
  seq: 0,

  setCollapsed: (collapsed) => set({ collapsed }),
  setFailed: (failed) => set({ failed }),
  setHeight: (height) => {
    // Ölçüm her çizimde gelebiliyor; aynı değeri yeniden yazmak bütün
    // ekranları gereksiz yere yeniden çizerdi (yükseklik context'te).
    if (Math.abs(get().height - height) < 1) return;
    set({ height });
  },

  reopen: () => {
    const { collapsed, failed, seq } = get();
    if (!collapsed && !failed) return;
    set({ collapsed: false, failed: false, seq: seq + 1 });
  },
}));
