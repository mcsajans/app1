Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **1. Modül olan "Bebek Profilleri" (`babies`)** geliştirmesini yapacaksın.

### Proje Mimarısı & Çalışma Kuralları
1. **Dizin Yapısı & Bağımsızlık:**
  - Projemiz iki ayrı dizinden oluşuyor: Backend (`/backend` veya Node.js projesinin olduğu dizin) ve Mobil App (`/app` veya React Native projesinin olduğu dizin).
  - Backend ve Mobile App sürücüleri/projeleri birbirinden bağımsız dizinlerde çalışmaktadır.
2. **Dokümantasyon:**
  - Projede yapılan tüm mimari kararlar, API end-point tanımları ve veri modelleri projenin kök dizininde (veya ilgili dizinde) yer alan `teknik_dokuman.md` dosyasına eksiksiz şekilde yazılacaktır/güncellenecektir.
3. **Geliştirme Akışı (Strict Step-by-Step Order):**
  - **ÖNCE BACKEND:** İlk olarak Node.js tarafındaki veri modelleri, veritabanı şeması/migration'ları, validation'lar ve API end-point'leri geliştirilmeli ve test edilmelidir.
  - **DOKÜMANTASYON:** API ve veri yapısı tamamlandığında `teknik_dokuman.md` dosyasına ilgili modül detayları eklenmelidir.
  - **SONRA REACT NATIVE:** Backend API'leri hazır hale geldikten ve dokümante edildikten sonra React Native tarafına geçilmeli, API servis entegrasyonu, state yönetimi ve UI bileşenleri geliştirilmelidir.

---

### Modül 1: Bebek Profilleri (`babies`) Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:
- **Veri Modeli (Schema/Entity):**
  - `id` (UUID/Primary Key)
  - `name` (String, Zorunlu)
  - `gender` (Enum: 'male', 'female', Zorunlu)
  - `birth_date` (DateTime/ISOString, Zorunlu)
  - `birth_time` (String/Time, Opsiyonel)
  - `birth_weight` (Float - gram/kg, Opsiyonel)
  - `birth_height` (Float - cm, Opsiyonel)
  - `head_circumference` (Float - cm, Opsiyonel)
  - `blood_type` (Enum: 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-', Opsiyonel)
  - `is_premature` (Boolean, Varsayılan: false)
  - `gestational_age_weeks` (Integer, Prematüre ise gebelik haftası)
  - `photo_url` (String, Opsiyonel)
  - `is_default` (Boolean, Aktif seçili profil için)
  - `created_at`, `updated_at`

- **API End-point'leri:**
  - `POST /api/v1/babies` -> Yeni bebek profili oluşturma
  - `GET /api/v1/babies` -> Kullanıcıya ait tüm bebek profillerini listeleme
  - `GET /api/v1/babies/:id` -> Tek bir bebek profil detayı
  - `PUT/PATCH /api/v1/babies/:id` -> Bebek profil bilgilerini güncelleme
  - `DELETE /api/v1/babies/:id` -> Profil silme veya arşivleme
  - `POST /api/v1/babies/:id/select` -> Aktif/varsayılan bebek profilini değiştirme

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - Backend API'leri ile haberleşecek `babyService` (Axios / Fetch) modülünün yazılması.
- **State Yönetimi:**
  - Uygulama genelinde aktif seçili bebeği tutacak Context / Redux / Zustand state yapısı (`activeBaby`).
- **UI & Ekranlar:**
  - **Profil Listeleme & Seçici (Profile Switcher):** Header veya menüde bebekler arası hızlı geçiş yapmayı sağlayan bileşen.
  - **Profil Oluşturma / Düzenleme Ekranı:** Form validation'ları içeren, fotoğraf seçimi destekleyen form ekranı.
  - **Dinamik Yaş Hesaplama Mantığı (Helper/Utility):**
    - 0-30 gün arası: "X Günlük"
    - 1-24 ay arası: "X Ay Y Günlük"
    - 2 yaş üzeri: "X Yaş Y Aylık" gösterim formatı.
    - Prematüre ise "Düzeltilmiş Yaş" hesaplama opsiyonu.

---

### Uygulama Adımları (Lütfen Sırayla Çalış):

1. **Adım 1:** Node.js backend projesinde `babies` modülü için veri tabanı modelini/şemasını oluştur ve API end-point'lerini yaz.
2. **Adım 2:** Tamamlanan backend API'lerinin istek/yanıt detaylarını ve veri şemasını `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native projesine geç; yazılan API'leri çağıracak API servisini ve state yönetimini kurgula.
4. **Adım 4:** Profil oluşturma, listeleme ve aktif profil seçme React Native UI bileşenlerini geliştir ve test et.

Sırasıyla bu adımları takip ederek geliştirmeye başla.