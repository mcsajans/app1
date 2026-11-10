Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **4. Modül olan "Ek Gıda" (`solid`)** geliştirmesini yapacaksın.

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

### Modül 4: Ek Gıda (`solid`) Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:
- **Veri Modeli (Schema/Entity):**
  - `id` (UUID/Primary Key)
  - `baby_id` (UUID, Foreign Key -> `babies.id`, Zorunlu)
  - `food_name` (String, Yiyecek/Besin Adı - Zorunlu)
  - `category` (Enum: 'vegetable', 'fruit', 'cereal', 'protein', 'dairy', 'snack', 'other', Kategori - Zorunlu)
  - `amount` (Float, Porsiyon/Miktar - Opsiyonel)
  - `unit` (Enum: 'spoon', 'gram', 'bowl', 'piece', Birim - Varsayılan: 'spoon')
  - `reaction` (Enum: 'loved', 'neutral', 'disliked', 'allergic', Reaksiyon / Sevme Durumu - Zorunlu)
  - `is_three_day_rule` (Boolean, 3 Gün Kuralı Denemesi mi? - Varsayılan: false)
  - `given_at` (DateTime/ISOString, Veriliş zamanı - Zorunlu)
  - `notes` (Text, Opsiyonel ebeveyn notu - örn: "Gaz yaptı, döküntü oluştu vb.")
  - `created_at`, `updated_at`

- **API End-point'leri:**
  - `POST /api/v1/solid` -> Yeni ek gıda kaydı oluşturma
  - `GET /api/v1/solid?baby_id=:babyId` -> Seçili bebeğe ait ek gıda geçmişini filtreli/sayfalamalı listeleme
  - `GET /api/v1/solid/allergies?baby_id=:babyId` -> Bebeğin alerji veya reaksiyon gösterdiği tüm gıdaların listesi
  - `PUT/PATCH /api/v1/solid/:id` -> Ek gıda kaydını güncelleme
  - `DELETE /api/v1/solid/:id` -> Ek gıda kaydını silme

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - Backend API'leri ile haberleşecek `solidService` modülünün yazılması.
- **UI & Ekranlar:**
  - **Ek Gıda Ekleme Formu:**
    - Yiyecek adı girişi (Sık kullanılan gıdalar için hızlı seçim etiketleri/chip'ler).
    - Kategori seçimi (Sebze, Meyve, Tahıl, Protein vb.).
    - Reaksiyon/Sevme Durumu seçici (İkonlu: Sevdi / Nötr / Sevmedi / Alerji Oluştu).
    - "3 Gün Kuralı" anahtarı (Switch/Toggle).
    - Tarih/Saat seçici ve not alanı.
  - **Alerji / Reaksiyon Uyarı Kartı:**
    - Alerjik reaksiyon işaretlenen gıdaları belirgin kırmızı uyarı rozeti ile gösteren liste bileşeni.
  - **Geçmiş & Liste Ekranı:**
    - Ek gıda deneyimlerinin kategori ve reaksiyon ikonlarıyla kronolojik listelenmesi.

---

### Uygulama Adımları (Lütfen Sırayla Çalış):

1. **Adım 1:** Node.js backend projesinde `solid` modülü için veritabanı şemasını/modelini oluştur ve API end-point'lerini yaz (`baby_id` ilişkisini kurduğundan emin ol).
2. **Adım 2:** Tamamlanan backend API'lerinin istek/yanıt detaylarını ve veri şemasını `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native projesine geç; `solidService` modülünü oluştur, form validasyonlarını ve reaksiyon logic'lerini kurgula.
4. **Adım 4:** Ek gıda formu, alerji takip uyarıları ve geçmiş listesi UI bileşenlerini geliştirip test et.

Sırasıyla bu adımları takip ederek geliştirmeye başla.