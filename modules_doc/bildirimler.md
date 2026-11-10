Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **Sağ Üst Köşe Bildirim Merkezi (`notifications`)** modülünü kurgulayıp geliştireceksin.

### Proje Mimarisi & Çalışma Kuralları
1. **Dizin Yapısı:** Backend (`/backend`) ve Mobil App (`/app`) bağımsız dizinlerde çalışmaktadır.
2. **Dokümantasyon:** Yapılan tüm veri modelleri, API değişiklikleri ve bildirim türleri `teknik_dokuman.md` dosyasına kaydedilmelidir.
3. **Geliştirme Akışı (Strict Step-by-Step Order):**
  - **ÖNCE BACKEND:** Veritabanı şemasını, bildirim oluşturma servisini ve API end-point'lerini yaz.
  - **DOKÜMANTASYON:** Detayları `teknik_dokuman.md` dosyasına kaydet.
  - **SONRA REACT NATIVE:** Header zili, bildirim rozeti (badge), bildirim listesi modalı/ekranı ve deep-link yönlendirmelerini kurgula.

---

### Modül: Bildirim Merkezi (`notifications`) Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:
- **Veri Modeli (`notifications` tablosu/şeması):**
  - `id` (UUID)
  - `user_id` (UUID, Bildirimin alıcısı olan kullanıcı - Zorunlu)
  - `baby_id` (UUID, Foreign Key -> `babies.id`, Zorunlu)
  - `title` (String, Bildirim Başlığı - Zorunlu)
  - `body` (String, Bildirim Detayı/İçeriği - Zorunlu)
  - `type` (Enum: 'vaccine', 'task', 'reminder', 'routine', 'family', Bildirim Tipi - Zorunlu)
  - `target_screen` (String, Tıklandığında gidilecek mobil ekran adı - Örn: 'VaccineDetail', 'TaskDetail')
  - `target_id` (UUID, İlgili kaydın ID'si - Örn: aşı ID'si veya görev ID'si)
  - `is_read` (Boolean, Okundu mu? - Varsayılan: false)
  - `created_at` (DateTime/ISOString)

- **İş Mantığı (Central Notification Service) & API End-point'leri:**
  - **Merkezi Bildirim Tetikleyici:** Sistemde bir aşı zamanlandığında, görev atandığında, hatırlatıcı süresi geldiğinde veya aile üyesi kayıt eklediğinde veritabanına otomatik `notifications` kaydı atan helper fonksiyonu yaz (`createNotification`).
  - `GET /api/v1/notifications?baby_id=:babyId` -> Kullanıcıya ait bildirimleri okundu/okunmadı durumuna göre listeleme.
  - `GET /api/v1/notifications/unread-count?baby_id=:babyId` -> Okunmamış bildirim sayısını dönme (Rozet için).
  - `PATCH /api/v1/notifications/:id/read` -> Tekil bildirimi okundu işaretleme.
  - `PATCH /api/v1/notifications/read-all` -> Tüm bildirimleri okundu işaretleme.
  - `DELETE /api/v1/notifications/:id` -> Bildirimi silme.

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı & State:**
  - `notificationService` entegrasyonu ve okunmamış bildirim sayısını (unreadCount) global state'te (Zustand/Redux/Context) tutma.
- **UI & Header Bileşeni:**
  - **Sağ Üst Header Zili (Notification Icon & Badge):**
    - Sağ üst köşede menü butonunun yanına `Bell` ikonu eklenmesi.
    - Okunmamış bildirim varsa ikon üzerinde kırmızı dinamik rozet (Örn: `🔴 3`).
  - **Bildirim Listesi Modal / Ekranı:**
    - Zile tıklandığında açılan alt çekmece (Bottom Sheet) veya özel ekran.
    - Bildirim Türü İkonları: Aşı (💉), Görev (📋), Hatırlatıcı (⏰), Aile (👥).
    - "Tümünü Okundu İşaretle" butonu.
    - Bildirime tıklandığında `target_screen` ve `target_id` parametreleriyle ilgili detay ekranına otomatik yönlendirme (React Navigation deep-link).

---

### Uygulama Adımları (Lütfen Sırayla Çalış):

1. **Adım 1:** Node.js backend tarafında `notifications` veritabanı şemasını oluştur, diger modüllerin bildirim fırlatmasını sağlayan merkezi servisi ve API end-point'lerini yaz.
2. **Adım 2:** Veritabanı yapısını ve API tanımlarını `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native tarafında header alanına zil butonunu ve canlı okunmamış rozet sayacını entegre et.
4. **Adım 4:** Bildirim listeleme çekmecesini, bildirim tipi ikonlarını, okundu işaretleme ve yönlendirme (navigation) bileşenlerini geliştirip test et.

Sırasıyla bu adımları takip ederek geliştirmeye başla.

# Ek geliştirme
Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde yer alan zamanlayıcı bazlı modüller (**Beslenme/Emzirme - `feeding`**, **Uyku - `sleep`**, **Süt Sağma - `pumping`**) için, uygulama kapalı veya arka planda olsa bile telefonun kilit ekranında ve bildirim çubuğunda canlı geçen süreyi gösteren ve bildirim üzerinden kontrol imkanı sunan **"Canlı Sayaç Bildirimi & Kilit Ekranı Yönetimi (Live Activity / Ongoing Notification)"** özelliğini geliştireceksin.

### Proje Mimarisi & Çalışma Kuralları
1. **Dizin Yapısı:** Backend (`/backend`) ve Mobil App (`/app`) bağımsız dizinlerde çalışmaktadır.
2. **Dokümantasyon:** Yapılan tüm native modül yapılandırmaları ve state yönetimi değişiklikleri `teknik_dokuman.md` dosyasına kaydedilmelidir.
3. **Geliştirme Akışı (Strict Step-by-Step Order):**
  - **ÖNCE BACKEND:** Aktif çalışan sayaç durumlarını (start_time, pause_time, current_status) oturum bazlı saklayan ve senkronize eden API end-point'lerini kontrol et/yaz.
  - **DOKÜMANTASYON:** API ve state yapısını `teknik_dokuman.md` dosyasına kaydet.
  - **SONRA REACT NATIVE:** Native modül entegrasyonlarını (iOS ActivityKit & Android Foreground Service), bildirim üzeri buton aksiyonlarını ve React Native tarafındaki state senkronizasyonunu kurgula.

---

### Canlı Sayaç Bildirimi (Live Activity / Ongoing Notification) Gereksinimleri

#### 1. Platforma Özel Native Entegrasyon Gereksinimleri:
- **iOS (Live Activities & Dynamic Island):**
  - iOS 16.1+ desteği için `ActivityKit` entegrasyonu sağlayan React Native kütüphanesini (`react-native-live-activity` veya özel Native Module) kurgula.
  - Kilit ekranında ve Dynamic Island üzerinde canlı kronometre, bebek adı ve sayaç türü (Örn: *"Derin • Emzirme (Sol Meme)"*) gösterimi.
  - Bildirim üzerinde "Duraklat / Devam Et" ve "Bitir" aksiyon butonları (App Intent entegrasyonu).
- **Android (Foreground Service & Ongoing Notification):**
  - Arka planda sayacın kapanmaması ve canlı kalması için bir `Foreground Service` yapısı kurgula (`@notifee/react-native` veya `react-native-foreground-service`).
  - Bildirim çubuğunda `ongoing: true` (kullanıcının kaydırarak kapatamayacağı, sayaç bitince kapanan) bildirim oluştur.
  - Bildirim kartında canlı kronometre sayacı ve 2 adet aksiyon butonu: **[ Duraklat / Devam Et ]** ve **[ Bitir ]**.

#### 2. Mobil App (React Native) İş Mantığı (Logic & State):
- **Sayaç Başlatıldığında:**
  - Uygulama içi kronometre başlatıldığı an eşzamanlı olarak iOS Live Activity ve Android Foreground Service başlatılsın.
  - Bildirime başlangıç zamanı (timestamp) ve sayaç türü gönderilsin.
- **Bildirim Üzerinden İşlem Yapıldığında (Action Handling):**
  - **Duraklat (Pause):** Bildirimdeki buton tıklandığında sayaç duraklatılsın, geçen süre sabitlensin, bildirimdeki buton "Devam Et" olarak güncellensin ve durum uygulama içi state ile senkronize edilsin.
  - **Devam Et (Resume):** Sayaç kaldığı yerden devam ettirilsin ve bildirim canlı kronometre moduna dönsün.
  - **Bitir (Stop/Complete):** Bildirime tıklandığında zamanlayıcı sonlandırılsın, aktif/toplam süre hesaplanıp otomatik olarak beslenme/uyku özet modalı açılsın veya kaydetme API'si tetiklenerek bildirim kapatılsın.
- **Uygulama Kapandığında / Yeniden Açıldığında:**
  - Cihaz yeniden başlasa veya uygulama arka planda kapansa dahi sayaç zaman damgası (timestamp) esas alındığı için süre kaybı yaşanmasın, uygulama açıldığında bildirimdeki aktif durumla senkronize olsun.

---

### Uygulama Adımları (Lütfen Sırayla Çalış):

1. **Adım 1:** React Native projesinde Android için `Notifee` / Foreground Service, iOS için Live Activity modüllerini ve izin yapılandırmalarını ekle.
2. **Adım 2:** Bildirim kartı üzerinden gelen Duraklat, Devam Et ve Bitir aksiyonlarını yakalayan event listener (Background Event Handler) yapısını kurgula.
3. **Adım 3:** Yapılan mimari entegrasyonu ve state akışını `teknik_dokuman.md` dosyasına kaydet.
4. **Adım 4:** Emzirme, Uyku ve Sağma kronometrelerine canlı bildirim servisini bağla; kilit ekranında sayacın canlı aktığını, bildirim üzerinden duraklatılıp bitirilebildiğini test et.

Sırasıyla bu adımları takip ederek geliştirmeye başla.
