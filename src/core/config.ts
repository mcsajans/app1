import { Platform } from 'react-native';

export const APP_NAME = 'Bebiqa';
export const APP_VERSION = '1.0.0';
export const DB_NAME = 'bebiqa.db';

/* ------------------------------------------------------------------ API */

/**
 * API adresi.
 *
 * Adres **tek kaynaktan** gelir: `EXPO_PUBLIC_API_URL`. Kod içinde gömülü bir
 * canlı sunucu adresi **yoktur** — eskiden varsayılan `https://babylog.mcsajans.com`
 * idi ve bu iki soruna yol açıyordu:
 *
 *  - `.env.local` olmadan yapılan her derleme sessizce **canlı** veriye
 *    bağlanıyordu. Yerel geliştirmede yanlışlıkla canlı kayıt oluşturmak için
 *    tek yeten şey dosyayı kopyalamayı unutmaktı.
 *  - Yayın adresi kaynak kodun içinde duruyordu; sunucu taşındığında burayı
 *    da düzenlemek gerekiyordu, oysa adres bir **dağıtım ayarı**.
 *
 * Değişken verilmezse `PLATFORM_LOCAL_ORIGIN` kullanılır: geliştirme
 * makinesindeki sunucu. Android emülatörü host makineye `10.0.2.2` takma
 * adıyla erişir; iOS simülatörü ve tarayıcı `localhost` görür. Yayın
 * derlemelerinde adres EAS ortam değişkeniyle verilir (`eas.json` → `env`).
 *
 * Yerel kurulum için proje kökünde bir **`.env.local`** dosyası yeterli
 * (`.gitignore` onu dışarıda tutar, `.env.example` örneği taşır):
 *
 *     EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
 *
 * Fiziksel telefonda `10.0.2.2` ve `localhost` **çalışmaz** — ikisi de
 * cihazın kendisini gösterir. Oraya makinenin LAN adresi yazılmalı
 * (`ipconfig` → ör. `http://192.168.1.20:4000`) ve telefon aynı ağda olmalı.
 *
 * `EXPO_PUBLIC_*` değişkenleri paketleme sırasında **koda gömülür**, yani
 * değişiklik için uygulamanın yeniden yüklenmesi (Reload) gerekir; sunucuyu
 * yeniden başlatmak gerekmez. Gömüldükleri için de gizli bilgi taşımazlar —
 * burada yalnızca adres var (bkz. TEKNIK_DOKUMAN.md §8, §17.3).
 */
const PLATFORM_LOCAL_ORIGIN =
  Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

/**
 * `process.env.EXPO_PUBLIC_API_URL` **nokta gösterimiyle** okunmalı: Expo CLI
 * tam da bu ifadeyi metinsel olarak arayıp değeriyle değiştiriyor. Değişkene
 * atayıp destructuring ya da `process.env['...']` ile okumak sessizce
 * `undefined` verirdi.
 */
const configuredOrigin = process.env.EXPO_PUBLIC_API_URL;
const configuredCanonical = process.env.EXPO_PUBLIC_API_CANONICAL_URL;
const configuredHostHeader = process.env.EXPO_PUBLIC_API_HOST_HEADER;

/** Sondaki eğik çizgi, yol birleştirmede çift `//` üretmesin diye kırpılır. */
const trimSlash = (value: string) => value.replace(/\/+$/, '');

const ORIGIN = trimSlash((configuredOrigin ?? '').trim() || PLATFORM_LOCAL_ORIGIN);

/**
 * Yayın derlemesinde adres **verilmek zorunda**.
 *
 * Gömülü bir yayın adresi kalmadığı için, `EXPO_PUBLIC_API_URL` verilmeden
 * alınan bir release derlemesi yerel sunucuyu (`10.0.2.2` / `localhost`)
 * gösterir ve kullanıcının telefonunda **hiçbir istek** çalışmaz. Arıza
 * kullanıcıya "Sunucuya ulaşılamadı" olarak görünür ve nedenini anlamak
 * zordur, bu yüzden geliştirme konsoluna açık bir uyarı yazılıyor.
 *
 * Fırlatılmıyor: uygulamayı hiç açılmaz hâle getirmek, hatayı görmesi gereken
 * kişinin (derlemeyi alan geliştirici) eline bir ipucu bile vermezdi. Adres
 * EAS tarafında `eas.json` → `build.<profil>.env` ya da bir EAS ortam
 * değişkeniyle verilir.
 */
if (!__DEV__ && !(configuredOrigin ?? '').trim()) {
  console.warn(
    '[bebiqa] EXPO_PUBLIC_API_URL verilmedi; yayın derlemesi yerel ' +
      `sunucuyu (${PLATFORM_LOCAL_ORIGIN}) gösteriyor ve hiçbir istek ` +
      'çalışmayacak. Adresi eas.json → build.<profil>.env içinde tanımla.',
  );
}

export const API_VERSION = 'v1';
export const API_PATH_PREFIX = `/api/${API_VERSION}`;

/**
 * Sunucunun kendini bildiği kanonik origin (sunucu `.env` → `PUBLIC_BASE_URL`).
 *
 * Yükleme ve logo adresleri sunucudan **bu** öneki taşıyarak geliyor; istemci
 * farklı bir adrese bağlanıyorsa `assets.ts` onları bağlanılabilir origin'e
 * çeviriyor. Canlı kurulumda ikisi aynıdır, bu yüzden varsayılanı `ORIGIN`.
 *
 * Ayrı bir değişken olması şart: yerel geliştirmede istemci `http://10.0.2.2`
 * adresine bağlanırken sunucu hâlâ `http://bebektakip.test/uploads/...`
 * döndürüyor. İkisi tek değerden türetilseydi önek eşleşmez, çeviri sessizce
 * atlanır ve emülatörde hiçbir fotoğraf yüklenmezdi.
 *
 * **Doğru ayarlanmamış olması artık ölümcül değil.** `assets.ts` üçüncü bir
 * kural daha uyguluyor: tanınmayan bir origin'den gelse bile `/uploads/`
 * altındaki her yol bağlanılabilir origin'e taşınıyor. Bu değişken yine de
 * doğru tutulmalı — kural `/uploads/` dışına uygulanmıyor.
 */
export const API_CANONICAL_ORIGIN = trimSlash(
  (configuredCanonical ?? '').trim() || ORIGIN,
);
export const API_CANONICAL_BASE_URL = `${API_CANONICAL_ORIGIN}${API_PATH_PREFIX}`;

/** İstemcinin gerçekten bağlandığı origin ve taban adres. */
export const API_REQUEST_ORIGIN = ORIGIN;
export const API_BASE_URL = `${API_REQUEST_ORIGIN}${API_PATH_PREFIX}`;

/**
 * İsme dayalı sanal konağı seçen `Host` başlığı.
 *
 * Yalnızca yerel geliştirmede gerekiyor: Apache `bebektakip.test` konağına
 * isteği ancak bu başlığı görünce yönlendiriyordu, IP'ye yapılan çıplak istek
 * varsayılan konağa düşüp 404 veriyordu. Canlı sunucuda adres gerçek olduğu
 * için başlık boş kalır.
 */
export const API_HEADERS: Readonly<Record<string, string>> = configuredHostHeader?.trim()
  ? { Host: configuredHostHeader.trim() }
  : {};

export const REQUEST_TIMEOUT_MS = 10000;
