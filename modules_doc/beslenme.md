Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizdeki **Emzirme Sayacı (`breastfeeding`)**, **Biberon (`bottle`)**, **Ek Gıda (`solid`)** ve **Süt Sağma (`pumping`)** modüllerini tek bir **Beslenme (`feeding`)** çatısı altında birleştireceksin; ayrıca ortak (çoklu ebeveyn) sayaç yönetimini ve Raporlar ekranındaki Eğilim grafiğinin tarih filtrelemesini kurgulayacaksın.

> **Not — bu şartname mevcut kod tabanına göre gözden geçirildi (2026-11-02).**
> Dört modülün tamamı **uygulanmış** durumda; bu yüzden metin bir "sıfırdan
> yazma" değil, bir **göç (migration)** şartnamesidir. İlk hâli uygulanmış
> sistemle sekiz noktada çelişiyordu ve bazıları sessiz veri kaybı üretirdi.
> Özgün istek kaybolmasın diye hepsi tek tek yazıldı:
>
> 1. **Birleşme veri katmanında zaten yarı yarıya olmuş.** `breastfeeding`,
>    `bottle` ve `solid` **aynı `feedings` tablosunu** paylaşıyor ve `feed_type`
>    ile ayrılıyor (TEKNIK_DOKUMAN §22.0.2). Günlük akış da üçünü tek
>    `kind='feeding'` satırı olarak gösteriyor. Geriye kalan iş veri modeli
>    değil, **modül kataloğu ve arayüz** birleştirmesi — artı `pumping`, ki o
>    gerçekten ayrı tabloda (`pumping_sessions`).
> 2. **`details` JSON'u raporları kırar.** Bugün `amount_ml` bir **üretilen
>    sütun** (`cl → ml` dönüşümü orada yapılıyor) ve `v_timeline` görünümü
>    `f.feed_type` ile `f.amount_ml` sütunlarını doğrudan okuyor. Miktarı JSON
>    içine gömmek "günde kaç ml aldı" sorgusunu, günlük özet uçlarını ve akış
>    görünümünü aynı anda bozar. Çözüm §1.2'de.
> 3. **`feed_type` enum'u daraltılamaz.** Şartname `'bottle'` diyor; sistemde
>    `bottle_breastmilk` · `bottle_formula` · `water` ayrı değerler ve raporlar
>    buna dayanıyor — özellikle **su, ml toplamına dâhil edilmiyor** (§9.8,
>    §22.0.2). İçerik alt alana taşınacaksa o kural sorguya taşınmalı.
> 4. **`timestamp` tek alanı yetmez.** Sistemde `started_at` + `ended_at` +
>    `duration_sec` + **`tz_offset_min`** var. Son alan gün sınırını cihazın
>    yerel saatine göre belirliyor; düşerse gece 02:00'deki emzirme bir önceki
>    güne yazılır (§22.3) ve emzirmenin durum makinesi (§10.1) çalışamaz.
> 5. **Sağmayı `feedings`'e taşımak çift sayım riski taşır.** Sağılıp sonra
>    biberonla verilen süt hem `pumping` hem `bottle_breastmilk` satırı
>    üretiyor; ikisi aynı tabloda `SUM(amount_ml)`'e girerse bebeğin aldığı
>    miktar **iki katı** görünür. Karar §1.3'te.
> 6. **Ortak sayacın önündeki engel WebSocket değil, yetki.** Seanslar zaten
>    **sunucuda** yaşıyor (§10.1, §22.3) ve uçlar mevcut; ama `editor`
>    **yalnızca kendi girdiği kaydı** değiştirebiliyor, aksi hâlde `404`
>    dönüyor (§5.5). Yani bugün baba, annenin başlattığı sayacı duraklatamaz.
>    Asıl iş bu kuralın istisnası — ayrıntı §2.1.
> 7. **Projede gerçek zamanlı altyapı yok.** Socket.io, FCM/APNs, sunucudan
>    cihaza itilen hiçbir kanal yok (`enableRemoteNotifications: false`;
>    NOTLAR-ve-EKSIKLER.md §4). Socket.io eklemek yeni bir sunucu bileşeni ve
>    yeni bir mobil bağımlılık demek. Daha ucuz ve yeterli bir yol var: §2.2.
> 8. **Modül kataloğundan dört satır silmek bir ürün kararıdır.** Yönetim
>    paneli bugün Ek Gıda'yı tek başına kapatabiliyor (sistemde varsayılan
>    **kapalı**), Süt Sağma'yı da öyle. Tek `feeding` anahtarı bu ayarı
>    kaybeder. Seçenekler ve önerilen yol §0.2'de.
>
> **Ayrıca:** bu dosyanın önceki sürümü **"Tarih Filtreli Beslenme Raporu"**
> şartnamesiydi (`/reports/feeding` ucu, özet kartları, PDF çıktısı). Bu
> sürümde §3 yalnızca **Eğilim grafiğinin** tarih filtresini istiyor. Önceki
> kapsam başka hiçbir dosyada yaşamıyor; hâlâ isteniyorsa ayrı bir şartname
> dosyası açılmalı.

### Proje Mimarisi & Çalışma Kuralları

1. **Dizin Yapısı:** Backend (Node.js projesinin olduğu dizin) ve Mobil App
   (React Native projesinin olduğu dizin) bağımsız çalışır. Mobil depoda
   `backend/` dizini **yoktur**; sunucu ayrı depodadır.
2. **Dokümantasyon:** Veri modeli, API ve modül birleştirme detayları
   `TEKNIK_DOKUMAN.md` dosyasına yazılır (dosya adı büyük harflidir; depoda
   `teknik_dokuman.md` yok). İlgili bölümler: §4.2 (DDL), §4.3 (akış
   görünümü), §4.4 (modül seed'i), §9 (modül sistemi), §22.0.2 / §22.1 /
   §22.2 / §22.8 / §22.9, §12.7 (canlı sayaç bildirimi).
3. **Geliştirme Akışı (Strict Step-by-Step Order):**
   - **ÖNCE BACKEND:** şema göçü, yetki istisnası, ortak sayaç uçları, tarih
     aralıklı eğilim ucu.
   - **DOKÜMANTASYON:** `TEKNIK_DOKUMAN.md` güncellenir.
   - **SONRA REACT NATIVE:** tekil Beslenme ekranı, ortak sayaç müdahalesi,
     tarih filtreli eğilim grafiği.

---

## 0. Göç kapsamı

### 0.1 Değişecek yüzey

Dört modül anahtarı mobil tarafta **22 dosyada** geçiyor. Göç planı bunları
saymadan yapılırsa yarım kalır:

| Yer | Dosya | Ne olacak |
|-----|-------|-----------|
| Modül anahtarı tipi | `src/core/modules/types.ts` | `ModuleKey` birliğinden 4 anahtar çıkar, `feeding` girer |
| Katalog | `src/core/modules/catalog.ts` | 4 meta satırı → 1; `sortOrder` sunucudaki `modules` tablosuyla hizalanmalı |
| Sunucu seed'i | `modules` tablosu (§4.4) | Aynı değişiklik; iki taraf ayrışırsa panel ile uygulama farklı liste gösterir |
| Ekran eşlemesi | `src/core/navigation/moduleScreens.ts` | 4 ekran → `FeedingScreen` |
| Ekranlar | `src/modules/{breastfeeding,bottle,solid,pumping}/` | Tek klasöre taşınır; `ActiveDurationSheet` korunur (§10.2.1) |
| İkon ve renk | `Icon.tsx`, `theme/index.ts` (`moduleTint`) | `feeding` için ton ve ikon; eski adlar **kayıt türleri** için kalmalı |
| Ana ekran / akış | `HomeScreen.tsx`, `TimelineScreen.tsx` | Izgarada tek kutu; akış zaten `kind='feeding'` |
| Canlı sayaç | `src/core/timers/*`, `liveTimerNotice.ts` | `TimerKind` ve bildirim kategorileri yeniden adlandırılır (§12.7) |
| Hatırlatıcılar | `RemindersScreen.tsx`, `REMINDER_CATEGORIES` | **Dokunulmaz** — aşağıdaki uyarı |

> **Hatırlatıcı kategorileri silinmemeli.** `REMINDER_CATEGORIES` içindeki
> `breastfeeding` ve `pumping` değerleri kullanımda; listeden düşürülürse
> kayıtlı satırlar doğrulamadan geçemez hâle gelir (NOTLAR §1.4). Modül
> birleşse de kategori kümesi olduğu gibi kalır.

### 0.2 Modül kapatma ayarı — karar gerekiyor

Bugün yönetim paneli dört modülü **ayrı ayrı** açıp kapatabiliyor; `solid` ve
`pumping` sistemde varsayılan olarak **kapalı** (§4.4). Tek anahtara inmek bu
ayarı kaybeder: "ek gıdaya başlamamış bir bebek için Ek Gıda sekmesini kapat"
artık mümkün olmaz.

| Seçenek | Sonuç |
|---------|-------|
| A — Tek `feeding` anahtarı | En sade; alt bölüm kapatma yeteneği **kaybedilir** |
| B — `feeding` ana anahtar + 4 alt anahtar korunur | Panel ayarı korunur; ekran bölümleri kapalı alt modülü çizmez |

**Önerilen: B.** Katalogda `feeding` görünür modül olur, dört eski anahtar
**gizli alt bayrak** olarak kalır (ızgarada kutusu olmaz, panelde alt seçenek
olarak durur). Mevcut `requires` alanı zaten modüller arası bağımlılığı
destekliyor; ekranın bölüm görünürlüğü `useModuleStore((s) => s.states)` ile
okunur — ana ekran kartlarındaki kuralın aynısı (§9.8). Böylece göç tek yönlü
bir kayıp olmaz.

---

## 1. Birleşik Beslenme Modülü — veri yapısı

### 1.1 Mevcut durum

`feedings` tablosu zaten üç tipi taşıyor (§4.2):

```
id · sync_uuid · baby_id · feed_type · started_at · ended_at · tz_offset_min
duration_sec · amount · amount_unit · amount_ml (GENERATED) · food_name
note · entry_source · status · created_by · updated_by · timestamps · deleted_at
```

Ek gıda alanları (`food_category`, `reaction`, `is_three_day_rule`) §22.2'de,
emzirme ayrıntısı `breastfeeding_sessions` + `breastfeeding_segments`
tablolarında, sağma ise ayrı `pumping_sessions` tablosunda.

### 1.2 `details` JSON'u — hibrit kural

Şartname her tip için JSON `details` nesnesi istiyor. Tamamını JSON'a taşımak
**üç şeyi birden kırar**: `amount_ml` üretilen sütunu, `v_timeline` görünümü ve
günlük özet sorguları. Bu yüzden ayrım şöyle yapılacak:

| Alan sınıfı | Nerede durur | Neden |
|-------------|--------------|-------|
| Toplanan / filtrelenen / sıralanan | **Gerçek sütun** | `SUM(amount_ml)`, `WHERE feed_type IN (...)`, `ORDER BY started_at`, `GROUP BY reaction` indeks ister; MySQL'de JSON alanı ancak üretilen sütun + fonksiyonel indeksle indekslenir — aynı işi iki kat makineyle yapmak olur |
| Yalnızca okunup gösterilen, tipe özel | `details` JSON | Yeni alan eklemek migration gerektirmez |

Buna göre **sütunda kalanlar**: `feed_type`, `started_at`, `ended_at`,
`tz_offset_min`, `duration_sec`, `amount`, `amount_unit`, `amount_ml`,
`food_name`, `food_category`, `reaction`, `status`, `note`, denetim alanları.

**`details` JSON'a girenler** (hepsi yeni ya da toplanmayan):
`temperature` (`warm` · `room_temp` · `cold` — **şartnamenin yeni getirdiği
alan**, sistemde yoktu), `is_three_day_rule`, `storage_location`, `is_used`,
`last_side`.

> `reaction` bilinçli olarak sütunda kalıyor: `/solid/allergies` ucu ona göre
> gruplayıp sayıyor (§22.2) ve raporda reaksiyon dağılımı isteniyor.

### 1.3 `feed_type` kümesi ve sağma

Şartnamedeki dört değerli enum (`breastfeeding`·`bottle`·`solid`·`pumping`)
doğrudan uygulanamaz. Uygulanacak küme:

```
feed_type: 'breast' | 'bottle' | 'solid' | 'water' | 'pumping'
details.bottle_content: 'breast_milk' | 'formula'
```

- `bottle_breastmilk` / `bottle_formula` tek `bottle` tipine inip içerik alt
  alana taşınabilir — **ama** göç sırasında eski değerler yeni biçime
  çevrilmeli ve `bottle_breakdown` döndüren tüm sorgular `details`'ten okumaya
  geçmeli.
- **`water` ayrı tip olarak kalır.** Biberon içeriği sayılıp ml toplamına
  girerse "bugün 390 ml aldı" yanıltıcı olur; su beslenme değil sıvı alımıdır
  (§22.0.2). Ayrı tip, kuralı sorguda unutmayı zorlaştırır.
- **Sağma için iki yol var ve biri tehlikeli:**

| Yol | Değerlendirme |
|-----|---------------|
| `pumping_sessions` tablosu **kalır** | Önerilen. Göç riski sıfır, stok uçları (`/pumping/stash`) olduğu gibi çalışır, çift sayım imkânsız. "Birleşme" arayüz düzeyinde yapılır |
| `feedings`'e `feed_type='pumping'` olarak taşınır | Şema birliği kazanılır ama **her** intake sorgusuna `feed_type <> 'pumping'` koşulu eklenmesi gerekir; biri unutulduğunda bebeğin aldığı süt iki kat görünür ve bu hata sessizdir |

İkinci yol seçilirse `v_timeline` de gözden geçirilmeli: sağma bebeğin değil
annenin kaydı, günlük akışta beslenme gibi görünmesi istenmeyebilir.

### 1.4 Alan adları

`created_by_user_id` / `updated_by_user_id` yerine sistemdeki adlar kullanılır:
**`created_by` / `updated_by`**. Kimlikler `UUID` değil `BIGINT UNSIGNED`;
`sync_uuid` ayrı bir sütun ve çevrimdışı eşleme için var.

### 1.5 Göç güvenliği

- Göç **tek yönlü silme ile başlamaz**: eski tablolar ve uçlar en az bir sürüm
  boyunca okunur kalır. Yüklü istemciler anında güncellenmiyor (OTA herkese
  aynı anda ulaşmaz); uçlar bir gecede kalkarsa eski sürüm beyaz ekran verir.
- Her göç adımı **geri alınabilir** olmalı: `details` doldurulurken eski
  sütunlar düşürülmez, yalnızca yazma yolu yeni alana çevrilir.
- Yerel aynada `module_catalog` tablosu var (şema v2); modül anahtarları
  değişince eski satırlar temizlenmeli, yoksa cihazda artık var olmayan bir
  modül "açık" görünür.

---

## 2. Ortak canlı sayaç (çoklu ebeveyn)

### 2.1 Asıl engel: yetki kuralı

Bu gereksinimin önündeki engel gerçek zamanlılık değil. Seans zaten sunucuda
ve uçlar hazır (`/breastfeeding/{id}/pause` · `/resume` · `/stop` ·
`/active-duration`). Engel şu: **`editor` yalnızca `created_by = kendisi` olan
kayda dokunabiliyor, aksi hâlde `404` dönüyor** (§5.5). Yani bugün baba,
annenin başlattığı sayacı duraklatamaz — şartnamenin tam da istediği şey.

Uygulanacak istisna:

> **Çalışan bir seans kişisel kayıt değil, paylaşılan durumdur.** `status` değeri
> `running` ya da `paused` olduğu sürece, bebeğe `editor` yetkisiyle bağlı **her**
> üye `pause` · `resume` · `switch` · `stop` · `active-duration` komutlarını
> verebilir. Seans `completed` olduğu anda normal kural geri döner: kaydı yalnızca
> girenle `owner` düzenleyebilir.

Gerekçe: sayaç bir "kayıt" değil, o an süren bir olay. Bebeği gece besleyen kişi
ile sayacı başlatan kişi çoğu zaman farklı. `viewer` bu istisnanın dışındadır.

Her komut `updated_by` alanını yazar; arayüz "son müdahale: Baba Mehmet"
satırını buradan gösterir. Denetim izi (§6) zaten bu alanları topluyor.

### 2.2 Gerçek zamanlılık — Socket.io yerine yoklama

Projede sunucudan cihaza itilen hiçbir kanal yok. Socket.io eklemek sunucuya
kalıcı bağlantı yönetimi, mobil tarafa yeni bir bağımlılık ve yeniden bağlanma
mantığı getirir. Gereksinimin karşılığı daha ucuz bir yolla alınabilir:

| Durum | Davranış |
|-------|----------|
| Beslenme ekranı açık ve sayaç çalışıyor | `GET /babies/{id}/feedings/active-timer` **3–5 saniyede bir** yoklanır |
| Ekran kapalı / uygulama arka planda | Yoklama durur |
| Uygulama ön plana döndü | Bir kez sorulur — bu **zaten yapılıyor** (§12.7, `refreshFromServer`) |

Sayaç zaman damgasından hesaplandığı için (§10.3) yoklama **süreyi** değil
yalnızca **durumu** taşır: kim duraklattı, hangi taraf açık, bitti mi. Bu
yüzden 3–5 saniyelik gecikme ekranda fark edilmez; saniye akışı istemcide
sürer.

Socket.io yine de istenirse ayrı bir şartname konusu olmalı: push altyapısının
tamamı (FCM/APNs dâhil) hâlâ yok ve ikisi birlikte planlanmalı.

### 2.3 Uç

```
POST /babies/{babyId}/feedings/active-timer
  { action: 'start'|'pause'|'resume'|'switch'|'stop',
    feed_type: 'breast'|'pumping', side?: 'left'|'right',
    active_duration_sec?: number, at: ISO }

GET  /babies/{babyId}/feedings/active-timer   -> { timer: ActiveTimer | null }
```

Tek uç, mevcut `/breastfeeding/*` uçlarının önüne **ince bir cephe** olarak
yazılır; durum makinesi (§10.1) yeniden yazılmaz. Dönen nesne mobildeki
`LiveTimer` modeliyle aynı alanları taşımalı: `started_at`,
`open_segment_started_at`, `total_active_sec`, `status`, `open_side`,
`session_id`, `updated_by`.

Çakışma kuralları:

- İki ebeveyn aynı anda `start` derse ikinci istek **yeni seans açmaz**,
  çalışanı `already_running: true` ile döndürür — uyku modülündeki kuralın
  aynısı (§22.3).
- Zaten duraklatılmış seansa `pause`, zaten kapalı seansa `stop` → `422`.
- `stop` yarışında ikinci istek `422` alır; istemci bunu hata olarak değil
  "diğer ebeveyn bitirmiş" olarak gösterir, yoksa gece yarısı anlamsız bir
  hata kutusu çıkar.

### 2.4 Mobil taraf

- Canlı sayaç bildirimi (§12.7) bu uçla beslenir; `TimerKind` adları modül
  birleşmesine göre güncellenir. Bildirimden duraklatma **zaten** çalışıyor,
  yetki istisnası gelince diğer ebeveyn için de çalışır.
- Ekranda "Anne başlattı · 14:32" ve son müdahale satırı gösterilir; kimin
  neyi yaptığı belirsiz kalırsa iki ebeveyn birbirinin sayacını kapatır.
- Salt okuyan üyeye kontrol düğmeleri **hiç** gösterilmez (`useCanEdit`).

---

## 3. Raporlar — tarih filtreli Eğilim grafiği

### 3.1 Uç

Mevcut uç `GET /babies/{id}/reports/trends?metric=sleep|feeding|diaper&days=`
(§22.8). Şartnamedeki `?baby_id=` biçimi bu projenin sözleşmesi değil: bebek
**yoldan** çözülüyor ve yetki ara katmanı oradan çalışıyor (§5.5). `/api/v1`
önekini de istemci ekliyor (`API_PATH_PREFIX`).

Genişletilmiş hâli:

| Parametre | Zorunlu | Değer |
|-----------|---------|-------|
| `metric` | evet | `sleep` · `feeding` · `diaper` |
| `preset` | hayır | `today` · `this_week` · `last_week` · `this_month` · `custom` · `last_7_days` · `last_30_days` |
| `start_date` / `end_date` | `preset=custom` ise evet | `YYYY-MM-DD`, bitiş dâhil |
| `days` | hayır | **Geriye uyumluluk.** Verilirse `last_N_days` gibi davranır |
| `tz_offset_min` | hayır | Cihazın UTC farkı |

`days` korunmalı: ekran bugün onu gönderiyor ve uçtan kaldırmak eski
istemcileri bozar.

### 3.2 Pencere çözümlemesi

Pencere **sunucuda** çözülür ve çözülmüş hâli yanıtta `range` olarak döner;
istemci de hesaplarsa ekrandaki etiket ile rakamların ait olduğu günler gece
yarısı sessizce ayrışır.

| `preset` | Pencere | Bugünü içerir |
|----------|---------|---------------|
| `today` | bugün | ✔ |
| `this_week` | **pazartesi**–bugün | ✔ |
| `last_week` | önceki pazartesi–pazar | ✘ |
| `this_month` | ayın 1'i–bugün | ✔ |
| `last_7_days` / `last_30_days` | dünden geriye tam günler | ✘ |

Üç nokta açıkça kodlanmalı:

- **Hafta pazartesi başlar.** JavaScript'in `getDay()`'i pazarı `0` sayar;
  doğrudan kullanılırsa "Bu hafta" etiketi yanlış olur.
- **Takvim penceresi ile dönen pencere aynı şey değil.** Mevcut rapor "son 7
  gün"ü bugünün yarım gününü saymadan alıyor (§22.8); `this_week` ise bugünü
  içeriyor. Karıştırılırsa günlük ortalama sabah her bakıldığında düşük görünür.
  Yanıt bu yüzden `days_counted` (gelecekte olmayan gün sayısı) döndürür ve
  ortalamalar ona bölünür.
- Gün kovası kaydın **kendi** `tz_offset_min` değerine göre açılır (§22.3).

Hata tablosu: `start_date > end_date` → `422`; bilinmeyen `preset` → `422`
(sessizce varsayılana düşmez); pencere > 366 gün → `422`; `end_date` bugünden
ileriyse **reddedilmez, kırpılır** ve kırpılmış hâli `range`'te döner.

### 3.3 Yanıt

```jsonc
{
  "metric": "feeding",
  "range": { "preset": "this_week", "start_date": "2026-11-02",
             "end_date": "2026-11-02", "days": 1, "days_counted": 1,
             "includes_today": true },
  "series": [
    { "date": "2026-11-02", "total_ml": 360, "count": 3,
      "breastfeeding_sec": 4320, "pumped_ml": 190 }
  ]
}
```

`series` adı korunuyor: mobildeki `TrendPoint` tipi ve `BarChart` bileşeni onu
olduğu gibi tüketiyor. Veri **olmayan günler de sıfırla** döner; yalnızca dolu
günleri göndermek grafikte boşlukları görünmez kılar ve "her gün beslendi"
izlenimi verir (§22.8).

### 3.4 Mobil

- **Hızlı etiketler** mevcut `Chips` bileşeniyle: **[ Bugün | Bu hafta | Geçen
  hafta | Bu ay | Özel ]**. Ekranda şu an `7 / 14 / 30 gün` çipleri var; bunlar
  `last_7_days` / `last_30_days`'e eşlenir, ikisi birden durmaz.
- **Özel aralık:** projede tarih **aralığı** seçici bileşeni yok ve takvim
  kütüphanesi eklenmeyecek. İki `DateField` yan yana kullanılır
  (`src/components/DateTimeField.tsx`): başlangıç `maximumDate={bugün}`, bitiş
  `minimumDate={başlangıç}`. Geçersiz aralık arayüzde kurulamaz.
- **İstek aralık tamamlanmadan atılmaz**; yarım aralık her dokunuşta `422`
  üretirdi.
- **Grafik kütüphanesi eklenmeyecek.** `react-native-chart-kit` /
  `victory-native` kurulu değil; grafik `View` yükseklikleriyle çiziliyor
  (`ReportsScreen.tsx` → `BarChart`). Pencere 30 günü aşabildiği için sütun
  genişliği gün sayısına göre hesaplanmalı — şu an sabit 5 piksel ve 90 günde
  ekrandan taşar.

---

## Uygulama Adımları (Lütfen Sırayla Çalış)

1. **Adım 1:** §0.2'deki A/B kararını ver ve yaz. Katalog, `ModuleKey`, sunucu
   `modules` seed'i ve yerel `module_catalog` önbelleği birlikte güncellenir.
2. **Adım 2:** Şema göçü: `details` JSON sütunu eklenir, §1.2'deki alanlar
   doldurulur. Eski sütunlar **düşürülmez**. `v_timeline` ve günlük özet
   sorguları gözden geçirilir.
3. **Adım 3:** Sağma için §1.3'teki kararı ver. Taşımaya karar verilirse her
   intake sorgusuna `feed_type <> 'pumping'` koşulu eklenir ve çift sayım testi
   yazılır.
4. **Adım 4:** Yetki istisnasını uygula (§2.1) ve test et: anne başlatır, baba
   duraklatır, `updated_by` babayı gösterir, `viewer` reddedilir.
5. **Adım 5:** `feedings/active-timer` cephesini yaz; çakışma kurallarını
   (§2.3) test et.
6. **Adım 6:** `reports/trends` ucuna `preset` / `start_date` / `end_date`
   ekle; `days` parametresini bozma.
7. **Adım 7:** Değişiklikleri `TEKNIK_DOKUMAN.md`'ye işle (§4.2, §4.3, §4.4,
   §9, §22.x ve §12.7).
8. **Adım 8:** Mobilde tekil `FeedingScreen` — bölümler `Chips` ile ayrılır,
   navigasyon sekmesi kullanılmaz (`AGENTS.md`). `ActiveDurationSheet`
   korunur.
9. **Adım 9:** Ortak sayaç yoklaması ve "son müdahale" satırı; canlı sayaç
   bildirimini yeni tür adlarına uyarla.
10. **Adım 10:** Eğilim grafiğine tarih filtresini bağla.
11. **Adım 11:** `npx expo lint` ve `npx tsc --noEmit` koş; ikisi de temiz
    olmadan iş bitmiş sayılmaz.

## Kabul Kriterleri

- [ ] Göçten sonra eski kayıtların **tamamı** yeni ekranda görünüyor; kayıt
      sayısı göç öncesiyle birebir aynı.
- [ ] `feedings/daily-summary` ve `reports/summary` değerleri göç öncesiyle
      **aynı** sonucu veriyor (su hariç toplam, porsiyon birimli ek gıdanın ml'ye
      karışmaması dâhil).
- [ ] Sağma kaydı bebeğin aldığı ml toplamına **girmiyor**; sağılıp biberonla
      verilen süt tek kez sayılıyor.
- [ ] Anne emzirmeyi başlatıyor, baba kendi telefonundan duraklatıp
      bitirebiliyor; `viewer` üye `404` alıyor.
- [ ] İki ebeveyn aynı anda `start` dediğinde tek seans açılıyor.
- [ ] Aktif süre düzeltme penceresi (§10.2.1) birleşmeden sonra da çıkıyor ve
      düzeltilen süre raporda görünüyor.
- [ ] 2 Kasım'da `this_month` seçildiğinde ortalama 2'ye bölünüyor, 30'a değil.
- [ ] `days=7` ile `preset=last_7_days` **aynı** seriyi döndürüyor.
- [ ] Yönetim panelinden beslenme kapatıldığında ana ekrandaki kutu ve alt
      bölümler çizilmiyor; hatırlatıcı kategorileri etkilenmiyor.
- [ ] Eski sürüm bir istemci, göç yayınlandıktan sonra da çalışmaya devam
      ediyor (uçlar en az bir sürüm korunuyor).
