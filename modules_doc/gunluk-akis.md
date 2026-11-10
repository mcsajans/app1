Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **9. Modül olan "Günlük Akış" (`timeline`)** geliştirmesini yapacaksın.

### Proje Mimarısı & Çalışma Kuralları
1. **Dizin Yapısı & Bağımsızlık:**
  - Projemiz iki ayrı dizinden oluşuyor: Backend (`/backend` veya Node.js projesinin olduğu dizin) ve Mobil App (`/app` veya React Native projesinin olduğu dizin).
  - Backend ve Mobile App projeleri birbirinden bağımsız dizinlerde çalışmaktadır.
2. **Dokümantasyon:**
  - Projede yapılan tüm mimari kararlar, API end-point tanımları ve veri modelleri projenin kök dizininde (veya ilgili dizinde) yer alan `teknik_dokuman.md` dosyasına eksiksiz şekilde yazılacak/güncellenecektir.
3. **Geliştirme Akışı (Strict Step-by-Step Order):**
  - **ÖNCE BACKEND:** İlk olarak tüm bakım modüllerinin (`breastfeeding`, `bottle`, `solid`, `sleep`, `diaper`, `pumping`) verilerini tek bir kronolojik akışta birleştirecek Node.js API katmanı geliştirilmeli ve test edilmelidir.
  - **DOKÜMANTASYON:** API ve veri yapısı tamamlandığında `teknik_dokuman.md` dosyasına ilgili modül detayları eklenmelidir.
  - **SONRA REACT NATIVE:** Backend API'leri hazır hale geldikten sonra React Native tarafına geçilmeli, dinamik kart yapısı ve sonsuz kaydırma (Infinite Scroll/Pagination) UI entegrasyonu yapılmalıdır.

---

### Modül 9: Günlük Akış (`timeline`) Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:
- **API End-point'leri & Birleşik Sorgu (Aggregated Feed):**
  - `GET /api/v1/timeline?baby_id=:babyId&date=YYYY-MM-DD&page=1&limit=20&categories=sleep,feeding,diaper` -> Tüm aktiviteleri zaman damgasına (`timestamp`) göre azalan sırada birleştirerek dönen ana feed API'si.
  - Yanıt Formatı: Her kayıt için `id`, `category`, `timestamp`, `title`, `summary_details`, `actor_user_name` nesnelerini içermelidir.

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - `timelineService` (Sayfalamalı/Pagination destekli istek yapısı).
- **UI & Ekranlar:**
  - **Ana Ekran Kronolojik Akış (Feed List):**
    - Tarih seçici/Takvim şeridi (Tarihler arası hızlı geçiş).
    - Her modüle özel renk ve ikonla tasarlanmış dinamik akış kartları (Örn: Uyku kartı mavi, Beslenme pembe, Bez sarı).
    - Aktivite kartına tıklandığında ilgili kaydın detay modalını açma/düzenleme/silme imkanı.
  - **Kategori Filtreleme Barı:**
    - Sadece uykuları, sadece beslenmeleri veya sadece bez değişimlerini filtreleme imkanı (Filter Chips).

---

### Uygulama Adımları (Lütfen Sırayla Çalış):
1. **Adım 1:** Node.js backend projesinde tüm aktivite tablolarından veri toplayan ortak `timeline` aggregation API'sini ve filtreleme parametrelerini geliştir.
2. **Adım 2:** API yanıt şemasını ve parametreleri `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native projesine geç; `timelineService` katmanını ve tarih bazlı state yapısını kurgula.
4. **Adım 4:** Tarih şeridi, modül bazlı akış kartları ve kategori filtreleme UI bileşenlerini geliştirip test et.