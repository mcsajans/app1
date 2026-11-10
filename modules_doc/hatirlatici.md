Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **8. Modül olan "Hatırlatıcılar" (`reminders`)** geliştirmesini yapacaksın.

### Proje Mimarısı & Çalışma Kuralları
1. **Dizin Yapısı & Bağımsızlık:**
  - Projemiz iki ayrı dizinden oluşuyor: Backend (`/backend` veya Node.js projesinin olduğu dizin) ve Mobil App (`/app` veya React Native projesinin olduğu dizin).
  - Backend ve Mobile App projeleri birbirinden bağımsız dizinlerde çalışmaktadır.
2. **Dokümantasyon:**
  - Projede yapılan tüm mimari kararlar, API end-point tanımları ve veri modelleri projenin kök dizininde (veya ilgili dizinde) yer alan `teknik_dokuman.md` dosyasına eksiksiz şekilde yazılacak/güncellenecektir.
3. **Geliştirme Akışı (Strict Step-by-Step Order):**
  - **ÖNCE BACKEND:** İlk olarak Node.js tarafındaki veri modelleri, zamanlanmış görev yapısı ve API end-point'leri geliştirilmeli ve test edilmelidir.
  - **DOKÜMANTASYON:** API ve veri yapısı tamamlandığında `teknik_dokuman.md` dosyasına ilgili modül detayları eklenmelidir.
  - **SONRA REACT NATIVE:** Backend API'leri hazır hale geldikten sonra React Native tarafına geçilmeli, yerel bildirim (Local Notification) entegrasyonu ve alarm yönetimi geliştirilmelidir.

---

### Modül 8: Hatırlatıcılar (`reminders`) Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:
- **Veri Modeli (Schema/Entity):**
  - `id` (UUID/Primary Key)
  - `baby_id` (UUID, Foreign Key -> `babies.id`, Zorunlu)
  - `title` (String, Hatırlatıcı Başlığı - Zorunlu)
  - `category` (Enum: 'feeding', 'sleep', 'diaper', 'medicine', 'vaccine', 'doctor', 'custom', Zorunlu)
  - `remind_at` (DateTime/ISOString, İlk Hatırlatma Zamanı - Zorunlu)
  - `is_recurring` (Boolean, Tekrarlayan Bildirim mi?)
  - `recurrence_interval_hours` (Integer, Kaç saatte bir tekrarlanacağı - Opsiyonel)
  - `is_active` (Boolean, Aktif/Pasif Durumu - Varsayılan: true)
  - `created_at`, `updated_at`

- **API End-point'leri:**
  - `POST /api/v1/reminders` -> Yeni hatırlatıcı oluşturma
  - `GET /api/v1/reminders?baby_id=:babyId` -> Bebeğe ait aktif/pasif hatırlatıcıları listeleme
  - `PATCH /api/v1/reminders/:id/toggle` -> Hatırlatıcıyı aktif/pasif yapma
  - `PUT/PATCH /api/v1/reminders/:id` -> Hatırlatıcıyı güncelleme
  - `DELETE /api/v1/reminders/:id` -> Hatırlatıcıyı silme

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - `reminderService` ve Cihaz İçi Yerel Bildirim Entegrasyonu (`react-native-push-notification` veya `expo-notifications`).
- **UI & Ekranlar:**
  - **Hatırlatıcı Ekleme / Düzenleme Ekranı:**
    - Kategori seçimi (İlaç, Aşı, Beslenme, Dr. Randevusu vb.).
    - Tarih ve Saat seçici.
    - "Son Aktiviteden X Saat Sonra Uyar" veya "Her Gün Saat X'te Uyar" gibi esnek periyot seçimleri.
  - **Hatırlatıcı Listesi:**
    - Aktif ve tamamlanmış alarm/bildirim kartları listesi (Açma/kapatma switch butonlu).

---

### Uygulama Adımları (Lütfen Sırayla Çalış):
1. **Adım 1:** Node.js backend projesinde `reminders` veritabanı şemasını oluştur ve API end-point'lerini yaz (`baby_id` ilişkili).
2. **Adım 2:** Tamamlanan backend API'lerinin istek/yanıt detaylarını `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native projesine geç; `reminderService` ve yerel push bildirim izin/zamanlama servislerini kurgula.
4. **Adım 4:** Hatırlatıcı oluşturma formu ve aktif alarmlar listesi UI bileşenlerini geliştirip test et.