Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde yer alan kayıt ve başlatma butonlarına (**Beslenme, Uyku, Bez Değişimi, Görevler, Aşılar, Hatırlatıcılar, Profil Kaydet vb.**) tıklandığında gelir elde etmemizi sağlayacak **"Google AdMob Geçiş Reklamı (Interstitial Ads) Entegrasyonu"** özelliğini geliştireceksin.

### Proje Mimarisi & Çalışma Kuralları
1. **Dizin Yapısı:** Mobil App (`/app`) dizininde çalışacaksın.
2. **Dokümantasyon:** Yapılan tüm reklam kütüphanesi yapılandırmaları ve reklam tetikleme kuralları `teknik_dokuman.md` dosyasına kaydedilmelidir.
3. **Kullanıcı Deneyimi (UX) & Performans:**
  - Reklam gösterimi veritabanı kaydını veya canlı sayacın başlatılmasını kesinlikle engellememelidir.
  - Butona tıklandığında ilgili API kaydı veya kronometre başlatma işlemi **anında** yürütülmelidir.
  - İşlem gerçekleştikten 3 saniye sonra önceden yüklenmiş (pre-loaded) geçiş reklamı ekrana getirilmelidir.

---

### Reklam Tetiklenecek Butonlar Listesi
Aşağıdaki butonlara her tıklandığında arka planda işlem tamamlandıktan 3 saniye sonra geçiş reklamı tetiklenmelidir:
- **Tamamlandı** (Görev tamamlama, aşı tamamlama modalı butonları)[cite: 2]
- **Değişiklikleri Kaydet** (Profil, hatırlatıcı, görev ve ayar düzenleme butonları)[cite: 1]
- **Sol** (Beslenme / Emzirme kronometresi sol meme başlat/duraklat butonu)[cite: 1]
- **Sağ** (Beslenme / Emzirme kronometresi sağ meme başlat/duraklat butonu)[cite: 1]
- **Kaydet** (Yeni bez değişimi, biberon, ek gıda, süt sağma, aşı, hatırlatıcı ekleme butonları)[cite: 1]
- **Uykuya Daldı** (Uyku takibi canlı kronometre başlatma butonu)[cite: 1]
- **Davet Oluştur** (Aile ve Yetkiler modülü davet kodu/bağlantısı üretme butonu)[cite: 1]

---

### Özellik Gereksinimleri: Google AdMob Geçiş Reklamı Entegrasyonu

#### 1. Kütüphane & Native Kurulum:
- React Native projesine `react-native-google-mobile-ads` kütüphanesini ekle.
- iOS (`Info.plist`) ve Android (`AndroidManifest.xml`) dosyalarında Google AdMob App ID yapılandırmalarını ve izin parametrelerini tanımla.
- Geliştirme ve test süreçlerinde Google'ın resmi Test Ad Unit ID'lerini (`TestIds.INTERSTITIAL`) kullan.

#### 2. Merkezi Reklam Servisi Katmanı (`adService.ts` / `useInterstitialAd` Hook):
- Reklamın kullanıcı butona basmadan önce arka planda önceden yüklenmesini (pre-loading) sağlayan bir servis katmanı veya custom hook kurgula.
- Reklam gösterilip kapatıldığında veya gösterim başarısız olduğunda bir sonraki gösterim için otomatik olarak yeni reklamı arka planda yükle (`interstitial.load()`).
- Reklam yüklenmediyse uygulamanın çökmesini önleyecek hata yakalama (try/catch) mekanizmasını kur.

#### 3. Buton Tetikleme & 3 Saniye Gecikme Mantığı:
- Belirtilen butonlara (`Tamamlandı`, `Değişiklikleri Kaydet`, `Sol`, `Sağ`, `Kaydet`, `Uykuya Daldı`, `Davet Oluştur`) tıklandığında:
  1. İlgili form kaydını veya kronometre/sayaç başlatma mantığını **gecikmesiz anında çalıştır**.
  2. Kullanıcıya işlem sonucunu (toast bildirim, modal kapanması vb.) anında yansıt.
  3. `setTimeout` ile 3 saniyelik bir zamanlayıcı tetikle.
  4. 3 saniye dolduğunda reklam hazırsa (`interstitial.isLoaded`) reklamı göster (`interstitial.show()`).

---

### Uygulama Adımları (Lütfen Sırayla Çalış):

1. **Adım 1:** React Native projesine `react-native-google-mobile-ads` kütüphanesini kur ve iOS/Android native yapılandırmalarını tamamla.
2. **Adım 2:** Arka planda reklam yükleyen ve 3 saniyelik gecikmeli gösterim fonksiyonu sunan `adService` modülünü kurgula.
3. **Adım 3:** Yapılan AdMob kütüphane kurulumlarını ve reklam tetikleme kurallarını `teknik_dokuman.md` dosyasına kaydet.
4. **Adım 4:** Belirtilen tüm buton bileşenlerine (`Tamamlandı`, `Değişiklikleri Kaydet`, `Sol`, `Sağ`, `Kaydet`, `Uykuya Daldı`, `Davet Oluştur`) 3 saniye gecikmeli reklam tetikleme işlevini bağla ve test et.

Sırasıyla bu adımları takip ederek geliştirmeye başla.
---
---

# UYGULAMA PLANI — bu depoya özel (4 Kasım 2026)

Yukarıdaki şartname geneldir; aşağısı **bu projenin gerçek dosyalarına ve
kurallarına** göre çıkarılmış uygulama planıdır. Kod yazmadan önce §0'ı oku:
iki noktada şartnameden **bilerek sapmak** gerekiyor.

## 0. Önce iki uyarı

### 0.1 "Her butonda reklam" AdMob politikasına takılır

Şartname yedi buton grubuna **her tıklamada** geçiş reklamı istiyor. Bu
projede o butonlar günde onlarca kez basılıyor: emzirme sayacında **Sol/Sağ**
tek bir beslenmede 3-4 kez, bez değişimi günde 8-12 kez. Google'ın geçiş
reklamı kuralı, reklamın **doğal geçiş noktalarında** gösterilmesini istiyor;
her kullanıcı eyleminden sonra reklam açmak "ad flooding / disruptive
interstitial" sayılıp **hesap askıya alınmasına** kadar gidebiliyor. Bir
bebeğin gece beslenmesini kaydeden ebeveyne 02:00'de tam ekran reklam açmak
ayrıca uygulamanın terk edilme sebebidir.

**Bu yüzden plan, şartnamedeki buton listesini aynen uygular ama araya bir
frekans sınırı koyar** (§2 Adım 2): reklam en fazla `N` dakikada bir ve
oturum başına en fazla `M` kez gösterilir. Sayıları **sen** belirleyeceksin
(§1, madde 10); öneri: `N = 3 dakika`, `M = 5`. Sınırı kaldırmak istersen tek
bir sabiti değiştirmek yetiyor — ama riski yukarıda yazdı.

### 0.2 `Info.plist` ve `AndroidManifest.xml` elle düzenlenmeyecek

Şartname §1'de bu iki dosyanın elle düzenlenmesi yazıyor. Bu projede
**yapılamaz**: `android/` ve `ios/` dizinleri Continuous Native Generation
çıktısıdır ve `AGENTS.md` elle düzenlemeyi yasaklıyor — bir sonraki
`expo prebuild` yazdığın her satırı siler. Aynı işi
`react-native-google-mobile-ads`'in **config plugin**'i yapıyor: App ID'ler
`app.json`'a yazılır, manifest/plist girdilerini eklenti derleme sırasında
üretir. Plan bu yolu kullanıyor.

### 0.3 Önerilerim — §1 ve §3'te senden beklediğim kararlar için

Aşağıdakiler benim **önerim**; son söz senin. "Hepsine tamam" demen yeterli,
tek tek değiştirmek istersen de madde numarasını söylemen kâfi.

| # | Karar | **Önerim** | Gerekçe |
|---|-------|-----------|---------|
| A | Çocuklara yönelik mi? (§1.4, §3.1) | **Hayır** — Play Console'da hedef kitle **18+**, kodda `tagForChildDirectedTreatment: false`, `tagForUnderAgeOfConsent: false` | Uygulamayı bebek değil ebeveyn kullanıyor; bebek verinin **konusu**, kullanıcısı değil. 18 altı herhangi bir yaş bandını işaretlersen Google Play **Families** politikası açılır: onaylı SDK zorunluluğu, kişiselleştirilmiş reklam yasağı ve belirgin gelir kaybı. **Tek istisna:** mağaza görseli/metni çocuklara hitap edecek şekilde pazarlanacaksa beyan değişir, o zaman bana söyle. |
| B | Frekans sınırı sayıları (§1.10, §3.2) | **3 dakikada bir, oturum başına 5**, artı **sessiz saatlerde de aynı ölçekte reklamlar uygulanacak.** | 3 dakika, art arda kayıt giren ebeveyni (bez + biberon + not) tek reklamla geçiriyor. Oturum başına 5, günde ~10-15 gösterim demek — zaten gerçekçi tavan bu. Sessiz saat kısıtı olmayacak: kullanıcı kendi gece penceresini girmiş (`quiet_hours`, §12.3); 03:00'te mama kaydeden anneye tam ekran reklam açmak uygulamanın silinme sebebidir. Kullanıcı sessiz saat tanımlamamışsa 23:00–07:00 varsayılır. Ancak bu saatler arasında da reklam gösterimi olacaktır. |
| C | Hangi butonlarda reklam **olmasın** (§0.1) | **Sol / Sağ** ve **Uykuya Daldı** listeden çıksın | İkisi de bir işi **başlatma** anı; geçiş reklamı doğal **bitiş/geçiş** noktalarına ait. Emzirme Sol/Sağ tek beslenmede 3-4 kez basılıyor ve sayaç akarken ekranı kapatan reklam, ölçülen sürenin doğruluğuna da gölge düşürüyor — politika riskinin en yüksek olduğu yer burası. Reklam **Kaydet**, **Tamamlandı**, **Değişiklikleri Kaydet** ve **Davet Oluştur**'da kalsın; bunların hepsi "iş bitti" anı. Yine de şartnamedeki hâliyle isterseniz uygulanabilir — B maddesindeki sınır bu durumda tek emniyet olur. |
| D | Kişiselleştirilmiş reklam? (§3.3) | **Evet, ama izinle**: UMP formu kurulsun, reddedene **kişiselleştirilmemiş** reklam gösterilsin (reklamsız değil) | Kişiselleştirilmemiş reklamın geliri belirgin şekilde düşük; izni hiç sormamak o düşük geliri herkese uygulamak demek. Reddedeni reklamsız bırakmak ise gelir modelini delerdi. **iOS ATT'yi ilk açılışta sorma** — kullanıcı uygulamayı bir süre kullandıktan sonra sor; ilk saniyede sorulan izin çok daha yüksek oranda reddediliyor. |
| E | Reklamsız sürüm (§3.4) | **Şimdi yapma, kapısını bırak**: `adService` içine `isAdsDisabled()` kontrolü ilk günden konsun | Bir satır maliyeti var; sonradan 17 çağrı noktasını tek tek bulmaktan ucuz. Gerçek satın alma akışı (RevenueCat ya da `expo-in-app-purchases`) ayrı bir iş, reklam entegrasyonuyla birlikte yapılmamalı. |
| F | Başlangıç ortamı | **Önce yalnızca Android**; iOS'u Android'de gelir doğrulandıktan sonra aç | iOS ek yük getiriyor: ATT metni, App Store gizlilik formu, ayrı App ID ve reklam birimi. Android tarafı zaten derlenip test edilebilir durumda (§2 Adım 1), iOS için bu makinede derleme yok. |

**Bu önerilerle gelir tarafı ne oluyor:** C maddesi tetikleyici sayısını
azaltıyor, B maddesi gösterimi sınırlıyor — yani kasıtlı olarak "mümkün olan
en çok reklam"dan uzaklaşıyoruz. Buna karşılık hesabın askıya alınma riski ve
uygulamanın terk edilme riski düşüyor. Askıya alınmış bir AdMob hesabının
geliri sıfırdır; denge bu yüzden böyle kuruldu.

---

## 1. SENİN YAPMAN GEREKENLER

Bunlar kodla halledilemez; hesap, hukuk ve mağaza tarafı. **Koda başlamadan
önce 1-4 arası maddeler, yayına çıkmadan önce hepsi gerekli.**

> **Güncelleme (5 Kasım 2026) — bu listenin tamamı artık yönetim panelinde.**
> Aşağıdaki maddelerin çıktıları `.env` dosyasına **yazılmıyor**; sunucudaki
> `ad_settings` tablosunda duruyor ve panelin **Reklamlar** ekranından
> (`/admin/ads`) giriliyor. Ekranın altındaki kontrol listesi hangi maddenin
> eksik olduğunu gösteriyor. Ayrıntı: `TEKNIK_DOKUMAN.md` §7.6.
>
> İki madde kaçınılmaz olarak **derleme zamanı** kalıyor (App ID ve iOS ATT
> metni): config plugin onları `app.json`'dan okuyup manifest/plist'e yazıyor,
> çalışma zamanında bir uçtan gelmeleri mümkün değil. İkisi de panelde
> saklanıyor — ekran `app.json`'a yapıştırılacak bloğu girilen değerlerle
> hazır gösteriyor — ama `app.json`'a kopyalanıp yeniden derlenmeleri gerekiyor.

| # | Yapılacak | Çıktı / nereye yazılacak | Ne zaman |
|---|-----------|--------------------------|----------|
| 1 | [AdMob hesabı](https://admob.google.com) aç, **iki uygulama** kaydet (Android ve iOS) | 2 adet **App ID** (`ca-app-pub-XXXX~YYYY`) → panel **Reklamlar** + oradaki blokla `app.json` | Başlamadan |
| 2 | Her uygulama için bir **Geçiş reklamı (Interstitial)** reklam birimi oluştur | 2 adet **Ad Unit ID** (`ca-app-pub-XXXX/ZZZZ`) → panel **Reklamlar** (yeniden derleme gerekmez) | Başlamadan |
| 3 | AdMob'da uygulama paket adının **birebir** `com.bebiqa.app` olduğunu doğrula (`app.json` → `android.package` / `ios.bundleIdentifier`) | Panel **Reklamlar** → paket adı alanı; fark varsa uyarı verir | Başlamadan |
| 4 | **Çocuklara yönelik mi?** kararını ver (§3'te açıklandı) | Panel **Reklamlar** → "Çocuklara yönelik" onay kutusu | Başlamadan |
| 5 | AdMob → Gizlilik ve mesajlaşma → **GDPR mesajı** (UMP) oluştur ve yayınla | Konsolda ayar + panelde onay kutusu | Yayından önce |
| 6 | **Gizlilik politikası** sayfası hazırla; reklam ve reklam kimliği verisinin işlendiğini yaz (KVKK + Play şartı) | Genel erişime açık URL → panel **Reklamlar** | Yayından önce |
| 7 | Google Play Console → **Uygulama içeriği** → hedef kitle, veri güvenliği formu, reklam içerir beyanı | Konsolda form + panelde onay kutusu | Yayından önce |
| 8 | **`app-ads.txt`** satırını AdMob'dan al | Panel **Reklamlar** → içerik alanı; sunucu `/app-ads.txt` adresinden servis eder (dosya koymak gerekmez) | Yayından önce |
| 9 | iOS'ta kişiselleştirilmiş reklam isteniyorsa **ATT** metnini yaz (Türkçe izin cümlesi) | Panel **Reklamlar** + oradaki blokla `app.json` → `ios.infoPlist.NSUserTrackingUsageDescription` | iOS yayınından önce |
| 10 | **Frekans sınırı** sayılarını belirle (§0.1): kaç dakikada bir, oturumda kaç kez | Panel **Reklamlar** → frekans alanları (varsayılan 3 dk / 5) | Başlamadan |
| 11 | AdMob → Ayarlar → **Test cihazları**'na kendi telefonunu/emülatörünü ekle | Konsolda ayar + panel **Reklamlar** → cihaz kimlikleri | Test sırasında |
| 12 | **Ödeme profili**: adres doğrulama PIN'i ve vergi bilgileri | AdMob hesabı + panelde onay kutusu | İlk ödeme öncesi |
| 13 | Yeniden derlemeyi onayla: `expo prebuild` + `expo run:android` şart (§2 Adım 1) | ~10-20 dk sürer | Başlamadan |

> **Asla kendi reklamına tıklama.** Panelde **"Test kimlikleri kullan"**
> anahtarı varsayılan olarak AÇIK: canlı kimlikler girilse bile
> `TestIds.INTERSTITIAL` kullanılır. Canlıya geçiş bu anahtarı kapatmakla
> olur — tek ve bilinçli bir adım. Kendi telefonunu panelin *test cihazları*
> alanına eklemek, canlıya geçtikten sonra da o cihazda test reklamı
> gelmesini sağlar. Canlı reklam birimine kendi cihazından tıklamak hesabın
> kalıcı olarak kapatılma sebebidir.

### Kimlikleri nereye yazacaksın

**Reklam birimi kimlikleri, frekans sınırı, beyanlar ve tetikleyiciler:**
panelin **Reklamlar** ekranı. Kaydettiğin anda uygulamalar bir sonraki
tazelemede alır; yeniden derleme **gerekmez**.

**App ID'ler** (ve iOS için ATT metni) derleme zamanı okunduğu için ayrıca
`app.json`'a yazılmalı. Panel bu bloğu girilen değerlerle hazır gösteriyor,
kopyalaman yeterli:

```jsonc
// app.json — App ID'ler DERLEME zamanı okunur, bir uçtan gelemez
"plugins": [
  ["react-native-google-mobile-ads", {
    "androidAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY",
    "iosAppId":     "ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"
  }]
]
```

> **Niçin `.env` değil.** `EXPO_PUBLIC_*` değerleri paketleme sırasında koda
> **gömülür**: reklam birimi oraya yazılsaydı her kimlik değişikliği yeni bir
> APK demek olurdu. Frekans sınırı da denenerek bulunan bir işletme kararı;
> her denemede sunucuyu yeniden başlatmak gerekmemeli. Bu yüzden ikisi de
> veritabanında (`ad_settings`, migration `020`) duruyor — modül aktifliğiyle
> aynı desen (`TEKNIK_DOKUMAN.md` §9.1).

---

## 2. GELİŞTİRME ADIMLARI

> **DURUM (5 Kasım 2026): Adım 1-5 tamamlandı; emülatörde doğrulandı.**
>
> - `react-native-google-mobile-ads` **17.4.0** kuruldu, config plugin
>   `app.json`'a eklendi, `expo prebuild` ile manifest üretildi.
> - `src/core/ads/adService.ts` yazıldı; `App.tsx` kabuğunda `initAds()` ve
>   `watchAdSettings()` bağlandı.
> - Dört tetikleyici bağlandı: `save` (14 ekran, `withSaveFeedback`),
>   `complete` (görev + aşı), `invite` (davet), `timer_start` (uyku + emzirme).
> - Dokümantasyon: `TEKNIK_DOKUMAN.md` **§23** (istemci) ve **§7.6** (panel).
> - Adım 5: Android 16 emülatöründe sekiz senaryonun tamamı sürüldü ve geçti
>   (sonuç tablosu: `TEKNIK_DOKUMAN.md` §23.7). Çökme yok, JS hatası yok.
>
> **Kalan: yalnızca gerçek AdMob hesabı.** `app.json`'daki App ID'ler şu an
> Google'ın **örnek** kimlikleri — eklenti onlar olmadan açılışta çöküyor, bu
> yüzden yer tutucu bırakılamadı. Gerçek kimlikler alınınca panelin
> **Reklamlar** ekranı `app.json`'a yapıştırılacak bloğu hazır gösteriyor;
> sonra `prebuild` + yeniden derleme. Reklam birimi kimlikleri, frekans sınırı
> ve tetikleyiciler panelden geliyor; onlar için derleme gerekmiyor.

### Adım 1 — Kütüphane ve native kurulum

Sürüm uyumu kontrol edildi: paketin güncel sürümü **17.x**, **yalnızca New
Architecture** ile çalışıyor ve **React Native ≥ 0.86** istiyor. Bu proje
RN 0.88 ve `newArchEnabled=true` (`android/gradle.properties:44`) — uyumlu.
Alt sınırlar: **Android API 24+, iOS 15.1+**.

```bash
npx expo install react-native-google-mobile-ads   # npm/yarn add DEĞİL
```

`app.json` → `plugins` dizisine yukarıdaki eklenti girdisini ekle (mevcut
`expo-notifications`, `expo-calendar` girdilerinin yanına).

Sonra **zorunlu yeniden derleme** — bu adım atlanırsa uygulama açılışta çöker:

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="C:\\Users\\<kullanıcı>\\AppData\\Local\\Android\\Sdk"
npx expo prebuild --platform android
npx expo run:android
```

> Bu makinede `JAVA_HOME` ve `ANDROID_HOME` kabukta tanımlı değil; tanımsız
> çalıştırılırsa önce "Gradle requires JVM 17" sonra "SDK location not found"
> hatası verir.

**Kontrol:** `plugins/withCmakeObjectPathMax.js` eklentisi hâlâ listede
kalmalı — Windows'ta uzun yol sorunları için duruyor, prebuild'de kaybolursa
derleme patlar.

### Adım 2 — `src/core/ads/adService.ts` (merkezi servis)

> **Ayar katmanı HAZIR.** `src/core/ads/useAdSettingsStore.ts` panelden gelen
> yapılandırmayı taşıyor (açılışta SQLite önbelleğinden, sonra
> `GET /ads/config` ile tazelenir). `adService` sayıları kendi içinde sabit
> tutmayacak, bu depodan okuyacak:
> `useAdSettingsStore.getState().config` → `frequency_minutes`, `session_cap`,
> `action_delay_ms`, `use_test_ids`, `interstitial`, `child_directed`,
> `personalized_ads`, `test_device_ids`. Tetikleyicinin açık olup olmadığı
> `shouldShowFor('save' | 'complete' | 'invite' | 'timer_start')` ile
> sorulur. Ayrıntı: `TEKNIK_DOKUMAN.md` §7.6.

Tek dosya, React'siz, ekranlardan bağımsız. Sorumlulukları:

1. **Ön yükleme.** Uygulama açılışında bir `InterstitialAd` örneği kurulur ve
   `load()` edilir. `AdEventType.CLOSED` ve `AdEventType.ERROR` olaylarında
   **hemen yeni reklam yüklenir**, böylece bir sonraki gösterim hazır olur.
2. **Gecikmeli gösterim.** `showAfterAction()` çağrısı
   `setTimeout(..., config.action_delay_ms)` kurar (panel varsayılanı 3000);
   süre dolunca reklam hazırsa gösterir.
3. **Frekans sınırı** (§0.1): son gösterim zamanı ve oturum sayacı tutulur,
   sınır dolduysa gösterim **sessizce atlanır**. Sayılar panelden gelir
   (`frequency_minutes`, `session_cap`); `0` girilmesi sınırı kaldırır.
4. **Güvenlik kapıları** — reklam şu durumlarda gösterilmez:
   - uygulama ön planda değilse (`AppState.currentState !== 'active'`),
   - **ninni/müzik çalıyorsa** (`useMusicStore`) — tam ekran reklam sesi keser
     ve uyuyan bebeği uyandırır,
   - kaydetme onay penceresi hâlâ açıksa (`useSaveFeedbackStore.phase !==
     'hidden'`) — iki tam ekran katman üst üste binmemeli,
   - reklam yüklenmemişse (hata değil, sessiz geçiş),
   - **panel ayarı kapatmışsa**: `shouldShowFor(trigger)` `false` döndüyse —
     ana anahtar kapalı, bu tetikleyici seçili değil ya da bu platform için
     birim kimliği girilmemiş,
   - `config.respect_quiet_hours` açık **ve** kullanıcının sessiz saat
     penceresi içindeyse (varsayılan kapalı, bkz. §0.3-B).
5. **Hata yakalama.** `show()` ve `load()` çağrıları `try/catch` içinde; reklam
   hatası **hiçbir koşulda** kaydı ya da sayacı etkilemez.
6. **Kimlik seçimi.** `__DEV__ || config.use_test_ids` ise
   `TestIds.INTERSTITIAL`, değilse `interstitialUnitId(config)` (platforma
   göre Android/iOS birimi). Kimlik `.env`'den **gelmiyor** — panelden geliyor,
   bu yüzden değiştirmek için yeniden derleme gerekmez.
7. **Ayar değişimini izleme.** Depo zustand; `useAdSettingsStore.subscribe`
   ile ana anahtar kapatıldığında bekleyen `setTimeout` iptal edilmeli,
   yoksa panelde kapatılan reklam bir kez daha açılır.

Dışa açılan tek fonksiyon şu imzada olmalı:

```ts
/** İşlem tamamlandıktan sonra çağrılır; 3 sn sonra reklamı dener. */
export function showAdAfterAction(): void
```

**Başlatma:** `mobileAds().initialize()` yalnızca **bir kez**, `App.tsx`
kabuğunda çağrılacak. Sıra önemli: **önce** `tagForChildDirectedTreatment` ve
UMP izni (`AdsConsent`), **sonra** `initialize()` — başlatma sırasında reklam
ön yüklenebildiği için izin daha önce alınmış olmalı.

### Adım 3 — Tetikleyicileri bağla

Bu projede iş kolaylaştı: §"Kaydet" ve "Değişiklikleri Kaydet" butonlarının
**tamamı** zaten tek bir sarmalayıcıdan geçiyor —
`src/core/feedback/useSaveFeedbackStore.ts` → `withSaveFeedback()`. 14 ekran
onu kullanıyor. Reklam tetiğini **oraya tek bir satırla** eklemek, şu
dosyaların hepsini kapsar:

`BottleScreen`, `DiaperScreen`, `SolidScreen`, `PumpingScreen`,
`RemindersScreen` (kaydet + sessiz saat), `VaccinesScreen` (randevu /
yapıldı / takvime ekle), `TasksScreen` (oluştur + değişiklikleri kaydet),
`BabyForm`, `BabiesScreen`, `FamilyScreen` (**Davet Oluştur** dahil),
`ProfileScreen`, `BreastfeedingScreen` (emzirme özeti kaydet),
`SleepScreen` ("Uyandı").

```ts
// useSaveFeedbackStore.ts → withSaveFeedback içinde, succeed(message)'dan sonra
succeed(message);
showAdAfterAction();   // 3 sn sonra; başarısız kayıtta çağrılmaz
```

Şartnamedeki listede olup bu sarmalayıcıdan **geçmeyen üç yer** kaldı; onlar
tek tek bağlanacak:

| Buton | Dosya | Fonksiyon |
|-------|-------|-----------|
| **Tamamlandı** (görev) | `src/modules/tasks/TasksScreen.tsx` | `complete()` — üç `run(...)` dalının her biri |
| **Uykuya Daldı** | `src/modules/sleep/SleepScreen.tsx` | `onStart()` |
| **Sol / Sağ** | `src/modules/breastfeeding/BreastfeedingScreen.tsx` | `onStart(side)` ve `onSwitch(side)` |

Her üçünde de kural aynı: **önce** kayıt/sayaç işlemi (`await`), **sonra**
`showAdAfterAction()`. Reklam çağrısı `await` edilmez ve hatası yutulur.

> **Sol/Sağ için not:** bunlar sayaç başlatma/meme değiştirme butonları.
> Frekans sınırı olmadan tek bir emzirmede 3-4 reklam açılır. §0.1'deki sınır
> asıl burada işe yarıyor.

### Adım 4 — Dokümantasyon

`TEKNIK_DOKUMAN.md`'ye yeni bir bölüm: kütüphane sürümü, config plugin
yapılandırması, `adService` sözleşmesi, frekans sınırı sayıları ve gerekçesi,
güvenlik kapıları, test/canlı kimlik ayrımı. Projenin kuralı: API ve
yapılandırma kararları orada tutuluyor (`AGENTS.md`, şartname §1.2).

### Adım 5 — Test

```bash
npx tsc --noEmit && npx expo lint
```

Emülatörde sırayla doğrula:

1. Bez değişimi → **Kaydet** → kayıt anında düşüyor, onay penceresi 1,6 sn'de
   kapanıyor, **3. saniyede** test reklamı açılıyor (üstünde "Test Ad" rozeti).
2. Reklamı kapat → bir sonraki kayıtta reklam yine hazır (otomatik yeniden
   yükleme çalışıyor).
3. Uçak modunda kaydet → reklam gelmiyor, **kayıt ve onay penceresi normal
   çalışıyor** (en kritik testtir).
4. Arka arkaya 3 kayıt → frekans sınırı devrede, ikinci ve üçüncüde reklam yok.
5. Ninni çalarken kaydet → reklam açılmıyor.
6. Emzirme **Sol → Sağ** → sayaç kesintisiz, reklam sınıra takılıyor.
7. Görev **Tamamlandı** ve **Davet Oluştur** → reklam geliyor.

---

## 3. SENİN KARAR VERMEN GEREKEN AÇIK SORULAR

> **Bu dört sorunun hepsi artık panelden değiştirilebilir bir AYAR**
> (`/admin/ads`, bkz. `TEKNIK_DOKUMAN.md` §7.6). Kod hiçbirini sabit
> tutmuyor, yani karar vermek için derleme beklemek gerekmiyor —
> varsayılanlar §0.3'teki önerilerle geldi:
>
> | Soru | Panel alanı | Varsayılan |
> |------|-------------|------------|
> | Çocuklara yönelik mi? | `child_directed` | **hayır** (18+) |
> | Frekans sınırı | `frequency_minutes`, `session_cap` | **3 dk / oturumda 5** |
> | Kişiselleştirilmiş reklam | `personalized_ads`, `ump_enabled` | **evet, UMP izniyle** |
> | Reklamsız sürüm | `ads_enabled` (sistem geneli kapı) | reklam açık |
>
> Yalnızca "kullanıcı başına reklam kaldırma" (satın alma akışı) hâlâ ayrı
> bir iş — §4'e bakın.

> Bu dört sorunun **benim önerdiğim cevapları** §0.3'te tabloyla duruyor.

1. **Uygulama çocuklara mı yönelik?** Bebiqa'i bebek değil **ebeveyn**
   kullanıyor, yani teknik olarak yetişkin hedefli. Ama Play Console'da
   "hedef kitle" beyanında çocukları da işaretlersen Google Play **Families**
   politikası devreye girer: yalnızca onaylı reklam SDK'ları, kişiselleştirilmiş
   reklam yasağı ve `tagForChildDirectedTreatment: true` zorunluluğu. Yanlış
   beyan uygulamanın mağazadan kaldırılma sebebidir. **Kararı sen vereceksin**,
   kod ona göre ayarlanacak.
2. **Frekans sınırı sayıları** (§0.1): kaç dakikada bir, oturumda en fazla kaç.
3. **Kişiselleştirilmiş reklam mı?** İstiyorsan iOS'ta ATT izni ve EEA'da UMP
   zorunlu; istemiyorsan gelir düşer ama izin yükü hafifler.
4. **Reklamsız sürüm olacak mı?** (ileride satın alma ile kapatma) — şimdiden
   `adService` içine bir `isAdsDisabled()` kapısı koymak, sonradan her
   tetikleyiciyi tek tek bulmaktan ucuz.

---

## 4. BU PLANDA KASITLI OLARAK YAPILMAYANLAR

- **Banner ve ödüllü reklam yok.** Şartname yalnızca geçiş reklamı istiyor.
- **Mediation (AdMob dışı ağlar) yok.** Tek ağ ile başlanacak; mediation
  gelirle birlikte, ayrı bir iş olarak değerlendirilir.
- **Reklam, kaydın başarısına bağlı.** Kayıt hata verirse reklam
  gösterilmez — kullanıcı hatayı okuyamadan ekranı kapatan bir reklam en kötü
  ihtimal.
