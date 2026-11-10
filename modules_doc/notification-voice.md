# BEBEK VE ÇOCUK TAKİP SİSTEMİ (0-3 YAŞ) - TEKNİK VE GELİŞTİRME DOKÜMANI

Bu doküman, 0-3 yaş çocuk takip sisteminin backend (Node.js) ve mobil (React Native) mimarisini, veri modellerini, API end-point'lerini, iş kurallarını ve ses/bildirim yönetimi gibi teknik standartlarını eksiksiz şekilde içermektedir.

---

## 1. GENEL MİMARİ VE ÇALIŞMA KURALLARI

1. **Dizin Yapısı ve Bağımsızlık:**
  - Proje iki bağımsız dizinden oluşur: Backend (Node.js — `C:\wamp64\www\bebektakip`)
    ve Mobil App (React Native — `C:\bebektakip`).
  - Backend ve Mobil App servisleri tamamen modüler ve decoupling (bağımsız)
    prensibiyle kurgulanmıştır.

2. **Geliştirme Sıralaması (Strict Step-by-Step Execution):**
  - **Adım 1 (Backend First):** Veritabanı modelleri, migration'lar, validation (DTO) ve API end-point'leri geliştirilip test edilir.
  - **Adım 2 (Dokümantasyon):** Yapılan mimari ve API güncellemeleri `TEKNIK_DOKUMAN.md` dosyasına kaydedilir.
  - **Adım 3 (Frontend Integration):** Servis katmanı (`services`), state yönetimi ve React Native UI bileşenleri geliştirilir.

3. **Adresler ortam değişkeninden gelir — koda gömülmez.**
  Ne mobil istemcide ne sunucuda sabit bir yayın adresi vardır:

  | Nerede | Değişken | Yerel değer |
  | :--- | :--- | :--- |
  | Mobil | `EXPO_PUBLIC_API_URL` (`.env.local`) | `http://10.0.2.2:4000` (Android emülatörü) |
  | Sunucu | `PUBLIC_BASE_URL` (`.env`) | `http://bebektakip.test` |

  Mobil tarafta değişken verilmezse **yerel sunucu** varsayılır (Android
  emülatörü `10.0.2.2`, iOS simülatörü `localhost`). Daha önce varsayılan
  canlı sunucuydu ve `.env.local` kopyalanmayı unutulduğunda geliştirme
  derlemesi sessizce canlı veriye bağlanıyordu. Fiziksel telefonda ikisi de
  çalışmaz — makinenin LAN adresi yazılmalıdır (`ipconfig`, ör.
  `http://192.168.1.20:4000`).

  **Yüklenen dosyaların adresi göreli taşınır** (`/uploads/...`). Mutlak
  adres taşımak, cihazın sunucunun kendini bildiği konak adını çözebilmesini
  gerektiriyordu; yerel kurulumda bu `bebektakip.test` olduğu için hiçbir
  telefon çözemiyor ve müzik çalar sessizce hiç başlamıyordu. Ayrıntı:
  `TEKNIK_DOKUMAN.md` §22.5.1.

4. **E-posta & SMTP Yapılandırması:**
  Değerler sunucunun `.env` dosyasında durur ve **bu belgeye yazılmaz** —
  belge depoya giriyor, parola ise sırdır. Gereken anahtarlar:

  ```env
  SMTP_HOST=
  SMTP_PORT=465
  EMAIL_USER=
  EMAIL_PASS=
  EMAIL_FROM=
  ```

  Yerel geliştirmede `MAIL_DRY_RUN=true` açıktır: akış sonuna kadar çalışır,
  yalnızca gönderim adımı atlanır ve loga yazılır. **Canlıda kaldırılmalıdır.**

---

## 2. BİLDİRİM SESLERİ VE SES YÖNETİM KURALLARI

Uygulama içi ve cihaz seviyesi sesli bildirimlerin mantığı, çalma tekrar
sayıları ve medya kuralları aşağıda listelenmiştir.

### 2.1. Ses Listesi ve Kullanım Alanları

Ses dosyaları **uygulamanın içine gömülüdür** (`assets/notification/`); bir
adresten indirilmezler, gerekçesi §2.2.4'te. Eşleme tek bir kaynakta durur:
`src/core/notifications/soundCatalog.ts`. Tabloyu değiştiren oraya da
bakmalıdır — iki yerde elle tutulsaydı biri unutulur ve sapma yalnızca gerçek
cihazda duyulurdu.

| Modül / Alan | Tetiklenme Durumu | Ses Dosyası | Tekrar | Android kanalı |
| :--- | :--- | :--- | :--- | :--- |
| **Uygulama Bildirim Menüsü** | Menüye her yeni bildirim düştüğünde | `bildirim8.mp3` | 2 | — (uygulama içi) |
| **Beslenme (Biberon/Emzirme/Sağma)** | Sayaç aktifken her 5 dakikada 1 | `bildirim3.mp3` | 1 | — (uygulama içi) |
| **Uyku Takibi** | Sayaç aktifken her 30 dakikada 1 | `bildirim1.mp3` | 1 | — (uygulama içi) |
| **Hatırlatıcılar (Zamanlı/Periyodik)** | Belirlenen saatte / periyotta | `bildirim2.mp3` | 4 | `reminders_v2` |
| **Görev Zamanı Geldiğinde** | Görev saati ulaştığı anda | `bildirim5.mp3` | 4 | `tasks_v2` |
| **Gecikmiş Görev Uyarısı** | Görev zamanı geçtikten sonra her 5 dakikada 1 | `bildirim6.mp3` | 4 | `tasks_overdue_v2` |
| **Aşı Bildirimleri** | 7 gün, 2 gün, 1 gün önceden | `bildirim4.mp3` | 2 | `vaccines_v2` |
| **Aşı Günü** | Randevu anında | `bildirim4.mp3` | 4 | `vaccines_v2` |

`bildirim7.mp3` kütüphanede duruyor ama hiçbir olaya bağlı değil. Dosya yine
de pakete giriyor, böylece bir olaya atanması gerektiğinde yeniden derleme
gerekmez.

> **Kanal kimliklerindeki `_v2` eki şart.** Android'de bir kanalın sesi ve
> önemi oluşturulduktan sonra uygulama tarafından **değiştirilemez**; yalnızca
> adı ve açıklaması güncellenebilir. Özel sesler eski kimliklere yazılsaydı,
> uygulamayı daha önce kurmuş hiç kimse onları duymayacaktı. Bu kuralı yine
> değiştirmek gerekirse kimlik de artmalıdır (`_v3`). Eski kanallar cihazda
> kalır ve sessizleşir; silinseydi kullanıcının o kanalda yaptığı ayar da
> silinirdi.

### 2.2. Ses Yönetimi Genel Teknik Kuralları

1. **Ses Kesilme Davranışı (Audio Interruption Handling):**
  - Belirtilen tekrar sayısı tamamlandığında bildirim sesi otomatik durur.
  - Kullanıcı bildirim çekmecesini açtığında, bir bildirime dokunduğunda,
    "tümünü okundu işaretle" dediğinde veya bildirime basıp uygulamayı
    açtığında ses, tekrar sayısı bitmemiş olsa dahi **anında** kesilir.
    Uygulama: `src/core/notifications/alertSound.ts` → `stopAlert()`.
  - Aynı anda yalnızca **tek** uyarı çalar; yeni uyarı çalanın yerini alır.
    Sıraya alınsaydı, kullanıcı ekrana baktıktan dakikalar sonra çalan sesler
    üretilirdi.

2. **Sayaç ve Kronometre Bağlantısı:**
  - Beslenme ve Uyku alanlarındaki periyodik sesli bildirimler (5 dk / 30 dk)
    **yalnızca ilgili sayaç AKTİF (RUNNING)** durumdayken çalar. Sayaç
    duraklatıldığında ya da oturum bitirildiğinde periyodik uyarılar — ve o an
    çalan ses — anında sonlanır.
  - Aralık, sayacın **başlangıcına demirlenmiştir**: ekran değişiminde ya da
    uygulama ön plana döndüğünde ritim kaymaz. Düz bir `setInterval`
    kullanılsaydı her yeniden kurulum aralığı baştan başlatır ve 5 dakikalık
    uyarı, 4 dakikada bir tazelenen bir ekranda hiç çalmazdı.
    Uygulama: `timerTicker.ts`; hesap `tickPlan.ts` (saf, `npm test` ile
    doğrulanır).
  - **Sınır:** JavaScript arka planda çalışmaz. Uygulama arka plandayken
    periyodik ses durur ve geri dönüldüğünde geçen süreye göre yeniden
    hizalanır. Kilit ekranındaki canlı sayaç bildirimi (`liveTimerNotice.ts`)
    bu boşlukta süreyi göstermeye devam eder.

3. **Gecikmiş Görev Bildirim Döngüsü:**
  - Görev zamanı geçtiğinde `bildirim6.mp3` her 5 dakikada bir çalar; görev
    **"Tamamlandı"** ya da **"İptal"** edilene — veya 24 saatlik güvenlik
    zaman aşımı dolana — kadar sürer. Uygulama: `taskOverdue.ts`.
  - **Sınır:** 5 dakikalık döngünün tamamı yalnızca uygulama ayaktayken
    çalışır. İşletim sistemi tarafında 24 saat × 12 = **288 bildirim**
    planlanamaz; iOS bekleyen bildirimleri 64'te kesip fazlasını sessizce atar
    ve tek bir gecikmiş görev tüm hatırlatıcıları, aşıları ve diğer görevleri
    plandan dışarı iterdi. Bu yüzden sistem tarafında **seyrelen bir
    merdiven** kurulur: gecikmenin 5., 15., 30., 60. dakikası ile 3. ve 6.
    saati (`taskAlarms.ts` → `OVERDUE_LADDER_MIN`). Uygulama açıldığında tam
    döngü kaldığı yerden devam eder.
  - Görev kapatıldığı **anda** hem döngü hem çalan ses durur; bir sonraki tam
    eşitlemeyi beklemek, kullanıcı "Tamamlandı"ya bastıktan sonra ses çalmaya
    devam etmek demekti.

4. **Yerel Ses Depolama (Native Assets / Offline Management):**
  - Ses dosyaları `assets/notification/` altında durur ve derleme sırasında
    Android'de `res/raw`, iOS'ta ana pakete kopyalanır. Kopyalamayı
    `app.json` → `expo-notifications` → `sounds` dizisi yapar; dosyalar
    bildirim içeriğinde ve kanal tanımında **yalnızca temel adıyla** anılır
    (`bildirim5.mp3`), yol verilmez.
  - **Ses dosyası eklemek yeniden derleme gerektirir.** `sounds` dizisi
    derleme zamanı bir kaynak kopyalama adımıdır; Reload yetmez:
    `npx expo prebuild --platform android` ardından `npx expo run:android`.
  - Ad `sounds` dizisinde yoksa Android kanalı **sessiz** oluşturur ve hata
    vermez — bu yüzden liste ile katalog tek kaynaktan beslenir.
  - Gerekçe: bir bildirim sesi internet kesintisinde de, uygulama soğuk
    başlarken de **anında** çalmak zorundadır. Adresten indirilen bir ses,
    ebeveynin en çok ihtiyaç duyduğu anda (gece, kötü bağlantı) sessiz
    kalırdı.

5. **Tekrar sayısı neden uygulamanın işi:**
  - İşletim sistemine teslim edilen bir bildirimin sesi **bir kez** çalar.
    Tekrar için N ayrı bildirim planlamak gerekirdi ve bu, yukarıdaki 64'lük
    bütçeyi tüketirdi.
  - Bu yüzden uygulama ön plandayken bildirim işleyicisi sistem sesini
    bastırır (`shouldPlaySound: false`) ve aynı sesi `expo-audio` ile tekrar
    sayısınca çalar (`foregroundAlerts.ts`). İkisi birden açık kalsaydı her
    uyarı ön planda çift duyulurdu.
  - **Sınır:** uygulama arka plandayken ya da kapalıyken ses kanaldan **tek
    seferlik** çalar; tekrar olmaz. Uyarının kendisi kaybolmaz, bildirim
    gölgede durur.

6. **Sessiz saatler, izin ve oturum:**
  - Hatırlatıcılarda sessiz saat kuralı sesi de kapsar: `quiet_behavior`
    `silent` ise bildirim sessiz gönderilir (`sound: false`).
  - Bildirim izni geri alındığında bekleyen alarmlar iptal edilir **ve**
    uygulama içi uyarı turları durur; yoksa bildirim göstermeden ses çalmaya
    devam ederdi.
  - Oturum kapanışında çalan ses susturulur ve tüm gecikme turları kalkar:
    çıkış yapmış bir hesabın görevi için telefonun çalması kabul edilemez.

---

## 3. MODÜL DETAYLARI VE VERİ MODELLERİ

### Modül 1: Bebek Profilleri (`babies`)
Bebeğe ait temel kişisel ve fiziksel bilgilerin tutulduğu temel modüldür. Profil fotoğrafı yükleme desteği içerir.

- **Veri Şeması (`babies`):**
  - `id` (UUID, PK)
  - `name` (String, Zorunlu)
  - `gender` (Enum: 'male', 'female', Zorunlu)
  - `birth_date` (DateTime, Zorunlu)
  - `birth_time` (String, Opsiyonel)
  - `birth_weight` (Float - kg/g)
  - `birth_height` (Float - cm)
  - `head_circumference` (Float - cm)
  - `blood_type` (Enum: 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-')
  - `is_premature` (Boolean, Varsayılan: false)
  - `gestational_age_weeks` (Integer, Prematüre ise gebelik haftası)
  - `photo_url` (String, Backend multipart upload ile gelen dosya bağlantısı)
  - `is_default` (Boolean)
  - `created_at`, `updated_at`

- **API End-point'leri:**
  - `POST /api/v1/babies` -> Yeni bebek profili oluşturma (Multipart photo upload destekli)
  - `GET /api/v1/babies` -> Kullanıcının tüm bebek profilleri
  - `GET /api/v1/babies/:id` -> Bebek profil detayı
  - `PUT/PATCH /api/v1/babies/:id` -> Profil güncelleme
  - `DELETE /api/v1/babies/:id` -> Profil silme/arşivleme
  - `POST /api/v1/babies/:id/select` -> Aktif seçili bebeği değiştirme

- **Yaş Hesaplama Logic (Frontend Utility):**
  - 0-30 Gün: `X Günlük`
  - 1-24 Ay: `X Ay Y Günlük`
  - 2 Yaş Üzeri: `X Yaş Y Aylık`
  - Prematüre ise gebelik haftasına göre "Düzeltilmiş Yaş" seçeneği.

---

### Modül 2: Birleşik Beslenme Modülü (`feeding`)
Eski ayrı modüller (`breastfeeding`, `bottle`, `solid`, `pumping`) tek bir çatı altında birleştirilmiştir. Emzirme, biberon, ek gıda ve süt sağma işlemleri bu modülden yönetilir.

- **Veri Şeması (`feedings`):**
  - `id` (UUID, PK)
  - `baby_id` (UUID, FK -> `babies.id`, Zorunlu)
  - `created_by_user_id` (UUID, Kaydı Oluşturan - Zorunlu)
  - `updated_by_user_id` (UUID, En Son Güncelleyen)
  - `feed_type` (Enum: 'breastfeeding', 'bottle', 'solid', 'pumping', Zorunlu)
  - `timestamp` (DateTime, Zorunlu)
  - `notes` (Text)
  - `details` (JSON Field - Tipe Göre Esnek Veri):
    - *breastfeeding:* `left_duration_seconds`, `right_duration_seconds`, `total_elapsed_duration_seconds`, `active_duration_seconds` (Sonradan slider ile düzeltilen aktif süre), `last_side` ('left'/'right')
    - *bottle:* `bottle_content` ('breast_milk', 'formula', 'water'), `amount` (ml), `temperature` ('warm', 'room_temp', 'cold')
    - *solid:* `food_name`, `category` ('vegetable', 'fruit', 'cereal', 'protein', 'dairy', 'snack'), `amount`, `unit` ('spoon', 'gram', 'bowl', 'piece'), `reaction` ('loved', 'neutral', 'disliked', 'allergic'), `is_three_day_rule` (Boolean)
    - *pumping:* `left_amount`, `right_amount`, `total_amount`, `storage_location` ('fridge', 'freezer', 'used_immediately'), `is_used` (Boolean)
  - `created_at`, `updated_at`

- **Çoklu Ebeveyn Sayaç Yönetimi & Canlı Bildirim:**
  - Bir ebeveyn canlı sayaç başlattığında (Emzirme/Sağma), WebSocket / Socket.io üzerinden tüm yetkili ebeveynlerin cihazlarına anlık durum düşer.
  - Yetkili diğer ebeveynler (Anne, Baba, Bakıcı) devam eden sayacı **kendi cihazından duraklatabilir, tekrar başlatabilir, aktif süreyi düzenleyebilir ve oturumu kapatabilir**.
  - Canlı sayaç çalışırken kilit ekranı ve bildirim çubuğunda **Live Activity (iOS)** ve **Ongoing Foreground Service (Android)** ile süre canlı akar; bildirim üzerindeki butonlardan duraklatma/bitirme aksiyonu verilebilir.

- **API End-point'leri:**
  - `POST /api/v1/feedings` -> Yeni beslenme/sağma kaydı ekleme
  - `GET /api/v1/feedings?baby_id=:babyId&feed_type=...` -> Filtreli liste
  - `POST /api/v1/feedings/active-timer` -> Ortak sayaç başlat/duraklat/devam et/bitir
  - `GET /api/v1/feedings/daily-summary?baby_id=:babyId&date=YYYY-MM-DD` -> Günlük özet

---

### Modül 3: Uyku Takibi (`sleep`)
Gece uykusu ve gündüz şekerlemelerini izleyen canlı sayaçlı modüldür.

- **Veri Şeması (`sleep`):**
  - `id` (UUID, PK)
  - `baby_id` (UUID, FK -> `babies.id`)
  - `type` (Enum: 'night_sleep', 'nap', Zorunlu)
  - `start_time` (DateTime, Zorunlu)
  - `end_time` (DateTime)
  - `duration_minutes` (Integer)
  - `quality` (Enum: 'peaceful', 'restless', 'frequent_waking')
  - `wake_reason` (String - Açlık, gaz vb.)
  - `notes` (Text)
  - `created_at`, `updated_at`

- **İş Mantığı:**
  - Canlı kronometre arka planda timestamp bazlı çalışır. Canlı bildirim çubuğu desteği mevcuttur.
  - "Uyanıklık Penceresi (Wake Window)" Widget'ı: Bebeğin uyanmasından itibaren geçen süreyi takip eder.

- **API End-point'leri:**
  - `POST /api/v1/sleep` -> Uyku kaydı ekleme
  - `GET /api/v1/sleep?baby_id=:babyId` -> Geçmiş uyku listesi
  - `GET /api/v1/sleep/daily-summary?baby_id=:babyId&date=YYYY-MM-DD` -> Günlük uyku/uyanıklık özeti

---

### Modül 4: Bez Değişimi (`diaper`)
Bebeğin alt değişim ve pişik takip modülüdür.

- **Veri Şeması (`diaper`):**
  - `id` (UUID, PK)
  - `baby_id` (UUID, FK -> `babies.id`)
  - `type` (Enum: 'wet', 'dirty', 'both', 'dry', Zorunlu)
  - `poop_color` (Enum: 'yellow', 'brown', 'green', 'black', 'red', 'other')
  - `poop_texture` (Enum: 'normal', 'liquid', 'hard', 'seedy')
  - `rash_status` (Enum: 'none', 'mild', 'severe', Varsayılan: 'none')
  - `cream_applied` (Boolean, Varsayılan: false)
  - `changed_at` (DateTime, Zorunlu)
  - `notes` (Text)
  - `created_at`, `updated_at`

- **API End-point'leri:**
  - `POST /api/v1/diaper` -> Yeni bez değişimi ekleme
  - `GET /api/v1/diaper?baby_id=:babyId` -> Bez değişimi geçmişi

---

### Modül 5: Ninni & Müzik (`music`)
Çevrimdışı destekli ninni ve beyaz gürültü çalarıdır.

- **Veri Şeması (`music`):**
  - `id` (UUID, PK)
  - `title` (String, Zorunlu)
  - `category` (Enum: 'lullaby', 'white_noise', 'nature', 'classical')
  - `audio_path` (String, **göreli** yol — çalmak için bu kullanılır)
  - `audio_url` (String, mutlak adres; eski istemciler için geriye dönük)
  - `duration_seconds` (Integer, yüklemede dosyadan okunur)
  - `is_favorite` (Boolean, **kullanıcıya** ait)

- **İş Mantığı:**
  - Geri sayımlı Uyku Zamanlayıcı (15, 30, 45, 60 dk). Süre dolduğunda ses kademeli olarak (fade-out) kısılarak durdurulur.
  - **Çalma, durdurulana kadar sürer.** Oturum ekrana değil
    `core/music/useMusicStore.ts`'e ait: başka bir ekrana geçmek ya da
    uygulamadan tamamen çıkmak sesi kesmez. Yalnızca şunlar bitirir: ekrandaki
    **Durdur**, bildirimden kapatma, uyku zamanlayıcısı, oturum kapanışı.
  - **Bildirim çubuğundan duraklat / devam et / kapat.** Çalarken gölgede iki
    satır olur: sistemin Media3 medya kartı (duraklat/devam + kilit ekranı +
    Bluetooth düğmeleri) ve uygulamanın kendi `music_player` bildirimi —
    ikincisinde **Duraklat / Devam et** ve **Kapat** düğmeleri var. Kapat
    oturumu tamamen bitirir: çalar serbest kalır, foreground servis ve her iki
    bildirim de kalkar. Medya kartında kapatma düğmesi yok ve eklenemiyor
    (`expo-audio` Media3 özel düğmelerini dışarı açmıyor), ikinci bildirimin
    gerekçesi bu — ayrıntı TEKNIK_DOKUMAN §22.5.4.
  - **Android'de kilit ekranı denetimleri şarttır**: `shouldPlayInBackground`
    tek başına yetmiyor, ses yaklaşık 3 dakika sonra kesiliyor. Kesme kipi de
    `doNotMixPersistent` olmalı — denetimler yalnızca bu iki kiple çalışıyor.
  - **Adres göreli taşınır.** Mutlak adres, cihazın sunucunun kendini bildiği
    konak adını (`PUBLIC_BASE_URL`) çözebilmesini gerektiriyordu; yerel
    kurulumda bu `bebektakip.test` olduğu için hiçbir telefon çözemiyor ve
    çalma **sessizce** hiç başlamıyordu. Ayrıntı: `TEKNIK_DOKUMAN.md` §22.5.1.
  - **Çalma hatası ekranda gösterilir** (`status.error`). Önceden hiç
    okunmuyordu: başarısız çalma, sessiz bir çalardan ayırt edilemiyordu.
  - **Dosya biçimi önerisi:** mp3, 64 kbit/s mono, 1–3 dakika ve döngüye
    uygun. Telefon parçayı akış hâlinde indiriyor; uzun ve yüksek bit hızlı
    bir kayıt (ölçülen örnek: 2 saat, 192 kbit/s, 172 MB) mobil veride
    dakikalarca sessiz bekletir ve kullanıcıya "çalmıyor" gibi görünür. Döngü
    düğmesi kısa kaydı kesintisiz tekrarlıyor. Yönetim paneli ağır dosya
    yüklendiğinde uyarı gösterir.

---

### Modül 6: Hatırlatıcılar (`reminders`)
Zamanlanmış, tekrarlayan alarmlar ve etkinlik takibi modülüdür.

- **Veri Şeması (`reminders`):**
  - `id` (UUID, PK)
  - `baby_id` (UUID, FK -> `babies.id`)
  - `title` (String, Zorunlu)
  - `category` (Enum: 'feeding', 'sleep', 'diaper', 'medicine', 'vaccine', 'doctor', 'event', 'custom', Zorunlu)
  - `remind_at` (DateTime, Zorunlu)
  - `is_recurring` (Boolean)
  - `recurrence_interval` (Enum: 'daily', 'weekly', 'custom_hours')
  - `notification_offsets` (Array of Integers, Örn: `[30, 15, 5, 0]` - dk öncesi)
  - `device_alarm_ids` (Array of Strings - Telefon alarm ID referansları)
  - `enable_device_alarm` (Boolean, Varsayılan: true)
  - `is_active` (Boolean, Varsayılan: true)
  - `created_at`, `updated_at`

- **Cihaz Alarm Entegrasyonu:**
  - Hatırlatıcı zamanlandığında telefonun kendi varsayılan saat/alarm uygulamasına yerel etkinlik eklenir. Süresi geçen veya tamamlanan hatırlatıcıların alarmları cihazdan otomatik temizlenir.

---

### Modül 7: Günlük Akış (`timeline`)
Tüm bakım ve aktivite verilerinin kronolojik akış halindeki birleşik gösterimidir.

- **API End-point'leri:**
  - `GET /api/v1/timeline?baby_id=:babyId&date=YYYY-MM-DD&categories=feeding,sleep,diaper...`
- **İş Mantığı:** Tüm modül verilerini zaman damgasına (`timestamp`) göre birleştirip filtrelenebilir tek bir feed olarak sunar.

---

### Modül 8: Aile ve Yetkiler (`family`)
Bebek profilinin anne, baba, bakıcı ve diğer aile yakınları arasında paylaşılmasını sağlar.

- **Veri Şemaları:**
  - `baby_members`: `id`, `baby_id`, `user_id`, `role` ('admin', 'caregiver', 'viewer'), `relation_type` ('mother', 'father', 'nanny', 'grandparent', 'relative'), `status` ('pending', 'active')
  - `invitations`: `id`, `baby_id`, `invite_code`, `email`, `role`, `expires_at`
- **İş Mantığı:** E-posta veya QR kod ile davet. `viewer` rolü veri giremez/silemez, sadece canlı akışı ve sayaçları izler.

---

### Modül 9: Raporlar ve Eğilim Grafikleri (`reports`)
Gelişmiş tarih filtreli beslenme, uyku ve gelişim grafik analiz modülüdür.

- **İş Mantığı & Tarih Filtreleme:**
  - Hızlı filtreler: `Bugün`, `Dün`, `Bu Hafta`, `Geçen Hafta`, `Bu Ay`.
  - **Özel Tarih Aralığı Seçici (Custom Range Picker):** İstenilen başlangıç (`start_date`) ve bitiş (`end_date`) tarihleri girilerek geçmişe dönük beslenme (ml/süre), uyku ve bez istatistikleri sorgulanabilir.
- **Eğilim (Trends) Grafiği:** Zamana bağlı değişim grafikleri (`react-native-chart-kit` / `victory-native`) ile gösterilir.
- **PDF Çıktı:** Seçilen tarih aralığı tek tıkla doktor kontrolü için PDF formatında indirilip paylaşılabilir (`EMAIL_FROM` üzerinden e-posta atılabilir).

---

### Modül 10: Görevler (`tasks`)
Ebeveynlerin birbirine veya bakıcılara mama tarifi, sağılmış süt verilişi veya ilaç/bakım talimatlarını görev olarak atamasını sağlar.

- **Veri Şeması (`tasks`):**
  - `id` (UUID, PK)
  - `baby_id` (UUID, FK -> `babies.id`)
  - `creator_user_id` (UUID, Görevi Atayan)
  - `assigned_user_id` (UUID, Atanan Birey)
  - `title` (String, Zorunlu)
  - `task_type` (Enum: 'formula_prep', 'breast_milk_feed', 'medicine', 'vaccine_visit', 'care', 'custom')
  - `status` (Enum: 'pending', 'in_progress', 'completed', 'cancelled', Varsayılan: 'pending')
  - `due_time` (DateTime, Zorunlu)
  - `instruction_details` (JSON Field):
    - *formula_prep:* `formula_amount_ml`, `formula_scoops`, `hot_water_ml`, `cold_water_ml`, `special_notes`
    - *breast_milk_feed:* `pumping_stash_id`, `heating_method`
  - `notification_offsets` (Array of Integers, Örn: `[30, 15, 5, 0]`)
  - `device_alarm_ids` (Array of Strings)
  - `completed_at` (DateTime)
  - `created_at`, `updated_at`

- **Görev Takip ve Döngü Mantığı:**
  - Görev zamanı geldiğinde `bildirim5.mp3` çalar.
  - Görev saati geçmesine rağmen tamamlanmadıysa, görev `Tamamlandı` veya `İptal` edilene kadar her 5 dakikada bir `bildirim6.mp3` sesi çalmaya devam eder.
  - Görevi alan kişi "Tamamlandı" olarak işaretlediğinde, yapılan işlem otomatik olarak ilgili modüle (`feedings` vb.) bir aktivite kaydı olarak dönüştürülür.

---

### Modül 11: Aşı Takibi (`vaccines`)
Ulusal ve özel aşıların takvimsel yönetimi, görev ataması ve lokasyon kayıt modülüdür.

- **Ulusal ve Özel Aşı Kataloğu (Seed Data):**
  - *0. Ay:* Hep B (1. Doz)
  - *1. Ay:* Hep B (2. Doz)
  - *2. Ay:* BCG Verem (1. Doz), DaBT-İPA-Hib 5'li Karma (1. Doz), KPA Zatürre (1. Doz)
  - *4. Ay:* DaBT-İPA-Hib (2. Doz), KPA (2. Doz)
  - *6. Ay:* Hep B (3. Doz), DaBT-İPA-Hib (3. Doz), OPA Çocuk Felci (1. Doz)
  - *12. Ay:* KKK (1. Doz), KPA (Pekiştirme), Suçiçeği (1. Doz)
  - *18. Ay:* DaBT-İPA-Hib (Pekiştirme), OPA (2. Doz), Hep A (1. Doz)
  - *24. Ay:* Hep A (2. Doz)
  - *4-6 Yaş / İlkokul 1:* KKK (2. Doz), DaBT-İPA (Pekiştirme)
  - *13-14 Yaş / Ortaokul 8:* Td Erişkin Tipi Difteri-Tetanos
  - *Özel Aşılar:* Rotavirüs (2/3 Doz), Meningokok B (Bexsero), Meningokok ACWY (Nimenrix/Menactra), HPV, Grip.
  - *Diğer / Özel:* Kullanıcının elle eklediği özel aşılar.

- **Veri Şemaları:**
  - `vaccine_definitions`: `id`, `name`, `category` ('mandatory', 'optional', 'custom'), `target_month`, `dose_number`, `description`
  - `baby_vaccines`: `id`, `baby_id`, `vaccine_definition_id`, `custom_vaccine_name`, `status` ('pending', 'completed', 'delayed'), `planned_date`, `location` (Aşı yapılacağı sağlık kuruluşu), `assigned_task_id` (FK -> `tasks.id`), `completed_date`, `doctor_name`, `side_effects` (JSON - fever, redness, swelling vb.), `notification_offsets` (`[10080, 2880, 1440]` -> 1 Hafta, 2 Gün, 1 Gün önce)

- **Bildirim ve Görev Bağlantısı:**
  - Bebek profili açıldığında doğum tarihine göre zorunlu aşılar otomatik zamanlanır.
  - Aşı için tarih ve lokasyon seçildiğinde 1 Hafta, 2 Gün ve 1 Gün öncesi için 3 aşamalı cihaz ve bildirim alarmları kurulur (`bildirim4.mp3`).
  - Ebeveyn isterse aşı yaptırma aksiyonunu `tasks` modülü üzerinden diğer ebeveyne görev olarak atayabilir.

---

### Modül 12: Bildirim Merkezi (`notifications`)
Sağ üst köşedeki zil ikonuna bağlı çalışan canlı bildirim ve yönlendirme merkezidir.

- **Veri Şeması (`notifications`):**
  - `id` (UUID, PK)
  - `user_id` (UUID, Alıcı Kullanıcı)
  - `baby_id` (UUID, FK -> `babies.id`)
  - `title` (String, Zorunlu)
  - `body` (String, Zorunlu)
  - `type` (Enum: 'vaccine', 'task', 'reminder', 'routine', 'family')
  - `target_screen` (String - Mobil yönlendirme ekranı)
  - `target_id` (UUID - İlgili aşı, görev veya beslenme ID'si)
  - `is_read` (Boolean, Varsayılan: false)
  - `created_at` (DateTime)

- **UI ve Arayüz Kuralları:**
  - Sağ üst köşede menü ikonunun yanında bildirim zili yer alır.
  - Okunmamış bildirim olduğunda kırmızı rozet (badge counter: `🔴 3`) görünür.
  - Yeni bildirim düştüğünde `bildirim8.mp3` sesi 2 tekrar çalar.
  - Bildirime dokunulduğunda `target_screen` uyarınca doğrudan ilgili modül detayına yönlendirme (Deep-linking) yapılır.

---

## 4. DASHBOARD VE ARAYÜZ (UI/UX) STANDARTLARI

1. **Görsel Tasarım & Renk Paleti:**
  - Soft Pastel Tonlar (Yumuşak Krem `#FDFBF7`, Pastel Mavi `#A8C3A8`, Pastel Pembe `#F4C2C2`).
  - Gece takibinde ebeveyn gözünü yormamak için **Otomatik Karanlık Mod (Dark Mode)** desteği.
2. **Tek Elle Kullanım (One-Handed UX):**
  - Bebek kucaktayken kullanım pratikliği için tüm sayaç başlatıcılar ve hızlı aksiyon butonları ekranın alt 2/3'lük alanında konumlandırılmıştır.
3. **Genel Dashboard Yapısı:**
  - **Üst Alan:** Bebek profili, yaş sayacı, bildirim zili ve menü.
  - **Canlı Takip Çubuğu:** Son beslenme, son uyku, son bez ve uyanıklık penceresi (wake window).
  - **Hızlı Aksiyon  Izgarası (Grid):** Beslenme, Uyku, Bez, Ninni, Hatırlatıcı, Görevler ve Aşılar kısa yolları.
  - **Günün Kronolojik Akışı:** Renk kodlu timeline özet kartları.
  - **Alt Gezinti Barı (Bottom Bar):** Ana Sayfa, Akış, Hızlı Ekle (+), Raporlar, Aile.