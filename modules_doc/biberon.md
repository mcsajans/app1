Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **3. Modül olan "Biberon" (`bottle`)** geliştirmesini yapacaksın.

> **Not:** Bu dosya depoda hiç yoktu — modül numaraları 1, 2, **4**, 5… diye
> atlıyordu (bkz. `NOTLAR-ve-EKSIKLER.md` §1.2). Oysa modül kataloğunda
> `bottle` kayıtlıydı ve mobilde alt sekmesi açıktı; ekran yalnızca
> "yapılacaklar" listesi gösteren bir yer tutucuydu. Aşağıdaki şartname, o yer
> tutucunun kendi özellik listesi ile mevcut `feedings` şemasından yazıldı.

### Proje Mimarısı & Çalışma Kuralları
1. **Dizin Yapısı & Bağımsızlık:**
  - Projemiz iki ayrı dizinden oluşuyor: Backend (Node.js projesinin olduğu dizin) ve Mobil App (React Native projesinin olduğu dizin).
  - Backend ve Mobile App projeleri birbirinden bağımsız dizinlerde çalışmaktadır.
2. **Dokümantasyon:**
  - Projede yapılan tüm mimari kararlar, API end-point tanımları ve veri modelleri `TEKNIK_DOKUMAN.md` dosyasına eksiksiz şekilde yazılacak/güncellenecektir.
3. **Geliştirme Akışı (Strict Step-by-Step Order):**
  - **ÖNCE BACKEND:** veri modelleri, migration'lar, validation'lar ve API end-point'leri geliştirilmeli ve test edilmelidir.
  - **DOKÜMANTASYON:** API ve veri yapısı tamamlandığında `TEKNIK_DOKUMAN.md` güncellenmelidir.
  - **SONRA REACT NATIVE:** Backend hazır olduktan sonra servis entegrasyonu, state yönetimi ve UI bileşenleri geliştirilmelidir.

---

### Modül 3: Biberon (`bottle`) Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:

- **Veri Modeli:** Biberon **ayrı bir tablo değildir**. Emzirme, biberon ve ek
  gıda aynı `feedings` tablosunu paylaşır ve `feed_type` ile ayrılır; böylece
  raporlardaki "günde toplam kaç ml aldı" sorusu tek sorguyla yanıtlanır.
  Biberonu ilgilendiren alanlar:
  - `id` (Primary Key)
  - `baby_id` (Foreign Key -> `babies.id`, Zorunlu)
  - `feed_type` (Enum: 'bottle_breastmilk' | 'bottle_formula' — ayrıca 'water' aynı ekranda kaydedilir)
  - `started_at` (DateTime, Zorunlu), `ended_at` (DateTime, Opsiyonel)
  - `duration_sec` (Integer, Opsiyonel — kronometre kullanıldıysa)
  - `amount` (Decimal, Zorunlu)
  - `amount_unit` (Enum: 'ml' | 'cl' — sıvı beslemede yalnızca hacim birimleri)
  - `amount_ml` (Decimal, **üretilen sütun** — yalnızca hacim birimlerinde dolar)
  - `note` (String, Opsiyonel)
  - `entry_source` (Enum: 'timer' | 'manual')
  - `created_by`, `created_at`, `updated_at`, `deleted_at`

- **Doğrulama Kuralları:**
  - Miktar girildiyse birim de zorunludur.
  - Sıvı beslemede birim `ml` veya `cl` olmalıdır; porsiyon birimleri (kaşık, gram, kâse, adet) reddedilmelidir.
  - `cl → ml` dönüşümü **yalnızca sunucuda** (`amount_ml`) yapılmalıdır. İstemci de çevirirse iki doğruluk kaynağı oluşur ve biri değiştiğinde toplamlar sessizce kayar.
  - Kısmi güncellemede (`PUT`) gönderilmeyen alanlar **korunmalıdır**; doğrulama şemasında varsayılan değer kullanılmamalıdır.

- **API End-point'leri:**
  - `POST /api/v1/babies/:babyId/feedings` -> Biberon kaydı oluşturma (`feed_type` ile)
  - `GET /api/v1/babies/:babyId/feedings?type=bottle_breastmilk,bottle_formula,water` -> Geçmişi listeleme; `type` **virgülle birden fazla tip** alabilmelidir (biberon ekranı üç tipi birlikte gösterir)
  - `GET /api/v1/babies/:babyId/feedings/daily-summary?date=YYYY-MM-DD` -> Günlük özet: öğün sayısı, toplam ml, ortalama öğün miktarı, anne sütü / formül / su dağılımı, son biberon zamanı, son biberondan beri geçen süre, öğünler arası ortalama
  - `PUT /api/v1/feedings/:id` -> Kaydı düzenleme
  - `DELETE /api/v1/feedings/:id` -> Kaydı silme
  - **Güvenlik:** `type` parametresindeki her değer enum'a karşı doğrulanmalı; bilinmeyen tip sessizce atılmamalı, istek reddedilmelidir. Hazır ifadelerde `IN (?)` dizi genişletmesi çalışmadığı için yer tutucular elle üretilmelidir.

- **Özet Hesabı Notları:**
  - Su, biberon ml toplamına **dâhil edilmemeli**, ayrı gösterilmelidir.
  - Porsiyon birimli ek gıda kayıtları ml toplamına girmemelidir.
  - "Son biberondan beri geçen süre" günden bağımsız hesaplanmalıdır; yoksa sabahın erken saatinde günün ilk biberonu verilmemişken bilgi kaybolur.

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - Backend API'leri ile haberleşecek `bottleService` modülünün yazılması.
- **UI & Ekranlar:**
  - **İçerik Seçimi:** Anne sütü / Formül mama / Su geçişi.
  - **Miktar Girişi:** `ml` veya `cl` birimiyle sayısal giriş; sunucu üst sınırı (5000) istemcide de erken uygulanmalı.
  - **Hızlı Miktar Butonları:** 60 / 90 / 120 / 150 ml. Bu butonlar ml cinsindendir; `cl` seçiliyken birim de `ml`'ye alınmalıdır, yoksa "120 cl" gibi 1,2 litrelik bir kayıt oluşur.
  - **Süre (İsteğe Bağlı):** Kronometre ile başlangıç-bitiş ve süre kaydı; kullanılmazsa yalnızca an kaydedilir.
  - **Not Alanı.**
  - **Son Öğün Kartı:** Son biberondan beri geçen sürenin **canlı** akması; özet anlık değer döndüğü için ekran açık kaldıkça eskiyecektir.
  - **Günlük Özet Kartı:** Öğün sayısı, toplam ml, ortalama; ayrıca anne sütü / formül / su dağılımı.
  - **Geçmiş Listesi:** İçerik ikonu, miktar, süre, not ve kaydı giren kişi; uzun basarak silme.

---

### Uygulama Adımları (Lütfen Sırayla Çalış):

1. **Adım 1:** `feedings` şemasının biberon için yeterli olduğunu doğrula; `type` filtresini çoğul tipe genişlet ve `feedings/daily-summary` ucunu yaz.
2. **Adım 2:** Birim doğrulamalarını (hacim/porsiyon ayrımı) ve kısmi güncelleme gerilemesini test et; `cl → ml` dönüşümünün özet toplamlarına doğru yansıdığını doğrula.
3. **Adım 3:** Tamamlanan backend API'lerinin istek/yanıt detaylarını `TEKNIK_DOKUMAN.md` dosyasına kaydet.
4. **Adım 4:** React Native projesine geç; `bottleService` modülünü oluştur, içerik/miktar/hızlı buton formunu ve isteğe bağlı kronometreyi kurgula.
5. **Adım 5:** Son öğün kartı, günlük özet ve geçmiş listesi UI bileşenlerini geliştirip test et.
