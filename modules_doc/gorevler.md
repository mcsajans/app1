Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **13. Modül olan "Görevler" (`tasks`)** geliştirmesini yapacaksın.

### Proje Mimarısı & Çalışma Kuralları
1. **Dizin Yapısı & Bağımsızlık:**
  - Projemiz iki ayrı dizinden oluşuyor: Backend (`/backend` veya Node.js projesinin olduğu dizin) ve Mobil App (`/app` veya React Native projesinin olduğu dizin).
  - Backend ve Mobile App projeleri birbirinden bağımsız dizinlerde çalışmaktadır.
2. **Dokümantasyon:**
  - Projede yapılan tüm mimari kararlar, API end-point tanımları ve veri modelleri projenin kök dizininde (veya ilgili dizinde) yer alan `teknik_dokuman.md` dosyasına eksiksiz şekilde yazılacak/güncellenecektir.
3. **Geliştirme Akışı (Strict Step-by-Step Order):**
  - **ÖNCE BACKEND:** İlk olarak Node.js tarafındaki veri modelleri, görev atama mantığı, şablon verileri ve API end-point'leri geliştirilmeli ve test edilmelidir.
  - **DOKÜMANTASYON:** API ve veri yapısı tamamlandığında `teknik_dokuman.md` dosyasına ilgili modül detayları eklenmelidir.
  - **SONRA REACT NATIVE:** Backend API'leri hazır hale geldikten sonra React Native tarafına geçilmeli, görev atama formu, detaylı mama/süt tarifi modalları ve tamamlama aksiyonları geliştirilmelidir.

---

### Modül 13: Görevler (`tasks`) Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:
- **Veri Modeli (Schema/Entity):**
  - `id` (UUID/Primary Key)
  - `baby_id` (UUID, Foreign Key -> `babies.id`, Zorunlu)
  - `creator_user_id` (UUID, Görevi Oluşturan Ebeveyn - Zorunlu)
  - `assigned_user_id` (UUID, Atanan Aile Üyesi/Bakıcı - Opsiyonel, boşsa herkese açık)
  - `title` (String, Görev Başlığı - Zorunlu)
  - `task_type` (Enum: 'formula_prep', 'breast_milk_feed', 'medicine', 'care', 'custom', Görev Tipi - Zorunlu)
  - `status` (Enum: 'pending', 'in_progress', 'completed', 'cancelled', Varsayılan: 'pending')
  - `due_time` (DateTime/ISOString, Görevin Yapılacağı Zaman - Zorunlu)
  - **Detaylı Formül/Tarif Nesnesi (JSON Field - `instruction_details`):**
    - `formula_amount_ml` (Float - Toplam mama miktarı)
    - `formula_scoops` (Float - Kaşık/ölçek sayısı)
    - `hot_water_ml` (Float - Sıcak su miktarı)
    - `cold_water_ml` (Float - Soğuk su miktarı)
    - `pumping_stash_id` (UUID - Kullanılacak sağılmış süt referansı)
    - `special_notes` (Text - Ek uyarılar/notlar)
  - `completed_at` (DateTime/ISOString)
  - `created_at`, `updated_at`

- **API End-point'leri:**
  - `POST /api/v1/tasks` -> Yeni görev oluşturma ve atama (Gerekirse atanan kişiye bildirim gönderme)
  - `GET /api/v1/tasks?baby_id=:babyId&status=pending|completed` -> Bebeğe ait görevleri durumuna ve atanan kişiye göre listeleme
  - `GET /api/v1/tasks/:id` -> Görev detaylarını (mama tarif detayları dahil) getirme
  - `PATCH /api/v1/tasks/:id/status` -> Görev durumunu güncelleme ('completed' yapıldığında istenirse ilgili aktiviteye dönüştürme logic'i)
  - `DELETE /api/v1/tasks/:id` -> Görevi silme veya iptal etme

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - `taskService` entegrasyonu.
- **UI & Ekranlar:**
  - **Görev Oluşturma Modalı:**
    - Görev türü seçimi (Mama Hazırla, Sağılmış Süt Ver, İlaç İçir vb.).
    - Kime Atanacağı seçimi (Anne, Baba, Dede, Bakıcı vb. kullanıcı listesinden).
    - Mama Hazırlama seçildiğinde açılan özel alanlar: *Kaç ml? Kaç ölçek mama? Ne kadar sıcak / ne kadar soğuk su?*
    - Saat seçici.
  - **Görev Kartı & Detay Ekranı:**
    - Hazırlama adımlarını açık ve belirgin listeleyen detaylı görev kartı (Örn: 🥣 *150ml Mama • 5 Ölçek • 90ml Sıcak + 60ml Soğuk Su*).
    - Atanan kişinin görevi bitirdiğinde basacağı "Tamamlandı Olarak İşaretle" butonu.
  - **Dashboard / Akış Entegrasyonu:**
    - Ana sayfada yaklaşan görevleri gösteren "Bugünün Görevleri" özet alanı.

---

### Uygulama Adımları (Lütfen Sırayla Çalış):
1. **Adım 1:** Node.js backend projesinde `tasks` veritabanı şemasını ve JSON detay yapısını oluştur, API end-point'lerini yaz (`baby_id` ve `user_id` ilişkili).
2. **Adım 2:** Tamamlanan backend API'lerinin detaylarını ve şemasını `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native projesine geç; `taskService` katmanını, mama tarif parametrelerinin validasyonlarını kurgula.
4. **Adım 4:** Görev oluşturma formu (mama/su miktarları girdi alanları dahil), görev listesi ve tamamlama aksiyonu UI bileşenlerini geliştirip test et.