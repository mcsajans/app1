Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **5. Modül olan "Uyku Takibi" (`sleep`)** geliştirmesini yapacaksın.

### Proje Mimarısı & Çalışma Kuralları
1. **Dizin Yapısı & Bağımsızlık:**
  - Projemiz iki ayrı dizinden oluşuyor: Backend (`/backend` veya Node.js projesinin olduğu dizin) ve Mobil App (`/app` veya React Native projesinin olduğu dizin).
  - Backend ve Mobile App projeleri birbirinden bağımsız dizinlerde çalışmaktadır.
2. **Dokümantasyon:**
  - Projede yapılan tüm mimari kararlar, API end-point tanımları ve veri modelleri projenin kök dizininde (veya ilgili dizinde) yer alan `teknik_dokuman.md` dosyasına eksiksiz şekilde yazılacak/güncellenecektir.
3. **Geliştirme Akışı (Strict Step-by-Step Order):**
  - **ÖNCE BACKEND:** İlk olarak Node.js tarafındaki veri modelleri, veritabanı şeması/migration'ları, validation'lar ve API end-point'leri geliştirilmeli ve test edilmelidir.
  - **DOKÜMANTASYON:** API ve veri yapısı tamamlandığında `teknik_dokuman.md` dosyasına ilgili modül detayları eklenmelidir.
  - **SONRA REACT NATIVE:** Backend API'leri hazır hale geldikten ve dokümante edildikten sonra React Native tarafına geçilmeli, API servis entegrasyonu, state yönetimi ve UI bileşenleri geliştirilmelidir.

---

### Modül 5: Uyku Takibi (`sleep`) Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:
- **Veri Modeli (Schema/Entity):**
  - `id` (UUID/Primary Key)
  - `baby_id` (UUID, Foreign Key -> `babies.id`, Zorunlu)
  - `type` (Enum: 'night_sleep', 'nap', Uyku Tipi: Gece Uykusu / Şekerleme - Zorunlu)
  - `start_time` (DateTime/ISOString, Uykuya Geçiş Zamanı - Zorunlu)
  - `end_time` (DateTime/ISOString, Uyanma Zamanı - Manuel kayıtta veya sayaç bitiminde zorunlu)
  - `duration_minutes` (Integer, Toplam Uyku Süresi - dakika cinsinden)
  - `quality` (Enum: 'peaceful', 'restless', 'frequent_waking', Opsiyonel Uyku Kalitesi)
  - `wake_reason` (String, Opsiyonel Uyanma Sebebi - örn: "Açlık", "Gaz", "Isı/Alt Islaklığı")
  - `notes` (Text, Opsiyonel ebeveyn notu)
  - `created_at`, `updated_at`

- **API End-point'leri:**
  - `POST /api/v1/sleep` -> Yeni uyku kaydı oluşturma (Sayaç bitimi veya manuel giriş)
  - `GET /api/v1/sleep?baby_id=:babyId` -> Seçili bebeğe ait uyku geçmişini filtreli/sayfalamalı listeleme
  - `GET /api/v1/sleep/daily-summary?baby_id=:babyId&date=YYYY-MM-DD` -> Bebeğin seçilen gündeki toplam gece/gündüz uyku sürelerini ve uyanıklık penceresini getirme
  - `PUT/PATCH /api/v1/sleep/:id` -> Uyku kaydını düzenleme
  - `DELETE /api/v1/sleep/:id` -> Uyku kaydını silme

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - Backend API'leri ile haberleşecek `sleepService` modülünün yazılması.
- **UI & Ekranlar:**
  - **Canlı Uyku Sayacı / Kronometresi:**
    - "Uykuya Daldı" ve "Uyandı" butonları ile çalışan canlı sayaç.
    - Gece Uykusu / Şekerleme (Nap) seçim geçişi.
    - Arka planda zaman takibini doğru yapmak için timestamp tabanlı süre hesabı.
  - **Uyanıklık Penceresi (Wake Window) Widget'ı:**
    - Bebeğin en son uyandığı saatten itibaren geçen uyanıklık süresini gösteren dinamik gösterge.
  - **Manuel Kayıt Ekleme / Düzenleme Modalı:**
    - Uyku başlangıç ve bitiş saatlerinin zaman seçici (TimePicker) ile geçmişe dönük ayarlanabilmesi.
  - **Geçmiş & Liste Ekranı:**
    - Gece ve gündüz uykularının farklı renk/ikon gruplarıyla kronolojik listelenmesi.

---

### Uygulama Adımları (Lütfen Sırayla Çalış):

1. **Adım 1:** Node.js backend projesinde `sleep` modülü için veritabanı şemasını/modelini oluştur ve API end-point'lerini yaz (`baby_id` ilişkisini kurduğundan emin ol).
2. **Adım 2:** Tamamlanan backend API'lerinin istek/yanıt detaylarını ve veri şemasını `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native projesine geç; `sleepService` modülünü oluştur, canlı uyku kronometresini ve uyanıklık penceresi (wake window) hesaplama mantığını kurgula.
4. **Adım 4:** Uyku kronometresi, uyanıklık penceresi kartı ve geçmiş listesi UI bileşenlerini geliştirip test et.

Sırasıyla bu adımları takip ederek geliştirmeye başla.