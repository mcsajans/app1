import { createContext, useContext } from 'react';

/**
 * Alt gezinme çubuğunun içeriğin üstünü örttüğü yükseklik (dp).
 *
 * Çubuk `position: absolute` ile çizilir — yani **yer kaplamaz**, ekranın
 * üstüne biner. Bu, çubuğun ızgara ve kartların arkasından geçmesini sağlayan
 * bilinçli bir seçim; bedeli, her ekranın en alttaki içeriği için kendi payını
 * bırakmak zorunda olması. Pay sabit bir sayı olarak yazıldığında cihazın
 * jest çubuğu ve ortadaki yuvarlak düğmenin taşması hesaba katılmıyor, "Görevi
 * oluştur" gibi en alttaki düğmeler çubuğun arkasında kalıyordu.
 *
 * Kabuk buraya çubuğun gerçek yüksekliğini koyar, `Screen` de alt payına
 * ekler. Çubuğun bulunmadığı yerlerde — giriş akışı, `Modal` ile açılan tam
 * ekran sayfalar — değer 0'dır ve yalnızca cihazın kendi alt güvenli alanı
 * uygulanır.
 */
export const BottomNavSpaceContext = createContext(0);

export const useBottomNavSpace = (): number => useContext(BottomNavSpaceContext);
