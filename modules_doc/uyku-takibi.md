Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **5. Modül olan "Uyku Takibi" (`sleep`)** geliştirmesini yapacaksın.

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

### Modül 5: Uyku Takibi (`sleep`) Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:
- **Veri Modeli (Schema/Entity):**
  - `id` (UUID/Primary Key)
  - `baby_id` (UUID, Foreign Key -> `babies.id`, Zorunlu)
  - `type` (Enum: 'night_sleep', 'nap', Uyku Tipi: Gece Uykusu / Şekerleme - Zorunlu)
  - `start_time` (DateTime/ISOString, Uykuya Geçiş Zamanı - Zorunlu)
  - `end_time` (DateTime/ISOString, Uyanma Zamanı - Manuel kayıtta veya sayaç bitiminde zorunlu)
  - `duration_minutes` (Integer, Toplam Uyku Süresi - dakika cinsinden)
  - `quality` (Enum: 'peaceful', 'restless', 'frequent_waking', Opsiyonel Uyku Kalitesi)
  - `wake_reason` (String, Opsiyonel Uyanma Sebebi - örn: "Açlık", "Gaz", "Isı/Alt Islaklığı")
  - `notes` (Text, Opsiyonel ebeveyn notu)
  - `created_at`, `updated_at`

- **API End-point'leri:**
  - `POST /api/v1/sleep` -> Yeni uyku kaydı oluşturma (Sayaç bitimi veya manuel giriş)
  - `GET /api/v1/sleep?baby_id=:babyId` -> Seçili bebeğe ait uyku geçmişini filtreli/sayfalamalı listeleme
  - `GET /api/v1/sleep/daily-summary?baby_id=:babyId&date=YYYY-MM-DD` -> Bebeğin seçilen gündeki toplam gece/gündüz uyku sürelerini ve uyanıklık penceresini getirme
  - `PUT/PATCH /api/v1/sleep/:id` -> Uyku kaydını düzenleme
  - `DELETE /api/v1/sleep/:id` -> Uyku kaydını silme

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - Backend API'leri ile haberleşecek `sleepService` modülünün yazılması.
- **UI & Ekranlar:**
  - **Canlı Uyku Sayacı / Kronometresi:**
    - "Uykuya Daldı" ve "Uyandı" butonları ile çalışan canlı sayaç.
    - Gece Uykusu / Şekerleme (Nap) seçim geçişi.
    - Arka planda zaman takibini doğru yapmak için timestamp tabanlı süre hesabı.
  - **Uyanıklık Penceresi (Wake Window) Widget'ı:**
    - Bebeğin en son uyandığı saatten itibaren geçen uyanıklık süresini gösteren dinamik gösterge.
  - **Manuel Kayıt Ekleme / Düzenleme Modalı:**
    - Uyku başlangıç ve bitiş saatlerinin zaman seçici (TimePicker) ile geçmişe dönük ayarlanabilmesi.
  - **Geçmiş & Liste Ekranı:**
    - Gece ve gündüz uykularının farklı renk/ikon gruplarıyla kronolojik listelenmesi.

---

### Uygulama Adımları (Lütfen Sırayla Çalış):

1. **Adım 1:** Node.js backend projesinde `sleep` modülü için veritabanı şemasını/modelini oluştur ve API end-point'lerini yaz (`baby_id` ilişkisini kurduğundan emin ol).
2. **Adım 2:** Tamamlanan backend API'lerinin istek/yanıt detaylarını ve veri şemasını `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native projesine geç; `sleepService` modülünü oluştur, canlı uyku kronometresini ve uyanıklık penceresi (wake window) hesaplama mantığını kurgula.
4. **Adım 4:** Uyku kronometresi, uyanıklık penceresi kartı ve geçmiş listesi UI bileşenlerini geliştirip test et.

Sırasıyla bu adımları takip ederek geliştirmeye başla.
---

## Ek Geliştirme — Elle Zaman Girişi ve "Geçmişten Başlat" (Analiz, 2026-11-21)

### 1. Problem

Uyku modülünde kayıt oluşturmanın **tek yolu kronometreydi**: ekran yalnızca
`sleep/start` ve `sleep/{id}/stop` çağırıyordu. Ebeveyn sayacı başlatmayı
unuttuysa — ki en sık olan bu — bebeğin 13:20–15:05 arası uyuduğunu bilmesine
rağmen bu bilgiyi uygulamaya **hiçbir şekilde** giremiyordu. Günlük özet,
uyanıklık penceresi ve raporlar o uykuyu hiç görmüyordu.

Bu durum şartnamede baştan vardı ama uygulanmamıştı:

- Bu dosya, "Mobil App İhtiyaçları" başlığı altında **"Manuel Kayıt Ekleme /
  Düzenleme Modalı: Uyku başlangıç ve bitiş saatlerinin zaman seçici ile
  geçmişe dönük ayarlanabilmesi"** diyor.
- `TEKNIK_DOKUMAN.md` §11 aynı şeyi söylüyor: *"Manuel mod: başlangıç/bitiş
  saati seçici; gece yarısını aşan kayıtlarda tarih otomatik +1 gün"* ve
  *"`sleep_type` otomatik önerisi: başlangıç saati 19:00–05:00 arası →
  `night`"*.

### 2. Mevcut durumun tespiti (ne vardı, ne yoktu)

| Katman | Durum |
|--------|-------|
| `POST /babies/{id}/sleep` (elle kayıt) | **Vardı** — `started_at` + `ended_at` + `entry_source='manual'` kabul ediyor |
| `POST /babies/{id}/sleep/start` | **Vardı** ve `started_at` alanı zaten **opsiyonel** — yani geçmişten başlatma sunucuda çoktan mümkündü |
| `sleepService.create()` (mobil) | **Vardı** ama **hiçbir ekran çağırmıyordu** (ölü kod) |
| `SleepScreen` | Elle giriş ya da geçmişten başlatma için **hiç arayüz yok** |
| Doğrulama | **Yetersiz** (aşağıda) |

Yani eksik öncelikle **arayüzdü**; ama arayüzü açmadan önce sunucu tarafında
üç ciddi boşluk kapanmalıydı — elle girilen zaman, kronometrenin ürettiği
zamandan çok daha "yaratıcı" olabiliyor:

1. **Gelecek zaman serbestti.** `started_at: 2027-01-01` kabul ediliyordu.
   Kronometrede bu imkânsızdı (zaman hep `Date.now()`), elle girişte bir
   tarih seçici kazası yeterli. Sonuç: uyanıklık penceresi ve günlük özet
   kalıcı olarak bozulur.
2. **Çakışma denetimi yoktu.** Aynı saat aralığı iki kez girilebiliyordu;
   günlük toplam sessizce şişiyordu (24 saati aşan "toplam uyku" mümkün).
3. **İkinci bir `running` kayıt açılabiliyordu.** `POST /sleep` gövdesinde
   `ended_at` yoksa kayıt `status='running'` olarak açılıyor ve **`/sleep/start`
   ucundaki "zaten çalışan kayıt var" kontrolünü atlıyordu.** Ekran ise
   `records.find(r => r.status === 'running')` ile tek bir çalışan kayıt
   varsayıyor: ikinci kayıt görünmez olur, kilit ekranı sayacı yanlış kaydı
   gösterir, "Uyandı" yanlış kaydı kapatır.

Ek olarak, elle girişin doğal devamı olan **düzenlemede** bir tutarsızlık
vardı: `PUT /sleep/{id}` ile `ended_at` değiştirildiğinde `duration_sec`
**yeniden hesaplanmıyordu**. Kayıt 2 saat görünürken süresi eski değerde
kalıyordu (§22.0.1'de kayıt *oluşturma* için düzeltilen hatanın aynısı,
*güncelleme* yolunda duruyordu).

### 3. Tasarım kararları

**(a) İki ayrı eylem, tek sayfa.** "Elle kayıt" ve "geçmişten başlat" aynı alt
sayfada iki mod olarak sunulur:

| Mod | Girilen | Sonuç |
|-----|---------|-------|
| Elle kayıt | başlangıç **ve** bitiş | `status='completed'`, `entry_source='manual'` |
| Geçmişten başlat | yalnızca başlangıç | `status='running'`, sayaç o andan itibaren canlı akar |

İkisini tek sayfada tutmanın sebebi: ebeveyn açısından ikisi de "saati elle
yazıyorum" eylemidir; fark yalnızca bitişi bilip bilmemesidir. Ayrı iki sayfa
aynı tarih seçicileri iki kez çizerdi.

**(b) Sunucu, `/sleep/start`'ın mevcut `started_at` alanını kullanır — yeni uç
açılmaz.** Geçmişten başlatma için ayrı bir uç (`/sleep/start-backdated`)
eklemek, aynı durum makinesinin ikinci bir kopyasını doğururdu. Tek fark
gönderilen zaman damgasıdır.

**(c) Çakışma 409, geçersiz zaman 422.** Ayrım bilinçli: 422 "gönderdiğin
değer tek başına hatalı" (gelecek tarih, bitiş < başlangıç), 409 "değer
kendi başına geçerli ama mevcut veriyle çelişiyor" (aynı aralıkta uyku var).
İstemci ikincisini kullanıcıya "o saatlerde zaten bir uyku kaydı var" diye
çevirebiliyor.

**(d) Sınırlar.** Tek kayıt en fazla **24 saat**, en fazla **30 gün** geriye.
24 saat uyku fiziksel sınırdır; 30 gün ise yıl/ay yazım hatalarını (2025,
01.12 yerine 12.01) yakalar, gerçek kullanımı kısıtlamaz. Gelecek için
**2 dakika** tolerans bırakılır: telefon saati ile sunucu saati arasındaki
kayma yüzünden "şimdi" seçen kullanıcıya hata göstermemek için.

**(e) `sleep_type` otomatik önerilir, zorlanmaz.** Başlangıç saati 19:00–05:00
arasındaysa tip `night`'a çekilir (§11'deki kural). Kullanıcı tipi elle
değiştirdiyse öneri bir daha devreye girmez — yoksa seçimi geri alınıyormuş
gibi görünürdü.

**(f) Gece yarısını aşan kayıt.** §11 "tarih otomatik +1 gün" diyor. Bunun
yerine **bitiş için ayrı bir tarih alanı** sunuldu ve bitiş başlangıçtan
önceyse hata verilir. Otomatik +1 gün sessiz bir varsayımdır: 23:00'te
başlayıp 07:00'de biten kayıtta doğru, 23:00'te başlayıp yanlışlıkla 22:00
yazılan kayıtta ise sessizce 23 saatlik bir uyku üretirdi. Tarih görünür
durur, yanlışlık görünür olur.

### 4. Yapılan değişiklikler

**Sunucu**

- `src/lib/manualEntry.ts` *(yeni)* — saf doğrulama katmanı: zaman penceresi
  kuralları (`assertManualWindow`), çakışma bulma (`findOverlap`), emzirme
  segment planı. Saf olması test edilebilmesi içindir
  (`src/lib/manualEntry.test.ts`, vitest).
- `POST /babies/{id}/sleep` — pencere doğrulaması, çakışma denetimi (409),
  "zaten çalışan uyku var" denetimi (409).
- `POST /babies/{id}/sleep/start` — `started_at` geçmişse: pencere
  doğrulaması + son kaydın bitişinden sonra olma şartı.
- `PUT /sleep/{id}` ve `PUT /feedings/{id}` — zaman alanları değiştiğinde
  `duration_sec` ve `status` yeniden türetilir.

**Mobil**

- `src/core/records/manualWindow.ts` *(yeni)* — istemci tarafı aynı kurallar
  (anında geri bildirim; sunucu yine de son söz sahibi) + uyku tipi önerisi.
- `src/components/BottomSheet.tsx` *(yeni)* — alt sayfa iskeleti.
- `src/components/DateTimeField.tsx` — `MomentField` (tarih + saat tek satır).
- `src/modules/sleep/ManualSleepSheet.tsx` *(yeni)* — iki modlu giriş sayfası.
  **Not:** `backdate` modu bir sonraki bölümde kaldırıldı.
- `src/modules/sleep/SleepScreen.tsx` — "Geçmişten başlat" ve "Elle kayıt
  ekle" düğmeleri (aynı bölümde yeniden düzenlendi).

Ayrıntılar: `TEKNIK_DOKUMAN.md` §11.1 ve §22.3.

---

## Ek Geliştirme — Giriş Biçimi Sekmesi (2026-11-21)

Emzirme modülünde kurulan düzenin (bkz. `emzirme-sayaci.md` → "Giriş Biçimi
Sekmesi") uykuya uyarlanması.

### 1. Problem

Boştaki kartta üç düğme vardı: "Uykuya daldı", "Geçmişten başlat", "Elle
kayıt ekle". Son ikisi aynı alt sayfanın iki moduydu ve ikisi de ebeveyne
"saati elle gir" diyordu. Aradaki asıl fark — biri **açık** kayıt açıp sayacı
akıtıyor, diğeri **bitmiş** kayıt yazıyor — yalnızca düğme yazısından
anlaşılıyordu. Üstelik en sık yapılan iş (sayacı başlatmak) üç düğmeden
biriydi.

### 2. Yeni düzen

```
Uyku tipi  [Şekerleme] [Gece uykusu]      ← iki biçimde de ortak, sekmenin üstünde
┌───────────────┬────────────────┐
│ ⏱ Anlık       │ 📅 Geri tarihli │
└───────────────┴────────────────┘
 Anlık                      Geri tarihli
 00:00                      Uykuya daldı [tarih][saat]
 ☐ önceki zamandan başlat   Uyandı       [tarih][saat]
   └ yalnızca SAAT          Süre: 1 sa
 [ not ]                    Uyku kalitesi [Rahat][Huzursuz][Sık uyandı]
 [ Uykuya daldı ]           [ not ]
                            [ Bilgileri kaydet ]
```

### 3. Tasarım kararları

**(a) Uyku tipi sekmelerin üstünde.** İki biçimde de sorulan tek alan o;
sekmenin içine koymak aynı soruyu iki kez çizmek olurdu. Tip önerisi
(19:00–05:00 → gece) korundu ve "geri tarihli" sekmesinde başlangıç saati
değiştikçe güncelleniyor — kullanıcı tipe elle dokunduysa bir daha değil.

**(b) Saat-yalnız geri alma uykuda daha da yerinde.** En sık senaryo sabah
07:00'de "22:00'de daldı" demek; `momentFromClock()` ileri kalan saati düne
yazıyor, yani tarih sormaya hiç gerek kalmıyor. Tavan uykuda 24 saat
(`MAX_SLEEP_SPAN_SEC`), emzirmedeki 6 saat değil.

**(c) Kalite yalnızca "geri tarihli" sekmesinde.** Anlık sayaçta uyku daha
bitmedi; kaliteyi o anda sormak cevabı olmayan bir soru. Sayaç bitişinde
`stop` ucu zaten kaliteyi alabiliyor.

**(d) Not sayaç başlarken yazılabiliyor.** Bunun için
`POST /babies/{id}/sleep/start` ucuna isteğe bağlı `note` eklendi
(`sleep_records.note`). Uyanma anında doldurulacak bir form alanı daha
olmasın diye — emzirmede de aynı karar verildi.

**(e) Alt sayfa yalnızca sayaç akarken.** Sayaç boştayken aynı işi "Geri
tarihli" sekmesi yapıyor; iki yol bırakmak aynı şeyi iki yerden sormak
olurdu. Sayaç akarken panel görünmediği için oradaki "Elle kayıt ekle"
düğmesi duruyor.

**(f) Kayıttan sonra panel sıfırlanır.** Başarılı kayıtta panel `key` ile
yeniden bağlanıp "Anlık" sekmesine döner; sıfırlama efekti (setState-in-effect)
yerine `key` deseni kullanıldı.

### 4. Yapılan değişiklikler

**Sunucu**

- `POST /babies/{id}/sleep/start` — isteğe bağlı `note` (≤500).

**Mobil**

- `src/modules/sleep/SleepStartPanel.tsx` *(yeni)* — tip + sekmeler + iki form.
- `src/modules/sleep/ManualSleepSheet.tsx` — `backdate` modu kaldırıldı,
  sıfırlama efekti yerine `key` ile yeniden bağlama.
- `src/modules/sleep/SleepScreen.tsx` — panel bağlandı, `submitManual` tek
  noktada.
- `src/core/api/modules.ts` — `sleepService.start(..., note?)`.

Paylaşılan parçalar emzirme bölümünde eklenmişti: `IconTabs`, `CheckRow`
(`src/components/ui.tsx`), `momentFromClock()`
(`src/core/records/manualWindow.ts`), `timer` / `backdate` ikonları.

---

## Ek Geliştirme — Modülün kendi reklam davranışı (2026-11-21)

Uyku ekranından açılan **bütün** geçiş reklamları iki noktada panelin
genel davranışından ayrılıyor (`SLEEP_AD = { delayMs: 3000, muted: true }`):

| | Panel geneli | Uyku modülü |
|---|---|---|
| Gecikme | 2000 ms (`action_delay_ms`) | **3000 ms** |
| Ses | açık | **kapalı** |

Üç yerde geçerli: **"Uykuya daldı"** (`timer_start`), **elle uyku kaydı** ve
**"Uyandı"** (ikisi de `save`).

**Neden sessiz?** Bebeği uyutmaya çalışırken açılan sesli bir reklam modülün
bütün amacını bozar. Ninni çalarken reklam zaten hiç gösterilmiyor
(`adService` kapısı), ama ninni kapalıyken de uyku ortamı sessiz olmalı.
Ses genel bir SDK ayarı olduğu için (`MobileAds().setAppMuted`) yalnızca o
gösterim boyunca kapatılıyor; reklam kapanınca `adService` geri açıyor —
yoksa bir sonraki modülün reklamı da sessiz kalırdı.

**Neden 3 saniye?** "Uykuya daldı"ya basan ebeveyn genelde telefonu bırakıp
bebeği yatırıyor; bir saniye fazla bekleme, reklamın tam elin telefondan
ayrıldığı anda açılma olasılığını azaltıyor.

Mekanizma: `showAdAfterAction(trigger, { delayMs, muted })` ve
`withSaveFeedback(fn, message, trigger, adOptions)`. Ayrıntı ve sınırlar:
`TEKNIK_DOKUMAN.md` §23.4.

---

## Reklam davranışı (2026-11-21)

Bu modülün **kendi ayarı** var; ayrıntısı yukarıdaki "Modülün kendi reklam
davranışı" bölümünde:

| Eylem | Tetik | Gecikme | Ses |
|-------|-------|---------|-----|
| "Uykuya daldı" | `timer_start` | 3 sn | **kapalı** |
| Elle uyku kaydı | `save` | 3 sn | **kapalı** |
| "Uyandı" | `save` | 3 sn | **kapalı** |

Sessizlik yalnızca o gösterime ait: reklam kapanınca `adService` sesi geri
açıyor.

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
