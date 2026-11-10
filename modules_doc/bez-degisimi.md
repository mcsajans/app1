Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **6. Modül olan "Bez Değişimi" (`diaper`)** geliştirmesini yapacaksın.

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

### Modül 6: Bez Değişimi (`diaper`) Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:
- **Veri Modeli (Schema/Entity):**
  - `id` (UUID/Primary Key)
  - `baby_id` (UUID, Foreign Key -> `babies.id`, Zorunlu)
  - `type` (Enum: 'wet', 'dirty', 'both', 'dry', Bez Türü: Çiş / Kaka / Çiş+Kaka / Kuru - Zorunlu)
  - `poop_color` (Enum: 'yellow', 'brown', 'green', 'black', 'red', 'other', Kaka Rengi - Opsiyonel)
  - `poop_texture` (Enum: 'normal', 'liquid', 'hard', 'seedy', Kaka Kıvamı - Opsiyonel)
  - `rash_status` (Enum: 'none', 'mild', 'severe', Pişik Durumu - Varsayılan: 'none')
  - `cream_applied` (Boolean, Krem/Merhem Sürüldü mü? - Varsayılan: false)
  - `changed_at` (DateTime/ISOString, Bez Değişim Zamanı - Zorunlu)
  - `notes` (Text, Opsiyonel ebeveyn notu)
  - `created_at`, `updated_at`

- **API End-point'leri:**
  - `POST /api/v1/diaper` -> Yeni bez değişimi kaydı oluşturma
  - `GET /api/v1/diaper?baby_id=:babyId` -> Seçili bebeğe ait bez değişimi geçmişini filtreli/sayfalamalı listeleme
  - `GET /api/v1/diaper/daily-summary?baby_id=:babyId&date=YYYY-MM-DD` -> Bebeğin seçilen gündeki toplam çiş/kaka bez sayılarını ve pişik durumunu getirme
  - `PUT/PATCH /api/v1/diaper/:id` -> Bez değişimi kaydını güncelleme
  - `DELETE /api/v1/diaper/:id` -> Bez değişimi kaydını silme

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - Backend API'leri ile haberleşecek `diaperService` modülünün yazılması.
- **UI & Ekranlar:**
  - **Hızlı Bez Değişimi Ekleme Ekranı:**
    - Bez türü seçimi için ikonlu görsel butonlar (Çiş, Kaka, İkisi Birlikte, Kuru).
    - Kaka seçildiğinde açılan Renk (Sarı, Yeşil, Kahverengi vb.) ve Kıvam (Sulu, Sert vb.) seçicileri.
    - Pişik Durumu derecelendirmesi ve "Pişik Kremi Sürüldü" switch/toggle kontrolü.
    - Tarih/Saat seçici (Varsayılan: Şu an).
  - **Günlük Özet Sayacı Widget'ı:**
    - Bugün değiştirilen toplam bez sayısı, çişli ve kakalı bez adetlerinin özeti.
  - **Geçmiş & Liste Ekranı:**
    - Bez değişim kayıtlarının tür ikonları ve renk detaylarıyla kronolojik listelenmesi.

---

### Uygulama Adımları (Lütfen Sırayla Çalış):

1. **Adım 1:** Node.js backend projesinde `diaper` modülü için veritabanı şemasını/modelini oluştur ve API end-point'lerini yaz (`baby_id` ilişkisini kurduğundan emin ol).
2. **Adım 2:** Tamamlanan backend API'lerinin istek/yanıt detaylarını ve veri şemasını `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native projesine geç; `diaperService` modülünü oluştur, form validasyonlarını ve koşullu renk/kıvam seçici logic'lerini kurgula.
4. **Adım 4:** Bez değişimi formu, günlük adet özet widget'ı ve geçmiş listesi UI bileşenlerini geliştirip test et.

Sırasıyla bu adımları takip ederek geliştirmeye başla.