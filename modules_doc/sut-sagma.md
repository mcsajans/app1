Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **12. Modül olan "Süt Sağma" (`pumping`)** geliştirmesini yapacaksın.

### Proje Mimarısı & Çalışma Kuralları
1. **Dizin Yapısı & Bağımsızlık:**
  - Projemiz iki ayrı dizinden oluşuyor: Backend (`/backend` veya Node.js projesinin olduğu dizin) ve Mobil App (`/app` veya React Native projesinin olduğu dizin).
  - Backend ve Mobile App projeleri birbirinden bağımsız dizinlerde çalışmaktadır.
2. **Dokümantasyon:**
  - Projede yapılan tüm mimari kararlar, API end-point tanımları ve veri modelleri projenin kök dizininde (veya ilgili dizinde) yer alan `teknik_dokuman.md` dosyasına eksiksiz şekilde yazılacak/güncellenecektir.
3. **Geliştirme Akışı (Strict Step-by-Step Order):**
  - **ÖNCE BACKEND:** İlk olarak Node.js tarafındaki veri modelleri, dondurucu/buzdolabı stok takip mantığı ve API end-point'leri geliştirilmeli ve test edilmelidir.
  - **DOKÜMANTASYON:** API ve veri yapısı tamamlandığında `teknik_dokuman.md` dosyasına ilgili modül detayları eklenmelidir.
  - **SONRA REACT NATIVE:** Backend API'leri hazır hale geldikten sonra React Native tarafına geçilmeli, sağma kronometresi, stok takibi ve UI bileşenleri geliştirilmelidir.

---

### Modül 12: Süt Sağma (`pumping`) Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:
- **Veri Modeli (Schema/Entity):**
  - `id` (UUID/Primary Key)
  - `baby_id` (UUID, Foreign Key -> `babies.id`, Zorunlu)
  - `left_amount` (Float, Sol Göğüsten Sağılan Miktar - ml/oz)
  - `right_amount` (Float, Sağ Göğüsten Sağılan Miktar - ml/oz)
  - `total_amount` (Float, Toplam Sağılan Miktar - ml/oz)
  - `pumped_at` (DateTime/ISOString, Sağma Zamanı - Zorunlu)
  - `storage_location` (Enum: 'fridge', 'freezer', 'used_immediately', Saklama Yeri - Varsayılan: 'fridge')
  - `is_used` (Boolean, Süt Tüketildi mi / Stoktan Düşüldü mü? - Varsayılan: false)
  - `notes` (Text, Opsiyonel ebeveyn notu)
  - `created_at`, `updated_at`

- **API End-point'leri:**
  - `POST /api/v1/pumping` -> Yeni süt sağma kaydı oluşturma
  - `GET /api/v1/pumping?baby_id=:babyId` -> Seçili bebeğe ait sağma geçmişini listeleme
  - `GET /api/v1/pumping/stash?baby_id=:babyId` -> Dondurucu ve buzdolabındaki mevcut süt stoğu toplamını getirme
  - `PATCH /api/v1/pumping/:id/use` -> Stoktaki bir sütü kullanıldı/tüketildi olarak işaretleme
  - `DELETE /api/v1/pumping/:id` -> Sağma kaydını silme

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - `pumpingService` entegrasyonu.
- **UI & Ekranlar:**
  - **Sağma Ekleme Ekranı / Kronometre:**
    - Sol ve Sağ göğüs için ayrı ayrı ml/cl miktar girdisi veya canlı sağma kronometresi.
    - Saklama Yeri Seçimi (Buzdolabı, Derin Dondurucu, Hemen Tüketildi).
  - **Süt Stoğu (Milk Stash) Widget'ı:**
    - Buzdolabında ve dondurucuda toplam kaç ml kullanılabilir süt kaldığını gösteren stok kartı.
  - **Geçmiş & Liste Ekranı:**
    - Geçmiş sağma oturumlarının kronolojik listesi ve stok durumları.

---

### Uygulama Adımları (Lütfen Sırayla Çalış):
1. **Adım 1:** Node.js backend projesinde `pumping` veritabanı şemasını oluştur, stok hesaplama logic'lerini ve API end-point'lerini yaz (`baby_id` ilişkili).
2. **Adım 2:** Tamamlanan backend API'lerinin istek/yanıt detaylarını `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native projesine geç; `pumpingService` modülünü oluştur, sağma kronometresi ve stok takip state'ini kurgula.
4. **Adım 4:** Sağma kayıt formu, dondurucu süt stoğu widget'ı ve geçmiş listesi UI bileşenlerini geliştirip test et.