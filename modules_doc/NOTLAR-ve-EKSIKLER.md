# Modül Dokümanları — Tespit Edilen Eksikler ve Sapmalar

Bu dosya `modules_doc/` altındaki modül şartnameleri ile **mevcut kod tabanı**
arasında bulduğum tutarsızlıkları, şartnamedeki boşlukları ve bilinçli olarak
farklı uyguladığım noktaları toplar.

Son güncelleme: 2026-11-03 (on üçüncü tur — bildirim sesleri
(`notification-voice.md` §2) uygulandı, Android'de müziğin hiç çalmaması
giderildi, istemciden gömülü yayın adresi kaldırıldı; §4.3 ve §4.4)

---

## 1. Şartname dosyalarındaki sorunlar

### 1.1 `aisle-ve-yetkiler.md` yanlış içerik taşıyordu — **çözüldü**

Dosya adı "Aile ve Yetkiler" modülünü vaat ediyordu, ancak içeriği
`uyku-takibi.md` ile **birebir aynıydı** (ikisi de 61 satır; ilk satırı bile
`**5. Modül olan "Uyku Takibi" (sleep)**` diyordu).

Özgün metin kurtarılamadığı için dosya, **hâlihazırda uygulanmış olan** veri
modeli ve uçlardan geriye dönük yeniden yazıldı. Yani belge kodu değil, kod
belgeyi doğruluyor — özgün şartnamede fazladan bir istek varsa dosyaya
eklenmelidir. Bu uyarı dosyanın başında da duruyor.

Modül 10 artık **uygulandı** (§6).

### 1.2 Modül 3'ün şartnamesi hiç yoktu — **çözüldü**

Modül numaraları 1, 2, **4**, 5… diye atlıyordu. Oysa `bottle` modül
kataloğunda kayıtlıydı, mobilde alt sekmesi **açıktı** ve ekran yalnızca
"yapılacaklar" listesi gösteren bir yer tutucuydu (`ModuleStub`). Yani her
kullanıcı 🍼 Biberon sekmesini görüyor, tıklayınca boş bir vaat listesiyle
karşılaşıyordu.

`modules_doc/biberon.md` yazıldı (yer tutucunun kendi özellik listesi ve mevcut
`feedings` şemasından) ve modül uygulandı. `ModuleStub` bileşeni son
kullanıcısını kaybettiği için silindi.

Geriye numara boşluğu kalmadı: 1–12 arası tüm modüllerin şartnamesi var.

### 1.3 `ek-gida.md` Modül 4 diyor ama katalogda `solid` 4. sırada değil

Önemsiz; yalnızca numaralandırma tutarsızlığı. Kod `module_key` ile çalıştığı
için etkisi yok. **Not:** mobil katalogdaki `sortOrder` değerleri sunucudaki
`modules` tablosuyla hizalanır; güncel sıra orada tutulur
(`pumping` 7, `family` 11, `reports` 12, `tasks` 13, `vaccines` 14).

### 1.4 `bildirimler.md` iki kez, iki farklı şey anlattı

**İlk hâli** (yedinci tura kadar) "8. Modül (Hatırlatıcılar) ve 13. Modül
(Görevler)" için ortak bir geliştirme tanımlıyordu: çoklu zamanlı bildirim +
cihaz takvimi alarmı. Kataloğa yeni modül **eklenmedi**, üç alan
(`notification_offsets`, `device_alarm_ids`, `enable_device_alarm`) var olan
iki tabloya eklendi ve doğrulama tek yerde toplandı (`src/lib/alarms.ts`).
Karşılığı TEKNIK_DOKUMAN §12.5 ve §12.6'dır ve **kaldırılmadı**.

**İkinci hâli** (dokuzuncu tur) aynı dosya adıyla tamamen farklı bir şey
istiyor: **Bildirim Merkezi** — sağ üst köşede zil, okunmamış rozeti,
liste çekmecesi ve deep-link. Karşılığı §22.13'tür.

İkisi birbirinin yerine geçmez ve aynı anda açık:

| | Cihaz bildirimi (§12.5) | Bildirim merkezi (§22.13) |
|---|---|---|
| Nerede durur | Telefonun bildirim gölgesi / takvimi | Sunucudaki `notifications` tablosu |
| Kim görür | Yalnızca o cihaz | Kullanıcının tüm cihazları |
| Ne haber verir | **Senin** kurduğun alarmın vakti geldi | **Başkasının** yaptığı iş |
| Geçmişi | Yok | Var, okundu durumu tutulur |

Bildirim merkezi de kataloğa eklenmedi; gerekçesi §22.13'te (zil kabuk
altyapısı, ızgarada 15. kutu olarak belirmemeli).

### 1.6 `ek-gelistirmeler.md`: zamanlanmış rapor karşılanamadı

Şartname "Haftalık/Aylık özet rapor çıktıları (PDF eki ile)" istiyor. PDF ve
e-posta **yapıldı**; **zamanlanmış** gönderim yapılmadı.

Sunucuda cron/kuyruk altyapısı yok ve eklemek işletim tarafında ayrı bir süreç
gerektiriyor (bu modülün kapsamı dışında). Uç nokta istek üzerine çalışıyor:
`POST /babies/{id}/reports/email`. Zamanlayıcı eklendiğinde aynı fonksiyonu
çağırması yeterli — hesap, PDF üretimi ve gönderim zaten ayrılmış durumda
(`services/reportSummary.ts`, `lib/reportPdf.ts`, `lib/mailer.ts`).

> Şartnamedeki SMTP parolası **belgeye yazılmadı**: yalnızca `.env` dosyasında
> duruyor ve o dosya `.gitignore` içinde. `.env.example` değişken adlarını
> belgeliyor, değer taşımıyor.

### 1.5 Karşılanamayan tetikleyici: "hatırlatıcı süresi geldiğinde"

`bildirimler.md` merkezi bildirim servisinden bunu da istiyor. **Sunucuda
zamanlayıcı yok**: hatırlatıcılar cihazda planlanıyor
(`core/notifications/scheduler.ts`) ve push altyapısı da yok. Sunucu bir
hatırlatıcının ne zaman çaldığını bilmiyor, bilse bile haber veremez.

Karşılanabilen kısım uygulandı: aileden biri hatırlatıcı **kurduğunda**
diğerleri haber alıyor. Gerçek "çaldı" bildirimi, sunucu tarafı push
eklendiğinde anlamlı olur (§19).

---

## 2. Mimari sapmalar (bilinçli)

### 2.1 Uç nokta biçimi: `/sleep?baby_id=` yerine `/babies/{id}/sleep`

**Şartname:** `GET /api/v1/sleep?baby_id=:babyId`
**Uygulanan:** `GET /api/v1/babies/{babyId}/sleep`

**Neden:** Bebek kimliği sorgu parametresi olarak gelirse her uçta elle yetki
kontrolü yazmak gerekir ve biri unutulduğunda **yatay yetki ihlali** oluşur.
Mevcut mimaride bebek bağlamı yola gömülüdür ve `requireBaby('viewer'|'editor'|
'owner')` ara katmanı **tek noktadan** uygular; üye olunmayan bebekte varlık
sızdırmamak için `404` döner (TEKNIK_DOKUMAN.md §5.5).

Şartnamedeki düz biçime geçmek, çalışan ve dokümante edilmiş bir güvenlik
modelini zayıflatırdı. İşlevsellik aynı, yalnızca adres biçimi farklı.

### 2.2 Enum değerleri Türkçe

Şartname `'wet' | 'dirty' | 'both' | 'dry'` gibi İngilizce enum'lar istiyor;
veritabanında `'cis' | 'kaka' | 'karisik' | 'kuru'` var ve **veri mevcut**.
Değiştirmek göç + veri dönüşümü gerektirir, işlevsel kazanç yoktur. Eşleme:

| Şartname | Veritabanı |
|----------|------------|
| `wet` / `dirty` / `both` / `dry` | `cis` / `kaka` / `karisik` / `kuru` |
| `night_sleep` / `nap` | `night` / `nap` |
| `peaceful` / `restless` / `frequent_waking` | `rahat` / `huzursuz` / `sik_uyandi` |

### 2.3 `id` alanları UUID değil BIGINT + ayrı `sync_uuid`

Şartname her modelde `id (UUID)` istiyor. Şema, birincil anahtar olarak
`BIGINT AUTO_INCREMENT` ve **ayrıca** çevrimdışı oluşturulan kayıtlar için
`sync_uuid CHAR(36)` tutar. Bu, offline-first senkronizasyonun gereği
(§2.1): istemci kaydı ağ yokken üretir, sunucu kendi id'sini atar, ikisi
`sync_uuid` üzerinden eşleşir. Tek UUID anahtar, InnoDB'de kümelenmiş indeks
parçalanmasına yol açardı.

### 2.4 Toplam alanlar saklanmıyor, türetiliyor

Şartname `total_duration_seconds` (emzirme) ve `total_amount` (sağma) gibi
toplam sütunları istiyor. Bunlar **saklanmaz**, okunurken hesaplanır: saklanan
toplam, parçalar güncellendiğinde sessizce tutarsızlaşır ve iki doğruluk
kaynağı oluşur.

### 2.5 Biberonun kendi tablosu yok

`bottle`, `breastfeeding` ve `solid` aynı `feedings` tablosunu paylaşır ve
`feed_type` ile ayrılır. Böylece "günde toplam kaç ml aldı" tek sorguyla
yanıtlanır; üç ayrı tabloda aynı soru üç UNION isterdi.

---

## 3. Şartnamede belirtilmemiş, karar gerektiren noktalar

| Konu | Soru | Şimdilik yapılan |
|------|------|------------------|
| Emzirme `end_time` | Şartname "Zorunlu" diyor ama canlı kronometre sırasında kayıt henüz bitmemiştir | Çalışan seans `status='running'` ile tutulur, `ended_at` NULL kalır |
| Süt stoğu birimi | `ml/oz` yazıyor, hangisi kanonik? | **ml** saklanır; oz gösterimde çevrilir |
| `is_used` stok düşümü | Kısmi tüketim olabilir mi? | Hayır — tüm kayıt kullanıldı olarak işaretlenir |
| Raporlar PDF | Sunucuda mı istemcide mi üretilecek, şablon nasıl? | **Yapılmadı**, bkz. §4 |
| Hatırlatıcı tekrarı | `recurrence_interval_hours` ile mevcut `interval_minutes` + `fixed_times` çakışıyor | Mevcut (daha zengin) şema korundu |
| Müzik `is_favorite` | Favori kullanıcıya mı parçaya mı ait? | **Kullanıcıya** — parça üzerinde tek bayrak olsaydı bir kullanıcının favorisi herkesi etkilerdi |
| Biberonda su | Sıvı alımı ml toplamına girer mi? | **Hayır** — ayrı sayılır; beslenme değil sıvı alımıdır |
| Bildirim ufku | Açık tarihli planlama kaç gün ileri gitsin? | **7 gün**; uygulama her ön plana gelişinde yenilenir (§4.1) |

---

## 4. Yapılmayan işler ve gerekçeleri

| İş | Neden |
|----|-------|
| ~~Aile ve Yetkiler modülü~~ | **Yapıldı.** Şartname yeniden yazıldı (§1.1), mobil arayüz eklendi. |
| ~~Biberon modülü (3)~~ | **Yapıldı.** Şartname yazıldı (§1.2), yer tutucu gerçek ekranla değiştirildi. |
| ~~Hatırlatıcı yerel bildirimleri~~ | **Yapıldı.** `expo-notifications` + sessiz saat uçları + planlayıcı. Sınırları §4.1'de. |
| ~~Ana ekran özet değerleri~~ | **Yapıldı.** `/reports/summary?period=daily` ve `/feedings/daily-summary` paralel çekiliyor; kutular ilgili modül kapalıysa çizilmiyor (TEKNIK_DOKUMAN §9.6). |
| **Raporlar — PDF dışa aktarma** | Sunucuda PDF üretimi yeni bağımlılık (puppeteer/pdfkit) ve şablon tasarımı gerektirir; şartnamede şablon/içerik tanımı yok. Özet ve trend uçları yapıldı. |
| ~~Canlı sayaç bildirimi (`bildirimler.md` → Ek geliştirme)~~ | **Yapıldı.** Emzirme, uyku ve sağma sayaçları kilit ekranında kalıcı bir bildirim tutuyor; duraklat/devam/bitir düğmeleri bildirimden çalışıyor. Yeni native bağımlılık eklenmedi, ayrıntı ve sınırlar §4.2 ile TEKNIK_DOKUMAN §12.7. |
| ~~Süt sağma kronometresi~~ | **Yapıldı.** `sut-sagma.md` istiyordu ama ekran yalnızca miktar formuydu ve `duration_sec` hep boş kalıyordu. Kronometre yerel (şema v6, `local_timer`), çünkü sağmanın sunucuda açık oturumu yok. |
| ~~Beslenme modüllerinin ızgarada birleştirilmesi~~ | **Yapıldı (arayüz katmanı).** Emzirme, biberon, ek gıda ve sağma ana ekran ızgarasından kaldırılıp tek **Beslenme** kutusunun altında sekme oldu. `beslenme.md` §0.2'deki **B seçeneği** uygulandı: dört anahtar katalogda `parent: 'feeding'` ile duruyor, panelden tek tek açılıp kapanabiliyor. Veri modeli birleştirmesi (tek `feedings` şeması, `details` JSON) **yapılmadı** — bkz. aşağıdaki satır. TEKNIK_DOKUMAN §9.12. |
| **Beslenme — veri modeli birleştirmesi** | `beslenme.md` ayrıca tek şema, `details` JSON'u, sağmanın `feedings`'e taşınması ve ortak sayaç yetki istisnası istiyor. Hiçbiri yapılmadı; şartnamedeki riskler (üretilen `amount_ml` sütunu, `v_timeline`, sağmada çift sayım) orada yazılı. Şimdiki değişiklik yalnızca gezinmeyi birleştiriyor, veriyi değil. |
| **Beslenme modülü sunucu kataloğunda yok** | `feeding` anahtarı mobil katalogda var, sunucudaki `modules` tablosunda yok. İstemci bilinmeyen anahtarı varsayılanıyla açık saydığı için çalışıyor, ama panelden **Beslenme'nin kendisi** kapatılamıyor (alt modülleri kapatılabiliyor). Sunucuya satır eklenince düzelir (TEKNIK_DOKUMAN §4.4). |
| ~~Etkinlik hatırlatıcısı — çoklu gün uyarısı ve yüksek ses~~ | **İstemci tarafı yapıldı.** Kategori `event` seçilince form ad + tarih + saat + "Ne zaman uyarılsın" (14/7/2/1 gün önce, aynı gün — hepsi birden seçilebilir) hâline geliyor; uyarılar ayrı `events` kanalından **alarm akışıyla** çalıyor. Planlama aşı/görev yoluna taşındı, ufuk 120 güne çıktı. TEKNIK_DOKUMAN §12.6. **Sunucu değişikliği bekliyor** → aşağıdaki satır. |
| ~~Hatırlatıcıda ofset tavanı 1440 dakika~~ | **Yapıldı.** Sunucuda `src/lib/alarms.ts` üçüncü bir kademe kazandı: `reminderAlarmFields` tavanı **20160** (14 gün). Görev 1440'ta kaldı, aşı 40320'de. Kademeler `src/lib/alarms.test.ts` ile sabitlendi (10 kontrol). |
| ~~Hatırlatıcıda açıklama sütunu yok~~ | **Yapıldı.** `migrations/018_reminder_description.sql` → `description VARCHAR(250) NULL`; uç oluşturma/güncelleme şemalarına ve yanıt biçimine eklendi. Göç yerel veritabanına uygulandı; 250 karakterlik Türkçe metnin kesilmeden döndüğü geri alınan bir işlemle doğrulandı. |
| **iOS'ta "çok yüksek" ses** | Bildirim sistemin zil düzeyinden çalar, uygulama bunu aşamaz; `critical` uyarı Apple onayı ister. İstemci `interruptionLevel: 'timeSensitive'` gönderiyor (Odak kipini deler) ama etkin olması için `com.apple.developer.usernotifications.time-sensitive` yetkisi ve yeni bir derleme gerekiyor. Android'de alarm akışı kullanıldığı için orada gerçekten yüksek. |
| ~~Raporlarda serbest tarih aralığı~~ | **Yapıldı.** Özet ve eğilim uçları `start_date`/`end_date` alıyor; pencere `resolveRange()` ile tek yerde çözülüyor ve yanıtta geri dönüyor. Tavan 92 gün. Mobilde ekranın en üstünde iki tarih kutusu + hızlı aralık çipleri; özet ile grafik artık aynı pencereyi kullanıyor (TEKNIK_DOKUMAN §22.8). |
| ~~Verileri sıfırla~~ | **Yapıldı.** `DELETE /babies/{id}/data` (yalnızca owner), kalıcı silme, silme sırası elle yazıldı. Mobilde Ayarlar ekranının en altında onay penceresi; birden fazla bebek varsa hangisinin verisi silineceği soruluyor. Profil ve aile üyeleri kalır (TEKNIK_DOKUMAN §22.7.1). |
| ~~Kayıt ve şifre sıfırlama e-postası~~ | **Yapıldı.** `welcomeMail` ve `passwordResetMail` eklendi; `forgot-password` artık kodu e-postayla gönderiyor ve hesabın varlığını sızdırmamak için her durumda `sent: true` dönüyor. Aile daveti postası zaten vardı (TEKNIK_DOKUMAN §22.14). |
| **Canlı sayaç — Dynamic Island ve akan kronometre** | Metin saniye saniye akmıyor; gerekçesi ve yükseltme yolu §4.2. |
| ~~Müzik — ekrandan çıkınca susuyordu~~ | **Düzeltildi.** Çalar `MusicScreen` içinde `useAudioPlayer` ile kuruluyordu; o kanca nesneyi bileşen söküldüğünde serbest bırakıyor, yani ana sayfaya dönmek ninniyi susturuyordu (navigasyonla eş zamanlı `ExoPlayerImpl: Release` ölçüldü). Çalma oturumu `core/music/useMusicStore.ts`'e taşındı: `createAudioPlayer` ile elle yönetiliyor, hiçbir bileşenin ömrüne bağlı değil. Uyku zamanlayıcısı da oraya taşındı — ekranda kalsaydı başka ekrana geçmek onu iptal ederdi. Emülatörde doğrulandı: uygulamadan çıkıldığında `state=PLAYING(3)`, bildirimden duraklat/devam çalışıyor, **Durdur** oturumu ve foreground servisi tamamen kaldırıyor (TEKNIK_DOKUMAN §22.5.3). |
| ~~Müzik — bildirimde ayrı "Kapat" düğmesi yok~~ | **Eklendi.** `expo-audio` medya kartına özel düğme (Media3 `CommandButton`) eklemeyi dışarı açmıyor ve Kotlin'ini yamalamak her yükseltmede bozulacağı için reddedildi. Onun yerine çaların **kendi** bildirimi eklendi (`core/music/musicNotice.ts`) — canlı sayaç bildirimiyle aynı desen: **Duraklat / Devam et** ve **Kapat** düğmeleri. Emülatörde doğrulandı: Duraklat → `PAUSED(2)` ve satır "Ninni duraklatıldı"ya dönüyor, Devam et → `PLAYING(3)`, Kapat → çalar ve medya oturumu serbest, foreground servis kalkıyor, iki bildirim de gidiyor. **Bedeli:** çalarken gölgede iki satır olur; sistem medya kartı silinemiyor (foreground servisin kendisi) ama işlevsiz kopya değil — kilit ekranı ve Bluetooth/kulaklık denetimleri ondan geliyor (TEKNIK_DOKUMAN §22.5.4). |
| ~~Müzik — kilit ekranı kontrolleri~~ | **Yapıldı.** `player.setActiveForLockScreen(true, …)` çağrılıyor ve kesme kipi `doNotMixPersistent`e çekildi — Expo belgesi, kilit ekranı denetimleri olmadan Android'de sesin ~3 dk sonra kesildiğini söylüyor ve denetimler yalnızca `doNotMix`/`doNotMixPersistent` ile çalışıyor. Sonraki/önceki düğmeleri kapalı: çalar tek parça çalıyor, oynatma listesi yok (TEKNIK_DOKUMAN §22.5.3). |
| ~~Müzik — Android'de hiç çalmaması~~ | **Çözüldü.** Kök neden: uç yalnızca `PUBLIC_BASE_URL` önekli **mutlak** adres döndürüyordu (`http://bebektakip.test/uploads/...`) ve bu konağı ne emülatör ne fiziksel telefon çözebiliyor. İndirme DNS aşamasında düşüyor, `status.error` da hiç okunmadığı için ekran "Çalıyor" yazıp 0:00'da duruyordu — kullanıcıya sessiz bir çalardan ayırt edilemez. Uç artık göreli `audio_path` döndürüyor, istemci onu kendi origin'ine ekliyor, `assets.ts` tanınmayan origin'lerden gelen `/uploads/` adreslerini de taşıyor ve çalma hatası ekranda gösteriliyor (TEKNIK_DOKUMAN §22.5.1). |
| ~~Müzik — 2 saatlik / 172 MB'lık kayıt~~ | **Dönüştürüldü (2026-11-03).** 192 kbit/s stereo → **64 kbit/s mono**: 172,7 MB → 57,5 MB, süre birebir korundu. Gömülü kapak görseli atıldı (ses verisinden önce inip ilk sesi geciktiriyordu), Xing başlığı yazıldı (ExoPlayer süre ve atlama konumunu oradan okuyor), kaynaktan kalma çöp etiketler temizlendi. Özgün dosya `backups/` altında — `uploads/` **dışında**, çünkü orada bırakılan yedek kimlik doğrulaması olmadan indirilebiliyordu. Komut ve gerekçeler TEKNIK_DOKUMAN §22.5.2. **Hâlâ 57,5 MB:** iki saatlik bir kayıt için bu alt sınır; asıl çözüm kısa ve döngüye uygun bir kayıt. |
| ~~Müzik — parça süresi hep boş~~ | **Yapıldı.** `duration_sec` göçün ilk gününden beri şemadaydı ama yükleme ucu doldurmuyordu; çalar `0:00 / 0:00` gösteriyordu. Süre artık yüklemede dosyadan okunuyor (`lib/audioMeta.ts` — bağımlılıksız mp3/wav/m4a/ogg ayrıştırıcısı, 9 vitest kontrolü). Eski satırlar için `scripts/backfill-audio-meta.ts`. Panel süreyi ve bit hızını listeliyor, ağır dosyada uyarıyor (TEKNIK_DOKUMAN §22.5.2). |
| ~~Canlı sayaç bildirimi yanlış kanala düşüyordu~~ | **Düzeltildi.** `showTimerNotice` `trigger: null` kullanıyordu; anında teslim ediyordu ama **kanal belirtmediği için** Android bildirimi `expo_notifications_fallback_notification_channel`'a düşürüyordu (emülatörde `dumpsys notification` ile görüldü). Sonuç: kurulan `live_timer` kanalı hiç kullanılmıyor, durum satırı LOW yerine **HIGH** önemle gösteriliyor (heads-up kart riski) ve kullanıcının "Çalışan kronometre" kanalında yaptığı ayar hiçbir şeye etki etmiyordu. `ChannelAwareTriggerInput` (`trigger: { channelId }`) tam bunun için var: yine anında teslim eder, kanalı seçer. Doğrulandı: `channel=live_timer`, `importance=2`. |
| ~~Bildirim sesleri (`notification-voice.md` §2)~~ | **Yapıldı.** Sekiz mp3 pakete gömüldü (`assets/notification/` → `app.json` → `sounds`), kanallar `_v2` kimlikleriyle yeniden kuruldu ve her biri kendi sesini taşıyor; tekrar sayıları, periyodik sayaç uyarıları (5 dk / 30 dk) ve gecikmiş görev döngüsü uygulandı; dokunuşta ses anında kesiliyor. Bilinçli sapmalar §4.3'te (TEKNIK_DOKUMAN §12.8). |
| **Görev atamasında KARŞI TARAFIN cihazına bildirim** | Şartnamede "gerekirse" diye geçiyor. Sistemde **sunucudan cihaza itilen** bildirim altyapısı hiç yok: tüm bildirimler `expo-notifications` ile **yerelde** planlanıyor (§4.1). `devices.push_token` sütunu duruyor ama hiçbir yer onu okumuyor; uçtan uca push için FCM/APNs kimlik bilgileri ve bir EAS projesi gerekir. Bunun yerine atanan kişi görevi **listesinde ve ana ekranındaki "Bugünün Görevleri" bölümünde** görür; ayrıca görev **kendi cihazında** açıldığında 30/15/5/0 dk uyarıları ve istenirse telefon takvimine etkinlik kurulur (§12.6). Eksik olan tek şey, görevi oluşturan kişinin karşı tarafın cihazını **anında** uyandırabilmesi. |
| **Mobilde test koşucusu** | Mobil projede jest/vitest yok. Sessiz saat tarih matematiği scratchpad'deki `quiet_logic_test.mjs` ile doğrulandı (38 kontrol); canlı sayaç modeli `live_timer_test.mjs` ile (35 kontrol). Periyodik uyarı hesabı artık **depoda** duruyor: `npm test` → `scripts/tests/tick-plan.test.mjs` (19 kontrol, düz Node). Kalıcı koşucu eklenirse `quietHours.ts`, `liveTimer.ts` ve `tickPlan.ts` ilk adaylar — üçü de native import'suz, saf fonksiyonlardan oluşuyor. |

### 4.1 Bildirim planlayıcısının bilinçli sınırları

- **7 günlük ufuk.** Sessiz saat devredeyken tekrar eden tetikleyici
  kullanılamaz (güne göre değişemez), bu yüzden her tekrar tek tek planlanır.
  Uygulama 7 gün hiç açılmazsa alarmlar tükenir. Her ön plana gelişte yeniden
  planlandığı için pratikte sorun değil.
- **56 bildirim üst sınırı.** iOS 64'te kesip fazlasını *sessizce* atar; en
  yakın zamanlılar korunacak şekilde kendimiz kırpar ve kırpılan sayıyı
  ekranda gösteririz. Emülatörde doğrulandı: 3 saatlik aralık + 2 sabit saat
  + gece sessiz saati → 70 tekrarın 56'sı planlandı, 21'i ertelendi, 14'ü
  kırpıldı; üçü de kullanıcıya yazıldı.
- **`anchor: 'last_record'` yaklaşıktır.** Başlangıç noktası sunucunun
  `next_trigger_at` değeridir, yoksa "şimdi + aralık". Kayıt girildikten
  sonraki ilk eşitleme doğru noktaya taşır.
- **Tam zamanlı alarm istenmiyor.** `SCHEDULE_EXACT_ALARM` Android 14'te
  varsayılan olarak reddedilir ve Play yalnızca alarm/takvim uygulamalarına
  açar. `bestEffort` teslim alarmın birkaç dakika kaymasına yol açabilir.
- **Haftanın bazı günlerine özel sessiz saat** sunucuda ve planlayıcıda
  destekleniyor (`days_mask`); mobil formda gün seçici de var.

### 4.2 Canlı sayaç bildiriminin bilinçli sınırları

Özellik çalışıyor (TEKNIK_DOKUMAN §12.7): üç sayaç için kilit ekranında kalıcı
satır, üstünde duraklat/devam/bitir. Şartnamedeki iki başlık **farklı**
uygulandı ve ikisinin de gerekçesi var.

**1. Sayaç saniye saniye akmıyor.** Metin durum değişiminde ve uygulama ön
plan/arka plan geçişlerinde yenileniyor; arada "14:32'den beri · 23 dk" gibi
başlangıç anına demirlenmiş kalıyor. Arka planda JavaScript çalışmadığı için
daha sık yenilemek mümkün değil. Dakika dakika bildirim planlamak da çözüm
değil: bekleyen her güncelleme ayrı kimlik gerektiriyor (aynı kimlikli ikinci
*planlı* istek öncekini iptal ediyor), ayrı kimlikler ise yerinde güncelleme
yerine üst üste birikme üretiyor — üstelik iOS'un 64'lük bekleyen bildirim
sınırını yiyip hatırlatıcıları dışarı iterdi (§4.1).

**2. Dynamic Island / Live Activity yok.** Şartname `ActivityKit` istiyordu.
Yükseltme yolu belli: **`expo-widgets`** (SDK 58'de `~58.0.26`) Live
Activity'leri TSX ile tanımlamayı sağlıyor (`createLiveActivity`, bölgeler
`compactLeading` · `compactTrailing` · `minimal` · `expandedCenter`…) ve
Android için `createCustomNotification` ile `ongoing` seçeneğini veriyor. Swift
yazmak gerekmiyor, uzantı hedefini config plugin üretiyor.

Şimdilik eklenmedi, çünkü:

- **Yeni native yüzey.** `expo-widgets` + `@expo/ui`, bir widget uzantısı
  hedefi, App Group yapılandırması ve **yeni bir development build** demek
  (Expo Go'da yok). Mevcut çözüm hiçbir native değişiklik istemiyor; kanal ve
  kategoriler çalışma zamanında kuruluyor.
- **İstenen iki şey belgesiz.** Live Activity içinde kendi kendine akan bir
  kronometre (SwiftUI'deki `Text(timerInterval:)` karşılığı) ve etkinlik
  üstündeki düğmelerin JS'e ulaşması dokümanda tanımlı değil. Düğme mekanizması
  yalnızca ana ekran widget'ları için yazılı. Yani asıl iki gereksinimin
  karşılanacağı garanti değil ve bu ancak cihazda ölçülerek anlaşılır.
- **Sıra.** Sunucudan cihaza push altyapısı hâlâ yok (§4 tablosu); Live
  Activity'nin uzaktan güncellenmesi de onu istiyor. İkisi birlikte
  planlanmalı.

**3. Bildirim düğmeleri uygulamayı açıyor.** `opensAppToForeground: false`
seçilse, uygulama öldürülmüşken yanıt dinleyicisi hiç çalışmıyor (paketin tip
dokümanı bunu açıkça yazıyor). Arka planda işlem yapmak `expo-task-manager` +
`registerTaskAsync` (yalnızca Android) ya da bir foreground service istiyordu.
Düğmeye basınca uygulamanın açılıp işlemi hemen uygulaması, her iki platformda
ve her durumda kesin çalışan davranış — emzirmeyi bitirmek zaten uygulamayı
açmak istiyor, çünkü aktif süre düzeltme penceresi bildirime sığmaz (§10.2.1).

---

### 4.3 Bildirim seslerinin bilinçli sınırları

Şartname `modules_doc/notification-voice.md` §2'de yazılı; aşağıdaki üç nokta
**bilerek** farklı uygulandı ve gerekçeleri teknik.

- **Tekrar sayısı yalnızca uygulama ön plandayken uygulanır.**
  İşletim sistemine teslim edilen bir bildirimin sesi bir kez çalar. "4 tekrar"
  için 4 ayrı bildirim planlamak gerekirdi ve iOS bekleyen bildirimleri 64'te
  kesip fazlasını **sessizce** atıyor (`MAX_SCHEDULED`, §4.1). Ön planda
  bildirim işleyicisi sistem sesini bastırıyor (`shouldPlaySound: false`) ve
  tekrarı `expo-audio` çalıyor; arka planda kanal sesi tek seferlik duyuluyor.
  Uyarı kaybolmuyor, bildirim gölgede duruyor.

- ~~**Gecikmiş görev: 5 dakikalık döngünün tamamı yalnızca uygulama
  ayaktayken.**~~ **Kapatıldı.** 288 tarihli bildirim yerine **süresiz tekrar
  eden** tek bir tetikleyici kuruluyor (`TIME_INTERVAL`, 300 sn,
  `repeats: true`); tekrar eden tetikleyiciler `MAX_SCHEDULED` bütçesinin
  dışında olduğu için bütçeden yalnızca bir yer alıyor ve uygulama kapalıyken
  de çalıyor. Görev henüz gecikmemişken tetikleyici kurulamadığı için
  (kurulduğu andan sayar) görev saatinden sonrası için 5/10/15/20/25/30/45/
  60/120/240/360. dakikalara tarihli bir emniyet ağı planlanıyor. Açık
  görevler ayrıca `task_live` kanalında **kalıcı** bir satır alıyor
  (`taskNotice.ts`). Ayrıntı: TEKNIK_DOKUMAN §12.8.
  **Kalan sapma:** Android Doze, telefon uzun süre hareketsizken kesin
  alarmları ~9–15 dakikaya seyreltir; ritim o pencerede 5 dakikanın üstüne
  çıkabilir. Tam ritim ön plan servisi (yeni native bağımlılık) ister.

- **Periyodik sayaç sesleri arka planda durur.**
  JavaScript arka planda çalışmıyor. Beslenme (5 dk) ve uyku (30 dk) uyarıları
  uygulama ön plandayken çalıyor; geri dönüldüğünde geçen süreye göre yeniden
  hizalanıyor (aralık sayacın başlangıcına demirli, `tickPlan.ts`). Kilit
  ekranındaki canlı sayaç bildirimi (§4.2) bu boşlukta süreyi göstermeye devam
  ediyor.

Ayrıca iki **kurulum** notu:

- **Kanal kimlikleri `_v2` oldu.** Android'de kanalın sesi oluşturulduktan
  sonra uygulama tarafından değiştirilemiyor; eski kimliklere yazılan ses,
  uygulamayı daha önce kurmuş kimseye ulaşmazdı. Eski kanallar cihazda kalıyor
  ve sessizleşiyor — silinseydi kullanıcının o kanalda yaptığı ayar da
  sessizce silinirdi. `app.json` → `defaultChannel` de güncellendi.
- **Ses eklemek yeniden derleme gerektirir.** `sounds` dizisi derleme zamanı
  bir kaynak kopyalama adımı: `npx expo prebuild --platform android` ardından
  `npx expo run:android`. Ad dizide yoksa Android kanalı sessiz oluşturuyor ve
  **hata vermiyor**; bu yüzden tablo ile katalog tek kaynaktan besleniyor
  (`soundCatalog.ts`).

### 4.4 İstemcide gömülü yayın adresi kaldırıldı

`src/core/config.ts` içindeki `DEFAULT_ORIGIN` sabiti (canlı sunucu adresi)
silindi. İki sorun üretiyordu: `.env.local` kopyalanmayı unutulduğunda
geliştirme derlemesi **sessizce canlı veriye** bağlanıyordu, ve yayın adresi
bir dağıtım ayarı olmasına rağmen kaynak kodda duruyordu.

Artık değişken verilmezse platforma göre yerel sunucu varsayılıyor (Android
`http://10.0.2.2:4000`, iOS/web `http://localhost:4000`).

**Yan etki — dikkat:** `EXPO_PUBLIC_API_URL` verilmeden alınan bir **yayın**
derlemesi yerel sunucuyu gösterir ve hiçbir istek çalışmaz. Adres
`eas.json` → `build.<profil>.env` içinde ya da bir EAS ortam değişkeniyle
tanımlanmalı. `config.ts` bu durumda konsola açık bir uyarı yazıyor;
fırlatmıyor, çünkü uygulamayı hiç açılmaz hâle getirmek hatayı görmesi gereken
kişiye bir ipucu bile vermezdi.

---

## 5. Şartnameye göre eklenen alanlar

Mevcut şema şartnamenin istediğinden **zengindi**; eksik olanlar eklendi:

| Modül | Eklenen |
|-------|---------|
| Emzirme | `total_elapsed_sec`, `adjusted_active_sec` — aktif/pasif ayrımı (§10.2.1) |
| Uyku | `wake_reason` |
| Bez | `rash_status` (3 seviyeli; eski `has_rash` boolean'dan taşındı) |
| Ek gıda | `food_category`, `reaction`, `is_three_day_rule`, porsiyon birimleri |
| Süt sağma | Tablo tamamen yeni (`pumping_sessions`) |
| Biberon | `feedings/daily-summary` ucu; `type` filtresi çoğul tip alıyor |
| Hatırlatıcı | `quiet_hours` CRUD uçları (tablo vardı, **hiçbir uç okumuyordu**) |

Ayrıntılar ve istek/yanıt örnekleri `TEKNIK_DOKUMAN.md` içindedir.

---

## 6. Uygulanan modüller

| Modül | Backend | Doküman | Mobil |
|-------|:-------:|:-------:|:-----:|
| 1 — Bebek Profilleri | ✅ | §14 | ✅ |
| 2 — Emzirme Sayacı | ✅ | §22.1 | ✅ |
| 3 — Biberon | ✅ | §22.0.2 | ✅ |
| 4 — Ek Gıda | ✅ | §22.2 | ✅ |
| 5 — Uyku Takibi | ✅ | §22.3 | ✅ |
| 6 — Bez Değişimi | ✅ | §22.4 | ✅ |
| 7 — Ninni & Müzik | ✅ | §22.5 | ✅ (kilit ekranı kontrolü hariç) |
| 8 — Hatırlatıcılar | ✅ | §22.6 | ✅ |
| 9 — Günlük Akış | ✅ | §22.7 | ✅ |
| 10 — Aile ve Yetkiler | ✅ | §5, §22.10 | ✅ |
| 11 — Raporlar | ✅ | §22.8 | ✅ (PDF hariç) |
| 12 — Süt Sağma | ✅ | §22.9 | ✅ |
| 13 — Görevler | ✅ | §22.11 | ✅ |
| 14 — Aşı Takibi | ✅ | §22.12 | ✅ |
| Çoklu bildirim + cihaz alarmı | ✅ | §12.5, §12.6 | ✅ |
| Bildirim Merkezi | ✅ | §22.13 | ✅ |
| E-posta servisi (SMTP) | ✅ | §22.14 | — (sunucu tarafı) |
| Fotoğraf: doğrudan yükleme | ✅ | §22.14 | ✅ (kamera + galeri) |
| Hatırlatıcı: `event` + esnek tekrar | ✅ | §22.14 | ✅ |

**Bez modülü mobilde hiç yoktu**; modül kataloğuna eklendi.
**Biberon mobilde yer tutucuydu**; gerçek ekranla değiştirildi.
**`family` anahtarı mobil katalogda hiç yoktu**; `useModuleStore` sunucudan
gelen bu anahtarı "bilinmeyen" sayıp atıyordu.

### Yol boyunca bulunan ve düzeltilen hatalar

1. **Kısmi güncelleme veri kaybı** (tüm kayıt modülleri). zod'un `.default()`
   değerleri `.partial()` sonrasında da uygulandığı için, yalnızca notu
   güncelleyen bir istek `sleep_type`'ı `night`→`nap`, `wake_count`'u 3→0,
   `gender`'ı `kiz`→`belirtilmedi` yapıyordu. Her modülde gerileme testi var.
2. **`amount_ml` üretilen sütunu** hacim dışı birimleri de mililitre sayıyordu;
   2 kaşık mama rapordaki süt toplamına 2 ml olarak giriyordu.
3. **`IN (?)` dizi genişletmesi** hazır ifadelerle (`execute`) çalışmıyor;
   alerji sorgusu daima boş dönüyordu. Biberonun çoğul tip filtresinde aynı
   tuzağa düşmemek için yer tutucular elle üretiliyor.
4. **Panel CSRF reddi 403 yerine 500 dönüyordu.** `checkCsrf` düz bir `Error`
   fırlatıyor, `errorHandler` yalnızca `AppError`'ı tanıyordu. İstek yine
   reddediliyordu (güvenlik açığı değil) ama tüm panel POST uçlarını
   etkiliyor ve log'a sahte "beklenmeyen hata" yazıyordu. Bkz.
   TEKNIK_DOKUMAN §7.4.
5. **Panel giriş sayfası flash mesajını yutuyordu.** `login.ejs` head
   partial'ına `flash: null` geçiyor, ara katman ise flash'ı oturumdan
   siliyordu; oturum öncesi hiçbir bildirim görünmüyordu.
6. **Geri dönüş yolunda köken doğrulanmıyordu.** `Referer`'ın yalnızca yoluna
   bakmak yetmezdi: `https://kotu-site.example/admin/x` de `/admin` ile
   başlar ve saldırgan kurbanı kendi seçtiği panel yoluna sürükleyebilirdi.
   Artık köken de doğrulanıyor (birim testi var).
7. **Elle girilen kayıtta süre türetilmiyordu.** `duration_sec` yalnızca
   kronometre yolunda hesaplanıyordu; başlangıç ve bitişi olan elle girilmiş
   bir kayıt `NULL` süreyle kalıyor ve **günlük özet toplamlarına hiç
   girmiyordu**. Ekranda saatler doğru görünürken "bugün N saat uyudu" rakamı
   eksik çıkıyordu. Kayıt detay raporu "Süre: 0 dk" derken başlangıç-bitişin
   dokuz saat arayla durması ortaya çıkardı. Hem `sleep_records` hem
   `feedings` için düzeltildi (TEKNIK_DOKUMAN §22.0.1).
8. **Denetim alanları istemciye ulaşmıyordu.** Sunucu `actor_name`,
   `actor_relationship`, `entry_source`, `created_at`, `updated_at`
   gönderiyordu ama istemci tipleri bilmediği için hiçbir ekranda
   kullanılamıyordu. `AuditFields` olarak tanımlandılar; kayıt detay raporu
   "kim, ne zaman, nasıl girdi" sorusunu artık yanıtlıyor.
9. **Emzirme ekranı sunucunun döndürmediği alan adlarını bekliyordu.**
   `left_sec`, `active_sec`, `segment_started_at`, `current_side` — hiçbiri
   yanıtta yok. Servis `Record<string, unknown>` tiplendiği ve ekran
   körlemesine dönüştürdüğü için derleyici yakalayamadı. Kronometre birikmiş
   süreyi hep 0 sayıyor (meme değişiminden sonra baştan sayıyordu), açık taraf
   bilinmiyor, oturum özetinde sol/sağ sıfır görünüyordu. `ActiveBreastSession`
   tipi eklendi (TEKNIK_DOKUMAN §10.2.1).
10. **Geçmiş listesi seans kimliğini döndürmüyordu.** `id` feeding kimliğiydi;
   seans uçları `breastfeeding_sessions.id` ister. Sonradan düzeltme `404`
   dönüyordu. Artık ikisi de dönüyor, gerileme testi var.
11. **"Güncellendi" satırı hiç düzenlenmemiş kayıtlarda da çıkıyordu.**
   `updated_at !== created_at` karşılaştırması, transaction içinde milisaniye
   farkla yazılan satırlarda yanlış pozitif veriyordu.
12. **Yetki seviyesi cihazda saklanmıyordu.** `GET /babies` her satırda
   `my_permission` döndürüyordu ama yerel ayna şemasında yalnızca `is_owner`
   vardı. Sonuç: davet koduyla katılan **salt okuyan** bir üyeye de "Düzenle"
   düğmesi ve dolu kayıt formları gösteriliyordu. Sunucu bunları reddederdi —
   ama varlık sızdırmamak için dönen `404` ("Kayıt bulunamadı") kullanıcıya
   anlamsız gelirdi. v5 göçüyle `my_permission`, `owner_name`, `member_count`
   eklendi (TEKNIK_DOKUMAN §9.9.1).
13. **API typecheck 3 hatayla kırmızıydı.** `people.ts` içinde `req.params.id`
   Express 5'te `string | string[] | undefined`; `parseId` imzası genişletildi
   ve dizi gelirse geçersiz sayılıyor (iki id'den birini sessizce seçmemek
   için).
14. **§22.0 tuzağı Görevler modülünde yeniden çıktı.** `PUT /tasks/{id}`
   şeması `taskSchema.partial()` ile türetildiği için, yalnızca başlığı
   güncelleyen bir istek `task_type`'ı sessizce `custom`'a düşürüyordu: tarif
   yerinde duruyor ama görev artık mama görevi değil. Aynı hata ilk kez tüm
   kayıt modüllerinde görülmüştü (1. madde) — **varsayılanı olan her alan,
   güncelleme şemasında varsayılansız `optional()` ile ezilmeli.** Yeni modül
   eklerken ilk bakılacak yer burasıdır.

---

### Modül 13 doğrulanırken bulunan iki modül dışı hata

15. **Uygulama açılışta kendi kendini oturumdan atıyordu.** Sunucu, kullanılmış
   bir refresh token tekrar gelirse bunu çalıntı sayıp kullanıcının **tüm**
   oturumlarını iptal ediyor (`auth.ts`, §5.6 — doğru davranış). İstemcide ise
   tek-uçuş koruması yalnızca 401 yakalayan ara katmandaydı; `restore()` aynı
   token'ı ayrı bir yoldan gönderiyordu. Açılışta ikisi aynı anda çalışınca
   token iki kez gidiyor, sunucu güvenlik iptali uyguluyor ve kullanıcı hiçbir
   şey yapmadan giriş ekranına düşüyordu — üstelik yerel ayna da siliniyordu.
   Tekilleştirme `rotate()` içine alındı; her iki çağıran da ondan geçiyor.
   Emülatörde art arda üç yeniden yükleme ile doğrulandı: `refresh_tokens`
   zinciri artık kesintisiz (`replaced_by` dolu, toplu iptal yok).
   Sunucu tarafı kural `scratchpad/refresh_race_e2e.sh` ile sabitlendi (6/6).
16. **Veritabanı varsayılanıyla yazılan tüm zaman damgaları üç saat ileriydi.**
   Havuz `timezone: 'Z'` ile kuruluydu ve koddaki yorum "oturum saat dilimi
   UTC'ye sabitlenir" diyordu — ama bu ayar yalnızca **sürücünün** dönüşümünü
   belirler, MySQL'in `CURRENT_TIMESTAMP(3)` varsayılanını etkilemez. O,
   sunucunun `time_zone` değişkenine bakıyor ve WAMP'ta bu `SYSTEM` (+03:00).
   Sonuç: `created_at` / `updated_at` yerel saatle yazılıyor, sürücü onları UTC
   sanıp olduğu gibi döndürüyordu. API bir bebeğin `joined_at` değerini
   `10:20:59Z` diye yayınlarken gerçek UTC `07:20:59` idi; Node'dan gelen
   `meta.server_time` doğru olduğu için tutarsızlık görünür hâle geldi.
   Her yeni bağlantıda `SET time_zone = '+00:00'` çalıştırılıyor; yeni satırlar
   doğrulandı. **Eski satırlar hâlâ üç saat ileri** — geriye dönük düzeltme
   kullanıcının kararına bırakıldı (§8.7).

17. **Alt gezinme çubuğu ekranların son düğmesini örtüyordu.** Çubuk
   `position: absolute` olduğu için yer kaplamıyor; `Screen` ise tek bir sabit
   (64dp) pay bırakıyordu. Cihazın jest çubuğu (~24dp) ve ortadaki yuvarlak
   düğmenin taşması (22dp) sayılmadığından "Görevi oluştur", "Kaydet" gibi en
   alttaki düğmeler çubuğun arkasında kalıyordu. Aynı kökten ikinci bir kusur:
   kabuk alt ağaca `bottom: 0` verdiği için `Modal` ile açılan alt sayfalar
   (`RecordDetail`, `QuickAddSheet`) jest çubuğuna yapışıyordu. Artık alt ağaç
   gerçek inset'i görüyor, çubuğun örttüğü yükseklik ise ayrı bir context'le
   (`BottomNavSpaceContext`) yalnızca çubuğun altında çizilen ekranlara
   veriliyor (TEKNIK_DOKUMAN §9.7). Emülatörde dört ekranda doğrulandı.

18. **`expo-calendar` SDK 58'de eski API'yi çalışma zamanında reddediyor.**
   `createEventAsync` / `deleteEventAsync` / `getDefaultCalendarAsync` artık
   `expo-calendar/legacy` üzerinden alınmadıkça **hata fırlatıyor** — tip
   denetimi bunu yakalamıyor, çünkü işlevler hâlâ dışa açık ve yalnızca
   `@deprecated`. Eğitim verisinden hatırlanan örneklerin tamamı bu eski
   biçimde. Nesne tabanlı yeni karşılıkları kullanıldı (TEKNIK_DOKUMAN §12.6);
   doğru imzalar SDK 58 dokümanından ve paketin kendi `.d.ts` dosyalarından
   okundu.

19. **İkonlar emoji idi.** Üç ayrı soruna yol açıyordu: çizimi işletim
   sistemi belirlediği için aynı ekran Android ve iOS'ta farklı görünüyordu;
   emoji bir *karakter* olduğundan boyutu ve taban çizgisi yazı tipine bağlıydı
   ve ızgarada kutudan kutuya kayıyordu; rengi gömülü olduğu için pastel
   zeminlerde tema ile hiç uyuşmuyordu. Alt çubuktaki dört ikon ile üst
   şeritteki ayarlar ikonu ise `View`'lardan **elle çizilmişti**. Hepsi
   Material Design Icons'a taşındı, tek sarmalayıcı üzerinden
   (`src/components/Icon.tsx`, TEKNIK_DOKUMAN §9.7.1). Emoji yalnızca bildirim
   başlıklarında kaldı — orası işletim sistemine giden düz metin.
   **Geçişte iki yer kaçtı:** ana ekrandaki durum kartları ve Görevler
   ekranındaki görev kartı; tip imzası `IconName`'e çevrilmiş ama çizim
   `<Text>{icon}</Text>` kaldığı için ekranda ikon yerine semantik adın kendisi
   yazıyordu ("brea stfe", "task For"). İkisi de emülatörde görülerek bulundu —
   tip denetimi bunu yakalamıyor, çünkü `IconName` yine bir `string`.

---

## 7. Doğrulama durumu

| Takım | Kapsam | Sonuç |
|-------|--------|-------|
| `npm run typecheck` (API) | — | temiz |
| `npm test` (API, vitest) | `helpers.test.ts` — CSRF, parseId, açık yönlendirme | 14/14 |
| `npx tsc --noEmit` (mobil) | — | temiz |
| `npx eslint src App.tsx scripts` | — | temiz |
| `babies_e2e.sh` | bebek profilleri, fotoğraf, gerileme | tümü geçti |
| `modules_e2e.sh` | uyku, bez, zaman çizelgesi, raporlar | 28 kontrol |
| `feed_e2e.sh` | ek gıda, alerji, birim kuralları | 14 kontrol |
| `bottle_e2e.sh` | biberon, günlük özet, çoğul tip filtresi, enjeksiyon denemesi | 23/23 |
| `quiet_e2e.sh` | sessiz saat CRUD, yetki sızıntısı, gerileme | 16/16 |
| `quiet_logic_test.mjs` | gece yarısını aşan pencere, gün maskesi, tekrar hesabı | 38/38 |
| Emülatör | biberon kaydı, bildirim izni + kanal, planlama raporu, davet akışı | elle doğrulandı |
| Emülatör (kabuk) | ana ekran özetinin veritabanıyla birebir uyuşması, modül ızgarası, hesap paneli, ayarlara yönlendirme | elle doğrulandı |
| `duration_e2e.sh` | elle girilen kayıtta süre türetme, verilen sürenin korunması, özete yansıma | 10/10 |
| Emülatör (detay raporu) | ek gıda alerji uyarısı, uyku gece geçişi, biberon ml dönüşümü, denetim izi | elle doğrulandı |
| Emülatör (tasarım) | ana ekran üç bölümü, 4 sütunlu ızgara, alt çubuk, hızlı kayıt sayfası, hesap paneli, akış kartları | elle doğrulandı |
| Emülatör (seçiciler) | takvim (doğum tarihi) ve 24 saatlik saat seçici (sessiz saat) | elle doğrulandı |
| Emülatör (paylaşım) | iki seçenekli ekleme menüsü, kod girişi, katılma, yetki rozeti, salt okuma kipi | elle doğrulandı |
| `tasks_e2e.sh` | görev CRUD, tarif doğrulamaları, atama yetkisi, stok kontrolü, durum geçişi, kayda dönüşme, kısmi güncelleme gerilemesi | 32/32 |
| `task_format_test.mjs` | tarif satırı kuruluşu, ondalık kırpma, gecikme, kayda dönüşebilirlik | 25/25 |
| Emülatör (görevler) | görev oluşturma, atama, tarif şeridi, tamamlama sorusu, tamamlananlar sekmesi, ana ekran "Bugünün Görevleri" | elle doğrulandı |
| `refresh_race_e2e.sh` | token rotation, yeniden kullanım tespiti, toplu iptalin yan etkisi, erişim jetonunun 15 dk penceresi | 6/6 |
| `alarms_e2e.sh` | ofset varsayılanı ve normalleştirme, sınır denetimi, cihaz alarm kimlikleri, kısmi güncelleme gerilemesi, iki modülde de | 25/25 |
| `alarm_plan_test.mjs` | ofsetten tetikleme anı, geçmiş/yinelenen eleme, etiketler, süre dolumu | 27/27 |
| Emülatör (ikon seti + açılış) | 13 modül kutusu, alt çubuk, akış filtreleri, kayıt satırları, izin kartları, zıplayan açılış ikonu ve dolan çubuk | elle doğrulandı |
| Emülatör (bildirim + takvim) | izin karşılaması, görev ve hatırlatıcı için takvim etkinliği (günlük yinelenen dâhil), 30/15/5/0 hatırlatıcıları, tamamlama ve silmede temizlik, planlanan bildirimin **fiilen çalması** | elle doğrulandı |
| Emülatör (yerleşim) | görevler formunun son düğmeleri, ana ekran ızgarasının son satırı, raporların dipnotu, kayıt detay sayfasının alt payı | elle doğrulandı |
| Emülatör (oturum) | giriş, art arda üç yeniden yükleme, oturumun korunması, temiz rotation zinciri | elle doğrulandı |
| `active_duration_e2e.sh` | aktif/pasif ayrımı, duraklamalı seans, anne düzeltmesi, sonradan düzeltme ve geri alma, kimlik karışması, rapor toplamı | 26/26 |
| `relationship_e2e.sh` | kayıtta yakınlık, varsayılan `diger`, geçersiz değer, bebek oluştururken profil varsayılanı, istekte verilenin kazanması | 10/10 |
| `vaccines_e2e.sh` | otomatik ulusal takvim (20 doz), kütüphane, özel/manuel ekleme, kategori süzgeci, randevu + görev atama, görev çoğaltmama, tamamlama ve yan etkiler, geri alma, atlama, takvim kimliği, yetki sızıntısı, doğum tarihi kayması, silme | 67/67 |
| `vaccine_format_test.mjs` | durum türetmesi, gün sayımı, alarm anı, ay/yaş etiketleri, aya göre gruplama, yan etki özeti, liste özeti | 60/60 |
| `alarm_plan_test.mjs` (güncellendi) | gün tabanlı ofset etiketleri (7/2/1 gün) eklendi | 32/32 |
| `notifications_e2e.sh` | beş tetikleyici, aktör kuralı, rutin birleştirme, atanana/açana yönlendirme, süzgeçler, okundu ve toplu okundu, yetki sızıntısı, silme | 44/44 |
| `inbox_format_test.mjs` | göreli zaman sınırları (59 dk/1 saat, 23 saat/dün, 6 gün/tarih), gelecek zaman, rozet etiketi | 31/31 |
| Emülatör (bildirim merkezi) | zil rozeti, beş tür ikonu, okunmamış şeridi, deep-link (görev bildirimi → Görevler ekranı), tekil silme, tümünü okundu, boş durum | elle doğrulandı |
| `extras_e2e.sh` | multipart ile bebek oluşturma/güncelleme, tür çevrimi, JSON yolunun korunması, 5 MB ve tür süzgeci, davet e-postası, `event`/`medicine`/`doctor` kategorileri, tekrar doğrulamaları, kısmi güncelleme gerilemesi, PDF ekli rapor e-postası, yetki | 46/46 |
| `quiet_logic_test.mjs` (genişletildi) | `isoDay`, `activeOnDay` (dört tekrar biçimi), tarih penceresi, `rawOccurrences` süzgeci, `canRepeat` kısıtları | 69/69 |
| `scripts/smtp-probe.ts` | SMTP bağlantısı ve kimlik doğrulama (`verify()`) | DOĞRULANDI |
| `scripts/mail-probe.ts` | tam boru hattı: şablon + 20 KB PDF eki, gönderenin kendi adresine | gönderildi |
| fontkit kontrolü | DejaVu Sans, rapor metnindeki tüm Türkçe harfleri kapsıyor (`.notdef` yok) | 0 eksik glif |

> **Takımları arka arkaya koşturma tuzağı.** `POST /auth/login` IP başına
> **15 dakikada 20** istekle sınırlı (`loginLimiter`, `routes/v1/auth.ts`).
> Her e2e betiği 3–4 giriş yapıyor; dokuz takımı peş peşe koşturunca sınır
> ortada doluyor ve kalan betikler `RATE_LIMITED` yüzünden toplu hâlde
> düşüyor. Gerileme gibi görünür, değildir — ayırt etmenin yolu
> `curl -X POST .../auth/login` ile tek istek atıp yanıtın `RATE_LIMITED`
> olup olmadığına bakmak. Sayaç **bellekte** tutulduğu için API sürecini
> yeniden başlatmak sıfırlıyor; `tsx watch` dosya değişikliğinde süreci
> öldürmediği için kaydetmek yetmez, süreç gerçekten kapatılmalı.

API e2e betikleri `scratchpad` altındadır ve her biri kendi test bebeğini
oluşturup `trap` ile siler. Ancak API'nin silmesi **yumuşak** silmedir ve
betiğin açtığı hesap geride kalır; takım koşulduktan sonra
`scratchpad/purge_test_data.sh` çalıştırılır. Ölçüt yalnızca `@ornek.com`
uzantısıdır, gerçek hesaplar başka alan adları kullandığı için güvenlidir.

---

## 7.1 APK öncesi kontrol listesi

Mobil taraf hazır; aşağıdakiler **sunucu ve dağıtım** tarafında kalan işler.
İlk iki madde yapılmadan üretilen bir APK, arayüzünde olan ama sunucunun
tanımadığı özellikler gösterir.

### Yayından önce zorunlu

| # | Konu | Neden |
|---|------|-------|
| 1 | **Sunucu kodunu canlıya al** | Yapılan tüm API değişiklikleri (tarih aralıklı rapor, `DELETE /babies/{id}/data`, kayıt + şifre sıfırlama postaları, 14 günlük ofset tavanı) yalnızca **yerel** kurulumda. `babylog.mcsajans.com` ayrı bir dağıtım (nginx + Passenger/Plesk); oraya çıkılmadan APK'daki yeni ekranlar `404`/`422` alır |
| 2 | **`migrations/018_reminder_description.sql`'i canlıda koş** | `reminders.description` sütunu yoksa etkinlik açıklaması sessizce kaybolur |
| 3 | **`MAIL_DRY_RUN` satırını canlı `.env`'den kaldır** | Şu an `true`: posta gönderilmiyor, yalnızca loga yazılıyor. Kayıt ve şifre sıfırlama postaları bu hâliyle kullanıcıya **ulaşmaz** |
| 4 | **Gerçek imzalama anahtarı** | `android/app/build.gradle` release yapısını hâlâ **debug keystore** ile imzalıyor (`signingConfig signingConfigs.debug`). Dahili test/sideload için sorun değil; Play Store bunu kabul etmez ve debug anahtarıyla yayınlanmış bir uygulamanın anahtarı sonradan değiştirilemez |
| 5 | **`.env.local` paketlenmesin** | Dosya `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000` taşıyor ve `EXPO_PUBLIC_*` değişkenleri pakete **gömülüyor**. Derleme `EXPO_NO_DOTENV=1` ile yapılmalı (varsayılan `https://babylog.mcsajans.com` devreye girer), yoksa APK gerçek telefonda hiçbir sunucuya ulaşamaz |
| 6 | **`modules` tablosuna `feeding` satırı** | Mobil katalogda var, sunucuda yok. Çalışıyor (bilinmeyen anahtar varsayılanıyla açık geliyor) ama panelden Beslenme kutusu kapatılamıyor |

### Bilinen ve bilinçli eksikler (APK'yı engellemez)

| Konu | Durum |
|------|-------|
| Raporlarda PDF dışa aktarma | Sunucu tarafı yapılmadı; istemci yolu `beslenme.md`'de yazılı (§4) |
| Sunucudan cihaza push | Yok; tüm bildirimler cihazda planlanıyor (§4, §4.1) |
| iOS Live Activity / Dynamic Island | Yok; yükseltme yolu §4.2 |
| iOS'ta "çok yüksek" bildirim sesi | Zil düzeyini aşamıyor; `timeSensitive` için yetki + yeni derleme gerekiyor (§4.2) |
| Müzik kilit ekranı kontrolleri | `setActiveForLockScreen` eklenmedi (§4) |
| Beslenme **veri modeli** birleştirmesi | Yalnızca gezinme birleştirildi; tek şema / `details` JSON yapılmadı (bkz. `beslenme.md`) |
| Mobilde test koşucusu | Jest/vitest yok; saf modüller scratchpad betikleriyle doğrulanıyor (§4) |

### Sürüm numarası

`app.json`: `version 1.0.0`, `versionCode 1`, iOS `buildNumber 1`. İlk yayın
için uygun; her yeni yüklemede `versionCode` artmalı (EAS `production`
profilinde `autoIncrement` açık, yerel gradle derlemesinde elle).

---

## 8. Ortam notları

### 8.0.1 Kayıtta yakınlık derecesi (2026-11-02) — **yerelde tamamlandı**

Kayıt formuna "Bebeğe yakınlığın" seçimi eklendi (Anne / Baba / Bakıcı /
Yakın). Değer `users.default_relationship` sütununda saklanıyor ve bebek
oluştururken `my_relationship` gönderilmezse üyeliğe yazılıyor — önceden herkes
`diger` kaydolduğu için aile listesinde ebeveynler *"Yakın Mehmet"* diye
görünüyordu (TEKNIK_DOKUMAN §8.5.1).

`migrations/014_user_relationship.sql` **yerelde uygulandı** ve
`relationship_e2e.sh` 10/10 geçiyor.

Betik ilk koşuşta üç kontrolde düştü: `POST /babies` yanıtı `my_relationship`
alanını hiç döndürmüyordu (`shapeBaby` onu taşımıyor; yakınlık yalnızca liste
ucunda JOIN ile geliyordu). İstemcinin kendi yakınlığını öğrenmesi için listeyi
yeniden çekmesi gerekiyordu. Alan oluşturma yanıtına eklendi ve hesabı
`tx`'in dışına çıkarıldı.

**Canlıda hâlâ bekliyor:** göç uzak sunucuda çalıştırılmadı. Göçsüz bir
dağıtım her kayıt isteğini 500 yapar. Sıra: göç → dağıtım.

Mobil taraf, sunucu güncellenmeden de **çökmez**: alan opsiyonel ve
`AuthUser.relationship` tipinde de opsiyonel. Yalnızca seçim kaydedilmez.

### 8.0.3 SMTP ayarları ve kuru çalıştırma (2026-11-02, onuncu tur)

Backend `.env` dosyasına SMTP ayarları eklendi (`host1.mcsajans.com:465`,
`noreply@mcsajans.com`). Parola **yalnızca** o dosyada; `.env` `.gitignore`
içinde ve `.env.example` yalnızca değişken adlarını belgeliyor.

`scripts/smtp-probe.ts` ile bağlantı ve kimlik doğrulama sınandı:
**SMTP DOĞRULANDI**. `scripts/mail-probe.ts` ile tam boru hattı — şablon,
20 KB PDF eki, gerçek gönderim — denendi; alıcı olarak gönderenin **kendi**
adresi (`noreply@mcsajans.com`) kullanıldı, üçüncü bir tarafa test postası
gitmedi.

**Yerel `.env`'de `MAIL_DRY_RUN=true`.** Uçtan uca testler davet ve rapor
uçlarını çağırıyor; gerçekten gönderselerdi her koşu var olmayan
`@ornek.com` adreslerine posta yağdırırdı. Bayrak açıkken akış sonuna kadar
çalışıyor (şablon kurulur, PDF üretilir), yalnızca son adım atlanıyor ve loga
maskelenmiş adresle bir satır düşüyor.

> **Canlıya alırken `MAIL_DRY_RUN` satırı kaldırılmalı** — aksi hâlde davet
> e-postaları sessizce gönderilmez ve kullanıcı kodu elden iletmek zorunda
> kalır.

### 8.0.2 Yerel kuruluma geri dönüldü (2026-11-02, sekizinci tur)

Aşı modülü geliştirilirken istemci **yerel** sunucuya bağlandı:

```
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
EXPO_PUBLIC_API_CANONICAL_URL=http://bebektakip.test
# EXPO_PUBLIC_API_HOST_HEADER — kapalı
```

Önceki yerel kurulumdan iki fark var:

1. **Port doğrudan 4000.** Apache ters proxy'si (`bebektakip.test`, port 80)
   kullanılmıyor, çünkü `wampapache64` servisi bu makinede başlatılamıyor
   (aşağıya bakın). Express'e doğrudan bağlanmak bir bağımlılığı tamamen
   kaldırıyor.
2. **`Host` başlığı yok.** Express konak adına bakmıyor; başlık yalnızca
   Apache'nin sanal konak seçimi için gerekiyordu.

`EXPO_PUBLIC_API_CANONICAL_URL` gene de gerekli: sunucunun `.env`'indeki
`PUBLIC_BASE_URL` hâlâ `http://bebektakip.test` ve yüklenen dosyaların adresi
o önekle dönüyor. Çeviri olmasa emülatörde hiçbir fotoğraf yüklenmezdi
(`core/api/assets.ts`).

**WAMP servisleri başlatılamıyor.** `Start-Service wampmysqld64` ve
`wampapache64` ikisi de *"hizmet '.' bilgisayarında açılamıyor"* diyor —
yükseltilmiş yetki gerekiyor. MySQL, servis yerine **doğrudan süreç** olarak
açıldı; bu yetki istemiyor:

```bash
/c/wamp64/bin/mysql/mysql8.4.7/bin/mysqld.exe \
  --defaults-file=c:/wamp64/bin/mysql/mysql8.4.7/my.ini --console
```

Apache için aynı yol denenmedi; gerekmedi.

> **Canlıya dönerken:** `.env.local`'daki iki satırı yorumla, Metro'yu yeniden
> başlat ve `npx expo run:android` ile **yeniden derle**. Yalnızca Reload
> yetmez — bu tuzak §8.0'da anlatılıyor.

### 8.0 API adresi canlı sunucuya taşındı (2026-11-02)

Varsayılan taban adres artık **`https://babylog.mcsajans.com/api/v1`**. Gerçek
bir alan adı ve geçerli TLS olduğu için emülatör, cihaz ve tarayıcı onu kendi
DNS'leriyle çözüyor — eski kurulumdaki iki hile (IP'ye bağlanıp `Host` başlığı
taşımak, Android için `10.0.2.2` takma adresi) artık varsayılan yolda yok.

Yerel sunucu kurulumu **silinmedi, isteğe bağlı oldu**: `.env.local` içindeki üç
`EXPO_PUBLIC_*` değişkeni onu geri getiriyor (TEKNIK_DOKUMAN §8.6, §17.3).
Depoda `.env.example` bu değişkenleri belgeliyor; `.env.local` git tarafından
yok sayılıyor ve bu makinede **üç satırı da yorumlu** bırakıldı — yani uygulama
canlı sunucuya gidiyor. Yerele dönmek için yorumları kaldırıp yeniden derlemek
yeterli.

Kimlik doğrulama uçları canlı adreste doğrulandı (2026-11-02):
`GET /api/v1/health` → 200, `GET /api/v1/branding` → 200,
`POST /api/v1/auth/login` → geçersiz kimlikle 401 +
`{"code":"UNAUTHENTICATED"}` zarfı.

**Kanonik origin ayrı bir değişken** (`EXPO_PUBLIC_API_CANONICAL_URL`): sunucu
yükleme ve logo adreslerini kendi `PUBLIC_BASE_URL` değeriyle döndürüyor. Yerel
geliştirmede istemci `http://10.0.2.2` adresine bağlanırken sunucu hâlâ
`http://bebektakip.test/...` döndürür; ikisi tek değerden türetilseydi önek
eşleşmez, `assets.ts` çeviriyi sessizce atlar ve hiçbir fotoğraf yüklenmezdi.

**Değişiklik anında geçmiyor.** Metro `.env*` dosyalarını **başlangıçta**
okuyor, dev build ise değerleri **derleme sırasında** gömüyor. Sırasıyla:
Metro'yu `--clear` ile yeniden başlat, gerekiyorsa `expo run:android` ile
yeniden derle. Yalnızca Reload yetmiyor — bu tur bir saatin kaybı tam olarak
buradan çıktı.

**Backend'e dokunulmadı** (kullanıcının kararı). Canlı sunucuda
`PUBLIC_BASE_URL` da güncellenmeli: logo, bebek fotoğrafı ve müzik adresleri
orada üretiliyor, `http://bebektakip.test` kalırsa istemci onları çözemez.


### 8.1 Test verisi temizlendi (2026-11-02)

Geliştirme boyunca biriken test verisi silindi. Silinenler: 5 test kullanıcısı
(`a.yilmaz@eposta.com`, `baba…@ornek.com`, `yabanci…@ornek.com`,
`ebeveyn.test@ornek.com`, `test.anne@ornek.com`), 23 bebek ve bunlara bağlı
tüm kayıtlar (43 besleme, 29 uyku, 34 bez, 24 sağma, 8 emzirme, 5 hatırlatıcı,
24 üyelik, 2 davet), 351 etkinlik kaydı, 66 refresh token ve 5 yetim bebek
fotoğrafı. Cihazdaki yerel SQLite aynası da `pm clear` ile temizlendi.

**Korunanlar:** yönetici hesabı (`can.surucu@mcsajans.com`), modül kataloğu
(12 satır), yüklenen müzik parçası, markalama logoları ve yöneticinin kendi
panel etkinlik geçmişi (25 satır).

Silme öncesi tam veritabanı yedeği alındı; oturum scratchpad'indeki
`bebektakip-yedek-temizlik-oncesi.sql` dosyasında.

> **Not:** `scratchpad` altındaki API e2e betikleri `test.anne@ornek.com` ile
> giriş yapıyordu ve artık çalışmaz. Yeniden koşturmak için ya o hesabı
> yeniden oluşturmak ya da betikleri kendi hesabını kaydedecek şekilde
> güncellemek gerekir — ikisi de yeniden test verisi üretir.

### 8.2 Android 16 yerel ağ izni

Emülatör (API 37) uygulamayı ilk açtığında "yakındaki cihazları bul" benzeri
bir izin istiyor; günlükte `android.permission.ACCESS_LOCAL_NETWORK` olarak
görünüyor. Sebep, API'nin **yerel ağ** adresinde (`10.0.2.2`) olması. Üretimde
API genel bir alan adında olacağı için bu istem çıkmaz; LAN üzerinden
dağıtılacaksa izin manifest'e eklenmeli ve kullanıcıya gerekçesi anlatılmalı.

### 8.3 Tasarım şablonunun uygulanması (2026-11-02)

`modules_doc/tasarim.jpg` birebir uygulandı. Renkler göz kararı değil,
şablondan **örneklenerek** alındı (her nokta için küçük bir pencerenin en sık
rengi; JPEG gürültüsüne dayanıklı olsun diye). Ayrıntılar
TEKNIK_DOKUMAN §9.5–9.8'de.

Şablonla önceki kararlar arasında **tek çelişki** vardı: iki tur önce "alttaki
menüleri tamamen kaldır" denmişti, şablonda ise beş öğeli bir alt çubuk var.
Sorulduğunda çubuğun eklenmesi, üst şeritte de bebek bilgisinin gösterilmesi
tercih edildi. Çelişki yalnızca görünürde: kaldırılan şey **modül
sekmeleriydi** (modül sayısıyla büyüyen), eklenen ise modülden bağımsız sabit
bir kabuk çubuğu.

Şablonla birlikte gelen yan değişiklikler:

- `babies` artık gerçek bir ekran (`BabiesScreen`). Şablonda ızgarada kendi
  kutusu var; bebek yönetimi eskiden yalnızca üst şeritteki açılır penceredeydi
  ve o pencere (`BabySwitcher`) kaldırıldı.
- Izgara sırası şablondan alındı ve sunucudaki `modules.sort_order` aynı
  sıraya çekildi.
- Grafik sütunları pastel tonları değil `track*` tonlarını kullanıyor: beyaz
  zeminde 5 piksellik pastel bir sütun neredeyse görünmüyordu.
- `@react-navigation/bottom-tabs` geri **eklenmedi**; alt çubuk elle yazıldı
  ve navigasyon ağacının dışında duruyor.

### 8.4 Emülatör saat dilimi

Emülatör **UTC**'de; geliştirme makinesi ve sunucu +03:00. API ile elle
oluşturulan kayıtlarda `tz_offset_min: 180` kullanılırsa o kayıt cihazda bir
önceki güne düşer ve "bugün" akışında görünmez. Bu bir hata değil, günlük
sınırının `tz_offset_min` ile belirlenmesinin doğal sonucu; emülatörde test
ederken kayıtları cihazın saat dilimiyle oluşturmak gerekir.

### 8.5 Paylaşım testi verisi (2026-11-02)

Paylaşım akışını denemek için geçici olarak iki hesap (`paylasan@ornek.com`,
`katilan@ornek.com`) ve bir "Paylasim Testi" bebeği oluşturuldu; `viewer`
yetkili bir davet kodu üretilip uygulamada kullanıldı. Test bitince bebek ve
iki hesap silindi — bebeğin silinmesi üyelikleri de cascade ile kaldırdığı
için kullanıcının hesabında iz kalmadı. Kalan tek bebek "Cagan Efe".

### 8.6 Görevler modülü test verisi (2026-11-02)

Modül 13 doğrulanırken açılan hesaplar (`gorev.anne@`, `gorev.baba@`,
`gorev.yabanci@`, `gorevui.test@ornek.com`), bunların 3 bebeği (40, 41, 42) ve
bağlı tüm kayıtları silindi. Emülatörde elle oluşturulan iki görev
(`Aksam mamasi TEST`, `Banyo saati TEST`) ve etkinlik kayıtları da kaldırıldı.
Silme öncesi tam yedek alındı. Veritabanında yalnızca gerçek hesaplar
(`can.surucu@mcsajans.com`, `busesurucu95@gmail.com`,
`mehmetcansurucu@gmail.com`) ve bebek **Cagan Efe** kaldı.

### 8.7 Geçmiş zaman damgaları hâlâ üç saat ileri — **karar bekliyor**

`SET time_zone = '+00:00'` düzeltmesinden (6. bölüm, 16. madde) **önce** yazılan
her satırın `created_at` / `updated_at` değeri +03:00 ile kaydedildi, yani
gerçek UTC değerinden üç saat ileri. Olay zamanları (`started_at`, `due_time`,
`revoked_at` gibi Node'dan ya da `UTC_TIMESTAMP(3)` ile yazılanlar) **doğru**;
etkilenen yalnızca veritabanı varsayılanıyla dolan denetim sütunları.

Görünür etkisi: kayıt detay sayfasındaki "Kaydedildi / Güncellendi" satırları
geçmiş kayıtlarda üç saat ileri bir an gösterir.

Düzeltme tek bir göçle yapılabilir — düzeltme anından önceki satırlarda
`DATE_SUB(col, INTERVAL 3 HOUR)`. Çalıştırılmadı: kullanıcının gerçek
verisini geriye dönük yeniden yazmak onun kararıdır ve göç iki kez
çalıştırılırsa veriyi ikinci kez kaydırır (bu yüzden göç, sınır anını sabit
bir değer olarak taşımalıdır).

### 8.8 İzinler (2026-11-02)

`app.json` → `expo.android.permissions` listesi dolduruldu: `POST_NOTIFICATIONS`,
`READ_CALENDAR`, `WRITE_CALENDAR`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED`,
`WAKE_LOCK`, `READ_MEDIA_IMAGES`, `INTERNET`, `ACCESS_NETWORK_STATE`. Daha
önce liste hiç yoktu; izinler yalnızca kullanılan paketlerin kendi
manifest'lerinden geliyordu ve takvim izni hiçbir yerde yoktu.

Çalışma zamanı tarafında girişten sonra bir kez `PermissionsSheet` açılıyor
(TEKNIK_DOKUMAN §12.5) ve Ayarlar → İzinler bölümünden sonradan tek tek
istenebiliyor.

iOS kullanım açıklamaları config plugin seçenekleriyle veriliyor
(`expo-calendar` → `writeOnlyCalendarPermission`, `expo-image-picker` →
`photosPermission`); doğrudan `infoPlist` yazmak yerine plugin kullanmak
Continuous Native Generation kuralının gereği.

**`SCHEDULE_EXACT_ALARM` istenmiyor** — gerekçe §4.1'de.

### 8.9 Bildirim ve takvim doğrulaması (2026-11-02)

Emülatörde uçtan uca: 09:00'a kurulu bir göreve 30/15/5/0 dk uyarıları
planlandı, 08:45'te **"🥣 Bildirim testi — 15 dakika kaldı"** bildirimi
`channel=tasks` üzerinden çaldı. Aynı görev cihaz takvimine de yazıldı
("Bebiqa" adlı yerel takvim, dört hatırlatıcı); görev silinince hem
bekleyen bildirimler hem takvim etkinliği ve hatırlatıcıları kalktı.

Sabit saatli bir hatırlatıcı (09:00 ve 21:00, ofsetler 15 ve 0) için takvime
`FREQ=DAILY;INTERVAL=1` yinelenen etkinlik yazıldı ve ekrandaki "Cihazda planlı
bildirim" sayacı 3 → 7 çıktı (2 saat × 2 ofset). Hatırlatıcı silinince takvim
kaydı da kalktı.

Cihazda bir "Bebiqa" takvimi kalır; özelliğin kalıcı parçasıdır, test
artığı değildir.
