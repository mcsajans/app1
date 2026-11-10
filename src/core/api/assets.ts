import { API_CANONICAL_ORIGIN, API_HEADERS, API_REQUEST_ORIGIN } from '../config';

/**
 * Sunucudan gelen dosya adreslerini **cihazın gerçekten açabileceği** adrese
 * çevirir (fotoğraf, logo, müzik).
 *
 * Sunucu bu adresleri kendi kanonik origin'iyle üretiyor (`PUBLIC_BASE_URL`).
 * İstemci başka bir adrese bağlanıyorsa — yerel kurulumda bağlanıyor — önek
 * çevrilmek zorunda; yoksa indirme DNS aşamasında düşer.
 *
 * Üç kural sırayla denenir:
 *
 *  1. **Göreli yol** (`/uploads/...`): doğrudan bağlanılan origin'e eklenir.
 *     Yeni uçlar bu biçimi döndürüyor (`audio_path`) ve en sağlamı budur —
 *     sunucunun kendini nasıl bildiğinden tamamen bağımsız.
 *  2. **Kanonik origin öneki**: bilinen önek, bağlanılabilir olanla değişir.
 *  3. **Başka bir origin, ama `/uploads/` yolu**: yine bağlanılabilir origin'e
 *     taşınır.
 *
 * Üçüncü kural savunma amaçlı ve **gerçek bir arızadan** doğdu: `EXPO_PUBLIC_*`
 * değişkenleri paketleme sırasında koda gömülüyor, yani uygulama bir kanonik
 * adresle derlenip sunucu sonradan başka bir `PUBLIC_BASE_URL` ile çalışmaya
 * başlayabiliyor. O durumda 2. kural eşleşmiyor, adres olduğu gibi geçiyor ve
 * cihaz `http://bebektakip.test/...` adresini çözmeye çalışıp başarısız
 * oluyordu. Müzik çalar bu yüzden hiç başlamıyordu — hata da göstermeden,
 * çünkü çözümlenemeyen konak sessiz bir ağ hatası üretiyor.
 *
 * Kural yalnızca `/uploads/` altındaki yollara uygulanıyor: sunucunun
 * döndürdüğü başka bir mutlak adres (ileride bir CDN ya da `source_type =
 * 'remote'` parçası) kendi konağında kalmalı.
 */
export function toDeviceUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // 1 — göreli yol.
  if (url.startsWith('/')) return `${API_REQUEST_ORIGIN}${url}`;

  // 2 — bilinen kanonik önek.
  if (url.startsWith(API_CANONICAL_ORIGIN)) {
    return API_REQUEST_ORIGIN + url.slice(API_CANONICAL_ORIGIN.length);
  }

  // 3 — başka bir origin, ama yüklenen dosya yolu.
  const uploads = url.match(/^https?:\/\/[^/]+(\/uploads\/.*)$/);
  if (uploads) return `${API_REQUEST_ORIGIN}${uploads[1]}`;

  return url;
}

export type RemoteImageSource = { uri: string; headers?: Record<string, string> };

/**
 * `<Image source={...} />` için hazır kaynak. Android'de Fresco, kaynaktaki
 * `headers` alanını OkHttp isteğine aktarır (ReactOkHttpNetworkFetcher), bu
 * yüzden `Host` başlığı resim indirmelerinde de geçerli olur.
 */
export function remoteSource(url: string | null | undefined): RemoteImageSource | null {
  const uri = toDeviceUrl(url);
  if (!uri) return null;
  const headers = Object.keys(API_HEADERS).length > 0 ? { ...API_HEADERS } : undefined;
  return headers ? { uri, headers } : { uri };
}

/**
 * `<Image source={...} />` için takma ad. Ses için de aynı yapı kullanılır:
 * `expo-audio` kaynak nesnesinde `headers` alanını destekler, böylece sanal
 * konak başlığı ses indirmelerinde de geçerli olur.
 */
export const imageSource = remoteSource;
export const audioSource = remoteSource;
