Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **7. Modül olan "Ninni & Müzik" (`music`)** geliştirmesini yapacaksın.

### Proje Mimarısı & Çalışma Kuralları
1. **Dizin Yapısı & Bağımsızlık:**
  - Projemiz iki ayrı dizinden oluşuyor: Backend (`/backend` veya Node.js projesinin olduğu dizin) ve Mobil App (`/app` veya React Native projesinin olduğu dizin).
  - Backend ve Mobile App projeleri birbirinden bağımsız dizinlerde çalışmaktadır.
2. **Dokümantasyon:**
  - Projede yapılan tüm mimari kararlar, API end-point tanımları ve veri modelleri projenin kök dizininde (veya ilgili dizinde) yer alan `teknik_dokuman.md` dosyasına eksiksiz şekilde yazılacak/güncellenecektir.
3. **Geliştirme Akışı (Strict Step-by-Step Order):**
  - **ÖNCE BACKEND:** İlk olarak Node.js tarafındaki ses kütüphanesi veri modelleri ve API end-point'leri geliştirilmeli ve test edilmelidir.
  - **DOKÜMANTASYON:** API ve veri yapısı tamamlandığında `teknik_dokuman.md` dosyasına ilgili modül detayları eklenmelidir.
  - **SONRA REACT NATIVE:** Backend API'leri hazır hale geldikten ve dokümante edildikten sonra React Native tarafına geçilmeli, ses oynatıcı (audio player) ve zamanlayıcı entegrasyonu geliştirilmelidir.

---

### Modül 7: Ninni & Müzik (`music`) Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:
- **Veri Modeli (Schema/Entity):**
  - `id` (UUID/Primary Key)
  - `title` (String, Müzik/Ses Adı - Zorunlu)
  - `category` (Enum: 'lullaby', 'white_noise', 'nature', 'classical', Kategori - Zorunlu)
  - `audio_url` (String, Ses Dosyası Bağlantısı - Zorunlu)
  - `duration_seconds` (Integer, Süre - Saniye cinsinden)
  - `is_favorite` (Boolean, Sık kullanılanlar durumu)
  - `created_at`, `updated_at`

- **API End-point'leri:**
  - `GET /api/v1/music` -> Tüm ninni ve beyaz gürültü seslerini kategorili listeleme
  - `GET /api/v1/music/favorites` -> Favori ses listesini getirme
  - `POST /api/v1/music/:id/favorite` -> Bir sesi favorilere ekleme/çıkarma (Toggle)

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - `musicService` ve cihaz içi ses çalma motoru entegrasyonu (`react-native-track-player` veya `expo-av`).
- **UI & Ekranlar:**
  - **Müzik Çalar & Oynatma Ekranı:**
    - Oynat/Durdur (Play/Pause), İleri/Geri ve Döngü (Loop) kontrolleri.
    - Kategorilere göre filtrelenmiş ses listesi (Beyaz Gürültü, Anne Karnı Sesleri, Ninniler).
  - **Uyku Zamanlayıcısı (Sleep Timer):**
    - 15, 30, 45, 60 dakika gibi zaman seçenekleri.
    - Zaman dolduğunda sesi kademeli olarak kısarak (fade-out) durduran mantık.
  - **Arka Plan Oynatma (Background Audio):**
    - Uygulama kapalı veya ekran kilitliyken sesin çalmaya devam etmesi.

---

### Uygulama Adımları (Lütfen Sırayla Çalış):
1. **Adım 1:** Node.js backend projesinde `music` veri şemasını oluştur, varsayılan ses kütüphanesi seed verilerini ve API end-point'lerini yaz.
2. **Adım 2:** Tamamlanan backend API'lerinin detaylarını `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native projesinde ses kütüphanesini kurgula, `musicService` ve uyku zamanlayıcı (timer fade-out) logic'lerini yaz.
4. **Adım 4:** Müzik listesi, medya çalar arayüzü ve zamanlayıcı UI bileşenlerini geliştirip test et.