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

---

## Ek Geliştirme — Elle Zaman Girişi ve "Geçmişten Başlat" (Analiz, 2026-11-21)

### 1. Problem

Emzirme seansı yalnızca **kronometreyle** oluşturulabiliyordu:
`start → switch/pause/resume → stop`. Anne sayacı başlatmayı unuttuysa
(gece beslemelerinde neredeyse kural), "14:10'da başladı, 14:35'te bitti,
çoğunlukla sol" bilgisini uygulamaya girmenin **hiçbir yolu yoktu**.

Bu da şartnamede baştan vardı: bu dosyadaki "Mobil App İhtiyaçları" başlığı
**"Manuel Kayıt Ekleme / Düzenleme Modalı: Kronometre kullanmadan geçmişe
dönük manuel süre ve saat girişi yapabilme"** diyor ve backend bölümü
`POST /api/v1/breastfeeding` ucunu *"Elle manuel giriş veya kronometre
bitişi ile"* diye tanımlıyor. Uygulanan sürümde o uç **yalnızca durum
makinesi** olarak gerçeklendi; elle giriş yolu hiç açılmadı.

### 2. Mevcut durumun tespiti

| Katman | Durum |
|--------|-------|
| `POST /babies/{id}/breastfeeding/start` | `at` alanı **opsiyonel** → geçmişten başlatma sunucuda zaten mümkündü, istemci hep `now` gönderiyordu |
| Elle (başlangıç+bitiş) kayıt ucu | **YOK** |
| `breastfeedingService` | `createManual` benzeri bir şey yok |
| `BreastfeedingScreen` | Yalnızca Sol/Sağ başlat düğmeleri |

Elle kayıt ucu yazılırken dikkat edilmesi gereken yapısal bir ayrıntı var ve
gözden kaçması kolay:

> **Süreler saklanmaz, `breastfeeding_segments` satırlarından `SUM()` ile
> türetilir** (§22.1). Yani elle girilen bir seansta yalnızca
> `breastfeeding_sessions.left_active_sec` / `right_active_sec` doldurmak
> **yetmez**: geçmiş listesi ve `/last` ucu segmentleri topladığı için kayıt
> listede "Sol 00:00 · Sağ 00:00" görünürdü.

Elle kayıt bu yüzden **gerçek zaman damgalı segmentler** üretir — tıpkı
kronometrenin ürettiği gibi. Böylece kayıt detayı, raporlar ve "son emzirilen
taraf" rozeti elle girilen kayıtta da doğru çalışır.

### 3. Tasarım kararları

**(a) Yeni uç: `POST /babies/{id}/breastfeeding/manual`.** Mevcut `/start`
ucuna "bitişi de kabul et" eklemek, durum makinesinin girişini iki anlamlı
hâle getirirdi (hem seans açar hem kapatır). Ayrı uç, durum makinesini
dokunulmadan bırakır.

**(b) Taraf dağılımı: "Sol / Sağ / İkisi de" + oran.** Anne dakika hesabı
yapmak zorunda bırakılmaz. "İkisi de" seçilirse pencere, kaydırıcıyla
sol/sağ arasında paylaştırılır (varsayılan %50). Üretilen segmentler:

```
[başlangıç ────── sol ──────][────── sağ ──────> bitiş]
```

İki segment ardışıktır, aralarında boşluk bırakılmaz: boşluk "pasif süre"
anlamına gelir ve elle girişte böyle bir bilgi yoktur.

**(c) Aktif/pasif düzeltmesi elle girişte sorulmaz.** Pencerenin tamamı aktif
emme kabul edilir (`adjusted_active_sec = NULL`, yani "düzeltme yapılmadı").
Anne isterse kayıt detayındaki **mevcut** "Aktif süreyi düzelt" aksiyonunu
kullanır (§10.2.1). Aynı soruyu giriş sırasında da sormak, zaten uzun olan
formu uzatır ve var olan özelliği kopyalardı.

**(d) `entry_source='manual'`.** Kronometreden gelen kayıt `timer`, elle
girilen `manual` kalır; ikisi kayıt detayında ayırt edilebilir olmalı —
"kronometre ne ölçtü" ayrımının anlamı buna bağlı.

**(e) Çakışma denetimi.** Aynı aralıkta ikinci bir emzirme kaydı fiziksel
olarak imkânsızdır; 409 ile reddedilir. Devam eden (`running`/`paused`) bir
seans varsa ve elle girilen pencere onunla kesişiyorsa yine 409.

**(f) Sınırlar.** Tek seans en fazla **6 saat** (uykudaki 24 saatten farklı:
6 saati aşan tek bir emzirme seansı veri girişi hatasıdır), en fazla
**30 gün** geriye, gelecek için **2 dakika** tolerans. Ortak kurallar
`src/lib/manualEntry.ts` içinde tek yerde durur.

**(g) Geçmişten başlatma `at` ile yapılır.** `/start` ucu zaten kabul
ediyordu; eklenen tek şey doğrulama: gelecekte olamaz, 30 günden eski
olamaz ve **son seansın bitişinden önce olamaz** — aksi hâlde canlı akan
sayaç, kapanmış bir kaydın üstüne biner.

### 4. Yapılan değişiklikler

**Sunucu**

- `src/lib/manualEntry.ts` *(yeni)* — ortak pencere doğrulaması, çakışma
  bulma ve **segment planlama** (`planBreastSegments`): verilen pencere ve
  taraf dağılımından zaman damgalı segment listesi üretir. Saf fonksiyon,
  `src/lib/manualEntry.test.ts` ile test edilir.
- `POST /babies/{id}/breastfeeding/manual` *(yeni uç)* — tek transaction'da
  `feedings` + `breastfeeding_sessions` + segmentler yazar, denetim izine
  düşer.
- `POST /babies/{id}/breastfeeding/start` — `at` için pencere doğrulaması.

**Mobil**

- `breastfeedingService.start(babyId, side, at?)` ve
  `breastfeedingService.createManual(...)`.
- `src/modules/breastfeeding/ManualSessionSheet.tsx` *(yeni)* — iki modlu
  giriş sayfası (elle kayıt / geçmişten başlat). **Not:** "geçmişten başlat"
  modu bir sonraki bölümde kaldırıldı, işi başlangıç paneli devraldı.
- `src/modules/breastfeeding/BreastfeedingScreen.tsx` — boştaki kartta iki
  yeni düğme (aynı bölümde yeniden düzenlendi).

Ayrıntılar: `TEKNIK_DOKUMAN.md` §10.6 ve §22.1.

---

## Ek Geliştirme — Sayaç Akışının Yeniden Tasarımı (2026-11-21)

### 1. Problem

Önceki sürümde modüle girildiğinde boş kartta **dört düğme** duruyordu: Sol,
Sağ, "Geçmişten başlat", "Elle kayıt ekle". Üç sorun:

1. En sık yapılan iş (sayacı başlatmak) diğer üçüyle aynı görsel ağırlıktaydı.
2. Emzirmeye başlanırken bebek kucakta ve tek el boşta: dört küçük hedef,
   iki büyük hedeften zor.
3. "Geçmişten başlat" ayrı bir alt sayfa açıyordu ve orada taraf **ikinci kez**
   soruluyordu — oysa kullanıcı tarafı zaten seçmişti.

Sayaç akarken de iki ayrı "Sola geç / Sağa geç" düğmesi vardı; biri her zaman
devre dışıydı, yani ekranın yarısı hiçbir şey yapmayan bir düğmeye gidiyordu.

### 2. Yeni akış

```
[Sol]  [Sağ]          ← modüle girince yalnızca iki meme kutusu
   ↓ (taraf seçilir)
00:00                 ← sayaç hazır, henüz çalışmıyor
☐ Sayacı önceki bir zamandan başlat
  └ işaretlenirse: yalnızca SAAT alanı (varsayılan şu an)
[ Notunuz varsa buraya yazınız ]
[ Başla — Sol meme ] / [ Seçilen saatten başlat ]
   ↓
02:40  Sol meme sürüyor
[ Sağa geç ]                     ← yalnızca KARŞI taraf
[Duraklat] [Emzirmeyi bitir] [Elle kayıt]
```

### 3. Tasarım kararları

**(a) Başlatma iki adım.** Taraf seçilince sayaç hemen başlamaz; aradaki
"hazırlık" adımı olmadan not ve geçmiş saat girilemezdi (sayaç akarken
yazılan not, akmaya başlamış bir ölçümü düzeltmez).

**(b) Geçmişten başlatmada yalnızca saat sorulur.** Tarih alanı her seferinde
boşuna bir dokunuştu: geri gidilen süre zaten en fazla 6 saat. Girilen saat
şu andan ileride kalıyorsa **dün** sayılır — gece 00:10'da "23:50" yazmak
beklenen bir durumdur, 23:50'yi bugüne yazmak ise imkânsız bir gelecek
üretirdi. Kural saf bir fonksiyonda: `momentFromClock()`
(`src/core/records/manualWindow.ts`), testleri
`scripts/tests/manual-window.test.mjs` içinde.

**(c) 6 saat sınırı istemcide de söylenir.** Sunucu aynı tavanı zaten
uyguluyor ama dönen hata "aralığı aşıyor" diyor; saat alanının yanında
"Sayaç en fazla 6 saat öncesinden başlatılabilir" demek düzeltmeyi tek
dokunuşa indiriyor. Son söz yine sunucunun.

**(d) Not başlangıçta yazılır, bitişte değil.** Bitiş ekranı anneye aktif
süre düzeltmesini soruyor (§10.2.1); oraya bir de not alanı koymak, emzirme
biterken — çoğu zaman uyuyan bebekle — doldurulacak formu uzatırdı. Bu
yüzden `POST /breastfeeding/start` artık `note` kabul ediyor.

**(e) Taraf değiştirme tek düğme.** Açık olan tarafa "geç" demek anlamsız;
emzirilen taraf zaten başlıkta yazıyor.

**(f) Geçmiş satırı: üstte saat aralığı, altta dakika.** "Ne zaman
emzirdim" en sık sorulan soru ve cevabı artık `08:14 – 08:17`. Süre hesabı
alt satıra indi ve birimi açıkça yazılıyor: `Sol 03:07 dk · Sağ 00:00 dk`.
Bitmemiş seansta bitiş saati yoktur; üst satır `08:14'ten beri` olur.

**(g) Elle kayıt sayfası tek modlu kaldı.** "Geçmişten başlat" modunun işini
başlangıç panelindeki kutucuk yapıyor; iki yol bırakmak aynı şeyi iki farklı
yerden sormak olurdu.

### 4. Yapılan değişiklikler

**Sunucu**

- `POST /babies/{id}/breastfeeding/start` — isteğe bağlı `note` (≤500) artık
  `feedings.note` sütununa yazılır.

**Mobil**

- `src/modules/breastfeeding/StartPanel.tsx` *(yeni)* — iki kutulu taraf
  seçimi + hazırlık adımı.
- `src/components/ui.tsx` — paylaşılan `CheckRow` (sıradan onay kutusu;
  `ConsentChecks` hukuki metinler için ayrı kalır).
- `src/core/records/manualWindow.ts` — `momentFromClock()`.
- `src/modules/breastfeeding/ManualSessionSheet.tsx` — `backdate` modu
  kaldırıldı; sıfırlama efekti yerine her açılışta `key` ile yeniden bağlama
  (React derleyicisi efekt içinde setState'i uyarıyor).
- `src/modules/breastfeeding/BreastfeedingScreen.tsx` — yeni akış, tek
  "geç" düğmesi, geçmiş satırının yeni biçimi.

---

## Ek Geliştirme — Giriş Biçimi Sekmesi (2026-11-21)

### 1. Problem

Taraf seçildikten sonraki ekranda iki ayrı iş iç içe duruyordu:

1. **Anlık** — emzirme şu an sürüyor, sayaç akacak (istenirse birkaç dakika
   geriden).
2. **Geri tarihli** — emzirme çoktan bitti, yalnızca kaydı yazılacak.

İkincisi için ayrı bir alt sayfa ("Elle kayıt ekle") vardı ve orada taraf
**ikinci kez** soruluyordu. Üstelik ikisi de "geçmiş bir saat" istiyordu;
hangisinin açık seans, hangisinin bitmiş kayıt ürettiği ancak düğme
yazısından anlaşılıyordu.

### 2. Yeni düzen

```
[Sol]  [Sağ]
   ↓
Sol meme
┌───────────────┬───────────────┐
│ ⏱ Anlık       │ 📅 Geri tarihli│   ← sekme çubuğu
└───────────────┴───────────────┘
 Anlık                     Geri tarihli
 00:00                     Emzirmeye başlama saati [tarih][saat]
 ☐ önceki zamandan başlat  Emzirmeyi bitirme saati [tarih][saat]
 [ not ]                   Toplam süre: 30 dk
 [ Başla — Sol meme ]      [ not ]
                           [ Bilgileri kaydet ]
                           [ İki memeyi de emzirdim ]
```

### 3. Tasarım kararları

**(a) Sekme, kutucuk değil.** İki yol aynı kaydı üretmiyor: biri sunucuda
**açık seans** açıyor (durum makinesi işliyor, bildirim çıkıyor), diğeri
doğrudan **tamamlanmış** kayıt yazıyor. Aynı formun iki hâli oldukları için
`Chips` değil segment denetimi: `IconTabs` (`src/components/ui.tsx`).
Etiketler ikonla birlikte yazılıyor — kronometre ile takvim-saat simgeleri
18 px'te birbirine benziyor.

**(b) Not iki sekmede ortak.** Sekme değiştirince yazılan not silinmiyor;
aynı kaydın notu, yalnızca kaydın nasıl girildiği değişiyor.

**(c) Varsayılan saatler sekme açılırken hesaplanıyor.** Panel boştaki
kartın içinde saatlerce açık kalabiliyor; `useState` başlatıcısında
hesaplanan "yarım saat önce" o sırada çoktan eskimiş olurdu. Olay
işleyicisinde `Date.now()` okumak React derleyicisinin saflık kuralına da
takılmıyor.

**(d) Taraf seçimi ekranında artık elle kayıt düğmesi yok.** İşi "Geri
tarihli" sekmesi yapıyor ve oraya gitmek için zaten taraf seçmek gerekiyor —
form onu sormuyor, kullanıcı bir kez söylüyor.

**(e) "İkisi de" ayrı sayfada kaldı.** Süre paylaştırma kaydırıcısı iki
sekmeli ekranı üçüncü bir hâle sokardı. Sekmenin altındaki "İki memeyi de
emzirdim" düğmesi o sayfayı **"İkisi de" seçili** açıyor (`initialBoth`);
kullanıcının az önce söylediğini bir daha seçmesi gerekmiyor.

**(f) Ekran sadeleşti.** Kartın üstündeki "Son: Sol / Sırada: Sağ" rozet
kartı kaldırıldı: sıradaki taraf kutunun kendi rozetinde, son emzirmenin
saati ve süresi ise hemen altındaki geçmiş listesinin ilk satırında zaten
yazıyordu — aynı bilgi üç yerde duruyordu. Taraf kutuları da küçüldü (ikon
40 → 24 px, dolu pembe zemin yerine ince vurgu çerçevesi); iki kutu kartın
yarısını kaplıyor ve ekranın asıl işi olan sayaçtan fazla yer tutuyordu.

**(g) Kayıttan sonra panel sıfırlanır.** Başarılı kayıtta panel `key` ile
yeniden bağlanıp taraf seçimine döner. Dolu formu ekranda bırakmak
"kaydedildi mi?" sorusunu doğuruyordu.

### 4. Yapılan değişiklikler

Yalnızca mobil; sunucu sözleşmesi değişmedi (`POST …/breastfeeding/manual`
zaten vardı).

- `src/components/ui.tsx` — `IconTabs` (paylaşılan segment sekmesi).
- `src/components/Icon.tsx` — `timer`, `backdate` ikonları.
- `src/modules/breastfeeding/StartPanel.tsx` — sekmeler, geri tarihli form,
  `onManualSave`.
- `src/modules/breastfeeding/ManualSessionSheet.tsx` — `initialBoth`.
- `src/modules/breastfeeding/BreastfeedingScreen.tsx` — `submitManual` tek
  noktada, panel `key` ile sıfırlanıyor, üstteki rozet kartı kaldırıldı.
- `src/modules/breastfeeding/StartPanel.tsx` — sade taraf kutuları.

---

## Ek Geliştirme — "Bitir" ve başlangıç reklamı (2026-11-21)

- **Düğme adı kısaldı:** "Emzirmeyi bitir" → **"Bitir"**. Düğme üç düğmelik
  bir satırda duruyor ve uzun etiket iki satıra taşıyordu; hangi işin
  bitirildiği zaten kartın başlığında yazıyor ("Sol meme sürüyor").
- **Sayaç başlatıldıktan 2 saniye sonra tam ekran reklam** gösteriliyor.
  Kod tarafı zaten hazırdı (`showAdAfterAction('timer_start')`); açılan şey
  panel ayarı oldu: `trigger_timer_start` **açık**, `action_delay_ms`
  **2000 ms**. Reklam `await` edilmiyor ve hiç `throw` etmiyor — sayaç her
  hâlükârda başlıyor.
- **Taraf değiştirme artık reklam tetiklemiyor.** `onSwitch` içindeki
  `showAdAfterAction` çağrısı kaldırıldı: emzirmenin ortasında açılan tam
  ekran reklam hem ölçülen süreyi gölgeler hem de anneyi uygulamadan atar.
  Ayrıntı: `TEKNIK_DOKUMAN.md` §23.4.

---

## Reklam davranışı (2026-11-21)

| Eylem | Tetik | Not |
|-------|-------|-----|
| Sayaç başlatma ("Başla — Sol/Sağ meme") | `timer_start` | **2 sn** sonra tam ekran reklam |
| Taraf değiştirme ("Sola/Sağa geç") | — | **Reklam yok**: emzirmenin ortasında açılan reklam hem ölçülen süreyi gölgeler hem anneyi uygulamadan atar |
| "Bitir" → özet → Kaydet | `save` | `withSaveFeedback` |
| Elle emzirme kaydı | `save` | alt sayfadan |

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
