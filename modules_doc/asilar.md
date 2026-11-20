Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **Aşı Takibi (`vaccines`)** modülünü görev atama, takvim entegrasyonu ve çoklu bildirim desteğiyle baştan kurgulayıp geliştireceksin.

### Proje Mimarisi & Çalışma Kuralları
1. **Dizin Yapısı:** Backend (`/backend`) ve Mobil App (`/app`) bağımsız dizinlerde çalışmaktadır.
2. **Dokümantasyon:** Yapılan tüm veri modelleri, API değişiklikleri ve varsayılan aşı tanımları `teknik_dokuman.md` dosyasına kaydedilmelidir.
3. **Geliştirme Akışı (Strict Step-by-Step Order):**
  - **ÖNCE BACKEND:** Veritabanı şemalarını, seed verilerini (Ulusal + Özel aşılar), görev entegrasyonunu ve API end-point'lerini yaz.
  - **DOKÜMANTASYON:** Detayları `teknik_dokuman.md` dosyasına kaydet.
  - **SONRA REACT NATIVE:** Mobil tarafta aşı takvimi ekranını, randevu/yer ekleme modalını, görev atama bağlantısını ve 1 hafta/2 gün/1 gün önceden çalışan bildirim sistemini geliştir.

---

### Modül: Aşı Takibi (`vaccines`) Baştan Kurgu Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:
- **Veri Modelleri (Schema/Entity):**
  - **`vaccine_definitions` (Sistem Aşı Kütüphanesi):**
    - `id` (UUID)
    - `name` (String: Örn: "DaBT-İPA-Hib", "Rotavirüs", "Meningokok B", "Özel Aşı")
    - `category` (Enum: 'mandatory', 'optional', 'custom')
    - `target_month` (Integer: 0, 1, 2, 4, 6, 12, 18, 24, 48, 156 vb.)
    - `dose_number` (Integer)
    - `description` (Text)
  - **`baby_vaccines` (Bebeğe Atanmış Aşı Takvimi):**
    - `id` (UUID)
    - `baby_id` (UUID, Foreign Key -> `babies.id`, Zorunlu)
    - `vaccine_definition_id` (UUID, Foreign Key -> `vaccine_definitions.id`, Opsiyonel - Özel aşı ise boş)
    - `custom_vaccine_name` (String, Özel aşı adı)
    - `status` (Enum: 'pending', 'upcoming', 'completed', 'delayed', 'skipped')
    - `planned_date` (Date/ISOString, Planlanan aşı tarihi - Zorunlu)
    - `location` (String, Aşı yapılacak yer/sağlık kuruluşı - Örn: "Aİle Sağlığı Merkezi", "Özel Hastane")
    - `assigned_task_id` (UUID, Foreign Key -> `tasks.id`, Aşı görevi atandıysa görev referansı)
    - `completed_date` (DateTime/ISOString)
    - `doctor_name` (String)
    - `side_effects` (JSON - `fever`, `swelling`, `redness`, `irritability` booleans)
    - `notification_offsets` (Array of Integers, Default: `[10080, 2880, 1440]` -> 7 Gün / 1 Hafta, 2 Gün ve 1 Gün öncesi dakika değerleri)
    - `device_alarm_ids` (Array of Strings)

- **API End-point'leri & Logic:**
  - **Otomatik Aşı Takvimi Oluşturma:** Yeni bebek oluşturulduğunda (`POST /api/v1/babies`), doğum tarihine göre tüm `mandatory` aşıları otomatik olarak `planned_date` hesaplayarak `baby_vaccines` tablosuna ekle.
  - `GET /api/v1/vaccines?baby_id=:babyId&category=mandatory|optional|custom` -> Bebeğe ait tüm aşıları filtreli/kategorili listeleme.
  - `POST /api/v1/vaccines/schedule` -> Aşıya tarih, yapılacağı yer ekleme ve opsiyonel olarak `tasks` modülü üzerinden aile ferdine "Aşı Yaptırma Görevi" oluşturma.
  - `POST /api/v1/vaccines/custom` -> "Diğer / Özel Aşı" ekleme.
  - `PATCH /api/v1/vaccines/:id/complete` -> Aşıyı tamamlandı işaretleme (Bağlı görev varsa onu da 'completed' yapma).

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - `vaccineService` entegrasyonu.
- **Bildirim & Alarm Zamanlayıcı (Notification Scheduler):**
  - Aşı tarihi ve yapılacağı yer girildiğinde cihazda **1 Hafta Önce (7 gün)**, **2 Gün Önce** ve **1 Gün Önce** tetiklenecek 3 ayrı yerel bildirim ve cihaz takvimi alarmı kur (`scheduleNotification`).
- **UI & Ekranlar:**
  - **Aşı Takvimi & Liste Ekranı:**
    - Sekmeler: "Ulusal Aşı Takvimi", "Özel Aşılar", "Diğer / Manuel Aşılar".
    - Aşı Kartı: Aşı adı, dozu, hedeflenen tarih, yapılacağı yer ve durum rozeti (Tamamlandı, Gecikti, Planlandı).
  - **Aşı Randevusu & Görev Atama Modalı:**
    - Aşı Tarihi ve Yapılacağı Yer (Lokasyon/Hastane) seçimi.
    - **"Görevi Aile Üyesine Ata" Switch / Seçim Alanı:** Görevin kime atanacağı (Anne, Baba, Bakıcı vb.) seçeneği.
  - **Diğer Aşı Ekleme Ekranı:**
    - Ulusal takvim dışındaki özel aşı adını, dozunu ve zamanını elle girme formu.

---

### Uygulama Adımları (Lütfen Sırayla Çalış):

1. **Adım 1:** Node.js backend tarafında Sağlık Bakanlığı ve özel aşı seed verilerini ekle; `baby_vaccines` şemasını `tasks` modülü ilişkisi, `location` ve `notification_offsets` [10080, 2880, 1440] ile güncelle.
2. **Adım 2:** Veritabanı yapısını ve API tanımlarını `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native tarafında 1 hafta, 2 gün ve 1 gün öncesi bildirim kurulum mekanizmasını `vaccineService` üzerine entegre et.
4. **Adım 4:** Aşı takvimi ekranı, aşı randevu/yer ekleme modalı, görev atama bağlantısı ve "Diğer Aşı" ekleme UI bileşenlerini geliştirip test et.

Sırasıyla bu adımları takip ederek geliştirmeye başla.

---

## Reklam davranışı (2026-11-21)

| Eylem | Tetik |
|-------|-------|
| Randevuyu kaydet | `save` |
| "Yapıldı olarak işaretle" | `complete` |
| Takvime aşı ekle | `save` |

Aşı **bildirimleri** (7 gün / 2 gün / 1 gün önce) ve cihaz takvimi kaydı
reklamla ilgisiz. Eksik aşı hatırlatması (bildirim merkezine düşen satır) da
reklam tetiklemez.

Ortak kurallar (ayrıntı: `TEKNIK_DOKUMAN.md` §23):

- Tetikleyici panelden açılıp kapatılır (`/admin/ads`); ana anahtar kapalıyken
  hiçbir istek atılmaz.
- Reklam **kayıttan sonra** ve `await` edilmeden çağrılır; hiç `throw` etmez.
  Kayıt hiçbir koşulda reklamdan etkilenmez.
- Frekans sınırı (varsayılan 3 dk) ve oturum tavanı (5) her tetiği kapsar;
  ninni çalarken, uygulama arka plandayken ve kaydetme onay penceresi
  açıkken gösterim atlanır.
- Ekranın altındaki **sabit banner** ayrı bir iş: tetikleyiciye bağlı değil,
  her ekranda duruyor (§23.7).

---

## Ek Geliştirme — Eksik aşı hatırlatması (2026-11-21)

**Girilmemiş aşılar bildirim merkezine düşüyor.** Ana sayfa açıldığında
istemci `POST /babies/{id}/vaccines/remind-missing` çağırıyor; sunucu
koşulları değerlendirip gerekirse bildirim yazıyor.

### Koşullar

| Koşul | Değer |
|-------|-------|
| Bebek yaşı | **30 günden büyük** |
| ya da profil yeni eklendi | son **7 gün** içinde (doğumdaki Hepatit B / BCG için) |
| Girilmemiş aşı | `status = 'pending'` **ve** planlanan gün geçmiş |
| Tekrar | aynı kullanıcı + bebek için **24 saatte bir** |

`skipped` (bilinçli atlama) ve `completed` sayılmıyor — ikisini hatırlatmak
kullanıcıya kendi kararını tekrar sormak olurdu.

### Neden böyle

- **Sunucuda yazılıyor**, çünkü bildirim merkezi sunucudaki `notifications`
  tablosu (§22.13): kullanıcı telefon değiştirse de hatırlatma duruyor.
- **İstemci tetikliyor**, çünkü "bugün" cihazın saat diliminde anlamlı ve
  hatırlatmanın doğal anı ana sayfanın açılması. Her gece çalışan bir
  zamanlanmış iş, çalışmadığı gün sessizce hiçbir şey yapmazdı.
- **Uç idempotent.** Ana sayfa günde onlarca kez açılıyor; `notifyUser`'ın
  `dedupeHours: 24` kapısı olmasa merkez aynı satırla dolardı. İstemci ayrıca
  oturum başına bebek başına tek çağrı yapıyor.

### Bildirim

Başlık "Eksik aşı kaydı", gövde en eski üç aşının adı (doz numarasıyla) ve
"+N aşı daha"; dokununca **Aşı Takibi** ekranı açılıyor. Aktörü yok
(`actor_user_id = NULL`): bunu bir aile üyesi değil, sistemin kendisi
söylüyor.

Yeni sunucu yardımcısı: `notifyUser()` (`src/services/notifications.ts`) —
`notifyFamily`den farkı, olayı yapanı dışlamak yerine **tek bir kullanıcıya**
yazması ve başlığa göre tekrarı engelleyebilmesi.
