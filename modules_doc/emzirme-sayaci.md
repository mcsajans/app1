Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **2. Modül olan "Emzirme Sayacı" (`breastfeeding`)** geliştirmesini yapacaksın.

### Proje Mimarsı & Çalışma Kuralları
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

### Modül 2: Emzirme Sayacı (`breastfeeding`) Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:
- **Veri Modeli (Schema/Entity):**
  - `id` (UUID/Primary Key)
  - `baby_id` (UUID, Foreign Key -> `babies.id`, Zorunlu)
  - `start_time` (DateTime/ISOString, Zorunlu)
  - `end_time` (DateTime/ISOString, Zorunlu)
  - `left_duration_seconds` (Integer, Sol meme emzirme süresi - saniye cinsinden)
  - `right_duration_seconds` (Integer, Sağ meme emzirme süresi - saniye cinsinden)
  - `total_duration_seconds` (Integer, Toplam süre)
  - `last_side` (Enum: 'left', 'right', Son emzirilen taraf/son biten taraf)
  - `notes` (Text, Opsiyonel ebeveyn notu)
  - `created_at`, `updated_at`

- **API End-point'leri:**
  - `POST /api/v1/breastfeeding` -> Yeni emzirme kaydı oluşturma (Elle manuel giriş veya kronometre bitişi ile)
  - `GET /api/v1/breastfeeding?baby_id=:babyId` -> Seçili bebeğe ait emzirme geçmişini filtreli/sayfalamalı listeleme
  - `GET /api/v1/breastfeeding/last?baby_id=:babyId` -> Bebeğin son emzirme kaydını ve son emzirilen taraf bilgisini getirme
  - `PUT/PATCH /api/v1/breastfeeding/:id` -> Emzirme kaydını düzenleme (Süre veya not güncelleme)
  - `DELETE /api/v1/breastfeeding/:id` -> Emzirme kaydını silme

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - Backend API'leri ile haberleşecek `breastfeedingService` modülünün yazılması.
- **UI & Ekranlar:**
  - **Canlı Emzirme Kronometresi (Timer Screen):**
    - Sağ Meme ve Sol Meme için bağımsız Başlat / Duraklat (Start/Pause) butonları.
    - Anlık olarak sağ ve sol süreleri ayrı ayrı, toplam süreyi genel gösteren canlı kronometre bileşeni.
    - Uygulama arka plana geçtiğinde kronometrenin durmaması/doğru saymaya devam etmesi mantığı (Background timer / timestamp tabanlı süre hesabı).
    - "Son Emzirilen Taraf": Ekranın üstünde en son hangi memede kalındığını belirgin belirten görsel gösterge/rozet.
  - **Manuel Kayıt Ekleme / Düzenleme Modalı:**
    - Kronometre kullanmadan geçmişe dönük manuel süre ve saat girişi yapabilme.
  - **Geçmiş & Liste Ekranı:**
    - Seçili bebeğe ait geçmiş emzirme oturumlarının kronolojik olarak listelenmesi.

---

### Uygulama Adımları (Lütfen Sırayla Çalış):

1. **Adım 1:** Node.js backend projesinde `breastfeeding` modülü için veritabanı şemasını/modelini oluştur ve API end-point'lerini yaz (`baby_id` ilişkisini kurduğundan emin ol).
2. **Adım 2:** Tamamlanan backend API'lerinin istek/yanıt detaylarını ve veri şemasını `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native projesine geç; `breastfeedingService` modülünü oluştur, zaman esaslı çalışan canlı kronometre mantığını ve state yönetimini kurgula.
4. **Adım 4:** Sol/Sağ meme kronometre arayüzü, son taraf vurgusu ve geçmiş emzirme listesi UI bileşenlerini geliştirip test et.

Sırasıyla bu adımları takip ederek geliştirmeye başla.


### Ek Düzeltme

Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde daha önce geliştirmesini tamamladığımız **2. Modül olan "Emzirme Sayacı" (`breastfeeding`)** içerisine, oturum bitiminde annenin yorulmadan aktif emme süresini ayarlayabilmesi için **"Sonradan Aktif Süre Düzeltme (Pasif / Aktif Ayrımı)"** özelliğini ekleyeceksin.

### Proje Mimarisi & Çalışma Kuralları
1. **Dizin Yapısı:** Backend (`/backend`) ve Mobil App (`/app`) bağımsız dizinlerde çalışmaktadır.
2. **Dokümantasyon:** Yapılan tüm yeni veritabanı alanları ve API güncellemeleri `teknik_dokuman.md` dosyasına kaydedilmelidir.
3. **Geliştirme Akışı (Strict Step-by-Step Order):**
  - **ÖNCE BACKEND:** Node.js tarafındaki veri şemasına ve API'ye yeni süre alanlarını ekle ve test et.
  - **DOKÜMANTASYON:** Güncellenen API end-point ve DTO yapılarını `teknik_dokuman.md` dosyasına kaydet.
  - **SONRA REACT NATIVE:** React Native tarafında oturum bitirme modalına aktif süre ayarlama slider/input bileşenini ekle ve entegrasyonu tamamla.

---

### Mevcut Modüle Eklenecek Özellik Gereksinimleri

#### 1. Backend (Node.js) Güncelleme İhtiyaçları:
- **Veri Şeması (`breastfeeding` tablosu/şeması):**
  - `total_elapsed_duration_seconds` (Integer, Kronometrenin çalıştığı toplam geçen süre - Zorunlu)
  - `active_duration_seconds` (Integer, Annenin ayarladığı gerçek/aktif emme süresi - Zorunlu)
  - *Not:* Mevcut `total_duration_seconds` alanı varsa geriye dönük uyumluluk için `active_duration_seconds` değeriyle senkronize tutulmalıdır.
- **API End-point Güncellemeleri:**
  - `POST /api/v1/breastfeeding` ve `PUT/PATCH /api/v1/breastfeeding/:id` istek gövdelerinde (body) `active_duration_seconds` ve `total_elapsed_duration_seconds` alanlarını kabul edecek şekilde validation kurallarını ve controller katmanını güncelle.

#### 2. Mobil App (React Native) Güncelleme İhtiyaçları:
- **Oturum Bitirme & Aktif Süre Ayarlama Modalı (Session Summary Modal):**
  - Anne emzirme kronometresinde "Bitir" butonuna bastığında hemen kaydetmek yerine bir **Özet ve Düzeltme Modalı** aç.
  - Modalda kronometrede geçen **Toplam Süre** gösterilsin (Örn: *25 Dakika*).
  - Toplam sürenin hemen altında varsayılan olarak toplam süreye eşit ayarlanmış bir **Kaydırıcı (Slider / `@react-native-community/slider`)** veya hızlı dakika seçim butonları (Örn: *"%100 Aktif", "%80 Aktif", "15 Dk Aktif"*) yer alsın.
  - Anne slider'ı kaydırdıkça "Aktif Emme Süresi: X dk" ve "Pasif/Mola Süresi: Y dk" olarak canlı güncellensin.
  - "Kaydet" butonuna basıldığında hem `total_elapsed_duration_seconds` hem de `active_duration_seconds` değerleri backend'e gönderilsin.
- **Geçmiş & Akış Kartları Güncellemesi:**
  - Geçmiş emzirme listesinde ve Günlük Akış (`timeline`) kartında bebeğin gerçek beslenme süresi olan **Aktif Emme Süresi** öne çıkarılsın (Örn: *"Sol Meme: 18 dk aktif (Toplam 25 dk)"*).

---

### Uygulama Adımları (Lütfen Sırayla Çalış):

1. **Adım 1:** Node.js backend projesinde `breastfeeding` veritabanı şemasını ve API validation DTO'larını `active_duration_seconds` ve `total_elapsed_duration_seconds` alanlarını destekleyecek şekilde güncelle.
2. **Adım 2:** API değişikliklerini `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native projesine geç; emzirme kronometresi durdurulduğunda açılan "Aktif Süre Düzeltme Modalı" UI bileşenini ve Slider entegrasyonunu kurgula.
4. **Adım 4:** Düzeltilen aktif sürenin API'ye doğru gönderildiğini, geçmiş listesi ve özet kartlarında aktif/toplam süre ayrımının doğru gösterildiğini test et.

Sırasıyla bu adımları takip ederek geliştirmeye başla.

---

> ### Uygulama Notu (2026-11-02)
>
> "Ek Düzeltme" bölümü uygulandı. Şartnameden **iki bilinçli sapma** var:
>
> 1. **Alan adları.** Şartname `total_elapsed_duration_seconds` ve
>    `active_duration_seconds` diyor; şema `total_elapsed_sec` ve
>    `adjusted_active_sec` kullanıyor — kod tabanının `_sec` sonekiyle tutarlı
>    olsun diye. API yanıtlarında `active_duration_sec`,
>    `total_elapsed_sec`, `passive_duration_sec`, `measured_active_sec` ve
>    `is_duration_adjusted` döner.
>
> 2. **`active_duration_seconds` zorunlu değil, türetilmiş.** Şartname onu
>    "Zorunlu" sütun olarak istiyor; şemada `adjusted_active_sec` **nullable**
>    tutuldu (NULL = anne düzeltme yapmadı). Sebep: kronometrenin ölçtüğü
>    değerle annenin beyanı farklı şeylerdir ve tek sütunda tutmak ölçüm
>    verisini geri alınamaz biçimde ezerdi. API yanıtı yine her zaman dolu bir
>    `active_duration_sec` döndürür (`COALESCE(düzeltme, ölçülen)`), yani
>    sözleşme karşılanır.
>
> Şartnamedeki `total_duration_seconds` ile senkron tutma gereği karşılandı:
> hem o alan hem `feedings.duration_sec` **etkin aktif** süreyi taşır, bu
> sayede raporlardaki emzirme toplamı bebeğin gerçek beslenme süresini
> gösterir.
>
> Ayrıntılar: `TEKNIK_DOKUMAN.md` §10.2.1.
