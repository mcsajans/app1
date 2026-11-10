# Bebiqa — Teknik Doküman

**Proje:** Bebek & Çocuk Takip Uygulaması (Android)
**Platform:** React Native (Android öncelikli, iOS'a hazır mimari)
**Backend:** Node.js (Express + TypeScript) REST API + MySQL (WAMP / phpMyAdmin)
**Erişim modeli:** Çok kullanıcılı — e-posta/şifre ile hesap, bebek bazlı paylaşım ve yetkilendirme
**Yönetim paneli:** Tarayıcıdan `/admin` (yalnızca sistem yöneticisi)
**Doküman tarihi:** 2026-11-01 (v2 — çok kullanıcılı mimariye geçiş)
**Durum:** v1 mobil kabuk çalışıyor; backend geliştirmesi başlıyor

---

## 1. Amaç ve Kapsam

Ebeveynin bir veya birden fazla bebeğin **beslenme**, **emzirme**, **uyku**, **uyutma müziği** ve **hatırlatıcı** verilerini tek uygulamada takip etmesini sağlayan modüler bir Android uygulaması.

### 1.1 Fonksiyonel Kapsam (v1)

| # | Özellik | Açıklama |
|---|---------|----------|
| 1 | Çoklu bebek profili | Ad, soyad, cinsiyet, doğum tarihi (yaş otomatik ay+gün), fotoğraf, hızlı profil geçişi |
| 2 | Emzirme sayacı | Sağ/sol meme ayrı aktif süre, başlangıç/bitiş saati, duraklat-devam, ss:dd:ss hassasiyet |
| 3 | Biberon / Mama kaydı | Tür seçimi (anne sütü / formül mama / ek gıda), miktar + birim (ml / cl) |
| 4 | Uyku takibi | Kronometre veya manuel saat girişi, gece uykusu / gündüz şekerlemesi ayrımı |
| 5 | Müzik / Ninni | Yerel + uzak kaynaklı parçalar, arka planda çalma, uyku zamanlayıcısı, döngü |
| 6 | Akıllı hatırlatıcı | Emzirme arası periyoda göre (2/3/5 saat…) otomatik bildirim planlama |
| 7 | Sessiz saat (uyku penceresi) | Bebek uyurken bildirimi erteleme veya sessize alma |
| 8 | Günlük akış (Timeline) | Seçili bebeğin o güne ait tüm kayıtları kronolojik kart akışı |
| 9 | Modül yönetimi | Ayarlar ekranından her modülün aktif/pasif edilmesi |
| 10 | Kullanıcı hesapları | E-posta + şifre ile kayıt ve giriş; her ebeveynin kendi profili |
| 11 | Paylaşım ve yetkilendirme | Bebeği oluşturan kişi; anne, baba, dede, babaanne, anneanne, hala, teyze, amca, dayı, kardeş gibi yakınları davet eder ve yetki verir |
| 12 | Denetim izi | Her kaydın kim tarafından, hangi saatte girildiği; diğer ebeveynler görebilir |
| 13 | Bez değişimi | Cis / kaka / karışık, pişik notu — paylaşımlı kullanımın tipik örneği |
| 14 | Yönetim paneli | Sistem yöneticisinin tarayıcıdan eriştiği operasyon paneli |

### 1.2 Kapsam Dışı (v2+ için not)

Büyüme/gelişim grafikleri (kilo-boy-baş çevresi), aşı takvimi, ilaç takibi,
bulut yedekleme, iOS yayını, ebeveynler için web arayüzü (yönetim paneli yalnızca
sistem yöneticisine açıktır), gerçek zamanlı canlı senkronizasyon (WebSocket).

---

## 2. Mimari Genel Bakış

```
┌─────────────────────────────────────────────────────────┐
│  REACT NATIVE APP (Android)                             │
│                                                         │
│  UI Katmanı (React Navigation + ekranlar)               │
│        ↕                                                │
│  State Katmanı (Zustand store'ları)                     │
│        ↕                                                │
│  Servis Katmanı                                         │
│   ├── AuthService       (giriş, token yenileme)         │
│   ├── TimerService      (emzirme/uyku kronometresi)     │
│   ├── NotificationSvc   (planlama, sessiz saat)         │
│   ├── AudioService      (müzik, arka plan, sleep timer) │
│   ├── SyncService       (offline kuyruk → API)          │
│   └── ModuleRegistry    (aktif/pasif modül yönetimi)    │
│        ↕                                                │
│  Yerel Depolama                                         │
│   ├── SQLite  (seçili kullanıcının offline kopyası)     │
│   ├── MMKV    (ayarlar, aktif timer snapshot)           │
│   └── SecureStore (access + refresh token)              │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS/JSON + Bearer JWT
                        ▼
┌─────────────────────────────────────────────────────────┐
│  NODE.JS API  (Express 5 @ 127.0.0.1:4000)              │
│                                                         │
│   Express 5 + TypeScript                                │
│   Route → Validator (zod) → Service → Repository        │
│                                                         │
│   Ara katmanlar:                                        │
│    authenticate  → JWT doğrula, req.user                │
│    requireBaby   → baby_members'tan yetki çöz           │
│    audit         → activity_log'a yaz                   │
│                                                         │
│   /api/v1/*   mobil uygulama (JWT)                      │
│   /admin/*    yönetim paneli (EJS + çerez oturumu)      │
└───────────────────────┬─────────────────────────────────┘
                        │ mysql2 havuzu
                        ▼
┌─────────────────────────────────────────────────────────┐
│  MySQL 8.4.7 — veritabanı: bebektakip  (WAMP)           │
└─────────────────────────────────────────────────────────┘
```

> **Apache artık gerekmiyor.** API ve yönetim paneli Node tarafından sunulur; WAMP
> yalnızca MySQL (ve istenirse phpMyAdmin) için çalışır durumda kalır.

### 2.1 Offline-First Yaklaşımı

Uygulama **her zaman önce yerel SQLite'a yazar**, ardından `sync_queue` üzerinden API'ye gönderir. Sebep: ebeveyn gece yarısı emzirirken Wi-Fi/sunucu erişimi garanti değildir; kronometre verisi kaybedilemez.

- Her kayıt istemcide **UUID v4** (`sync_uuid`) ile üretilir → sunucu tarafında idempotent `INSERT ... ON DUPLICATE KEY UPDATE`.
- Çakışma çözümü: **last-write-wins**, `updated_at` karşılaştırması.
- Senkronizasyon tetikleyicileri: uygulama ön plana geldiğinde, kayıt oluşturulduğunda, ağ bağlantısı geri geldiğinde (`@react-native-community/netinfo`).

**Çok kullanıcılı ortamda offline'ın sınırları.** Paylaşımlı bir bebekte başka bir
ebeveynin girdiği kayıt ancak senkronizasyonla gelir; bu yüzden:

- Yerel SQLite **yalnızca o cihazda giriş yapmış kullanıcının eriştiği** bebeklerin
  aynasıdır. Çıkış yapıldığında yerel veri silinir (başka bir aile üyesi aynı cihazda
  giriş yaparsa önceki verinin kalmaması için).
- `sync_queue`'daki kayıtlar `created_by` olmadan gönderilir; sunucu token'dan yazar.
  Böylece çevrimdışı girilen kayıt da doğru kişiye atfedilir.
- Yetkisi sonradan düşürülen (`editor` → `viewer`) bir kullanıcının kuyrukta bekleyen
  kayıtları sunucu tarafından **reddedilir** (`403`), istemci bunları "gönderilemedi"
  olarak işaretler ve kullanıcıya gösterir.
- Timeline'da henüz senkronize olmamış kayıtlar "⏳ bekliyor" rozetiyle gösterilir.

---

## 3. Teknoloji Yığını

### 3.1 Mobil

| Katman | Seçim | Gerekçe |
|--------|-------|---------|
| Framework | **Expo SDK 58 / React Native 0.88.1 / React 19.3** (kurulu sürümler) | Expo'nun geliştirme konforu + native modül kullanma esnekliği (CNG + dev build) |
| Dil | TypeScript (strict) | Kayıt tipleri, enum güvenliği |
| Navigasyon | `@react-navigation/native` + native-stack | Tek düzeyli yığın; modül listesi runtime'da katalogdan türetilir. `bottom-tabs` 2026-11-02'de kaldırıldı (§9.6) |
| State | `zustand` + `immer` | Hafif; timer gibi yüksek frekanslı güncellemelerde Redux'tan ucuz |
| Yerel DB | `expo-sqlite` (veya `react-native-nitro-sqlite`) | Offline kayıt + timeline sorguları |
| Hızlı KV | `react-native-mmkv` | Timer snapshot'ını saniyede yazmak için AsyncStorage'dan belirgin hızlı |
| HTTP | `axios` + interceptor | Timeout, retry, `Authorization: Bearer` ekleme, 401'de otomatik token yenileme |
| Token saklama | `expo-secure-store` | Refresh token Android Keystore ile şifrelenir; MMKV/AsyncStorage'a yazılmaz |
| Bildirim | `notifee` (**önerilen**) veya `expo-notifications` | Notifee: tam kontrollü kanal, trigger alarm, foreground service |
| Ses | `expo-audio` (yeni API) veya `react-native-track-player` | Arka plan çalma + kilit ekranı kontrolü gerekiyorsa track-player |
| Kronometre arka plan | `notifee` foreground service | Android 14+ uzun süreli timer için gerekli |
| Fotoğraf | `expo-image-picker` + `expo-image-manipulator` | Galeri/kamera + 512px'e küçültme |
| Tarih | `dayjs` + `dayjs/locale/tr` | Yaş hesabı, timeline gruplama; moment'ten hafif |
| Form | `react-hook-form` + `zod` | Miktar/birim doğrulama |
| İkon | `react-native-vector-icons` veya `@expo/vector-icons` | — |

> **Not:** Paket sürümleri kurulum anında `npx expo install` ile SDK'ya uyumlu şekilde çözülmelidir; buradaki sürümler minimum eşiktir.

### 3.2 Backend

| Katman | Seçim | Gerekçe |
|--------|-------|---------|
| Çalışma ortamı | **Node.js 24** (kurulu: v24.15.0) | — |
| Dil | TypeScript (strict), ESM | Mobil tarafla ortak tip anlayışı |
| Framework | **Express 5** | Yaygın, ara katman modeli yetki kontrolüne birebir uyuyor |
| Veritabanı | MySQL 8.4.7 — `bebektakip` | Mevcut WAMP kurulumu korunur |
| Sürücü | `mysql2/promise` + bağlantı havuzu | Hazır ifade (prepared statement) zorunlu |
| Sorgu yöntemi | **Ham SQL** (ORM yok) | Şema dokümandaki DDL ile birebir aynı kalır, phpMyAdmin'de okunabilir |
| Migration | Numaralı `.sql` dosyaları + `npm run migrate` | Sürüm takibi `schema_migrations` tablosunda |
| Doğrulama | `zod` | İstek gövdesi + çevre değişkeni şeması |
| Şifre | `node:crypto` **scrypt** | Native derleme gerektirmez (Windows'ta node-gyp sorunu yaşanmaz) |
| Token | `jsonwebtoken` (HS256) | Access + rotating refresh |
| Güvenlik | `helmet`, `express-rate-limit`, `cors` | Başlıklar, kaba kuvvet koruması |
| Dosya yükleme | `multer` + `sharp` | Fotoğraf küçültme, mp3 yükleme |
| Yönetim paneli | `ejs` + `express-session` | Sunucu tarafı render, ayrı derleme hattı yok |
| Günlükleme | `pino` + `pino-http` | İstek kimliği ile yapılandırılmış log |
| Test | `vitest` + `supertest` | Yetki matrisi testleri için |
| Format | JSON, `Content-Type: application/json; charset=utf-8` | — |

### 3.3 Geliştirme Ortamı (bu makinede doğrulanan durum)

| Bileşen | Durum |
|---------|-------|
| Node.js | v24.15.0 ✅ |
| npm | 11.12.1 ✅ |
| MySQL | 8.4.7 ✅ (`bebektakip` veritabanı mevcut, henüz tablosu yok) |
| Apache | 2.4.65 ✅ |
| Android SDK | `%LOCALAPPDATA%\Android\Sdk` ✅ (platform-tools, emulator, build-tools 36) |
| Android Studio | Kurulu ✅ (bundled JBR = **JDK 25**) |
| Emülatör | `Medium_Phone_API_37.0` ✅ (API 37) |
| JDK (derleme) | **Temurin 17.0.20.1** → `C:\Users\mehmetcansurucu\.jdks\jdk-17.0.20.1+1` ✅ |
| Gradle | 9.4.1 (wrapper, prebuild tarafından üretildi) |

> Android Studio'nun JBR'ı JDK 25 olduğu için derlemede kullanılmıyor; Temurin 17
> ayrı olarak (yönetici izni gerekmeyen zip dağıtımı) kullanıcı dizinine kuruldu.
> Derleme öncesi gereken ortam değişkenleri:
> ```
> JAVA_HOME     = C:\Users\mehmetcansurucu\.jdks\jdk-17.0.20.1+1
> ANDROID_HOME  = C:\Users\mehmetcansurucu\AppData\Local\Android\Sdk
> PATH         += %JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools
> ```

---

## 4. Veritabanı Tasarımı

**Veritabanı:** `bebektakip`
**Karakter seti:** `utf8mb4` / **Collation:** `utf8mb4_tr_0900_ai_ci` (Türkçe sıralama, büyük-küçük harf duyarsız)
**Motor:** InnoDB (yabancı anahtar + transaction)

### 4.1 Zaman Damgası Politikası

Tüm olay zamanları **UTC** olarak `DATETIME(3)` tipinde saklanır (milisaniye hassasiyet). İstemci cihaz saat dilimine çevirerek gösterir. Gerekçe: yaz saati geçişi ve seyahat durumunda süre hesapları bozulmaz. Her kayıtta ayrıca `tz_offset_min` tutulur ki "saat 03:00'te emzirdi" bilgisi geçmişe dönük doğru raporlanabilsin.

**`DEFAULT CURRENT_TIMESTAMP(3)` tek başına UTC vermez.** MySQL bu varsayılanı
oturumun `time_zone` değişkenine göre hesaplar; WAMP'ta bu `SYSTEM`, yani
+03:00. mysql2 havuzundaki `timezone: 'Z'` ayarı ise yalnızca **sürücünün**
dönüşümünü belirler (JS `Date` → UTC yazılır, dönen DATETIME UTC kabul edilir)
ve sunucunun varsayılanını etkilemez. İkisi birlikte, veritabanı varsayılanıyla
yazılan her sütunun üç saat ileri saklanıp olduğu gibi geri okunması demekti.
Bu yüzden havuz, **her yeni bağlantıda `SET time_zone = '+00:00'`** çalıştırır
(`src/db/index.ts`). Yeni bir sunucuya taşınırken ilk doğrulanacak şey budur:
`meta.server_time` (Node'dan gelir) ile bir kaydın `created_at` değeri aynı
dakikayı göstermelidir.

### 4.2 Tablo Yapısı (DDL)

```sql
CREATE DATABASE IF NOT EXISTS bebektakip
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_tr_0900_ai_ci;
USE bebektakip;

-- ─────────────────────────────────────────────
-- 1) KULLANICILAR ve OTURUM
-- ─────────────────────────────────────────────
CREATE TABLE users (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sync_uuid       CHAR(36)        NOT NULL,
  email           VARCHAR(190)    NOT NULL,         -- 190: utf8mb4 + unique index sınırı
  password_hash   VARCHAR(255)    NOT NULL,         -- scrypt$N$r$p$salt$hash
  full_name       VARCHAR(120)    NOT NULL,
  phone           VARCHAR(25)     NULL,
  avatar_path     VARCHAR(255)    NULL,
  locale          VARCHAR(10)     NOT NULL DEFAULT 'tr',
  is_admin        TINYINT(1)      NOT NULL DEFAULT 0,  -- yönetim paneli erişimi
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,  -- askıya alınmış hesap = 0
  email_verified_at DATETIME(3)   NULL,
  last_login_at   DATETIME(3)     NULL,
  failed_logins   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until    DATETIME(3)     NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                  ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at      DATETIME(3)     NULL,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_uuid (sync_uuid),
  KEY ix_users_admin (is_admin, is_active)
) ENGINE=InnoDB;

-- Dönen (rotating) refresh token'lar. Düz token saklanmaz, yalnızca SHA-256 özeti.
CREATE TABLE refresh_tokens (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  token_hash    CHAR(64)        NOT NULL,          -- sha256 hex
  device_uuid   CHAR(36)        NULL,
  device_name   VARCHAR(80)     NULL,
  user_agent    VARCHAR(255)    NULL,
  ip            VARCHAR(45)     NULL,
  expires_at    DATETIME(3)     NOT NULL,
  revoked_at    DATETIME(3)     NULL,
  replaced_by   BIGINT UNSIGNED NULL,              -- rotation zinciri
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_rt_hash (token_hash),
  KEY ix_rt_user (user_id, revoked_at, expires_at),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE password_resets (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64)        NOT NULL,
  expires_at  DATETIME(3)     NOT NULL,
  used_at     DATETIME(3)     NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_pr_hash (token_hash),
  KEY ix_pr_user (user_id),
  CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 2) BEBEK PROFİLLERİ
-- ─────────────────────────────────────────────
CREATE TABLE babies (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sync_uuid     CHAR(36)        NOT NULL,
  first_name    VARCHAR(60)     NOT NULL,
  last_name     VARCHAR(60)     NULL,
  gender        ENUM('kiz','erkek','belirtilmedi') NOT NULL DEFAULT 'belirtilmedi',
  birth_date    DATE            NOT NULL,
  birth_time    TIME            NULL,              -- doğum saati (opsiyonel)
  -- Doğum ölçüleri (009). FLOAT yuvarlama hatası ürettiği için DECIMAL/INT:
  birth_weight_g        INT UNSIGNED     NULL,     -- gram, tam sayı (200–9000)
  birth_height_cm       DECIMAL(4,1)     NULL,     -- 20–80
  head_circumference_cm DECIMAL(4,1)     NULL,     -- 15–60
  is_premature          TINYINT(1)       NOT NULL DEFAULT 0,
  gestational_age_weeks TINYINT UNSIGNED NULL,     -- prematüre ise ZORUNLU (20–42)
  photo_path    VARCHAR(255)    NULL,              -- /uploads/babies/{rastgele}.jpg
  blood_type    ENUM('A+','A-','B+','B-','AB+','AB-','0+','0-') NULL,
  note          VARCHAR(500)    NULL,
  created_by    BIGINT UNSIGNED NOT NULL,          -- SAHİP; paylaşım yetkisi yalnızca onda
  updated_by    BIGINT UNSIGNED NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at    DATETIME(3)     NULL,              -- soft delete
  UNIQUE KEY uq_babies_uuid (sync_uuid),
  KEY ix_babies_owner (created_by, deleted_at),
  CONSTRAINT fk_babies_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;
```

> `is_selected` ve `sort_order` alanları `babies` tablosundan **kaldırıldı**. Çok
> kullanıcılı yapıda "seçili bebek" ve sıralama kişiye özeldir; bu yüzden
> `baby_members` tablosuna taşındı. Aynı bebek anne için 1. sırada, dede için 3. sırada
> olabilir.

```sql
-- ─────────────────────────────────────────────
-- 3) ÜYELİK ve DAVETLER  (paylaşım çekirdeği)
-- ─────────────────────────────────────────────
CREATE TABLE baby_members (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  baby_id            BIGINT UNSIGNED NOT NULL,
  user_id            BIGINT UNSIGNED NOT NULL,

  -- Yakınlık: yalnızca gösterim içindir, yetki vermez.
  relationship       ENUM('anne','baba','dede','babaanne','anneanne','hala','teyze',
                          'amca','dayi','kardes','ustanne','ustbaba','bakici','diger')
                     NOT NULL DEFAULT 'diger',
  relationship_label VARCHAR(40)  NULL,            -- 'diger' seçilirse serbest etiket

  -- Yetki: tüm erişim kararları BU alana bakar.
  permission         ENUM('owner','editor','viewer') NOT NULL DEFAULT 'viewer',

  -- Kişiye özel görünüm tercihleri
  is_selected        TINYINT(1)   NOT NULL DEFAULT 0,  -- bu kullanıcının aktif bebeği
  sort_order         SMALLINT     NOT NULL DEFAULT 0,
  notifications_on   TINYINT(1)   NOT NULL DEFAULT 1,

  invited_by         BIGINT UNSIGNED NULL,
  joined_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  is_active          TINYINT(1)   NOT NULL DEFAULT 1,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                  ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE KEY uq_member (baby_id, user_id),
  KEY ix_member_user (user_id, is_active),          -- "girişteki kullanıcının bebekleri"
  KEY ix_member_baby (baby_id, is_active),
  CONSTRAINT fk_bm_baby    FOREIGN KEY (baby_id)    REFERENCES babies(id) ON DELETE CASCADE,
  CONSTRAINT fk_bm_user    FOREIGN KEY (user_id)    REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_bm_inviter FOREIGN KEY (invited_by) REFERENCES users(id)  ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE baby_invitations (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  baby_id       BIGINT UNSIGNED NOT NULL,
  invited_by    BIGINT UNSIGNED NOT NULL,          -- daima bebeğin sahibi
  email         VARCHAR(190)    NOT NULL,
  relationship  ENUM('anne','baba','dede','babaanne','anneanne','hala','teyze',
                     'amca','dayi','kardes','ustanne','ustbaba','bakici','diger')
                NOT NULL DEFAULT 'diger',
  permission    ENUM('editor','viewer') NOT NULL DEFAULT 'viewer',  -- owner davet edilemez
  code_hash     CHAR(64)        NOT NULL,          -- 8 haneli kodun sha256'sı
  status        ENUM('pending','accepted','declined','revoked','expired')
                NOT NULL DEFAULT 'pending',
  expires_at    DATETIME(3)     NOT NULL,
  accepted_by   BIGINT UNSIGNED NULL,
  accepted_at   DATETIME(3)     NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_inv_code (code_hash),
  KEY ix_inv_email (email, status),                -- kayıt olunca bekleyen davetleri bul
  KEY ix_inv_baby (baby_id, status),
  CONSTRAINT fk_inv_baby    FOREIGN KEY (baby_id)     REFERENCES babies(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_inviter FOREIGN KEY (invited_by)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_inv_accept  FOREIGN KEY (accepted_by) REFERENCES users(id)  ON DELETE SET NULL
) ENGINE=InnoDB;
```

> Aynı bebek + e-posta için birden fazla `pending` davet olmaması, kısmi indeks
> bulunmadığından uygulama katmanında transaction içinde kontrol edilir.

```sql
-- ─────────────────────────────────────────────
-- 4) MODÜL KATALOĞU ve AKTİF/PASİF DURUMU
-- ─────────────────────────────────────────────
-- Modül aktifliği SİSTEM GENELİDİR: yalnızca yönetim panelinden değiştirilir ve
-- tüm kullanıcılar için aynı anda geçerli olur (§9.1). Kullanıcı veya bebek bazlı
-- modül durumu yoktur; bu yüzden ayrı bir module_states tablosu da yoktur.
CREATE TABLE modules (
  module_key    VARCHAR(40)  PRIMARY KEY,          -- 'breastfeeding', 'bottle', ...
  title         VARCHAR(80)  NOT NULL,
  description   VARCHAR(255) NULL,
  icon          VARCHAR(40)  NULL,
  is_core       TINYINT(1)   NOT NULL DEFAULT 0,   -- 1 ise panelden de kapatılamaz
  default_on    TINYINT(1)   NOT NULL DEFAULT 1,   -- seed'de is_enabled'ın başlangıcı
  is_enabled    TINYINT(1)   NOT NULL DEFAULT 1,   -- YÜRÜRLÜKTEKİ durum (panel yazar)
  config        JSON         NULL,                 -- modüle özel genel ayarlar
  sort_order    SMALLINT     NOT NULL DEFAULT 0,
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                             ON UPDATE CURRENT_TIMESTAMP(3),
  updated_by    BIGINT UNSIGNED NULL,              -- değişikliği yapan yönetici
  CONSTRAINT fk_mod_admin FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 5) BESLEME KAYITLARI (ana tablo — tüm türler)
-- ─────────────────────────────────────────────
CREATE TABLE feedings (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sync_uuid      CHAR(36)        NOT NULL,
  baby_id        BIGINT UNSIGNED NOT NULL,
  feed_type      ENUM('breast','bottle_breastmilk','bottle_formula','solid','water')
                 NOT NULL,
  started_at     DATETIME(3)     NOT NULL,         -- UTC
  ended_at       DATETIME(3)     NULL,
  tz_offset_min  SMALLINT        NOT NULL DEFAULT 180,
  duration_sec   INT UNSIGNED    NULL,             -- toplam aktif süre (emzirme)
  amount         DECIMAL(7,2)    NULL,             -- biberon/mama miktarı
  amount_unit    ENUM('ml','cl') NULL,
  amount_ml      DECIMAL(8,2)    GENERATED ALWAYS AS
                 (CASE amount_unit WHEN 'cl' THEN amount * 10 ELSE amount END) STORED,
  food_name      VARCHAR(80)     NULL,             -- ek gıda adı (sebze püresi, yoğurt…)
  note           VARCHAR(500)    NULL,
  entry_source   ENUM('timer','manual')  NOT NULL DEFAULT 'manual',
  status         ENUM('running','paused','completed') NOT NULL DEFAULT 'completed',
  created_by     BIGINT UNSIGNED NOT NULL,         -- kaydı giren kullanıcı (token'dan)
  updated_by     BIGINT UNSIGNED NULL,
  created_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                 ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at     DATETIME(3)     NULL,
  UNIQUE KEY uq_feed_uuid (sync_uuid),
  KEY ix_feed_baby_time (baby_id, started_at),
  KEY ix_feed_running (baby_id, status),
  CONSTRAINT fk_feed_baby    FOREIGN KEY (baby_id)    REFERENCES babies(id) ON DELETE CASCADE,
  CONSTRAINT fk_feed_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;
```

> `amount_ml` **generated column**: kullanıcı ml ya da cl girsin, raporlar tek birimde (ml) toplanır. Günlük toplam alınırken dönüşüm hatası imkânsız hale gelir.

```sql
-- ─────────────────────────────────────────────
-- 6) EMZİRME DETAYI — meme bazlı segmentler
-- ─────────────────────────────────────────────
CREATE TABLE breastfeeding_sessions (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  feeding_id       BIGINT UNSIGNED NOT NULL,
  left_active_sec  INT UNSIGNED    NOT NULL DEFAULT 0,
  right_active_sec INT UNSIGNED    NOT NULL DEFAULT 0,
  total_active_sec INT UNSIGNED    GENERATED ALWAYS AS
                   (left_active_sec + right_active_sec) STORED,
  pause_count      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  last_side        ENUM('left','right') NULL,      -- sonraki seansta hangi memeden başlanacağı
  UNIQUE KEY uq_bfs_feeding (feeding_id),
  CONSTRAINT fk_bfs_feed FOREIGN KEY (feeding_id) REFERENCES feedings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Her "başlat → durdur" aralığı bir segment. Aktif emme süresi = segmentlerin toplamı.
CREATE TABLE breastfeeding_segments (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id   BIGINT UNSIGNED NOT NULL,
  side         ENUM('left','right') NOT NULL,
  started_at   DATETIME(3)     NOT NULL,
  ended_at     DATETIME(3)     NULL,
  active_sec   INT UNSIGNED    NOT NULL DEFAULT 0,
  seq          SMALLINT UNSIGNED NOT NULL,         -- 1,2,3… sıra
  KEY ix_seg_session (session_id, seq),
  CONSTRAINT fk_seg_session FOREIGN KEY (session_id)
    REFERENCES breastfeeding_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 7) UYKU KAYITLARI
-- ─────────────────────────────────────────────
CREATE TABLE sleep_records (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sync_uuid      CHAR(36)        NOT NULL,
  baby_id        BIGINT UNSIGNED NOT NULL,
  sleep_type     ENUM('night','nap') NOT NULL DEFAULT 'nap',
  started_at     DATETIME(3)     NOT NULL,
  ended_at       DATETIME(3)     NULL,
  tz_offset_min  SMALLINT        NOT NULL DEFAULT 180,
  duration_sec   INT UNSIGNED    NULL,
  quality        ENUM('rahat','huzursuz','sik_uyandi') NULL,
  place          VARCHAR(60)     NULL,             -- yatak, puset, kucak…
  wake_count     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  note           VARCHAR(500)    NULL,
  entry_source   ENUM('timer','manual') NOT NULL DEFAULT 'manual',
  status         ENUM('running','completed') NOT NULL DEFAULT 'completed',
  created_by     BIGINT UNSIGNED NOT NULL,
  updated_by     BIGINT UNSIGNED NULL,
  created_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                 ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at     DATETIME(3)     NULL,
  UNIQUE KEY uq_sleep_uuid (sync_uuid),
  KEY ix_sleep_baby_time (baby_id, started_at),
  CONSTRAINT fk_sleep_baby    FOREIGN KEY (baby_id)    REFERENCES babies(id) ON DELETE CASCADE,
  CONSTRAINT fk_sleep_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 8) BEZ DEĞİŞİMİ
-- ─────────────────────────────────────────────
CREATE TABLE diapers (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sync_uuid      CHAR(36)        NOT NULL,
  baby_id        BIGINT UNSIGNED NOT NULL,
  changed_at     DATETIME(3)     NOT NULL,         -- olayın gerçekleştiği an (UTC)
  tz_offset_min  SMALLINT        NOT NULL DEFAULT 180,
  diaper_type    ENUM('cis','kaka','karisik','kuru') NOT NULL,
  consistency    ENUM('normal','yumusak','sulu','sert') NULL,
  color          ENUM('sari','yesil','kahverengi','siyah','kirmizi','diger') NULL,
  amount         ENUM('az','orta','cok') NULL,
  has_rash       TINYINT(1)      NOT NULL DEFAULT 0,
  cream_applied  TINYINT(1)      NOT NULL DEFAULT 0,
  note           VARCHAR(500)    NULL,
  created_by     BIGINT UNSIGNED NOT NULL,
  updated_by     BIGINT UNSIGNED NULL,
  created_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                 ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at     DATETIME(3)     NULL,
  UNIQUE KEY uq_diaper_uuid (sync_uuid),
  KEY ix_diaper_baby_time (baby_id, changed_at),
  CONSTRAINT fk_diaper_baby    FOREIGN KEY (baby_id)    REFERENCES babies(id) ON DELETE CASCADE,
  CONSTRAINT fk_diaper_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 9) HATIRLATICILAR ve SESSİZ SAAT
-- ─────────────────────────────────────────────
CREATE TABLE reminders (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  baby_id             BIGINT UNSIGNED NOT NULL,
  reminder_type       ENUM('feeding','breastfeeding','sleep','pumping','custom') NOT NULL,
  title               VARCHAR(80)     NOT NULL,
  description         VARCHAR(250)    NULL,        -- göç 018; etkinlik açıklaması
  -- Planlama modu:
  schedule_mode       ENUM('interval','fixed_times') NOT NULL DEFAULT 'interval',
  interval_minutes    SMALLINT UNSIGNED NULL,      -- 120, 180, 300 …
  anchor              ENUM('last_record','last_fired') NOT NULL DEFAULT 'last_record',
  fixed_times         JSON            NULL,        -- ["06:00","10:00","14:00"]
  -- Sessiz saat davranışı:
  respect_quiet_hours TINYINT(1)      NOT NULL DEFAULT 1,
  quiet_behavior      ENUM('postpone','silent','skip') NOT NULL DEFAULT 'postpone',
  -- Durum:
  is_enabled          TINYINT(1)      NOT NULL DEFAULT 1,
  next_trigger_at     DATETIME(3)     NULL,
  last_fired_at       DATETIME(3)     NULL,
  sound               VARCHAR(60)     NULL,
  vibrate             TINYINT(1)      NOT NULL DEFAULT 1,
  created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                      ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ix_rem_baby (baby_id, is_enabled),
  CONSTRAINT fk_rem_baby FOREIGN KEY (baby_id) REFERENCES babies(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE quiet_hours (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  baby_id         BIGINT UNSIGNED NOT NULL,
  label           VARCHAR(60)     NULL,            -- "Gece uykusu", "Öğle şekerlemesi"
  start_time      TIME            NOT NULL,        -- 22:30 (yerel saat)
  end_time        TIME            NOT NULL,        -- 06:30 (gün aşarsa normalize edilir)
  days_mask       TINYINT UNSIGNED NOT NULL DEFAULT 127, -- bit: Pzt=1 … Paz=64
  auto_from_sleep TINYINT(1)      NOT NULL DEFAULT 0,    -- aktif uyku kaydı varsa otomatik sessiz
  is_enabled      TINYINT(1)      NOT NULL DEFAULT 1,
  KEY ix_qh_baby (baby_id, is_enabled),
  CONSTRAINT fk_qh_baby FOREIGN KEY (baby_id) REFERENCES babies(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notification_log (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  baby_id               BIGINT UNSIGNED NOT NULL,
  reminder_id           BIGINT UNSIGNED NULL,
  local_notification_id VARCHAR(64)     NULL,      -- Notifee/OS tarafındaki id
  scheduled_at          DATETIME(3)     NOT NULL,
  fired_at              DATETIME(3)     NULL,
  status                ENUM('scheduled','fired','postponed','silenced','skipped','cancelled')
                        NOT NULL DEFAULT 'scheduled',
  postponed_to          DATETIME(3)     NULL,
  reason                VARCHAR(120)    NULL,      -- "quiet_hours 22:30-06:30"
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_nl_baby_time (baby_id, scheduled_at),
  CONSTRAINT fk_nl_baby FOREIGN KEY (baby_id)     REFERENCES babies(id)    ON DELETE CASCADE,
  CONSTRAINT fk_nl_rem  FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 10) MÜZİK MODÜLÜ
-- ─────────────────────────────────────────────
CREATE TABLE music_tracks (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(120)    NOT NULL,
  artist       VARCHAR(120)    NULL,
  category     ENUM('ninni','beyaz_gurultu','doga','klasik','kalp_atisi','dua','diger')
               NOT NULL DEFAULT 'ninni',
  source_type  ENUM('bundled','local_file','remote') NOT NULL DEFAULT 'remote',
  file_path    VARCHAR(255)    NULL,               -- /uploads/music/xxx.mp3
  remote_url   VARCHAR(500)    NULL,
  cover_path   VARCHAR(255)    NULL,
  duration_sec INT UNSIGNED    NULL,
  file_size    INT UNSIGNED    NULL,
  is_loopable  TINYINT(1)      NOT NULL DEFAULT 1,
  is_active    TINYINT(1)      NOT NULL DEFAULT 1,
  sort_order   SMALLINT        NOT NULL DEFAULT 0,
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_track_cat (category, is_active, sort_order)
) ENGINE=InnoDB;

CREATE TABLE music_playlists (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  baby_id    BIGINT UNSIGNED NULL,                 -- NULL = tüm bebekler
  name       VARCHAR(80)     NOT NULL,
  is_default TINYINT(1)      NOT NULL DEFAULT 0,
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_pl_baby FOREIGN KEY (baby_id) REFERENCES babies(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE playlist_tracks (
  playlist_id BIGINT UNSIGNED NOT NULL,
  track_id    BIGINT UNSIGNED NOT NULL,
  sort_order  SMALLINT        NOT NULL DEFAULT 0,
  PRIMARY KEY (playlist_id, track_id),
  CONSTRAINT fk_plt_pl FOREIGN KEY (playlist_id) REFERENCES music_playlists(id) ON DELETE CASCADE,
  CONSTRAINT fk_plt_tr FOREIGN KEY (track_id)    REFERENCES music_tracks(id)    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE music_play_log (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  baby_id         BIGINT UNSIGNED NOT NULL,
  track_id        BIGINT UNSIGNED NOT NULL,
  started_at      DATETIME(3)     NOT NULL,
  ended_at        DATETIME(3)     NULL,
  played_sec      INT UNSIGNED    NULL,
  sleep_timer_min SMALLINT UNSIGNED NULL,          -- seçilen otomatik kapanma süresi
  stop_reason     ENUM('user','timer','track_end','interrupt') NULL,
  created_by      BIGINT UNSIGNED NOT NULL,        -- müziği kim çaldı
  KEY ix_mpl_baby_time (baby_id, started_at),
  CONSTRAINT fk_mpl_baby    FOREIGN KEY (baby_id)    REFERENCES babies(id)       ON DELETE CASCADE,
  CONSTRAINT fk_mpl_track   FOREIGN KEY (track_id)   REFERENCES music_tracks(id) ON DELETE CASCADE,
  CONSTRAINT fk_mpl_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 11) DENETİM İZİ
-- ─────────────────────────────────────────────
CREATE TABLE activity_log (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  baby_id       BIGINT UNSIGNED NULL,              -- NULL = bebek bağlamı olmayan işlem
  user_id       BIGINT UNSIGNED NOT NULL,
  entity        ENUM('baby','member','invitation','feeding','breastfeeding','sleep',
                     'diaper','reminder','quiet_hour','music','module','account','admin')
                NOT NULL,
  entity_id     BIGINT UNSIGNED NULL,
  sync_uuid     CHAR(36)        NULL,
  action        ENUM('create','update','delete','restore','login','logout',
                     'invite','accept','revoke','permission_change')
                NOT NULL,
  summary       VARCHAR(255)    NOT NULL,          -- "Altını değiştirdi (kaka)"
  changes       JSON            NULL,              -- {"amount_ml":[120,150]}
  performed_at  DATETIME(3)     NOT NULL,          -- UTC
  tz_offset_min SMALLINT        NOT NULL DEFAULT 180,
  device_uuid   CHAR(36)        NULL,
  ip            VARCHAR(45)     NULL,
  user_agent    VARCHAR(255)    NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_al_baby_time (baby_id, performed_at),     -- bebek etkinlik geçmişi
  KEY ix_al_user_time (user_id, performed_at),     -- yönetim panelinde kullanıcı filtresi
  KEY ix_al_entity (entity, entity_id),
  CONSTRAINT fk_al_baby FOREIGN KEY (baby_id) REFERENCES babies(id) ON DELETE CASCADE,
  CONSTRAINT fk_al_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- 12) GENEL AYARLAR ve CİHAZLAR
-- ─────────────────────────────────────────────
CREATE TABLE app_settings (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,            -- ayarlar kişiye özeldir
  baby_id     BIGINT UNSIGNED NULL,                -- NULL = kullanıcı geneli
  setting_key VARCHAR(60)     NOT NULL,
  setting_val JSON            NOT NULL,
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                              ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_setting (user_id, baby_id, setting_key),
  CONSTRAINT fk_set_user FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_set_baby FOREIGN KEY (baby_id) REFERENCES babies(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE devices (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NOT NULL,           -- cihaz artık bir hesaba bağlı
  device_uuid  CHAR(36)        NOT NULL,
  device_name  VARCHAR(80)     NULL,
  platform     VARCHAR(20)     NULL,
  app_version  VARCHAR(20)     NULL,
  push_token   VARCHAR(255)    NULL,               -- ileride sunucu bildirimi için
  last_seen_at DATETIME(3)     NULL,
  last_sync_at DATETIME(3)     NULL,
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_dev (user_id, device_uuid),
  KEY ix_dev_user (user_id),
  CONSTRAINT fk_dev_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

> `devices.api_key` kaldırıldı. Kimlik doğrulama artık cihaz anahtarıyla değil,
> kullanıcı hesabına bağlı JWT ile yapılır (§5.6).

> **Değişiklik (2026-11-02).** Modül aktifliği kişiye özel olmaktan çıkarıldı.
> Önceki tasarımda `module_states` tablosu (kullanıcı + bebek kırılımında) tutuluyordu;
> artık tek doğruluk kaynağı `modules.is_enabled` sütunudur ve bunu yalnızca yönetim
> paneli yazar. Geçiş `008_global_modules.sql` ile yapılır:

```sql
ALTER TABLE modules
  ADD COLUMN is_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER default_on,
  ADD COLUMN config     JSON       NULL              AFTER is_enabled,
  ADD COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        ON UPDATE CURRENT_TIMESTAMP(3),
  ADD COLUMN updated_by BIGINT UNSIGNED NULL,
  ADD CONSTRAINT fk_mod_admin FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

UPDATE modules SET is_enabled = default_on;
UPDATE modules SET is_enabled = 1 WHERE is_core = 1;

DROP TABLE IF EXISTS module_states;
```

> Kişiye özel modül durumu **kasıtlı olarak** kaldırıldı: aynı bebeği takip eden anne
> ve babanın farklı sekme setleri görmesi destek tarafında karışıklık yaratıyordu.
> Tek yerden yönetim, sürüm başına tek bir arayüz tanımı anlamına gelir.

### 4.3 Timeline Görünümü (VIEW)

Günlük akış ekranı tek sorguyla beslenir:

Görünüm, kaydı girenin kimliğini de taşır — timeline kartındaki "Baba Mehmet kaydetti"
satırı buradan beslenir.

```sql
CREATE OR REPLACE VIEW v_timeline AS
SELECT f.baby_id, 'feeding' AS kind, f.id AS ref_id, f.sync_uuid,
       f.started_at, f.ended_at, f.duration_sec,
       f.feed_type AS subtype, f.amount_ml, f.note,
       f.created_by, f.created_at AS entered_at, f.updated_at
FROM feedings f WHERE f.deleted_at IS NULL
UNION ALL
SELECT s.baby_id, 'sleep', s.id, s.sync_uuid,
       s.started_at, s.ended_at, s.duration_sec,
       s.sleep_type, NULL, s.note,
       s.created_by, s.created_at, s.updated_at
FROM sleep_records s WHERE s.deleted_at IS NULL
UNION ALL
SELECT d.baby_id, 'diaper', d.id, d.sync_uuid,
       d.changed_at, NULL, NULL,
       d.diaper_type, NULL, d.note,
       d.created_by, d.created_at, d.updated_at
FROM diapers d WHERE d.deleted_at IS NULL
UNION ALL
SELECT m.baby_id, 'music', m.id, NULL,
       m.started_at, m.ended_at, m.played_sec,
       'music', NULL, NULL,
       m.created_by, m.started_at, m.started_at
FROM music_play_log m;
```

Sorgu örneği (seçili bebeğin bugünü, kaydı girenin adıyla birlikte):

```sql
SELECT t.*,
       u.full_name  AS actor_name,
       bm.relationship AS actor_relationship
FROM v_timeline t
JOIN users u         ON u.id  = t.created_by
LEFT JOIN baby_members bm ON bm.baby_id = t.baby_id AND bm.user_id = t.created_by
WHERE t.baby_id = :babyId
  AND t.started_at >= :dayStartUtc
  AND t.started_at <  :dayEndUtc
ORDER BY t.started_at DESC;
```

> Bu sorgu **daima** `requireBaby('viewer')` ara katmanından geçtikten sonra çalışır;
> `babyId` istemciden gelse de erişim hakkı sunucuda doğrulanmıştır (§5.5).

### 4.4 Seed Verisi — Modül Kataloğu

```sql
-- is_enabled seed'de default_on ile aynı başlar; sonrasını yalnızca panel değiştirir.
INSERT INTO modules (module_key, title, description, icon, is_core, default_on, is_enabled, sort_order) VALUES
('babies',        'Bebek Profilleri','Çoklu bebek yönetimi',               'baby',     1, 1, 1,  1),
('breastfeeding', 'Emzirme Sayacı',  'Sağ/sol meme kronometresi',          'timer',    0, 1, 1,  2),
('bottle',        'Biberon',         'Anne sütü / formül mama, ml-cl',     'bottle',   0, 1, 1,  3),
('solid',         'Ek Gıda',         'Mama ve katı gıda kaydı',            'bowl',     0, 0, 0,  4),
('sleep',         'Uyku Takibi',     'Gece uykusu ve şekerleme',           'moon',     0, 1, 1,  5),
('diaper',        'Bez Değişimi',    'Cis / kaka, pişik ve krem notu',     'diaper',   0, 1, 1,  6),
('music',         'Ninni & Müzik',   'Uyutma müzikleri, uyku zamanlayıcı', 'music',    0, 1, 1,  7),
('reminders',     'Hatırlatıcılar',  'Periyodik bildirim planlama',        'bell',     0, 1, 1,  8),
('timeline',      'Günlük Akış',     'Kronolojik kayıt akışı',             'timeline', 0, 1, 1,  9),
('family',        'Aile ve Yetkiler','Davet, yakınlık ve yetki yönetimi',  'users',    0, 1, 1, 10),
('reports',       'Raporlar',        'Günlük/haftalık özet',               'chart',    0, 0, 0, 11),
('pumping',       'Süt Sağma',       'Pompa ile sağma kaydı',              'pump',     0, 0, 0, 12);
```

> `family` modülü yalnızca bebeğin **sahibine** yönetim ekranı gösterir; `editor` ve
> `viewer` üyeler aynı ekranda yalnızca aile listesini okunur biçimde görür.

---

## 5. Kullanıcı Hesapları, Yetkilendirme ve Paylaşım

### 5.1 Kavramlar

Sistem dört kavramı birbirinden ayırır. Bunları karıştırmamak tasarımın temelidir:

| Kavram | Tablo | Açıklama |
|--------|-------|----------|
| **Kullanıcı** | `users` | E-posta + şifre ile hesap açmış gerçek kişi. Anne, baba, dede… hepsi birer kullanıcıdır. |
| **Üyelik** | `baby_members` | Bir kullanıcının belirli bir bebeğe bağlanması. Bebek–kullanıcı arasındaki köprü. |
| **Yakınlık** | `baby_members.relationship` | Kişinin bebeğe yakınlığı: anne, baba, dede, babaanne, anneanne, hala, teyze, amca, dayı, kardeş… **Sadece görüntüleme amaçlıdır, yetki vermez.** |
| **Yetki** | `baby_members.permission` | Kişinin ne yapabileceği: `owner` / `editor` / `viewer`. **Erişim kararları yalnızca buna bakar.** |

Bu ayrımın sebebi: "dede" olmak tek başına bir yetki seviyesi değildir. Bir ailede dede
kayıt girebilirken, başka bir ailede sadece görüntüleyici olabilir. Yakınlık arayüzde
"Dede Ahmet kaydetti" gibi okunur metin üretmek için, yetki ise erişim kontrolü için kullanılır.

### 5.2 Yetki Seviyeleri

| İşlem | `owner` | `editor` | `viewer` |
|-------|:-------:|:--------:|:--------:|
| Bebeğin kayıtlarını görmek (timeline, raporlar) | ✅ | ✅ | ✅ |
| Besleme / emzirme / uyku / bez kaydı eklemek | ✅ | ✅ | ❌ |
| Kendi eklediği kaydı düzenlemek / silmek | ✅ | ✅ | ❌ |
| **Başkasının** eklediği kaydı düzenlemek / silmek | ✅ | ❌ | ❌ |
| Bebek profilini düzenlemek (isim, fotoğraf, doğum tarihi) | ✅ | ❌ | ❌ |
| **Başka kişiyi davet etmek / yetkisini değiştirmek / çıkarmak** | ✅ | ❌ | ❌ |
| Hatırlatıcı ve sessiz saat tanımlamak | ✅ | ✅ | ❌ |
| Modül aç/kapat (o bebek için) | ✅ | ✅ | ❌ |
| Bebeği silmek | ✅ | ❌ | ❌ |
| Üyelikten kendi isteğiyle ayrılmak | ❌¹ | ✅ | ✅ |

¹ Sahip, bebeği silmeden veya sahipliği devretmeden ayrılamaz.

**Değişmez kural (kullanıcının açık talebi):**

> Bir kullanıcı, **kendi oluşturmadığı** bir bebeğin verisini başkasıyla paylaşamaz,
> başkasına görme yetkisi veremez.

Teknik karşılığı: `baby_members` üzerindeki tüm yazma işlemleri (`POST/PUT/DELETE
/babies/:id/members` ve `/invitations`) yalnızca `permission = 'owner'` olan üyeye
açıktır. Sunucu bunu istek gövdesine değil, veritabanındaki üyelik satırına bakarak
doğrular. İstemci tarafındaki gizleme yalnızca arayüz kolaylığıdır, güvenlik sınırı değildir.

Her bebeğin **tam olarak bir** `owner` üyeliği vardır ve bu, bebeği oluşturan kullanıcıdır
(`babies.created_by`). Sahiplik devri ayrı ve açık bir işlemdir
(`POST /babies/:id/transfer-ownership`); devirde eski sahip otomatik olarak `editor` olur.

### 5.3 Yakınlık Dereceleri

`baby_members.relationship` için izin verilen değerler:

```
anne · baba · dede · babaanne · anneanne · hala · teyze · amca · dayi
kardes · ustanne (üvey anne) · ustbaba (üvey baba) · bakici · diger
```

Arayüzde yakınlık + ad birleştirilerek gösterilir: *"Baba Mehmet"*, *"Anneanne Ayşe"*.
`diger` seçilirse kullanıcı serbest bir etiket girebilir (`relationship_label`).

Aynı yakınlık birden fazla kişide olabilir (örn. iki kardeş), bu yüzden `relationship`
üzerinde benzersizlik kısıtı **yoktur**; benzersiz olan `(baby_id, user_id)` çiftidir.

### 5.4 Paylaşım (Davet) Akışı

Sahip, bir kişiyi e-posta adresiyle davet eder. İki durum vardır:

```
Sahip "mehmet@ornek.com adresini baba / editor olarak davet et" der
        │
        ├── Bu e-posta ile kayıtlı kullanıcı VAR
        │      └─► baby_invitations satırı 'pending' açılır
        │          Kullanıcı uygulamayı açtığında "Elif için davetin var" bildirimi görür
        │          Kabul → baby_members satırı oluşur, davet 'accepted' olur
        │
        └── Kayıtlı kullanıcı YOK
               └─► Davet 'pending' olarak bekler + 8 haneli davet kodu üretilir
                   Kişi kayıt olduğunda e-postası eşleşen bekleyen davetler listelenir,
                   veya kayıt sırasında davet kodunu girerek doğrudan bağlanır
```

Davet kuralları:

- Davet **kodu** `baby_invitations.code` (8 hane, okunabilir alfabe — `0/O`, `1/I/l` yok).
  Veritabanında yalnızca `code_hash` saklanır; düz kod bir kez, daveti oluşturana gösterilir.
- Varsayılan geçerlilik **7 gün** (`expires_at`). Süresi geçen davet kabul edilemez.
- Sahip bekleyen daveti iptal edebilir (`status = 'revoked'`).
- Aynı bebek + aynı e-posta için aynı anda yalnızca bir `pending` davet olabilir.
- Davet kabul edildiğinde yetki **davette yazan** seviyedir; davet edilen kişi kendi
  yetkisini yükseltemez.
- Kabul anında kullanıcı zaten üyeyse davet `accepted` işaretlenir ama yetki **yükseltilmez**;
  yetki değişikliği sahibin açık işlemidir.

### 5.5 Sunucu Tarafı Yetki Kontrolü

Tüm bebek bağlamlı uç noktalar aynı ara katmandan geçer:

```ts
// src/middleware/babyAccess.ts
export const requireBaby = (min: Permission) => async (req, res, next) => {
  const babyId = Number(req.params.babyId ?? req.body.babyId);
  const row = await db.one(
    `SELECT permission, relationship FROM baby_members
      WHERE baby_id = ? AND user_id = ? AND is_active = 1`,
    [babyId, req.user.id],
  );

  // Üyelik yoksa 404 döner — 403 dönmek bebeğin varlığını sızdırırdı.
  if (!row) throw new NotFound('Bebek bulunamadı');
  if (RANK[row.permission] < RANK[min]) throw new Forbidden('Bu işlem için yetkin yok');

  req.membership = { babyId, ...row };
  next();
};

const RANK = { viewer: 1, editor: 2, owner: 3 };
```

Önemli ayrıntılar:

- **Üye olmayan kullanıcıya 404 dönülür, 403 değil.** 403 dönmek "bu id'de bir bebek var"
  bilgisini sızdırır ve id taramasına açık hale getirir.
- Kayıt düzenleme/silmede ek kontrol: `editor` yalnızca `created_by = req.user.id` olan
  kayda dokunabilir; `owner` hepsine dokunabilir.
- Liste uç noktaları (`GET /babies`) her zaman `JOIN baby_members` ile filtrelenir;
  "tüm bebekleri getir" diye bir sorgu uygulamada hiç yazılmaz.

### 5.6 Kimlik Doğrulama

| Konu | Karar |
|------|-------|
| Giriş | E-posta + şifre |
| Şifre saklama | **scrypt** (Node `crypto.scryptSync`, N=2¹⁵, r=8, p=1, 16 bayt salt). Kayıt biçimi: `scrypt$N$r$p$<salt_b64>$<hash_b64>`. Yerel derleme gerektiren native bağımlılık yok. |
| Oturum | **JWT access token** (15 dk) + **refresh token** (30 gün, döner/rotating) |
| Refresh saklama | `refresh_tokens` tablosunda yalnızca SHA-256 özeti. Kullanılan token iptal edilip yenisi verilir (rotation); aynı token ikinci kez kullanılırsa o kullanıcının **tüm** oturumları iptal edilir (token hırsızlığı tespiti). |
| Şifre kuralı | En az 8 karakter; çok kullanılan parola listesi kontrolü |
| Kaba kuvvet | `/auth/login` için IP + e-posta bazlı oran sınırı (15 dk'da 10 deneme) |
| Şifre sıfırlama | `password_resets` tablosu, tek kullanımlık token, 1 saat geçerli |
| Çıkış | Refresh token iptal edilir; access token süresi dolana kadar geçerli kalır (15 dk) |

Access token içeriği (payload) minimum tutulur — yetkiler **token'a gömülmez**, çünkü
sahip bir kişinin yetkisini düşürdüğünde değişiklik anında geçerli olmalıdır:

```json
{ "sub": 12, "email": "mehmet@ornek.com", "adm": false, "iat": …, "exp": … }
```

Yetki her istekte veritabanından okunur (bebek başına tek indeksli sorgu).

---

### 5.7 Mobil Oturum Akışı (Giriş / Kayıt)

Uygulama **giriş yapılmadan kullanılamaz**. Açılışta `SecureStore`'daki token
okunur; yoksa veya geçersizse kullanıcı `AuthNavigator`'a düşer.

```
Açılış
  └─ SecureStore'da refresh token var mı?
       ├─ hayır ──────────────────────────────> AuthNavigator (Giriş / Kayıt Ol)
       └─ evet ─> GET /auth/me
                    ├─ 200 ────────> RootNavigator  (oturum sürüyor)
                    └─ 401 ─> POST /auth/refresh
                                 ├─ 200 ──────> RootNavigator
                                 └─ hata ─────> token'ları sil, AuthNavigator
```

| Ekran | Alanlar | Uç nokta |
|-------|---------|----------|
| **Giriş** | E-posta, şifre | `POST /auth/login` |
| **Kayıt Ol** | Ad soyad, e-posta, şifre (+tekrar) | `POST /auth/register` |

**Token saklama.** `access_token` yalnızca bellekte (Zustand) tutulur — 15 dakikalık
ömrü diske yazmayı gereksiz kılar. `refresh_token` **`expo-secure-store`** ile saklanır
(Android'de Keystore destekli `EncryptedSharedPreferences`); `AsyncStorage`/`MMKV`
düz metin olduğu için refresh token oraya **yazılmaz**.

**401 davranışı.** `api/client.ts` bir `UNAUTHENTICATED` / `TOKEN_EXPIRED` yanıtı
aldığında isteği **bir kez** askıya alır, `POST /auth/refresh` ile çifti yeniler ve
isteği tekrarlar. Eşzamanlı birden çok istek olursa yalnızca ilki refresh çağırır,
diğerleri aynı sözü bekler — token rotation'da yarış koşulu oluşmaz
(§5.6'daki yeniden kullanım tespiti aksi halde tüm oturumları iptal ederdi).

> **Tekilleştirme çağıranda değil, `rotate()` içindedir.** İlk uygulamada koruma
> yalnızca 401 ara katmanındaydı; açılıştaki `restore()` aynı refresh token'ı
> ayrı bir yoldan gönderiyordu. İkisi aynı anda çalıştığında token iki kez
> gidiyor, sunucu bunu çalıntı sayıp **tüm oturumları iptal ediyor** ve
> kullanıcı hiçbir şey yapmadan giriş ekranına düşüyordu; üstelik yerel ayna da
> siliniyordu. Saklanan token'ı okuyan her yol `rotate()`'tan geçmek
> zorundadır — yeni bir çağıran eklenirken ilk bakılacak yer burasıdır.
> Sunucu tarafı kural `scratchpad/refresh_race_e2e.sh` ile sabitlendi.

**Giriş sonrası veri.** Oturum açılır açılmaz `GET /babies` çağrılır ve dönen kayıtlar
yerel SQLite'a aynalanır; ekranlar SQLite'tan okumaya devam eder (§2.1 offline-first).
Bebek tablosuna `server_id` ve `owner_user_id` sütunları eklenir, böylece yerel ayna
hangi hesaba ait olduğunu bilir.

**Çıkış.** `POST /auth/logout` ile refresh token iptal edilir, `SecureStore` temizlenir
ve **o hesaba ait yerel ayna silinir** — aynı cihazda başka bir hesap açıldığında
önceki kullanıcının bebekleri görünmemelidir.

> Şifre sıfırlama uçları (`/auth/forgot-password`, `/auth/reset-password`) sunucuda
> hazır; mobil ekranı §19'daki ilgili aşamaya bırakıldı. Giriş ekranındaki
> "Şifremi unuttum" bağlantısı şimdilik yönetim panelinden sıfırlama yapılacağını
> belirten bir bilgi metni gösterir.

---

### 5.8 Profil Ekranı

Kullanıcı kendi bilgilerini uygulama içinden günceller. Giriş: **Ayarlar →
Bilgilerimi düzenle** (`profile` ekranı, kök yığında).

| Alan | Uç nokta | Not |
|------|----------|-----|
| Ad soyad, telefon | `PUT /auth/me` | Sunucu yanıtındaki `user` doğrudan store'a yazılır |
| Şifre | `PUT /auth/me/password` | `{ current_password, new_password }` |
| E-posta | — | **Değiştirilemez**: hesabın kimliği ve davetlerin eşleştiği anahtar |

> **Şifre değişimi oturumu düşürür.** `PUT /auth/me/password`, kullanıcının
> `refresh_tokens` kayıtlarının **tamamını** iptal eder (§5.6) — elindeki cihaz
> dahil. Uygulama bunu sessizce bozuk bir oturumla sürdürmek yerine açık bir
> uyarı gösterip `logout()` çağırır ve kullanıcıyı giriş ekranına alır.

---

## 6. Denetim İzi (Kim, Ne Zaman, Ne Yaptı)

### 6.1 İlke

Paylaşımlı bir bebek kaydında "bu veriyi kim girdi?" sorusunun cevabı her zaman
bulunabilir olmalıdır. Kullanıcının örneği: *bebeğin altını baba değiştirip kendi
hesabından kaydettiğinde, anne bunu saatiyle birlikte görebilmeli.*

Bu iki katmanda çözülür:

1. **Kayıt üzerindeki aktör alanları** — "bu satırı kim oluşturdu / en son kim değiştirdi"
2. **`activity_log`** — "ne zaman ne oldu" tam geçmişi, silinen kayıtlar dahil

### 6.2 Kayıtlardaki Aktör Alanları

Veri üreten **her** tabloda şu dört alan bulunur:

```sql
created_by  BIGINT UNSIGNED NOT NULL,   -- users.id — kaydı giren
updated_by  BIGINT UNSIGNED NULL,       -- users.id — en son düzenleyen
created_at  DATETIME(3) NOT NULL,
updated_at  DATETIME(3) NOT NULL
```

`created_by` **istemciden alınmaz**; sunucu JWT'deki `sub` değerinden yazar. İstemcinin
gönderdiği herhangi bir `created_by` alanı yok sayılır. Aksi halde bir kullanıcı başkasının
adına kayıt girebilirdi.

Ayrıca kaydın **gerçekleşme zamanı** (`started_at` / `changed_at`) ile **sisteme girilme
zamanı** (`created_at`) ayrı tutulur. Baba sabah 03:00'te değiştirdiği bezi 08:00'de
girerse timeline 03:00 gösterir, denetim izi ise "08:12'de geriye dönük girildi" der.

### 6.3 `activity_log` Tablosu

Her oluşturma/düzenleme/silme işlemi, asıl tabloya yazan transaction'ın **içinde**
loglanır — yani kayıt varsa logu da kesin vardır.

| Alan | Açıklama |
|------|----------|
| `baby_id` | Hangi bebeğin akışına ait |
| `user_id` | İşlemi yapan kullanıcı |
| `entity` | `feeding`, `breastfeeding`, `sleep`, `diaper`, `baby`, `member`, `invitation`, `reminder`, `music` |
| `entity_id`, `sync_uuid` | Hedef kayıt |
| `action` | `create` / `update` / `delete` / `restore` |
| `summary` | Hazır okunabilir metin: *"Altını değiştirdi (kaka)"*, *"120 ml formül mama verdi"* |
| `changes` | JSON diff — yalnızca `update` için `{"amount_ml":[120,150]}` biçiminde |
| `performed_at` | İşlemin sunucuya ulaştığı an (UTC) |
| `tz_offset_min` | İstemcinin saat dilimi |
| `device_uuid`, `ip`, `user_agent` | Teşhis için |

`summary` yazma anında üretilir ve saklanır; sonradan modül silinse veya kayıt değişse
bile geçmiş okunabilir kalır.

### 6.4 Arayüzde Gösterim

Timeline kartlarının altına aktör satırı eklenir:

```
🧷 Bez Değişimi                                    03:05
   Kaka · Kremli
   👤 Baba Mehmet kaydetti · 08:12'de girildi
```

- Kaydı giren kişi **o anki kullanıcıysa** "Sen kaydettin" yazılır.
- Düzenlenmişse: *"Anne Ayşe düzenledi · 09:40"*.
- Bebek detayında **"Etkinlik geçmişi"** sekmesi `activity_log`'u kronolojik listeler;
  sahip ayrıca üyelik ve davet olaylarını da görür.
- Kayıt silindiğinde timeline'dan düşer ama `activity_log`'daki `delete` satırı kalır.

---

## 7. Yönetim Paneli (Sistem Yöneticisi)

### 7.1 Amaç ve Erişim

Uygulama sahibinin tarayıcıdan girdiği, **ebeveynlere kapalı** operasyon panelidir.
`users.is_admin = 1` olan hesaplar girebilir.

- Adres: `http://localhost:4000/admin`
- Oturum: panele özel **httpOnly + SameSite=Strict çerez** (mobil JWT'den ayrı).
  Panel çerezi mobil API'de, mobil JWT de panelde geçerli değildir.
- Sunucu tarafında render edilir (EJS); ayrı bir derleme hattı yoktur.
- Admin hesabı arayüzden oluşturulamaz; yalnızca `npm run create-admin` komutuyla açılır.

### 7.2 Ekranlar

| Ekran | İçerik |
|-------|--------|
| **Panel** | Kullanıcı / bebek / kayıt sayıları, son 7 gün aktivite grafiği, son kayıt olanlar |
| **Kullanıcılar** | Arama, hesap detayı, bağlı olduğu bebekler ve yetkileri, hesabı askıya alma/açma, şifre sıfırlama bağlantısı üretme |
| **Bebekler** | Tüm bebekler, sahibi, üye sayısı, kayıt sayısı, oluşturma tarihi |
| **Davetler** | Bekleyen/kabul edilen/süresi geçen davetler, iptal etme |
| **Etkinlik kayıtları** | `activity_log` üzerinde kullanıcı / bebek / tarih / işlem türü filtreli arama |
| **Modüller** | Sistem geneli modül aç/kapa. Değişiklik **tüm kullanıcıların** uygulamasında geçerli olur; `is_core` modüller kapatılamaz (§9) |
| **Müzik kütüphanesi** | Ninni/beyaz gürültü mp3 yükleme, kategori atama, sıralama, yayından kaldırma |
| **Sayfalar** | Genel erişime açık içerik sayfaları — gizlilik politikası, iOS ATT metni, kullanım koşulları. Adres, meta başlık ve meta açıklama elle verilir; yayınlanan sayfa `/<slug>` adresinden servis edilir (§7.7) |
| **Reklamlar** | Google AdMob geçiş reklamı ayarları: hesap kimlikleri, frekans sınırı, tetikleyiciler, hedef kitle beyanı, `app-ads.txt` ve yayına çıkış kontrol listesi (§7.6) |
| **Sistem** | Veritabanı sürümü, migration durumu, disk kullanımı, ortam bilgisi, **proje ve uygulama logosu yükleme** (§7.5) |

### 7.3 Panelde Mahremiyet Sınırı

Panel bir **operasyon** aracıdır, aile verisi tarama aracı değildir. Bu yüzden:

- Panelde **kayıt içerikleri gösterilmez** — emzirme süresi, bez detayı, not alanları yoktur.
  Yalnızca sayımlar (örn. "Elif: 342 kayıt") ve `activity_log` özet satırları görünür.
- Bebek fotoğrafları panelde gösterilmez.
- Admin, bir bebeğe üye olmadan kayıtlarını okuyan bir uç noktaya erişemez; mobil API
  admin için de aynı `baby_members` kontrolünden geçer.
- Panelde yapılan her yönetici işlemi (`askıya alma`, `silme`, `müzik yükleme`)
  `activity_log`'a `user_id = admin` ile yazılır.

### 7.4 Panel Güvenliği

| Önlem | Uygulama |
|-------|----------|
| CSRF | Tüm form POST'larında tek kullanımlık token |
| Oturum | 8 saat sonra süresi dolar, hareketsizlikte 30 dk |
| Giriş denemesi | IP bazlı oran sınırı, 5 başarısız denemede 15 dk kilit |
| Yetki | Her istekte `is_admin` yeniden kontrol edilir (çerezde taşınmaz) |
| Güvenlik başlıkları | `helmet` — CSP, X-Frame-Options: DENY, nosniff |
| Erişim | Varsayılan olarak yalnızca `127.0.0.1`; LAN'a açılacaksa açık yapılandırma gerekir |
| Hata yüzeyi | Panele özel hata katmanı: tarayıcıya flash+yönlendirme, programatik istemciye doğru kodla JSON |

**Panel hata katmanı (sonradan düzeltildi).** `checkCsrf` düz bir `Error`
fırlatıyordu; genel `errorHandler` yalnızca `AppError`'ı tanıdığı için her CSRF
reddi **403 yerine 500** dönüyor ve log'a sahte bir "beklenmeyen hata"
yazılıyordu. İstek yine reddediliyordu, yani güvenlik açığı değildi; ama tüm
panel POST uçlarını etkiliyordu. Düzeltme üç parçalıdır:

1. `CsrfError extends AppError` (403) — durum kodu artık hata nesnesinden gelir.
2. `adminRouter`'ın sonuna, **tüm rotalardan sonra** gelen bir hata katmanı.
   İçerik tipine göre ayrılır: HTML kabul eden form gönderimi flash mesajı +
   geri yönlendirme alır, programatik istemci (curl/test/fetch) genel katmana
   devredilir ve `403` JSON görür. Beklenmeyen hatalar her hâlükârda genel
   katmana gider — loglama ve ayrıntı gizleme orada tek noktada yapılır.
3. Geri dönüş yolu `Referer`'dan alınır ama **hem köken hem yol** doğrulanır.
   Yalnızca yola bakmak yetmezdi: `https://kotu-site.example/admin/x` de
   `/admin` ile başlar ve saldırgan kurbanı kendi seçtiği panel yoluna
   sürükleyebilirdi.

Ayrıca `/admin/login` sayfası `head` partial'ına bilinçli olarak `flash: null`
geçiyordu; oturum öncesi akışlarda tek bildirim kanalı flash olduğu için mesaj
**tamamen kayboluyordu**. Giriş sayfası artık flash'ı `error`/`notice`'a taşır.

---

### 7.5 Markalama — Proje ve Uygulama Logosu

Panelin **Sistem** ekranında iki logo yuvası vardır. Dosyalar veritabanında
değil, `uploads/kidvoice/` altında `<yuva>-logo.<uzantı>` adıyla durur; yuva
başına tek dosya tutulur, yenisi yüklenince eskisi silinir.

| Yuva | Dosya | Nerede görünür |
|------|-------|----------------|
| **Proje logosu** | `project-logo.*` | Giriş ve Kayıt ekranı, uygulamanın **sol üst köşesindeki** kalıcı marka şeridi |
| **Uygulama logosu** | `app-logo.*` | Yükleme/açılış ekranı ve **başlatıcı ikonu** (aşağıdaki nota bakın) |

**Uç nokta.** `GET /api/v1/branding` → `{ project_logo, app_logo }` (mutlak URL
ya da `null`). **Kimlik doğrulaması gerektirmez**, çünkü giriş ekranında da
kullanılır. URL'in sonundaki `?v=<mtime>` önbellek kırıcıdır: logo değişince
adres de değişir, cihaz eski görseli göstermez.

**Cihaz tarafı.** Sunucu adresleri kanonik origin'le (`PUBLIC_BASE_URL`,
yerelde `http://bebektakip.test`) döndürür. İstemci başka bir adrese
bağlanıyorsa `core/api/assets.ts` origin'i bağlanılabilir olanla değiştirir ve
gerekiyorsa sanal konak adını `Host` başlığıyla taşır (§8.6). İşlev üç kural
uygular — göreli yol, bilinen kanonik önek, ve savunma amaçlı: tanınmayan
origin'den gelse bile `/uploads/` altındaki her adres bağlanılabilir origin'e
taşınır (§22.5.1). Başlık `<Image source={{ uri, headers }} />`
üzerinden geçer — Android'de Fresco bunu OkHttp isteğine aktarır
(`ReactOkHttpNetworkFetcher`). Logolar `branding_cache` tablosunda saklanır,
böylece ağ yokken de görünür; bu önbellek **çıkışta silinmez**, çünkü logolar
hesaba değil sisteme aittir ve giriş ekranında da gerekir.

> **Başlatıcı ikonu çalışma zamanında değiştirilemez.** Android'in launcher
> ikonu APK'ya derleme sırasında gömülür; sunucudan indirilen bir görselle
> değiştirilemez. Bu yüzden akış ikiye ayrılır:
>
> - **Uygulama içi** (yükleme/açılış ekranı): logo anında, yeniden derlemeden gelir.
> - **Başlatıcı ikonu**: panele PNG yükledikten sonra
>   ```bash
>   node scripts/sync-app-icon.mjs --yes      # assets/icon.png + android-icon-foreground.png
>   npx expo prebuild --platform android     # mipmap-* kaynaklarını yeniden üret
>   npx expo run:android                     # derle ve kur
>   ```
>   `prebuild` adımı **atlanamaz**: `expo run:android` tek başına `assets/`
>   altındaki değişikliği fark etmez ve `android/app/src/main/res/mipmap-*`
>   dosyaları eski ikonla kalır.
>   Betik, logoyu **doğrudan kopyalamaz**: 1024×1024 kare bir tuvale ortalar ve
>   kenarlarda boşluk bırakır (`icon.png` %72 + marka zemini, uyarlanabilir
>   ikonun ön planı %60 + saydam). Aksi halde Android'in maskesi logoyu daire
>   biçiminde kırpar. Görüntü işleme `scripts/lib/png.mjs` içinde bağımlılıksız
>   yapılır (8 bit, interlace'siz PNG; desteklenmeyen biçimde açık hata verir).
>   Özgün dosyalar ilk çalıştırmada `.bak` olarak yedeklenir; sonraki
>   çalıştırmalar bu yedeğe dokunmaz.

### 7.6 Reklam Ayarları (Google AdMob)

Panelin **Reklamlar** ekranı, `modules_doc/Reklam.md` §1 "senin yapman
gerekenler" listesinin tamamını sisteme alır. Değerler `.env`'de **değil**,
veritabanında (`ad_settings`, migration `020`) durur. Üç gerekçe:

1. **Reklam birimi değişimi yeniden derleme gerektirmesin.** Birim kimliği
   `EXPO_PUBLIC_*` ile verilseydi pakete gömülürdü (§8.6) ve her değişiklik
   yeni bir APK demek olurdu. Panelden gelince uygulama bir sonraki
   tazelemede yeni birimi kullanır.
2. **Frekans sınırı bir işletme kararı.** "3 dakikada bir, oturumda 5"
   sayıları denenerek bulunuyor; her denemede sunucuyu yeniden başlatmak
   gerekmemeli.
3. **Yayına çıkış listesi somut kalsın.** GDPR mesajı, Play Console beyanı ve
   ödeme profili konsolda yapılıyor; kodla doğrulanamadıkları için panelde
   onay kutusu olarak duruyorlar ve ekranın altındaki kontrol listesi "neyi
   yapmadım" sorusunu cevaplıyor.

Modül aktifliğiyle (§9.1) aynı desen: tek doğruluk kaynağı veritabanı, yazan
tek yer yönetim paneli, okuyan taraf tek bir uçtan tüketiyor.

#### Tablo ve alanlar

`ad_settings` **tek satırlıktır** (`id = 1`, `CHECK (id = 1)`). Anahtar/değer
tablosu yerine sütunlar seçildi: her alan kendi tipini ve varsayılanını taşır,
panel formu ve zod şeması birebir eşlenir. Reklam.md §1 maddeleriyle eşleme:

| Madde | Alan(lar) | Zaman |
|-------|-----------|-------|
| 1 — AdMob App ID | `android_app_id`, `ios_app_id` | **Derleme** (aşağıdaki nota bakın) |
| 2 — Geçiş reklamı birimi | `android_interstitial_id`, `ios_interstitial_id` | Çalışma |
| 3 — Paket adı doğrulaması | `android_package`, `ios_bundle_id` | — |
| 4 — Çocuklara yönelik beyanı | `child_directed`, `under_age_of_consent` | Çalışma |
| 5 — GDPR / UMP mesajı | `ump_enabled`, `gdpr_message_published` | Çalışma / konsol |
| 6 — Gizlilik politikası | `privacy_policy_url` | Çalışma |
| 7 — Play Console beyanları | `play_console_declared` | Konsol |
| 8 — `app-ads.txt` | `app_ads_txt` | Sunucu (aşağıya bakın) |
| 9 — iOS ATT metni | `att_text` | **Derleme** (`app.json` → `ios.infoPlist`) |
| 10 — Frekans sınırı | `frequency_minutes`, `session_cap`, `action_delay_ms` | Çalışma |
| 11 — Test cihazları | `test_device_ids` | Çalışma |
| 12 — Ödeme profili | `payment_profile_done` | Hesap |
| 13 — Yeniden derleme | — | Mobil (Reklam.md §2 Adım 1) |

Bunlara ek olarak: `ads_enabled` (ana anahtar), `use_test_ids`,
`personalized_ads`, `respect_quiet_hours`, dört tetikleyici anahtarı
(`trigger_save`, `trigger_complete`, `trigger_invite`, `trigger_timer_start`)
ve `notes`.

> **App ID panelden okunamaz — derleme zamanı değeri.**
> `react-native-google-mobile-ads`'in config plugin'i App ID'leri
> `app.json`'dan okuyup AndroidManifest / Info.plist'e yazıyor; çalışma
> zamanında bir uçtan gelmesi mümkün değil. Panelde tutulması **kaydın tek
> yerde durması** içindir: ekran, `app.json`'a yapıştırılacak bloğu girilen
> değerlerle hazır gösteriyor. `att_text` için de aynı şey geçerli.

#### Varsayılanlar ve emniyet kuralları

- `ads_enabled` varsayılan **kapalı**, `use_test_ids` varsayılan **açık**.
  Kimlikler girilmeden reklam isteği atmak AdMob'da "invalid request"
  biriktirir; canlıya geçiş `use_test_ids`'i kapatmakla olan **tek ve bilinçli
  bir adım**.
- Tetikleyici varsayılanları Reklam.md §0.3-C önerisi: "iş bitti" anlarında
  (Kaydet, Tamamlandı, Davet Oluştur) açık, "işi başlatma" anlarında
  (Sol / Sağ / Uykuya Daldı) kapalı.
- **Küme tutarlılığı** `validateAdSettings()` ile ayrıca denetlenir; alan
  bazlı doğrulama yetmiyor çünkü "reklam açık ama hiçbir birim kimliği yok"
  hâlinde her alan tek tek geçerlidir ve hata ancak uygulamada sessiz bir
  "hiç reklam gelmiyor" olarak görünürdü. Reddedilen durumlar: canlı
  kimliklerde birim / App ID / gizlilik politikası eksikliği, çocuklara
  yönelik beyanıyla kişiselleştirilmiş reklamın bir arada olması (Play
  Families politikası) ve reklam açıkken hiç tetikleyici seçilmemesi.
- Çocuklara yönelik beyanı açıkken `/ads/config` kişiselleştirmeyi **her
  durumda** `false` döner. Panel ikisini birden kaydetmiyor ama beyan
  sonradan açılırsa satırda eski `personalized_ads = 1` kalabilir.
- Her kayıt `activity_log`'a yazılır (`entity = 'admin'`): reklam ayarı para
  ve mağaza politikası ilgilendiren bir karar, "kim ne zaman canlıya aldı"
  sorusunun cevabı denetim izinde durmalı. Kimlikler özet metnine değil
  `changes` alanına girer.

#### Uç nokta — `GET /api/v1/ads/config`

**Kimlik doğrulaması gerektirmez**, `/branding` gibi (§7.5). İki sebep:
uygulama açılışta reklam servisini kurarken bu değerlere ihtiyaç duyuyor ve
oturum restore'unu beklemek gereksiz bir bağımlılık olurdu; ayrıca içinde sır
yok — reklam birimi kimlikleri derlenmiş her APK'da düz metin olarak zaten
bulunuyor.

Yanıt, tablonun **alt kümesidir**. Konsol tarafı onay kutuları
(`gdpr_message_published`, `play_console_declared`, `payment_profile_done`),
`notes` ve `app_ads_txt` bilinçli olarak **dışarıda**: uygulamanın
davranışını etkilemiyorlar ve yayın hazırlığına dair iç bilgi taşıyorlar. App
ID'ler de yok — derleme zamanı değerleri, uygulamanın içinde gömülü.

```json
{
  "enabled": false,
  "use_test_ids": true,
  "interstitial": { "android": null, "ios": null },
  "child_directed": false,
  "under_age_of_consent": false,
  "ump_enabled": true,
  "personalized_ads": true,
  "privacy_policy_url": null,
  "frequency_minutes": 3,
  "session_cap": 5,
  "action_delay_ms": 3000,
  "respect_quiet_hours": false,
  "test_device_ids": [],
  "triggers": { "save": true, "complete": true, "invite": true, "timer_start": false }
}
```

#### `app-ads.txt`

`GET /app-ads.txt` (API yolu **altında değil**, kökte) içeriği
`ad_settings.app_ads_txt` sütunundan servis eder; dosyayı diske koymak
gerekmiyor ve alan adı taşındığında tek yerden yönetilir.
`Cache-Control: public, max-age=3600`. İçerik boşsa uç **404** döner: boş bir
200, doğrulayıcılara "dosya var ama yetkili satır yok" dedirtir ve envanteri
yetkisiz sayılarak reklam gelirini sessizce düşürür.

#### Cihaz tarafı

`src/core/ads/useAdSettingsStore.ts` — logolarla (§7.5) aynı desen: açılışta
SQLite önbelleğinden okur (`remote_config_cache`, şema v7), sonra `refreshAll`
içinde **dar kapsamda** (oturum gerekmeyen görevler) tazeler. Önbellek hesaba
değil sisteme ait olduğu için **çıkışta silinmez**.

Önbellek sütunlara açılmadı, tek bir JSON hücresinde durur: yapılandırma
sunucuda büyüyen bir küme ve istemci onu bütün olarak kullanıyor; her alanı
sütuna açmak, sunucuya eklenen her alan için bir SQLite migration'ı
gerektirirdi.

Gelen gövde `normalizeAdConfig()` ile şekle sokulur. Doğrulamasız kullanmak
riskli: eski bir sunucu sürümü ya da yarım dönmüş bir yanıt
`frequency_minutes` yerine `undefined` verip sınır hesabını geçersiz bir
sayıya çevirebilir — o da sınırın tamamen devre dışı kalması, yani ekranı
reklamla dolduran bir hata olurdu. Sunucuya hiç ulaşılamazsa geçerli hâl
`AD_CONFIG_FALLBACK`, yani **reklam kapalı**.

Depo **karar vermez, ayarı taşır.** `shouldShowFor(trigger)` yalnızca durağan
soruyu cevaplar: ana anahtar açık mı, bu tetikleyici seçili mi, bu platform
için birim kimliği var mı. Frekans sınırını saymak, gecikmeyi kurmak, ön plan
/ ninni / onay penceresi kapılarını uygulamak ve reklamı göstermek
`adService`'in işi (Reklam.md §2 Adım 2) — **henüz kurulmadı**, AdMob
kütüphanesi projeye eklenmedi.

### 7.7 İçerik Sayfaları (Gizlilik Politikası, iOS ATT Metni, …)

Panelin **Sayfalar** ekranı (`/admin/pages`) genel erişime açık metin
sayfalarını yönetir. Sayfa sayısı **sınırsız**: gizlilik politikası, iOS ATT
izin metni, kullanım koşulları, KVKK aydınlatma metni, çerez politikası…

Niçin panelde: gizlilik politikasının genel erişime açık bir URL'si olması
Google Play'in **şartı** (§7.6, Reklam.md §1 madde 6). Metni dosya olarak
sunucuya koymak ya da ayrı bir statik site kurmak, her küçük düzeltmeyi
dağıtım işine çeviriyordu — hukuki metinler ise en sık düzeltilen içerik.

#### Alanlar

Tablo `pages` (migration `021`). **Meta başlık, meta açıklama ve adres elle
verilir**, başlıktan türetilmez:

| Alan | Not |
|------|-----|
| `slug` | Adresin kendisi: `https://<alan>/<slug>`. Tek parçalı, küçük harf/rakam/tire |
| `title` | Sayfadaki `h1`; `meta_title` boşsa `<title>` olarak da kullanılır |
| `meta_title` | Arama sonucu ve sekme başlığı |
| `meta_description` | Boşsa gövdenin ilk cümlelerinden üretilir (`fallbackDescription`) |
| `content` | Sınırlı Markdown (aşağıya bakın) |
| `is_published` | Kapalıyken adres **404** döner — taslak yazıp sonra açmak için |
| `sort_order` | Panelde sıralama |
| `deleted_at` | Yumuşak silme; kalıcı silme **yok** |

Adres elle verilmesinin sebebi: yayınlanmış bir adres değişince ona verilmiş
dış bağlantılar kırılır — Play Console'a girilen gizlilik politikası adresi
dahil. Panel adres değiştiğinde özellikle uyarıyor ve değişimi
`activity_log`'a eski/yeni değerle yazıyor.

`UNIQUE KEY` **silinmiş satırları da kapsar**: aynı adresi yeniden kullanmak,
silinmiş bir sayfanın diriltilmesiyle çakışır ve hangisinin servis edileceği
belirsiz kalırdı. Panel çakışmada okunur bir hata veriyor, ham `UNIQUE`
ihlali kullanıcıya hiç görünmüyor.

#### Ham HTML kabul edilmiyor

`content` sınırlı bir Markdown ile işlenir (`lib/pages.ts` →
`renderContent`), **her şey önce kaçırılır**:

- `#` → `h2`, `##` → `h3`, `###` → `h4` (sayfanın `h1`'i başlıktır; ikinci bir
  `h1` belge yapısını bozar)
- `- ` / `* ` madde listesi, `1. ` numaralı liste
- `**kalın**`, `*italik*`, `` `kod` ``
- `[metin](https://…)`, `[metin](/baska-sayfa)`, `[metin](mailto:…)` — başka
  protokol bağlantıya **dönüştürülmez**, düz metin kalır (sessizce silmek,
  yazarın bağlantıyı koyduğunu sanmasına yol açardı)
- boş satır yeni paragraf; paragraf içindeki tek satır sonu `<br>` olur
  (hukuki metinde adres/madde dizilimi satır satır yazılıyor ve birleştirmek
  okunmaz hâle getiriyor)

Ham HTML'e izin verilmemesinin sebebi, yazarın yönetici olmaması değil
**origin paylaşımı**: sayfa panelle aynı origin'de yayınlanıyor. Panel çerezi
`SameSite=Strict` ve formlar CSRF jetonlu olsa da, aynı origin'de çalışan bir
script panel sayfasını `fetch` ile okuyup jetonu alabilirdi. Bir kez
yapıştırılan metnin paneli ele geçirmesine açık kapı bırakmak gereksiz.

#### Yumuşak silme

Kalıcı silme bilinçli olarak **yok**. Yanlışlıkla silinen bir gizlilik
politikası, Play Console'a verilmiş adresin 404 dönmesi ve uygulamanın
mağazada uyarı alması demek. Silme sayfayı yayından da çıkarır (silinmiş ama
hâlâ servis edilen bir adres, "sildim" diyen yöneticiyi yanıltırdı); içerik
tabloda kalır ve panelde **Silinenler** bölümünden tek tıkla geri gelir.
Geri alınan sayfanın yayın durumu **kapalı** kalır: adresin yeniden
çalışmasına yönetici bilinçli olarak karar vermeli.

Panelin silme düğmeleri `confirm()` kullanmıyor — CSP `script-src 'self'`
satır içi olay işleyicilerini engelliyor, yani onay penceresi hiç açılmazdı.
Yumuşak silme bu yüzden emniyetin **tek** katmanı, dolayısıyla zorunlu.

#### Genel erişim — `GET /<slug>`

Rota `app.ts` içinde, `/api/v1`, `/admin`, `/uploads`, `/app-ads.txt` ve `/`
rotalarının **tamamından sonra** duruyor; onlar daha önce eşleştiği için
gölgelenmiyor. Ayrıca `lib/pages.ts` → `RESERVED_SLUGS` o adları **kayıt
anında** reddediyor: aksi halde panelden `admin` adresi girilebilir, sayfa hiç
açılmaz ve yönetici "kaydettim ama çalışmıyor" durumunda kalırdı.

Çok parçalı adres (`yasal/gizlilik`) desteklenmiyor: kök yakalayıcı tek
segment eşliyor ve iki parçalı bir desen `/admin/...` benzeri yolları
gölgeleme riski taşıyor.

Yanıt tam bir HTML sayfası (`views/public/page.ejs`): `<title>`,
`meta description`, Open Graph alanları, `canonical`, açık/koyu tema ve
telefon genişliğinde okunur bir düzen. Stil **sayfa içinde** duruyor,
`/admin/static/admin.css`'e bağlanmıyor — panel stilinin ileride değişmesi
hukuki metnin görünümünü bozmamalı. `Cache-Control: public, max-age=60`:
düzeltilen bir cümlenin bir saat beklemesi kabul edilemez.

Adres doğru biçimde ama yayında sayfa yoksa: tarayıcıyla gelen isteğe kısa bir
HTML 404, programatik istemciye genel JSON 404 zarfı. Biçimi sayfa adresine
benzemeyen istek (nokta, büyük harf, uzantı) veritabanına hiç gitmeden genel
404'e devredilir.

#### Reklam ekranıyla bağ

`/admin/ads` → *gizlilik politikası adresi* alanı, panelde **yayında olan**
sayfaların adreslerini `datalist` olarak öneriyor (`publishedPageSlugs()`).
Adresi elle kopyalamak bir harf hatasıyla Play'de 404 dönen bir bağlantıya yol
açıyordu. Yayında sayfa yoksa alan doğrudan Sayfalar ekranına bağlantı veriyor.

> **`att_text` ile karıştırmayın.** `ad_settings.att_text` (§7.6) iOS'un
> izin penceresinde görünen **tek cümlelik** `Info.plist` dizesi ve derleme
> zamanı değeri. Sayfalar ekranındaki "iOS ATT metni" ise kullanıcıya
> izlemeyi açıklayan **uzun metin**; ikisi ayrı şeyler ve ikisi de gerekiyor.

---

## 8. REST API Sözleşmesi

**Taban URL:** `<origin>/api/v1` — origin bir **dağıtım ayarıdır**, koda
gömülü değildir. Yerelde `http://10.0.2.2:4000/api/v1` (Android emülatörü),
örnek uç: `http://10.0.2.2:4000/api/v1/auth/login`.

Mobil istemci origin'i `EXPO_PUBLIC_API_URL` değişkeninden alır (§8.6);
verilmezse **yerel sunucu** varsayılır. Önceden varsayılan canlı sunucuydu ve
bu iki sorun üretiyordu: `.env.local` kopyalanmayı unutulduğunda geliştirme
derlemesi sessizce canlı veriye bağlanıyordu, ve yayın adresi kaynak kodun
içinde duruyordu. Yayın derlemesinde adres EAS ortam değişkeniyle verilir
(`eas.json` → `env`). Yerel geliştirme kurulumu — Apache sanal konağı
`bebektakip.test` → `127.0.0.1:4000` — §17.3'te duruyor; Express'e doğrudan
`:4000` ile bağlanmak Apache bağımlılığını tamamen kaldırır.
**Kimlik doğrulama:** `Authorization: Bearer <access_token>`
**Yanıt zarfı:**

```json
{ "success": true,  "data": { }, "meta": { "server_time": "2026-11-01T18:20:00Z" } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": {} } }
```

**Hata kodları:** `VALIDATION_ERROR` (422) · `UNAUTHENTICATED` (401) · `TOKEN_EXPIRED` (401)
· `FORBIDDEN` (403) · `NOT_FOUND` (404) · `CONFLICT` (409) · `RATE_LIMITED` (429)

### 8.1 Uç Noktalar

**Gerekli yetki** sütunu, `baby_members.permission` üzerinden aranan en düşük seviyedir.
`—` kimlik doğrulaması gerektirmeyen, `auth` yalnızca giriş yapmış olmayı gerektiren
uç noktaları belirtir.

> **Uygulama durumu (2026-11-01).** Şu an `C:\wamp64\www\bebektakip` içinde **çalışır** durumda
> olanlar: tüm `/auth/*`, `/babies`, üyelik ve davet uçları, `/feedings`, `/sleep`,
> `/diapers`, `/breastfeeding/*`, `/timeline`, `/activity`, `/reports/daily`,
> `/modules` (sistem geneli). Henüz yazılmamış olanlar: `/sleep/start` · `/sleep/{id}/stop` kronometre
> uçları, `/reminders`, `/quiet-hours`, `/notifications/log`, `/music/*`, `/sync/push`,
> `/sync/pull`, fotoğraf yükleme ve şifre sıfırlama (`/auth/forgot-password`,
> `/auth/reset-password`). Bunlar ilgili yol haritası aşamalarında eklenecek (§19).

#### Kimlik doğrulama

| Metod | Yol | Gerekli | Açıklama |
|-------|-----|:-------:|----------|
| GET | `/branding` | — | Proje ve uygulama logosu URL'leri. Giriş ekranında kullanıldığı için açık uçtur (§7.5) |
| GET | `/ads/config` | — | Reklam ayarları (sistem geneli). Açılışta okunduğu ve sır taşımadığı için açık uçtur (§7.6) |
| POST | `/auth/register` | — | `{ email, password, full_name }` → kullanıcı + token çifti. Bekleyen davetler yanıtta listelenir. |
| POST | `/auth/login` | — | `{ email, password, device }` → `{ access_token, refresh_token, user }` |
| POST | `/auth/refresh` | — | `{ refresh_token }` → yeni çift (eski iptal edilir) |
| POST | `/auth/logout` | auth | Gönderilen refresh token'ı iptal eder |
| POST | `/auth/logout-all` | auth | Kullanıcının tüm oturumlarını kapatır |
| POST | `/auth/forgot-password` | — | Sıfırlama bağlantısı üretir |
| POST | `/auth/reset-password` | — | `{ token, password }` |
| GET | `/auth/me` | auth | Profil + bağlı bebek sayısı |
| PUT | `/auth/me` | auth | Ad, telefon, dil güncelleme |
| PUT | `/auth/me/password` | auth | `{ current_password, new_password }` |
| POST | `/auth/me/avatar` | auth | `multipart` profil fotoğrafı |
| GET | `/auth/sessions` | auth | Açık oturumlar (cihaz, son kullanım) |
| DELETE | `/auth/sessions/{id}` | auth | Belirli oturumu kapat |

#### Bebekler ve aile

| Metod | Yol | Gerekli | Açıklama |
|-------|-----|:-------:|----------|
| GET | `/babies` | auth | **Yalnızca kullanıcının üye olduğu** bebekler + kendi yetkisi ve yakınlığı |
| POST | `/babies` | auth | Yeni bebek; oluşturan otomatik `owner` üye olur |
| GET | `/babies/{id}` | viewer | Profil + üye listesi |
| PUT | `/babies/{id}` | **owner** | Profil güncelle |
| DELETE | `/babies/{id}` | **owner** | Soft delete (tüm üyelikler pasifleşir) |
| POST | `/babies/{id}/photo` | **owner** | `multipart/form-data`, alan adı `photo`; jpg/png/webp, en fazla 8 MB. Eski dosya silinir (§14.5) |
| POST | `/babies/{id}/select` | viewer | Kendi aktif profilini seçer (`baby_members.is_selected`) |
| GET | `/babies/{id}/members` | viewer | Aile listesi (ad, yakınlık, yetki) |
| POST | `/babies/{id}/invitations` | **owner** | `{ email, relationship, permission }` → davet kodu |
| GET | `/babies/{id}/invitations` | **owner** | Bekleyen davetler |
| DELETE | `/babies/{id}/invitations/{invId}` | **owner** | Daveti iptal et |
| PUT | `/babies/{id}/members/{userId}` | **owner** | Yetki veya yakınlık değiştir |
| DELETE | `/babies/{id}/members/{userId}` | **owner** | Üyeyi çıkar |
| POST | `/babies/{id}/transfer-ownership` | **owner** | `{ user_id }` — sahiplik devri |
| DELETE | `/babies/{id}/members/me` | editor/viewer | Kendi isteğiyle ayrıl |
| GET | `/invitations/mine` | auth | Bana gelen bekleyen davetler |
| POST | `/invitations/accept` | auth | `{ code }` veya `{ invitation_id }` |
| POST | `/invitations/decline` | auth | `{ invitation_id }` |

#### Kayıtlar

| Metod | Yol | Gerekli | Açıklama |
|-------|-----|:-------:|----------|
| GET | `/babies/{id}/feedings` | viewer | `?from=&to=&type=` |
| POST | `/babies/{id}/feedings` | **editor** | Besleme kaydı; `created_by` token'dan yazılır |
| PUT | `/feedings/{id}` | editor¹ | Düzenleme |
| DELETE | `/feedings/{id}` | editor¹ | Soft delete |
| POST | `/babies/{id}/breastfeeding/start` | **editor** | Seans başlat `{ side }` |
| POST | `/babies/{id}/breastfeeding/{sessionId}/switch` · `/pause` · `/resume` · `/stop` | editor¹ | Seans kontrolü |
| GET | `/babies/{id}/breastfeeding/active` | viewer | Çalışan seans (kimin başlattığı dahil) |
| GET/POST | `/babies/{id}/sleep` | viewer / **editor** | Uyku kayıtları |
| POST | `/babies/{id}/sleep/start` · `/sleep/{id}/stop` | editor | Kronometre ile uyku |
| GET/POST | `/babies/{id}/diapers` | viewer / **editor** | Bez değişimi |
| PUT/DELETE | `/diapers/{id}` | editor¹ | Düzenleme / silme |
| GET/POST/PUT/DELETE | `/babies/{id}/reminders` | viewer / **editor** | Hatırlatıcı CRUD |
| GET/POST/PUT/DELETE | `/babies/{id}/quiet-hours` | viewer / **editor** | Sessiz saat CRUD |
| POST | `/notifications/log` | editor | Bildirim sonucunu raporla |
| GET | `/babies/{id}/vaccines` | viewer | `?category=mandatory,optional,custom&status=` → aşı takvimi |
| POST | `/babies/{id}/vaccines` | **editor** | Kütüphaneden ya da elle aşı ekleme |
| GET | `/vaccines/library` | auth | Sistem aşı kütüphanesi (`?category=`) — bebeğe bağlı değil |
| GET | `/vaccines/{id}` | viewer (üyelik) | Tekil aşı kaydı |
| POST | `/vaccines/{id}/schedule` | editor | Tarih · saat · yer + aile ferdine görev atama |
| PATCH | `/vaccines/{id}/complete` | editor | Yapıldı işaretle; doktor, yer, yan etkiler |
| PATCH | `/vaccines/{id}/status` | editor | `pending` \| `completed` \| `skipped` |
| PUT/DELETE | `/vaccines/{id}` | editor | Düzenleme / yumuşak silme |
| GET | `/notifications` | auth | `?baby_id=&unread_only=&type=&limit=` → kullanıcının bildirim kutusu |
| GET | `/notifications/unread-count` | auth | `?baby_id=` → rozet sayısı |
| PATCH | `/notifications/{id}/read` | auth | Tekil okundu |
| PATCH | `/notifications/read-all` | auth | `{ baby_id? }` → tümünü okundu |
| DELETE | `/notifications/{id}` | auth | Bildirimi sil (sert silme) |
| POST | `/babies/{id}/reports/email` | viewer | `{ period, to_family? }` → dönem özetini PDF ekiyle e-postalar |
| GET | `/babies/{id}/timeline` | viewer | `?date=2026-11-01` → akış + `actor_name` |
| GET | `/babies/{id}/activity` | viewer | `?from=&to=&entity=&user_id=` → denetim izi |
| GET | `/babies/{id}/reports/daily` | viewer | Özet toplamlar |
| GET | `/modules` | auth | **Sistem geneli** modül kataloğu ve aktiflik durumu. Yazma ucu yoktur — yalnızca yönetim panelinden değişir (§9.1) |

¹ `editor` yalnızca **kendi girdiği** kaydı (`created_by = me`) düzenleyip silebilir;
`owner` tüm kayıtlara müdahale edebilir. Aksi halde `403 FORBIDDEN` döner.

#### Müzik ve senkronizasyon

| Metod | Yol | Gerekli | Açıklama |
|-------|-----|:-------:|----------|
| GET | `/music/tracks` | auth | `?category=` — ortak kütüphane |
| GET/POST | `/music/playlists` | auth | Kişisel çalma listeleri |
| POST | `/babies/{id}/music/play-log` | editor | Dinleme kaydı |
| POST | `/sync/push` | auth | Toplu kayıt; her öğe için yetki ayrı doğrulanır, reddedilenler `rejected[]` döner |
| GET | `/sync/pull` | auth | `?since=` → erişilebilen tüm bebeklerin değişen kayıtları |

> Müzik dosyalarının yüklenmesi mobil API'de **yoktur**; kütüphane yalnızca yönetim
> panelinden yönetilir (§7.2).

### 8.2 Örnek — Emzirme Seansı Akışı

```http
POST /api/v1/babies/1/breastfeeding/start
{ "side": "left", "sync_uuid": "a3f1…",
  "at": "2026-11-01T18:02:11.420Z", "tz_offset_min": 180 }
→ { "session_id": 412, "feeding_id": 412, "status": "running" }

POST /api/v1/babies/1/breastfeeding/412/switch { "side": "right", "at": "2026-11-01T18:09:48.100Z" }
POST /api/v1/babies/1/breastfeeding/412/pause  { "at": "2026-11-01T18:13:02.000Z" }
POST /api/v1/babies/1/breastfeeding/412/resume { "at": "2026-11-01T18:14:30.000Z" }
POST /api/v1/babies/1/breastfeeding/412/stop   { "at": "2026-11-01T18:21:05.900Z" }

→ {
    "started_at": "21:02:11", "ended_at": "21:21:05",
    "left_active_sec": 457, "right_active_sec": 591, "total_active_sec": 1048,
    "formatted": "00:17:28", "pause_count": 1, "next_side": "left",
    "segments": [
      { "seq": 1, "side": "left",  "start": "21:02:11", "end": "21:09:48", "active_sec": 457 },
      { "seq": 2, "side": "right", "start": "21:09:48", "end": "21:13:02", "active_sec": 194 },
      { "seq": 3, "side": "right", "start": "21:14:30", "end": "21:21:05", "active_sec": 397 }
    ]
  }
```

### 8.3 Örnek — Biberon / Mama Kaydı

```http
POST /api/v1/babies/1/feedings
Authorization: Bearer <access_token>

{
  "sync_uuid": "b7c2…",
  "feed_type": "bottle_formula",   // bottle_breastmilk | bottle_formula | solid | water
  "started_at": "2026-11-01T15:40:00.000Z",
  "ended_at":   "2026-11-01T15:52:00.000Z",
  "amount": 12,
  "amount_unit": "cl",             // sunucu amount_ml = 120 olarak türetir
  "note": "Tamamını bitirdi"
}
```

`baby_id` artık gövdede değil yoldadır; `created_by` istemciden **alınmaz**, sunucu
token'daki kullanıcıyı yazar.

### 8.4 Örnek — Paylaşım Akışı

Anne (bebeğin sahibi) babayı davet ediyor:

```http
POST /api/v1/babies/1/invitations
{ "email": "mehmet@ornek.com", "relationship": "baba", "permission": "editor" }

→ 201 { "invitation_id": 7, "code": "K7M4RPQX", "expires_at": "2026-11-08T19:00:00Z" }
```

Baba kendi hesabıyla kabul ediyor:

```http
GET  /api/v1/invitations/mine
→ [ { "id": 7, "baby_name": "Elif", "relationship": "baba",
      "permission": "editor", "invited_by": "Ayşe Yılmaz" } ]

POST /api/v1/invitations/accept   { "invitation_id": 7 }
→ 200 { "baby_id": 1, "permission": "editor" }
```

Baba artık kayıt girebilir ama **paylaşamaz**:

```http
POST /api/v1/babies/1/invitations   (baba olarak)
→ 403 { "error": { "code": "FORBIDDEN",
        "message": "Bu bebeği yalnızca oluşturan kişi paylaşabilir" } }
```

### 8.5 Örnek — Denetim İzi

Baba bez değişimini kaydediyor:

```http
POST /api/v1/babies/1/diapers
{ "sync_uuid": "c91f…", "changed_at": "2026-11-02T00:05:00.000Z",
  "diaper_type": "kaka", "cream_applied": true, "tz_offset_min": 180 }
```

Anne aynı günün akışını istediğinde kaydı kimin girdiğini görür:

```http
GET /api/v1/babies/1/timeline?date=2026-11-02

→ [ { "kind": "diaper", "subtype": "kaka",
      "started_at": "2026-11-02T00:05:00.000Z",   // olay saati  → 03:05
      "entered_at": "2026-11-02T05:12:40.000Z",   // giriş saati → 08:12
      "actor": { "user_id": 4, "name": "Mehmet Yılmaz",
                 "relationship": "baba", "is_me": false },
      "cream_applied": true } ]
```

### 8.5.1 Kayıtta Yakınlık Derecesi

`POST /api/v1/auth/register` isteğe bağlı bir `relationship` alanı alır
(`anne` | `baba` | … | `diger`, `baby_members.relationship` ile **aynı enum**).
Değer `users.default_relationship` sütununda saklanır
(`migrations/014_user_relationship.sql`) ve `publicUser` üzerinden
`relationship` + `relationship_label` olarak döner.

**Neden kullanıcı tablosunda.** Yakınlık asıl olarak bebeğe göredir
(`baby_members`): aynı kişi bir bebeğin annesi, diğerinin teyzesi olabilir. Ama
kayıt anında henüz hiç bebek yok ve kullanıcının "ben anneyim" demesi için bir
yer gerekiyordu. Bu sütun o cevabı **varsayılan** olarak saklar.

**Nerede kullanılır.** `POST /babies` isteğinde `my_relationship`
gönderilmezse buradaki değer üyeliğe yazılır. Önceden şema varsayılanı `diger`
olduğu için herkes "Yakın" kaydoluyordu ve ebeveynler aile listesinde
*"Yakın Mehmet"* diye görünüyordu. `my_relationship` artık `.default()`
taşımıyor; varsayılan orada olsaydı "gönderilmedi" ile "açıkça `diger` seçildi"
ayrımı kaybolur ve profildeki değer hiç devreye giremezdi.

**Alan zorunlu değil.** Eski istemciler ve `migrations/014` uygulanmamış
sunucular bozulmasın diye hem şemada `.default('diger')` var hem de `UserRow`
içinde sütun opsiyonel.

Mobil tarafta kayıt formu dört seçenek sunar (`SIGNUP_RELATIONSHIPS`:
Anne / Baba / Bakıcı / Yakın). Tam liste on dört; kayıt anında o kadar ayrıntı
sormak formu uzatıyor ve geri kalanı bebek eklerken ya da aile ekranından
seçilebiliyor. **Varsayılan seçili gelmez** ve seçim zorunludur: ilk seçeneği
hazır işaretlemek, kullanıcı hiç bakmadan geçtiğinde onu yanlış bir değerle
kaydetmek olurdu.

> Yakınlığın Türkçe karşılıkları `RELATIONSHIP_LABELS` içinde **tek yerde**
> durur (`core/api/modules.ts`). Önceden `FamilyScreen` ve `RecordDetail`
> içinde iki kopya vardı ve `diger` birinde "Diğer", diğerinde "Yakın"
> yazıyordu — aynı kişi iki ekranda farklı görünüyordu.

### 8.6 İstemcinin API Adresini Seçmesi

Adres `src/core/config.ts` içinde **üç** ortam değişkeninden türetilir; hiçbiri
verilmezse **yerel sunucu** varsayılır (Android emülatörü `http://10.0.2.2:4000`,
iOS simülatörü ve web `http://localhost:4000`). Kodda gömülü bir yayın adresi
**yoktur**: canlıya bağlanmak için değişkenin açıkça verilmesi gerekir.

Fiziksel telefonda `10.0.2.2` ve `localhost` **çalışmaz** — ikisi de cihazın
kendisini gösterir. Oraya makinenin LAN adresi yazılmalı (`ipconfig`, ör.
`http://192.168.1.20:4000`) ve telefon aynı ağda olmalı.

| Değişken | Varsayılan | Ne işe yarar |
|----------|-----------|--------------|
| `EXPO_PUBLIC_API_URL` | yerel sunucu (platforma göre) | İstemcinin **bağlandığı** origin |
| `EXPO_PUBLIC_API_CANONICAL_URL` | yukarıdakiyle aynı | Sunucunun **kendini bildiği** origin (`PUBLIC_BASE_URL`) |
| `EXPO_PUBLIC_API_HOST_HEADER` | yok | İsme dayalı sanal konağı seçen `Host` başlığı |

Değerler proje kökündeki **`.env.local`** dosyasına yazılır (`.gitignore`
`.env*.local` kalıbını dışarıda tutar); `.env.example` örneği taşır ve depoya
girer.

**Neden kanonik origin ayrı bir değişken.** Sunucu, yüklenen dosyaların
adresini kendi `PUBLIC_BASE_URL` değeriyle döndürüyor. Yerel geliştirmede
istemci `http://10.0.2.2` adresine bağlanırken sunucu hâlâ
`http://bebektakip.test/uploads/...` döndürür; `assets.ts` öneki çevirebilsin
diye ikisini ayrı bilmek zorunda. Tek değerden türetilseydi önek eşleşmez,
çeviri sessizce atlanır ve emülatörde hiçbir fotoğraf yüklenmezdi. Canlı
kurulumda ikisi aynıdır ve çeviri kimlik işlevi görür.

**`EXPO_PUBLIC_*` pakete gömülür.** Expo CLI `process.env.EXPO_PUBLIC_API_URL`
ifadesini metinsel olarak arayıp değeriyle değiştirir; bu yüzden değişkene
atayıp destructuring ya da `process.env['...']` ile okumak sessizce `undefined`
verir. Gömüldükleri için **sır taşımazlar** — burada yalnızca adres var.
Değişiklikten sonra uygulamanın yeniden yüklenmesi (Reload) yeter, geliştirme
sunucusunu yeniden başlatmak gerekmez.

> **Canlı sunucuda `PUBLIC_BASE_URL` de güncellenmeli.** Logo, bebek fotoğrafı
> ve müzik adresleri sunucuda bu değerle üretiliyor; `http://bebektakip.test`
> kalırsa istemci onları çözemez.

---

## 9. Modül Sistemi (Aktif / Pasif)

### 9.1 Tasarım İlkesi

Her modül **kendi kendine yeten bir klasör**: ekranları, store'u, servisi, tipleri ve API çağrıları içinde. Çekirdek uygulama yalnızca `ModuleRegistry` üzerinden modülleri tanır — böylece bir modülü kapatmak diğerlerini etkilemez.

> **Aktiflik sistem genelidir (2026-11-02).** Hangi modülün açık olduğuna
> **yönetim paneli** karar verir ve karar **tüm kullanıcılar** için aynı anda
> geçerli olur. Mobil uygulamada modül aç/kapa arayüzü **yoktur**; Ayarlar
> ekranındaki modül listesi kaldırılmıştır. Tek doğruluk kaynağı
> `modules.is_enabled` sütunudur (§4.2), mobil tarafa `GET /modules` ile
> okunur ve yerel SQLite'a önbelleklenir.

```ts
// src/core/modules/types.ts
export interface AppModule {
  key: ModuleKey;                    // 'breastfeeding'
  title: string;
  icon: string;
  sortOrder: number;
  isCore: boolean;                   // true → kapatılamaz
  screens: ScreenDefinition[];       // navigasyona eklenecek ekranlar
  timelineAdapter?: TimelineAdapter; // kayıtlarını timeline kartına dönüştürür
  settingsPanel?: React.FC;          // modüle özel ayar ekranı
  requires?: { keys: ModuleKey[]; mode: 'any' | 'all' };
  onEnable?: () => Promise<void>;
  onDisable?: () => Promise<void>;   // örn. hatırlatıcılarını iptal et
}
```

> **Uygulanan şekil daha dar.** `src/core/modules/types.ts` içindeki
> `ModuleMeta` yalnızca `key`, `title`, `description`, `icon`, `color`,
> `isCore`, `defaultOn`, `sortOrder` ve `requires` taşır. `tab` ve
> `quickAction` alanları alt sekme çubuğuyla birlikte kaldırıldı (§9.5);
> `screens` yerine ayrı bir `moduleScreens.ts` haritası var, böylece katalog
> React'e bağımlı kalmıyor ve store'dan güvenle import edilebiliyor.

### 9.2 Kayıt ve Çözümleme

```ts
// src/core/modules/registry.ts
export const MODULES: AppModule[] = [
  babiesModule, breastfeedingModule, bottleModule, solidModule,
  sleepModule, musicModule, remindersModule, timelineModule, reportsModule,
];

export const useEnabledModules = () => {
  // states: GET /modules yanıtının yerel önbelleği — sistem geneli, salt okunur.
  const states = useModuleStore(s => s.states);
  return useMemo(
    () => MODULES
      .filter(m => m.isCore || states[m.key] !== false)
      .filter(m => !m.requires || satisfies(m.requires, states))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [states]
  );
};
```

Navigasyon ve ana ekrandaki modül ızgarası bu listeden **runtime'da** üretilir.
Durum şu anlarda tazelenir: uygulama açılışı, giriş sonrası ve uygulamanın ön
plana gelişi. Sunucuya ulaşılamazsa son bilinen önbellek kullanılır — ağ yokken
modüller kaybolmaz.

Bir modül **panelden** kapatıldığında, o modülü kullanan istemcilerde:

1. `GET /modules` sonraki tazelemede `is_enabled: false` döner,
2. `onDisable()` çağrılır → ilgili `reminders` pasifleştirilir, planlı bildirimler `notifee.cancelTriggerNotification()` ile iptal edilir, çalan müzik durdurulur,
3. Navigasyon ağacı yeniden hesaplanır (modülün ana ekrandaki karesi kaybolur),
4. **Veri silinmez** — modül yeniden açıldığında geçmiş kayıtlar ve timeline girdileri geri gelir.

### 9.3 Modül Bağımlılıkları

`breastfeeding` ve `bottle` modüllerinin ikisi de kapalıysa `reminders` modülünün `feeding` tipi hatırlatıcıları otomatik pasifleşir. Bağımlılık `AppModule.requires` ile tanımlanır, kalıcı hali `modules.config` JSON alanında `{"requires":["breastfeeding","bottle"],"mode":"any"}` şeklinde tutulur.

### 9.4 Ayarlar Ekranı Davranışı

**Mobil Ayarlar ekranında modül listesi yoktur.** Aç/kapa switch'leri, modül
başlıkları ve bağımlılık uyarıları kaldırılmıştır; kullanıcı kendi uygulamasında
modül açıp kapatamaz. Ayarlar ekranında yalnızca şunlar kalır:

- **Hesap** — ad soyad, e-posta, telefon, kayıtlı bebek sayısı (salt okunur).
- **Ortam** — uygulama sürümü, açık modül sayısı, yerel veritabanı, API adresi
  ve bağlantı durumu.

Hesabı **değiştirme** ve **çıkış yapma** burada değil, hesap panelindedir
(§9.6). Aynı eylemin iki ayrı yerde durması hangisinin yetkili olduğunu
belirsizleştiriyordu.

### 9.5 Tasarım Sistemi

Uygulamanın görsel dili `modules_doc/tasarim.jpg` şablonundan gelir.
**Renkler göz kararı değil, şablondan örneklenerek** alındı: her nokta için
küçük bir pencerenin en sık rengi okundu (JPEG gürültüsüne dayanıklı olsun
diye). Değiştirmek gerekirse şablona geri bakılmalı; `src/core/theme/index.ts`
bu değerlerin tek kaynağıdır.

| Belirteç | Değer | Nerede |
|----------|-------|--------|
| `colors.bg` | `#F0F4FC` | Ekran zemini — düz beyaz değil, hafif mavi-gri |
| `colors.surface` | `#FFFFFF` | Kartlar, alt çubuk |
| `colors.surfaceSoft` | `#F7F9FD` | Girdi alanlarının zemini |
| `colors.accent` | `#8FB39C` | Alt çubuğun ortasındaki (＋) düğmesi |
| `colors.navActive` | `#E8939A` | Alt çubukta seçili sekme |
| `moduleTint.*` | 12 pastel ton | Izgara kutuları ve ikon kutucukları |
| `colors.track*` | 4 doygun ton | Akış kartlarının sol şeridi, grafik sütunları |

İki ayrım bilinçli:

- **Kartların çerçevesi yok.** Şablonda ayrımı yumuşak gölge yapıyor
  (`shadow.card`). Android'de `elevation` tek başına sert bir gri verdiği
  için gölge rengi ve yarıçapı birlikte ayarlandı.
- **Pastel tonlar yalnızca büyük yüzeylerde.** Grafik sütunları ve akış
  şeritleri `track*` tonlarını kullanır: beyaz zeminde 5 piksellik pastel bir
  sütun neredeyse görünmüyordu.

Izgara sırası da şablondan: Bebek, Biberon, Emzirme, Uyku, Bez, Ek Gıda, Süt
Sağma, Ninni, Hatırlatıcı, Akış, Aile, Raporlar. Sunucudaki
`modules.sort_order` aynı sıraya çekildi; iki taraf ayrışırsa panel ile
uygulama farklı sıra gösterirdi.

#### Klavye açıkken dokunuş — `Screen` kaydırma alanı

`Screen` bileşenindeki `ScrollView`, **`keyboardShouldPersistTaps="handled"`**
kullanır. React Native'in varsayılanı `'never'`: klavye açıkken ekrana yapılan
ilk dokunuş yalnızca klavyeyi kapatır ve çocuk bileşenlere **hiç iletilmez**.

Sonuç, tüm formlarda sessiz bir "iki kez bas" davranışıydı — şifreyi yazıp
"Giriş yap"a basan kullanıcının ilk dokunuşu kayboluyordu ve düğme bozuk
görünüyordu. Emülatörde şifre göster düğmesiyle doğrulandı: tek dokunuş
`'never'` ile hiçbir şey yapmıyor, `'handled'` ile anında çalışıyor.

`'handled'` iki davranışı birleştirir: dokunuşu işleyen bir bileşen varsa ona
iletilir, yoksa klavye yine kapanır. Diğer kaydırma alanlarına (hesap paneli,
hızlı kayıt, bildirim çekmecesi, kayıt detayı, aktif süre penceresi)
eklenmedi: hiçbirinde metin kutusu yok, dolayısıyla içlerinde klavye hiç
açılmıyor.

### 9.6 Tarih ve Saat Girişi

Tarih ve saat alanları **sistem seçicisi** kullanır
(`@react-native-community/datetimepicker`). Önceden düz metin kutularıydı ve
kullanıcıdan `YYYY-AA-GG` / `SS:DD` biçimini elle tutturması bekleniyordu;
yanlış yazım ancak kaydetmeye basınca hata olarak dönüyordu.

`src/components/DateTimeField.tsx` üç alan sunar:

| Bileşen | Kullanım |
|---------|----------|
| `DateField` | Doğum tarihi — takvim açar, ileri tarih `maximumDate` ile kapatılır |
| `TimeField` | Doğum saati, sessiz saat başlangıç/bitiş — 24 saatlik saat seçici |
| `TimeListField` | Hatırlatıcının `fixed_times` listesi — saat rozetleri, her biri silinebilir |

Üç not:

- Seçici **bildirimsel** kullanılır (açıkken bileşen monte edilir). İmperatif
  `DateTimePickerAndroid.open()` yalnızca Android'de var; tek kod yolu tutmak
  için bildirimsel biçim seçildi.
- `is24Hour` sabittir: kayıtlar `SS:DD` saklandığı için cihaz 12 saate ayarlı
  olsa da seçici 24 saat gösterir.
- `TimeListField` virgüllü metin kutusunun yerini aldı. Saatler sıralı tutulur
  ve aynı saat iki kez eklenmez; sunucu zaten en fazla 12 saat kabul ediyor.

Paket native kod içerir: eklendikten sonra `npx expo prebuild --platform
android` ve yeniden derleme gerekir.

### 9.7 Kabuk: ana ekran ızgarası ve hesap paneli

**Modül sekmeleri kaldırıldı.** Modül sayısı 12'ye çıkınca sekmeler sığmıyor,
bir kısmı Ayarlar'ın içindeki "Diğer modüller" listesine saklanıyordu; aynı
modüle iki ayrı yoldan ulaşılması ve bazılarının yalnızca ikinci yoldan
ulaşılabilmesi tutarsızdı. Modüller artık yalnızca ana ekrandaki ızgarada.

Şablondaki kabuk dört parçadır:

1. **Üst şerit** (`BabyBar`) — yuvarlak bebek fotoğrafı, bebeğin adı ve
   "Yaş: …" satırı, sağda ayarlar düğmesi. Üst güvenli alanı kendisi tüketir;
   alt ağaç `top: 0` ile çalışır, yoksa her ekran ikinci kez boşluk bırakırdı.
   Bebek alanına dokunmak Bebek Profilleri ekranına götürür — bu yüzden
   ekranlardaki yinelenen `BabySwitcher` kaldırıldı.
2. **Ana ekran ızgarası** — açık **tüm** modüller 4 sütunlu pastel kutularda.
   Liste katalogdan runtime'da türetilir; yeni modül eklemek ana ekranda
   değişiklik gerektirmez.
3. **Alt gezinme çubuğu** (`BottomNav`) — beş öğe: ana sayfa, günlük akış,
   ortada hızlı kayıt düğmesi, raporlar ve hesap. Bu çubuk **modül sekmesi
   değildir**: sabit bir iskelet, modül sayısından etkilenmez. Ortadaki (＋)
   `QuickAddSheet`'i açar; liste yine katalogdan gelir ve kayıt girilmeyen
   modülleri (bebek profilleri, akış, raporlar, aile, müzik) eler.
4. **Hesap paneli** (`AccountDrawer`) — ayarlar düğmesinden sağdan açılır:
   hesap başlığı, "Bilgilerimi düzenle", "Ayarlar" ve çıkış.

#### Alt çubuğun örttüğü alan

Çubuk `position: absolute` ile çizilir, yani **yer kaplamaz** — ızgara ve
kartlar arkasından geçer. Bedeli, her ekranın en alttaki içeriği için kendi
payını bırakmak zorunda olmasıdır. Pay üç parçadan oluşur ve üçü de gereklidir:

| Parça | Değer | Neden |
|-------|-------|-------|
| Cihazın jest çubuğu | `insets.bottom` | Cihaza göre değişir, emülatörde ~24dp |
| Çubuk gövdesi | `NAV_HEIGHT` (64) | Çubuğun kendisi |
| Taşan yuvarlak düğme | `NAV_OVERHANG` (22) | (＋) çubuğun üstüne taşar |

İlk uygulamada `Screen` tek bir sabit (`spacing.xxl * 2` = 64) bırakıyordu; ilk
iki parçayı saymadığı için **"Görevi oluştur", "Kaydet" gibi en alttaki
düğmeler çubuğun arkasında kalıyordu**. Aynı dönemde kabuk, alt ağaca
`bottom: 0` veriyordu ("boşluğu çubuk tüketiyor" varsayımıyla) — bu da `Modal`
ile açılan alt sayfaların (`RecordDetail`, `QuickAddSheet`) jest çubuğuna
yapışmasına yol açıyordu.

Çözüm iki parçalı:

- Alt ağaç cihazın **gerçek** `insets.bottom` değerini görür; `top` ezmesi
  (BabyBar'ın tükettiği üst alan) olduğu gibi kalır.
- Çubuğun örttüğü yükseklik ayrı bir context'te taşınır
  (`BottomNavSpaceContext`, varsayılan 0). Kabuk oraya `NAV_SPACE` koyar,
  `Screen` de alt payına ekler.

Ayrı context olmasının sebebi: çubuğun **üstünde** açılan `Modal` sayfalar bu
payı eklememelidir, yoksa alt kenarlarında 86dp boşluk kalır. Güvenli alanı
ezerek tek bir sayıya sıkıştırmak bu ayrımı yapamıyordu. Çubuğun bulunmadığı
yerde (giriş akışı) context varsayılanı 0'dır ve aynı `Screen` doğru çalışır.

Navigasyon artık tek düzeyli bir `native-stack`'tir: kök ana ekran, geri kalan
her şey üstüne itilir.

**`@react-navigation/drawer` kullanılmadı.** O paket `react-native-reanimated`
ve `react-native-gesture-handler` gerektirir — iki native bağımlılık, yeni bir
prebuild ve kalıcı bakım yükü. İhtiyaç tek düğmeyle açılan bir panel olduğu
için React Native'in kendi `Modal` + `Animated` bileşenleri kullanıldı; bedeli,
kaydırma jestiyle açılamamasıdır.

Panel navigasyon ağacının **dışında** (App kabuğunun çocuğu) durur, çünkü tüm
ekranların üzerine binmesi gerekir. Bu yüzden `useNavigation` kullanamaz ve
yönlendirmeyi `navigationRef` üzerinden yapar.

Kapanış animasyonunun yutulmaması için `Modal`'ın görünürlüğü `visible`
değerinden ayrı tutulur: kapanış isteği animasyonu başlatır, animasyon bitince
Modal sökülür. Geçiş efektte değil **render sırasında** yakalanır (React'in
türetilmiş durumu render'da düzeltme kalıbı); efekt içinde `setState` fazladan
bir render turu doğurup panelin ilk karesini atlatıyordu.

### 9.7.1 İkon Seti

Uygulamanın tek ikon kaynağı **Material Design Icons**'tur
(`@react-native-vector-icons/material-design-icons`), tek bir sarmalayıcı
üzerinden: `src/components/Icon.tsx`.

Önceden ikonlar **emoji** idi (👶 🍼 😴 …). Üç sorun çıkarıyorlardı:

1. **Platforma göre değişen çizim.** Aynı ekran Android ve iOS'ta farklı
   görünüyordu; emoji setini işletim sistemi belirliyor.
2. **Hizasız ve kayan boyut.** Emoji bir *karakterdir*: boyutu ve taban
   çizgisi yazı tipine bağlı, bu yüzden ızgarada kutudan kutuya kayıyordu.
   Alt çubukta ve kart başlıklarında aynı sorun vardı.
3. **Tema ile uyuşmama.** Rengi gömülü olduğu için pastel kutuların üzerinde
   ya çok parlak ya da bulanık duruyordu; `colors.textSoft` gibi bir değere
   boyanamıyordu.

`outline` varyantları tercih edildi: içi dolu ikonlar pastel zeminlerde ağır
duruyordu, çizgi ikonlar hem daha kurumsal hem daha yumuşak.

> **Biberon ikonu iki kez değişti.** MDI'nin `baby-bottle` ikonu **eğik**
> çizilmiş; 22–32 px'te biberondan çok bir etikete benziyordu ve akış
> listesinde her "Beslenme" satırı aynı belirsiz şekille doluyordu. Dolu
> varyantı da aynı silüeti taşıdığı için sonunda `bottle-tonic-outline`
> seçildi: dik duran boyun + gövde silüeti küçük boyutta da "şişe" olarak
> okunuyor. Emülatörde üç seçenek de denenerek karar verildi.

**Semantik adlandırma.** Çağıran taraf `bottle` der, `baby-bottle-outline`
demez. Set değişecek olursa tek dosya yeterlidir; ekranlar ikon kütüphanesini
hiç tanımaz. Modül ikonları ayrıca ayrı bir alan tutmaz: `ModuleMeta.key`
zaten sözlükteki adla aynıdır, iki yerde tutmak yeni modül eklerken birini
güncellemeyi unutmaya davetiye çıkarıyordu.

**`/static` içe aktarımı** (`@react-native-vector-icons/material-design-icons/static`)
bilinçli: font APK'ya gömülür ve ilk karede hazırdır. Varsayılan (dinamik)
içe aktarımda font çalışma zamanında yüklendiği için açılış ekranında ikonlar
bir an boş kutu olarak çiziliyordu. Karşılığında `app.json`'a config plugin
satırı ve bir `expo prebuild` gerekiyor.

> `@expo/vector-icons` **kullanılmadı**: Expo'nun kendi ikon rehberi onu
> "kullanımdan kaldırılacak, önerilmiyor" diye işaretleyip
> `@react-native-vector-icons`'a yönlendiriyor.

**Bildirim başlıklarında emoji bilinçli olarak kaldı** (`scheduler.ts`,
`taskAlarms.ts`): bildirim metni işletim sistemine düz metin gider, orada
bileşen çizdiremeyiz. Emoji, bildirim gölgesinde türü ayırt etmenin tek yolu —
kanal ikonu hepsinde aynı. Bunun dışındaki her yer vektör ikona geçti.

Alt çubuktaki dört ikon ve üst şeritteki ayarlar ikonu önceden `View`'lardan
**elle çizilmişti** (üçgen çatı + kare gövde, iki çizgi + iki nokta…).
Çalışıyordu ama kaba duruyordu ve her yeni sekme yeni bir çizim demekti;
artık onlar da aynı setten geliyor.

#### Geçiş sırasında kaçan iki yer

Emoji taraması `string` tipli ikon alanlarını yakalamıyordu: tip imzası
`IconName`'e çevrildiği hâlde **çizim** hâlâ `<Text>{icon}</Text>` kalmış
olabiliyor ve ekranda ikon yerine semantik adın kendisi yazılıyordu. İki yerde
oldu ve ikisi de emülatörde görülerek bulundu:

- **Ana ekrandaki durum kartları** — "brea stfe", "sleep", "bottle" yazıyordu.
- **Görevler ekranındaki görev kartı** — "task For" yazıyordu.

Ders: ikon alanının tipini değiştirmek yetmez, o alanı çizen yeri de aramak
gerekir. `grep -n "icon" <dosya>` ile hem imza hem gövde satırları birlikte
görülüyor.

#### Chip'lerde ikon

`Chips` bileşeni isteğe bağlı bir `icons` eşlemesi alır. Çoğu chip grubu kısa
metinlerden oluşuyor ve ikon onları kalabalıklaştırırdı; ama seçenekler bir
**türü** temsil ediyorsa (görev tipi gibi) chip, listedeki kartla aynı simgeyi
gösterir ve seçim sonrası "doğru olanı seçmişim" hissi verir.

Seçili chip'in ikonu `colors.primary` ile boyanır, beyazla değil: seçili chip
zemini `primarySoft` (açık mavi) ve beyaz ikon orada görünmüyordu.

Onay kutusunun içinde `check` değil **`tick`** kullanılır. `check`
(`check-circle-outline`) çemberli bir işaret; kare bir kutunun içine konunca
kutu-içinde-daire gibi duruyordu.

### 9.7.2 Açılış Ekranı

`src/components/SplashBounce.tsx`: ortada zıplayan uygulama ikonu, hemen
altında dolan bir çubuk, en altta ne beklendiğini söyleyen satır.

Dört karar:

1. **Yerel `assets/icon.png` kullanılır**, sunucudan gelen marka logosu değil.
   Açılışta logo henüz indirilmemiş olabiliyor ve ekran bir süre boş
   kalıyordu; paketlenmiş ikon ilk karede hazır.
2. **Her iki animasyon da `useNativeDriver` ile çalışır.** JS iş parçacığı
   açılışta zaten meşgul (yerel şema göçü, SecureStore okuması, oturum
   yenileme, ilk istek); animasyon orada kalsaydı tam da gösterilmesi gereken
   anda takılırdı. Bu yüzden çubuk `width` ile değil **`scaleX`** ile
   doldurulur — genişlik native sürücüde animasyonlanamıyor. `scaleX`
   merkezden ölçeklediği için dolgu, kaybolan yarım genişlik kadar
   `translateX` ile geri kaydırılır.
3. **Zıplama iki ayrı eğridir**: yukarı çıkarken yavaşlayan (`Easing.out`),
   inerken hızlanan (`Easing.in`). Tek eğriyle hareket mekanik duruyordu;
   yerçekimi hissi bu asimetriden geliyor. Tepede ve yerde kısa birer bekleme
   ritmi "nefes alan" bir hâle getiriyor.
4. **Çubuk gerçek ilerleme göstermez.** Açılışta ne kadar iş kaldığı
   bilinmiyor (hepsi ağ hızına bağlı). Dolup baştan başlayan bir döngü dürüst
   olanı: "çalışıyorum" der, yalan bir yüzde göstermez.

Sistemde **"hareketi azalt"** açıksa zıplama yapılmaz
(`AccessibilityInfo.isReduceMotionEnabled`); çubuk yine dolar, yalnızca ikon
sabit durur. Vestibüler duyarlılığı olan kullanıcılar için tekrarlayan hareket
rahatsız edici.

### 9.8 Ana Ekran Bölümleri

Şablonda ana ekran üç bölümden oluşur:

| Bölüm | İçerik |
|-------|--------|
| **Anlık Durum** | 2×2 kart: emzirme, uyku, biberon, uyanıklık süresi |
| **Hızlı İşlemler** | Açık tüm modüller, 4 sütunlu pastel kutular |
| **Günlük Akış** | Günün son 4 kaydı; sol şeridi kayıt türünü renkle ayırır |

Durum kartlarındaki oran çubukları bir ölçek gerektiriyor: günlük uyku 14
saat, biberon 800 ml, uyanıklık penceresi 3 saat üzerinden doldurulur. Bunlar
**hedef değil ölçek** — sağlık tavsiyesi değil, yalnızca çubuğun dolum oranını
anlamlı kılan referanslar; kodda da böyle not edildi.

Veri dört uçtan **paralel** çekilir:

| Uç | Verdiği |
|----|---------|
| `GET /babies/{id}/sleep/daily-summary` | uyku toplamı **ve uyanıklık penceresi** |
| `GET /babies/{id}/feedings/daily-summary` | **yalnızca biberon** mililitresi |
| `GET /babies/{id}/breastfeeding/last` | son seans ve sıradaki meme |
| `GET /babies/{id}/timeline` | günün son kayıtları |

Biberon için ayrı uç şarttır: rapordaki `total_ml`, `SUM(amount_ml)` olduğu
için **suyu da** sayar; oysa kartın etiketi "Biberon" diyor. Tek uçla
yetinmek rakamı sessizce şişirirdi (§22.0.2).

Kartlar ilgili modül kapalıysa hiç çizilmez — kapalı bir modülün sürekli `0`
göstermesi anlamsızdı.

### 9.9 Bebek Ekleme: iki yol

"Bebek ekle" iki seçenek sunar:

| Seçenek | Ne yapar |
|---------|----------|
| **Yeni bebek ekle** | `POST /babies` — profili oluşturan `owner` olur |
| **Paylaşım kodum var** | `POST /invitations/accept` — davet kodunu kullanıp var olan bir bebeğe katılır |

İkincisi eskiden yalnızca Aile ve Yetkiler ekranının **en altındaydı**. Oysa
daveti alan kişinin aradığı yer "bebek ekle" düğmesidir: henüz hiç bebeği
olmayan yeni bir kullanıcı Aile ekranına gitmeyi düşünmez. Aynı alan orada da
duruyor; iki giriş noktası da aynı ucu çağırır.

Katıldıktan sonra `refreshAll({ includePrivate: true })` çağrılır — bebek
ancak sunucudan tazelendikten sonra yerel aynaya düşer.

#### 9.9.1 Yetki seviyesinin istemciye taşınması

`GET /babies` her satırda `my_permission` döndürüyordu ama **yerel ayna bunu
saklamıyordu**: şemada yalnızca `is_owner` vardı. Davet koduyla katılan
kullanıcının `editor` mü `viewer` mı olduğu cihazda bilinmiyor, bu yüzden
liste salt okuyan bir üyeye de "Düzenle" düğmesi gösteriyordu. Düğme sunucuda
reddedilirdi — ama varlık sızdırmamak için dönen `404` ("Kayıt bulunamadı")
kullanıcıya anlamsız gelirdi.

Yerel şemaya v5 göçüyle `my_permission`, `owner_name` ve `member_count`
eklendi. Arayüz bunlara göre davranır:

| Yetki | Liste | Kayıt ekranları |
|-------|-------|-----------------|
| `owner` | "Sahip" rozeti, Düzenle | Tüm işlemler |
| `editor` | "Düzenleyebilir" rozeti, Düzenle | Tüm işlemler |
| `viewer` | "Yalnızca görüntüleme" rozeti, Düzenle **yok** | `ReadOnlyBanner`, kaydetme/silme devre dışı |

Paylaşılan bebekte kimin paylaştığı (`owner_name`) ve kaç kişinin eriştiği
(`member_count`) de listede gösterilir.

**Bu kontroller güvenlik değildir.** Asıl engel `requireBaby('editor')`
ara katmanındadır (§5.5); buradaki amaç kullanıcıya kesin reddedilecek bir
düğme sunmamaktır.

### 9.10 Kayıt Detay Raporu

Geçmiş listelerindeki satırlar tek satıra sığsın diye kırpılıyordu; renk,
kıvam, uyanma sebebi, kaydı giren kişi gibi alanlar **hiç görünmüyordu**.
Satıra dokunmak artık `RecordDetailSheet`'i açar (alttan gelen sayfa) ve
kaydın tamamını gösterir.

Ortak bileşen tek bir betimleyici alır (`RecordDetail`); her ekran kendi
betimleyicisini kurar, çünkü etiketler ve neyin öne çıkacağı modüle özgüdür.
Bölümler sırasıyla:

| Bölüm | İçerik |
|-------|--------|
| Başlık | İkon, kaydın adı, tam tarih-saat |
| Uyarı | Yalnızca gerektiğinde: alerjik tepki, şiddetli pişik |
| Rakamlar | En fazla üç `StatTile` — süre, miktar, tepki gibi |
| Ayrıntılar | Etiket/değer listesi; **boş değerli satırlar çizilmez** |
| Not | Varsa ebeveyn notu |
| Kayıt bilgisi | Giren kişi (yakınlığıyla), giriş şekli, oluşturma/güncelleme, kayıt no |
| Eylemler | Modüle özgü eylemler + silme + kapat |

Üç ayrıntı:

- **Silme buraya taşındı.** Önceden yalnızca uzun basmakla yapılabiliyordu ve
  keşfedilebilir değildi. Uzun basma kısayol olarak kaldı.
- **"Güncellendi" satırı yalnızca gerçekten düzenlenmişse çizilir.**
  `updated_at !== created_at` karşılaştırması yetmiyordu: satır transaction
  içinde önce eklenip sonra dokunulduğu için ikisi milisaniye farkla
  yazılabiliyor ve hiç düzenlenmemiş kayıtlarda da satır görünüyordu.
  Karşılaştırma saniye çözünürlüğünde yapılır.
- **Günlük Akış'ta silme yoktur.** Akış kayıtların özetini taşır ve salt
  okunur bir görünümdür; silme kaydın kendi modülünden yapılır.

Denetim alanları (`actor_name`, `actor_relationship`, `entry_source`,
`created_at`, `updated_at`) sunucudan **zaten geliyordu** ama istemci tipleri
bunları bilmediği için kullanılamıyordu; `AuditFields` olarak tanımlandılar.

### 9.11 Yönetim Panelindeki Modül Ekranı

`/admin/modules` ekranı modül kataloğunu tek tabloda listeler ve her satırda bir
aç/kapa düğmesi sunar:

- `is_core = 1` olan modüller (`babies`) **kapatılamaz**; düğme devre dışı görünür ve
  sunucu tarafı da POST'u reddeder — arayüze güvenilmez.
- Her değişiklik `activity_log`'a `entity = 'module'` olarak yazılır; kimin ne zaman
  hangi modülü kapattığı Etkinlik ekranından görülebilir.
- Değişiklik anında geçerlidir: istemciler bir sonraki `GET /modules` tazelemesinde
  yeni durumu alır.
- `modules.updated_by` değişikliği yapan yöneticiyi tutar.

### 9.12 Alt Modüller — Beslenme sekmeleri

Ana ekrandaki "Hızlı İşlemler" ızgarasında emzirme, biberon, ek gıda ve süt
sağma için **ayrı dört kutu** vardı. Dördü de aynı soruya bakıyor ("bebek ne
aldı?") ve ızgaranın yarısını yiyordu. Artık tek **Beslenme** kutusu açılıyor,
dördü o ekranda sekme oluyor.

#### Katalogdaki iki yeni alan

```ts
// src/core/modules/types.ts
parent?: ModuleKey;     // doluysa: ızgarada ve ağaçta yok, üst modülde sekme
shortTitle?: string;    // sekme çubuğundaki kısa ad
```

Dört alt modül **katalogdan silinmedi**, yalnızca `parent: 'feeding'` aldı.
Silinseydi yönetim panelindeki aç/kapa ayarı kaybolurdu: ek gıda ve sağma
sistemde varsayılan olarak kapalı ve "bu bebek için ek gıdayı kapat" hâlâ
anlamlı bir istek. Alt modül kapatıldığında yalnızca sekmesi çizilmez.

`feeding` modülü `requires: { keys: [dördü], mode: 'any' }` taşır: dördü de
kapatılmışsa Beslenme kutusu da çizilmez — boş bir sekme çubuğu açmanın
karşılığı yok.

| Yardımcı | Ne döndürür | Nerede |
|----------|-------------|--------|
| `topLevelModules(states)` | `parent` taşımayan açık modüller | Ana ekran ızgarası, `RootNavigator` |
| `childModules('feeding', states)` | Açık alt modüller, katalog sırasında | Sekme çubuğu |
| `moduleLabel(meta)` | `shortTitle ?? title` | Sekme etiketi |

#### Tek kapı kuralı

Alt modüller navigasyon ağacına **itilmez**. Ağaçta ayrıca dursalardı aynı
ekrana iki ayrı yoldan ulaşılırdı; alt sekme çubuğu tam bu yüzden kaldırılmıştı
(§9.7). Bunun pratik sonucu, bir modül anahtarının artık doğrudan bir rota adı
**olmaması**: alt modüle yönlendiren her yer `openModule(key, parent)`
üzerinden geçer ve üst modülün ilgili sekmesini açar.

Üç yer bundan etkilendi ve üçü de düzeltildi:

| Yer | Önce | Sonra |
|-----|------|-------|
| Ana ekran durum kartları | `navigate('breastfeeding')` | `openModule` → Beslenme + emzirme sekmesi |
| Hızlı kayıt sayfası | `navigateTo(key)` | `openModule(m.key, m.parent)` |
| Canlı sayaç bildirimi (§12.7) | `navigateTo(kind)` | `openModule(kind, parent)` |

Düzeltilmeselerdi dokunuş sessizce hiçbir şey yapmazdı: `navigate` bilinmeyen
rotada yalnızca uyarı basar.

#### Durum kartlarının görünürlüğü ızgaradan okunmaz

Ana ekrandaki "Anlık Durum" kartları eskiden ızgara listesine bakarak
çiziliyordu. Alt modüller ızgaradan çıkınca emzirme ve biberon kartları
sessizce kaybolurdu — oysa modüller hâlâ açık. Görünürlük artık doğrudan
`isModuleActive(key, states)` ile okunuyor.

#### Sekme kabuğu

`FeedingScreen` kendi `Screen`'ini **sarmaz**: alt ekranların her biri zaten
kendi kaydırma alanını getiriyor ve iç içe iki `ScrollView` hem çift kenar
boşluğu bırakır hem de sekme çubuğunu içerikle birlikte yukarı kaydırırdı.
Çubuk sabit, içerik kayar.

Sekme bileşenleri `src/modules/feeding/tabs.ts` içinde ayrı tutulur. Doğrudan
`moduleScreens.ts`'ten okunsaydı **require döngüsü** oluşuyordu
(`moduleScreens → FeedingScreen → moduleScreens`); Metro buna izin veriyor ama
ilk yüklenen tarafa yarı kurulmuş bir modül veriyor ve konsola uyarı basıyor.
`tabs.ts` hiçbir şeyi içe aktarmayan bir yaprak olduğu için iki taraf da onu
güvenle okuyor.

> **Sunucu kataloğu `feeding` anahtarını bilmiyor.** `useModuleStore.refresh()`
> katalog varsayılanlarıyla başlayıp yalnızca sunucunun tanıdığı anahtarları
> eziyor, bu yüzden yeni modül sunucu güncellenmeden de açık geliyor. Kalıcı
> çözüm için `modules` tablosuna satır eklenmeli (§4.4), yoksa panelden
> Beslenme'nin kendisi kapatılamaz — alt modülleri kapatılabilir.

### 9.13 Kaydetme Onayı — tek pencere

Her "Kaydet" düğmesi aynı pencereyi açar: basıldığı anda çark ve
*"Kaydediliyor…"*, istek bittiğinde yeşil onay ve **"İşleminiz
tamamlanmıştır"**. Pencere kabukta durur (`App.tsx` → `SaveFeedbackModal`),
gezinme ağacının dışında — kaydettikten sonra ekran değiştiren formlarda
(bebek profili) onay ekranla birlikte kaybolmasın.

- Durum: `src/core/feedback/useSaveFeedbackStore.ts` (`hidden | busy | done`).
- Ekranlar pencereyi doğrudan sürmez; kaydetme işini `withSaveFeedback(fn)`
  ile sarmalar. Sarmalayıcı hatayı **yeniden fırlatır**: formların kendi
  `catch` blokları ve `FormError` satırları olduğu gibi çalışmaya devam eder.

**Neden tek pencere.** Önceden kimi ekran yeşil bir satır yazıyor (`profil`),
kimi hiçbir şey söylemiyordu; kullanıcı kaydın gidip gitmediğini listeye
bakarak anlıyordu. Onayın metni ve yeri artık ekrana göre değişmiyor.

**Neden kendiliğinden kapanıyor.** Onay 1,6 saniye sonra kapanır; "Tamam"
düğmesi hemen kapatmak isteyene duruyor. Günde yirmi kayıt giren ebeveyne her
kayıtta bir dokunuş daha bindirmek, bu uygulamanın asıl döngüsünü ağırlaştırırdı.

**Neden doğrulamadan sonra açılıyor.** Pencere, yerel alan denetimleri
geçtikten sonra — yani gerçek istek başlarken — açılır. Düğmeye basar basmaz
açılsaydı, "Miktar zorunlu" diyen bir formda pencere bir an yanıp sönerdi.

**Hata durumunda** pencere sessizce kapanır ve hata formun kendi `FormError`
satırında kalır: hangi alanın sorunlu olduğunu yalnızca form biliyor, genel
bir pencere onu söyleyemez.

**Kapsam.** Veri yazan form düğmeleri: biberon, bez, ek gıda, sağma, uyku
("Uyandı"), emzirme özeti, görev, hatırlatıcı, sessiz saat, aşı (randevu /
yapıldı / takvime ekle), bebek profili, davet oluşturma ve kabul, profil
bilgileri. Dışarıda kalanlar ve nedenleri:

| Düğme | Neden |
|-------|-------|
| Giriş / Kayıt ol | Başarı zaten uygulamaya girmek; araya pencere koymak gecikme olurdu |
| Şifre değiştirme | Kendi `Alert`'i var ve ardından oturumu kapatıyor; iki pencere üst üste gelirdi |
| Şifremi unuttum | Akışın kendi "kod gönderildi / değişti" adımı var |
| Sayaç başlatma ("Uykuya daldı", "Sağmaya başla") | Kaydetme değil, sayaç açma |
| Silme / aileden çıkarma / devretme | Yıkıcı işlemler; onayları `Alert` ile **önden** alınıyor |

---

## 10. Emzirme Sayacı — Teknik Çözüm

### 10.1 Durum Makinesi

```
         start(side)
  idle ──────────────► running(side)
                         │   │   │
            pause() ◄────┘   │   └────► switch(otherSide)
                              │           (segment kapat, yeni segment aç)
  paused ──resume()──► running
     │
     └──stop()──► completed  (segmentler + toplamlar yazılır)
```

### 10.2 Süre Hesabı — "Aktif Emme" Tanımı

**Aktif süre**, yalnızca `running` durumunda geçen saniyelerin toplamıdır; duraklatılan aralıklar hariç tutulur. Her segment tek bir memeye aittir:

```
left_active_sec  = Σ (side='left'  segmentlerin active_sec)
right_active_sec = Σ (side='right' segmentlerin active_sec)
total_active_sec = left + right
```

Böylece "hangi saatte başlatıp durdurdu" bilgisi segment bazında kaybolmaz: `breastfeeding_segments` tablosu her başlat/durdur çiftini ayrı satır olarak saklar.

### 10.2.1 Aktif / Pasif Ayrımı — annenin sonradan düzeltmesi

Kronometrenin ölçtüğü süre ile bebeğin **gerçekten emdiği** süre aynı değildir:
bebek memede uyuklar, arada mola verir. Oturum bitiminde anne gerçek emme
süresini aşağı çekebilir.

**Üç kavram vardır ve karıştırılmaları kolaydır:**

| Kavram | Alan | Tanım |
|--------|------|-------|
| Ölçülen aktif | `measured_active_sec` | Kronometrenin duraklatılmadan saydığı saniye (§10.2) — sol + sağ segment toplamı |
| Duvar saati | `total_elapsed_sec` | Başlangıçtan bitişe geçen süre, **duraklamalar dâhil** |
| Aktif | `active_duration_sec` | Bebeğin gerçekten emdiği süre. Anne düzeltmediyse ölçülene eşit |

`passive_duration_sec` = duvar saati − aktif. **Hiçbir yerde ayrıca saklanmaz**:
saklansaydı düzeltme yapıldığında sessizce tutarsızlaşırdı.

#### Şema

```sql
ALTER TABLE breastfeeding_sessions
  ADD COLUMN total_elapsed_sec   INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN adjusted_active_sec INT UNSIGNED NULL;   -- NULL = düzeltme yok
```

Düzeltme **ölçülen değeri ezmez**, ayrı sütuna yazılır. Böylece "kronometre ne
ölçtü" ile "anne ne dedi" ayrı ayrı okunabilir — tek sütunda tutulsaydı bu
ayrım kaybolurdu ve ölçüm verisi geri alınamazdı.

> **Terim uyarısı.** Tablodaki mevcut `left_active_sec` / `right_active_sec`
> "duraklatılmamış saniye" demektir; yeni `adjusted_active_sec` ise annenin
> **beyan ettiği** süredir. İki farklı kavram, iki ayrı sütun.

#### Uçlar

| Metod | Yol | Ne yapar |
|-------|-----|----------|
| POST | `/breastfeeding/{id}/stop` | İsteğe bağlı `active_duration_sec` ile bitirir |
| PATCH | `/breastfeeding/{id}/active-duration` | **Sonradan** düzeltir; `null` düzeltmeyi kaldırır |

Doğrulama: aktif süre duvar saatini aşamaz (`422`). Ölçülenle aynı değer
gönderilirse düzeltme sayılmaz ve sütun `NULL` kalır.

**`feedings.duration_sec` etkin aktif süreye ayarlanır.** Raporlardaki
"emzirme süresi" toplamı oradan gelir ve bebeğin gerçek beslenme süresini
göstermelidir; ölçülen değeri yazmak toplamı şişirirdi.

Geriye dönük uyumluluk: liste ve `/last` yanıtlarındaki
`total_duration_seconds` artık **etkin aktif** süreyi taşır (şartnamedeki
"senkron tutulmalı" gereği). Ölçülen değere `measured_active_sec` ile
ulaşılır.

#### Arayüz

"Bitir" kaydı hemen yazmaz; **özet ve düzeltme penceresi** açılır
(`ActiveDurationSheet`):

- Geçen süre, sol ve sağ toplamları üstte,
- Aktif / pasif süre canlı güncellenen iki satır ve oran çubuğu,
- Dakika adımlı slider (`@react-native-community/slider`) ve hızlı oranlar
  (%100 / %80 / %60 / %50).

İki karar:

- **Varsayılan ölçülen değerdir** ve slider'a dokunulmadan kaydedilirse
  düzeltme yapılmamış sayılır. Aksi hâlde her seans "düzeltilmiş" görünür ve
  bayrak anlamını yitirirdi.
- **Slider'ın üst sınırı duvar saatidir**, ölçülen değil: duraklatılmış bir
  seansta anne "molada da emiyordu" diyebilmeli.

Geçmiş listesi, kayıt detayı, günlük akış ve ana ekran kartı artık **aktif
süreyi** öne çıkarır; duvar saati yalnızca farklıysa parantez içinde görünür
(*"18 dk aktif (toplam 25 dk)"*). Sol/sağ yüzdeleri **ölçülen** süreye göre
hesaplanır: aktif süre düzeltilse de memeler arasındaki oran değişmez.

Kayıt detayındaki **"Aktif süreyi düzelt"** eylemi aynı pencereyi tamamlanmış
bir seans için açar ve `PATCH .../active-duration` çağırır.

#### Yol boyunca çıkan iki kimlik tuzağı

- **`id` ile `session_id` karıştı.** Geçmiş listesi `id` olarak *feeding*
  kimliğini döndürüyordu; seans komutları ise `breastfeeding_sessions.id`
  ister. Sonradan düzeltme bu yüzden `404 Seans bulunamadı` dönüyordu. Liste
  artık ikisini de döndürür ve adlandırma bunu açıkça söyler.
- **Çalışan seansın alan adları hiç eşleşmiyordu.** Ekran `left_sec`,
  `active_sec`, `segment_started_at`, `current_side` bekliyordu; sunucu
  `left_active_sec`, `total_active_sec`, `open_segment_started_at`,
  `open_side` döndürüyor. Servis `Record<string, unknown>` tiplendiği ve ekran
  körlemesine dönüştürdüğü için derleyici bunu yakalayamadı. Sonucu:
  kronometre birikmiş süreyi 0 sayıyor (meme değişiminden sonra baştan
  sayıyordu) ve açık taraf bilinmiyordu. Artık `ActiveBreastSession` tipi
  gerçek şekli tanımlar; sunucu değişirse derleme kırılır.

### 10.3 Saat Tabanlı (Drift-Free) Kronometre

`setInterval` ile sayaç artırmak **kullanılmaz** — arka plana düşen JS thread'i tick kaçırır ve süre geriden gelir. Yerine her render'da **duvar saati farkı** hesaplanır:

```ts
// src/modules/breastfeeding/timer.ts
type Side = 'left' | 'right';

export type TimerSnapshot = {
  sessionId: string;
  side: Side;
  segmentStartedAtMs: number | null;            // null → paused
  accumulated: Record<Side, number>;            // ms
  sessionStartedAtMs: number;
  pauseCount: number;
};

export const elapsedMs = (s: TimerSnapshot, side: Side, now = Date.now()) => {
  const base = s.accumulated[side];
  const live = s.segmentStartedAtMs && s.side === side ? now - s.segmentStartedAtMs : 0;
  return base + live;
};

export const format = (ms: number) => {
  const t = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
};
```

- UI 1 sn'de bir yeniden render eder ama **değeri `Date.now()`'dan türetir** → drift sıfır.
- `AppState` `active` olduğunda ekstra bir telafi hesabı gerekmez; süre zaten saatten gelir.

### 10.4 Dayanıklılık (Crash / Kill Senaryosu)

| Katman | Davranış |
|--------|----------|
| MMKV snapshot | Her durum değişiminde + 5 sn'de bir `TimerSnapshot` yazılır |
| SQLite | `status='running'` kayıt ve açık segment tutulur |
| Uygulama açılışı | `status='running'` kayıt varsa "Devam eden emzirme var → Devam et / Bitir / Sil" diyaloğu |
| Foreground service | Notifee ile kalıcı bildirim: "Sol meme — 00:07:12" + Duraklat / Bitir aksiyonları |
| Android 14+ | `foregroundServiceType="shortService"` veya `dataSync`; manifest'te `FOREGROUND_SERVICE` + tip izni |

### 10.5 Ekran Davranışı

- İki büyük daire buton: **SOL** / **SAĞ** — her biri kendi aktif süresini `00:00:00` biçiminde gösterir.
- Aktif olan daire renkli ve nabız animasyonlu (`react-native-reanimated`).
- Alt bilgi çubuğu: `Başlangıç 21:02 · Toplam 00:17:28 · Son: Sağ`.
- "Sonraki seansta hangi meme?" önerisi `last_side`'ın tersi olarak gösterilir.
- Emzirme bitince kayıt `feedings` (`feed_type='breast'`) + `breastfeeding_sessions` + segmentler olarak **tek transaction'da** yazılır.
- Manuel düzeltme: bitmiş kayıtta başlangıç/bitiş saati ve her memenin süresi elle düzenlenebilir (`entry_source` `timer` kalır, `note`'a "düzenlendi" işareti eklenir).

---

## 11. Uyku Takibi

- **Kronometre modu:** `sleep/start` → kalıcı bildirim → `sleep/stop`. Emzirme ile aynı drift-free mekanizma.
- **Manuel mod:** başlangıç/bitiş saati seçici; gece yarısını aşan kayıtlarda tarih otomatik +1 gün.
- `sleep_type` otomatik önerisi: başlangıç saati 19:00–05:00 arası → `night`, aksi halde `nap`.
- Aktif uyku kaydı varken `quiet_hours.auto_from_sleep = 1` ise hatırlatıcılar otomatik olarak sessize alınır/ertelenir (bkz. §12.3).
- Uyanma sayacı: uyku kaydı açıkken "+1 uyandı" butonu `wake_count`'u artırır.
- Günlük özet: toplam uyku, en uzun kesintisiz uyku, şekerleme sayısı, uyanma sayısı.

---

## 12. Bildirim ve Hatırlatıcı Mimarisi

### 12.1 Yerel Bildirim Altyapısı

Bildirimler **cihaz üzerinde** planlanır (sunucu push'a bağımlı değil — WAMP kapalıyken de çalışır).

```ts
await notifee.createTriggerNotification(
  {
    id: `rem-${reminder.id}-${occurrenceTs}`,
    title: 'Emzirme zamanı',
    body: 'Son emzirmeden 3 saat geçti (18:05).',
    android: {
      channelId: 'reminders',
      smallIcon: 'ic_notification',
      pressAction: { id: 'open-breastfeeding' },
      actions: [
        { title: '15 dk ertele', pressAction: { id: 'snooze-15' } },
        { title: 'Başlat',       pressAction: { id: 'start-feeding' } },
      ],
    },
  },
  { type: TriggerType.TIMESTAMP, timestamp: fireAtMs, alarmManager: { allowWhileIdle: true } }
);
```

**Android kanalları** (gerçek kimlikler — `scheduler.ts`; sesler §12.8):

| Kanal | Önem | Ses | Kullanım |
|-------|------|-----|----------|
| `reminders_v2` | HIGH | `bildirim2.mp3` | Besleme, uyku, bez hatırlatıcıları |
| `tasks_v2` | HIGH | `bildirim5.mp3` | Görev saati geldiğinde |
| `tasks_overdue_v2` | HIGH | `bildirim6.mp3` | Görev saati geçtiği hâlde tamamlanmadığında |
| `vaccines_v2` | HIGH | `bildirim4.mp3` | Aşı günü yaklaştığında |
| `events_v2` | MAX | `bildirim2.mp3` (ALARM akışı) | Etkinlik uyarıları, yüksek sesli |
| `live_timer` | LOW (ongoing) | yok | Çalışan kronometre durum satırı (§12.7) |
| `task_live` | LOW (ongoing) | yok | Açık görevlerin kalıcı satırı (§12.8) |

> Yukarıdaki kod örneği **tarihsel**: `notifee` değil `expo-notifications`
> kullanılıyor (`scheduler.ts`). Sessiz saat ayrı bir kanalla değil, bildirim
> içeriğinde `sound: false` ile uygulanıyor — kanal başına ikinci bir kopya
> tutmak, kullanıcının yaptığı kanal ayarını ikiye bölerdi.

### 12.2 Interval Planlama Algoritması

```
anchor = 'last_record' ise:
    base = o bebeğin son tamamlanmış besleme kaydının started_at'i
           (kayıt yoksa → şimdi)
anchor = 'last_fired' ise:
    base = reminders.last_fired_at ?? şimdi

nextTrigger = base + interval_minutes
if (nextTrigger <= now) nextTrigger = now + 60sn        // geçmişe planlama yok
decision    = applyQuietHours(nextTrigger)              // §12.3
reminders.next_trigger_at = decision.at
notification_log'a 'scheduled' satırı yazılır
```

**Yeniden planlama tetikleyicileri:** yeni besleme kaydı, hatırlatıcı ayarı değişimi, bildirim ateşlenmesi, uygulama açılışı (kaçan planların onarımı), cihaz yeniden başlatması (`BOOT_COMPLETED` alıcısı → tüm aktif hatırlatıcıları yeniden kur).

**Önemli:** Aynı hatırlatıcı için OS'ta tek bir bekleyen tetik tutulur; yeniden planlamada önce `cancelTriggerNotification(oldId)` çağrılır. Böylece "son emzirmeden 3 saat sonra" kuralı her yeni kayıtta ileriye kayar, bildirim birikmez.

### 12.3 Sessiz Saat (Uyku Penceresi) Mantığı

```ts
function applyQuietHours(fireAt: Date, reminder: Reminder, windows: QuietHour[]): Decision {
  if (!reminder.respectQuietHours) return { action: 'fire', at: fireAt };

  const w        = findWindowContaining(fireAt, windows);  // gün aşan pencere normalize edilir
  const sleeping = hasRunningSleepRecord() && anyWindowAutoFromSleep(windows);

  if (!w && !sleeping) return { action: 'fire', at: fireAt };
  const endAt = w ? windowEnd(w, fireAt) : estimatedSleepEnd();

  switch (reminder.quietBehavior) {
    case 'postpone':  // pencere bittikten 1 dk sonrasına ötele
      return { action: 'postpone', at: addMinutes(endAt, 1) };
    case 'silent':    // aynı saatte ama sessiz kanalda
      return { action: 'fire', at: fireAt, channel: 'reminders_quiet' };
    case 'skip':      // bu tekrarı tamamen atla, sıradakini planla
      return { action: 'skip', at: nextOccurrenceAfter(endAt) };
  }
}
```

Her karar `notification_log`'a `status` + `reason` ile yazılır → "Bu bildirim neden gelmedi?" sorusu izlenebilir olur.

Gün aşan pencere normalizasyonu (`22:30 → 06:30`): `start_time > end_time` ise pencere iki parçaya bölünür — `[start_time, 24:00)` ve `[00:00, end_time)`.

### 12.4 Android İzin ve Pil Gereksinimleri

| Gereksinim | Açıklama |
|------------|----------|
| `POST_NOTIFICATIONS` | Android 13+ (API 33) — ilk açılışta runtime izni istenir |
| `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` | Tam zamanlı alarm; Android 13+ için gerekli |
| `FOREGROUND_SERVICE` + tip izni | Çalışan kronometre ve müzik bildirimi |
| `RECEIVE_BOOT_COMPLETED` | Yeniden başlatmada hatırlatıcıları kurma |
| `WAKE_LOCK` | Müzik + timer |
| Pil optimizasyonu | İlk kurulumda kullanıcıyı "Kısıtlanmamış" ayarına yönlendiren ekran (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) — Xiaomi/Huawei/Samsung agresif kill davranışı için şart |

**Uygulanan izin listesi** (`app.json` → `expo.android.permissions`):
`POST_NOTIFICATIONS`, `READ_CALENDAR`, `WRITE_CALENDAR`, `VIBRATE`,
`RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `READ_MEDIA_IMAGES`, `INTERNET`,
`ACCESS_NETWORK_STATE`.

`SCHEDULE_EXACT_ALARM` **bilinçli olarak istenmiyor**: Android 14'te varsayılan
olarak reddediliyor ve Play Store yalnızca alarm/takvim uygulamalarına açıyor
(bkz. NOTLAR-ve-EKSIKLER §4.1). Teslim `bestEffort` ile birkaç dakika kayabilir;
tam zamanlılık gereken yerde cihaz takvimi devreye giriyor (§12.6).

### 12.5 İzin Karşılaması

Android 13'ten beri bildirim izni **istenmeden verilmiyor**; takvim ve galeri
de aynı. İzinleri "kullanıldıkları ana" bırakmak teoride daha kibar ama
pratikte ebeveyn ilk hatırlatıcısını kurduğunda sessizce hiçbir alarm almıyor
ve bunu günler sonra fark ediyordu.

Bu yüzden girişten hemen sonra **bir kez** `PermissionsSheet` açılır: dört
izni (bildirim, **kesin alarm**, takvim, fotoğraf) gerekçesiyle birlikte
listeler ve sırayla ister.

#### Kesin alarm izni (`SCHEDULE_EXACT_ALARM`)

Android 12'den (API 31) beri **kesin saatli alarm ayrı bir izin**. Verilmezse
`expo-notifications` alarmı yine kuruyor ama sistem onu bir pencereye yayıyor.
Emülatörde ölçüldü: izin tanımlı değilken gecikmiş görev uyarısı
`window=+3m44s` ile planlanıyordu — yani "18:00 hatırlatıcısı" 18:04'te
çalabiliyordu. Hatırlatıcının ve görev saatinin bütün anlamı dakikasında
çalmasına bağlı olduğu için izin isteniyor.

- İzin `app.json` → `android.permissions` içinde tanımlı. **Tanım olmadan**
  `requestExactAlarmPermissionsAsync()` çağrısı reddediyor, o yüzden ekleme
  `expo prebuild` + yeniden derleme gerektiriyor.
- Okuma/isteme `expo-notifications`'ın kendi uçlarıyla:
  `getExactAlarmPermissionsAsync()` / `requestExactAlarmPermissionsAsync()`.
  Yeni bir native bağımlılık gerekmedi.
- Bu izin bir **diyalog değil, sistem ayar ekranı** açıyor; paket kullanıcı
  geri dönünce sözü çözüyor. Bu yüzden karşılama sayfasında **en sona**
  konuldu: önce üç diyalog bitsin, kullanıcı ancak sonunda uygulamadan
  çıksın.
- İki tuzak kodda yutuluyor: izin tanımlı değilse çağrı reddediyor, ve
  kullanıcı ayar ekranında izni **geri alırsa** Android uygulamayı yeniden
  başlatıyor ve söz hiç çözülmüyor (bir sonraki açılışta durum yeniden
  okunuyor).
- Android 14'ten (API 34) itibaren yeni kurulumlarda **varsayılan kapalı**;
  altındaki sürümlerde açık başlıyor ve istem anında dönüyor.
- `USE_EXACT_ALARM` **kullanılmadı**: otomatik veriliyor ama Google Play
  politikası onu yalnızca çekirdek işlevi çalar saat/takvim olan uygulamalara
  bırakıyor. Bebek takip uygulaması o tanıma girmiyor; yanlış izin mağaza
  reddi sebebidir.

Hatırlatıcılar ekranı izni ayrıca kendi içinde hatırlatıyor: bildirim izni
verilmişken kesin alarm izni yoksa "Hatırlatıcılar dakikasında çalmayabilir"
kartı ve tek dokunuşla ayar ekranına götüren düğme çıkıyor. İkisi tek satırda
birleştirilseydi "izin verdim ama hatırlatıcım geç çalıyor" durumu
açıklanamaz kalırdı.

Üç karar:

1. **Sistem isteminden önce gerekçe yazılır.** Android'de bir kez reddedilen
   izin bir daha sorulamıyor; kullanıcı telefonun ayarlarına gitmek zorunda.
   Gerekçesiz çıkan istem reddedilme oranını gereksiz yere yükseltiyordu.
2. **Sayfa engelleyici değildir.** "Şimdi değil" ile geçilir ve uygulamanın
   tamamı izinsiz çalışır. Her izin kartı, verilmezse **ne kaybedileceğini**
   de yazar.
3. **İstemler sırayla gönderilir.** İki sistem diyaloğunu aynı anda açmak
   Android'de ikincisini sessizce düşürüyor.

Bir kerelik olduğu SecureStore'daki `bebiqa.permissions_seen` bayrağıyla
işaretlenir; yalnızca "hiç sorulmamış izin var mı" diye bakmak yetmiyordu,
çünkü "Şimdi değil" diyen kullanıcıya sayfa her açılışta geri gelirdi.
Sonradan Ayarlar → İzinler bölümünden tek tek istenebilir; reddedilmiş izinde
düğme yerine telefonun ayarlarına yönlendiren bir açıklama çıkar — tıklanıp
hiçbir şey olmaması uygulamayı bozuk gösterirdi.

### 12.6 Çoklu Zamanlı Bildirim ve Cihaz Alarmı

Şartname: `modules_doc/bildirimler.md`. Modül 8 (Hatırlatıcılar) ve Modül 13
(Görevler) aynı üç alanı paylaşır:

| Alan | Tip | Anlamı |
|------|-----|--------|
| `notification_offsets` | JSON (tam sayı dizisi) | Kaç **dakika önce** uyarılacağı. Varsayılan `[30,15,5,0]`. `null` = kullanıcı tümünü kapattı |
| `device_alarm_ids` | JSON | Cihaz takvimine yazılan etkinlikler: `[{device_uuid, event_id, calendar_id}]` |
| `enable_device_alarm` | bool | Takvime yazılsın mı. Varsayılan açık |

Göç: `migrations/013_notification_alarms.sql`. Doğrulama tek yerde toplanır
(`src/lib/alarms.ts`) ki iki uçta kurallar ayrışmasın.

**Ofsetler normalleştirilir** (azalan, benzersiz). İstemciler farklı sırayla
gönderiyor; aynı değeri iki kez göndermek iki özdeş bildirim demek olurdu.
Boş dizi geçerlidir ve "bildirim yok" anlamına gelir.

**`enable_device_alarm` güncelleme şemasında varsayılansız `optional()`.**
zod'da `.default()` `.partial()` sonrasında da çalışır; alanı göndermeyen bir
istek onu sessizce `true` yapardı (§22.0'daki tuzağın aynısı).

#### Etkinlik hatırlatıcısı — 14 / 7 / 2 / 1 gün önce ve aynı gün

Kategorisi `event` olan hatırlatıcı, takvimdeki **tek bir ana** bağlıdır: bir
adı, bir tarihi, bir saati ve gün bazlı ön uyarıları vardır. Form o kategoriye
geçildiğinde kendini buna göre kurar (belirli saat kipi, tekrar yok, bugünün
tarihi, tek saat) ve periyodik hatırlatıcının alanlarını — aralık, haftanın
günleri, bitiş tarihi — gizler.

| Seçenek | `notification_offsets` değeri |
|---------|-------------------------------|
| 14 gün önce | `20160` |
| 7 gün önce | `10080` |
| 2 gün önce | `2880` |
| 1 gün önce | `1440` |
| Aynı gün (etkinlik saatinde) | `0` |

Beşi de **aynı anda** seçilebilir; alan zaten çoklu (`EVENT_OFFSETS`,
`alarmPlan.ts`).

#### Açıklama alanı (en fazla 250 karakter)

Etkinlikte ada ek olarak serbest bir **açıklama** girilir
(`REMINDER_DESCRIPTION_MAX = 250`). Kesme işini `TextInput`'un `maxLength`'i
yapar, elle `slice` değil: imleç metnin ortasındayken yazılan karakter de doğru
yerde engellenir. Sayaç (`132/250`) sınıra yaklaşınca değil **her zaman**
görünür — kullanıcı uzun bir metni yazdıktan sonra kesildiğini fark ederse
yazdığının bir kısmını kaybetmiş olur.

Açıklama üç yerde kullanılır:

| Yer | Nasıl |
|-----|-------|
| Bildirim | Gövdenin **ikinci satırı**. Aynı satıra eklenseydi kalan süre ("7 gün kaldı") 250 karakterin arkasında kalır ve bildirim kapalıyken okunamazdı |
| Cihaz takvimi | `upsertEvent({ notes })` — telefonun takvim uygulamasından bakıldığında da görünsün |
| Liste satırı | İki satırda kesilir (`numberOfLines={2}`); tamamı bildirimde ve takvimde zaten duruyor |

İstek gövdesine **yalnızca etkinlikte ve doluysa** eklenir; her hatırlatıcı
isteğine sunucunun tanımadığı bir anahtar koymamak için.

**Planlama yolu ayrıldı.** Periyodik hatırlatıcılar DAILY tetikleyiciyle
kuruluyor ve orada "14 gün önce" diye bir kavram yok; ayrıca ön uyarılar
yalnızca tekrar eden dalda uygulanıyordu, tek seferlik kayıtlarda sessizce
yok sayılıyordu. Etkinlikler bu yüzden **aşı ve görev uyarılarıyla aynı yoldan**
geçer: hedef an + `alarmSlots()`.

```ts
// scheduler.ts
isEventReminder(r)  // category==='event' && recurrence==='none'
                    // && fixed_times[0] && start_date
eventInstant(r.start_date, r.fixed_times[0])  // yerel Date
alarmSlots(at, r.notification_offsets, now)   // geçmiş ve yinelenen anlar elenir
```

Kategori tek başına ölçüt değil: kullanıcı "etkinlik" kategorisini seçip tekrar
eden bir hatırlatıcı da kurabilir (her hafta prova gibi). O durumda eski yol
doğru olanıdır.

**Ufuk 120 gün** (`EVENT_HORIZON_DAYS`). Genel ufuk 7 gün ve onunla "14 gün
önce" uyarısı ancak etkinlik 14 günden yakınsa plana girerdi — yani
kullanıcının seçtiği en erken uyarı hiç kurulmazdı. Daha uzaktaki etkinlikler
şimdilik planlanmaz; uygulama her ön plana gelişte yeniden eşitlendiği için
sıra geldiğinde eklenirler (aşı takvimiyle aynı desen).

**Sessiz saat uygulanmaz.** Görev ve aşı uyarılarıyla aynı gerekçe: kullanıcı
etkinliğin saatini kendi seçti ve bu uyarıların amacı kaçırılmamak. Form da bu
yüzden etkinlikte sessiz saat anahtarını göstermez — karşılığı olmayan bir
anahtar göstermek yanlış söz vermek olurdu.

#### Yüksek sesli bildirim — `events` kanalı

Etkinlik uyarıları ayrı bir Android kanalından çalar:

| Ayar | Değer | Niçin |
|------|-------|-------|
| `importance` | `MAX` | Ekranın üstünde beliren (heads-up) bildirim |
| `audioAttributes.usage` | `ALARM` | **Asıl yüksek ses buradan gelir:** bildirim sesi "bildirim" ses düzeyine bağlı ve çoğu cihazda düşük; alarm akışı ayrı ve belirgin şekilde yüksek |
| `flags.enforceAudibility` | `true` | Kısılmış akışlarda da duyulmasını ister |
| `vibrationPattern` | `[0,600,300,600,300,600]` | Ses kapalıyken de fark edilsin |
| `bypassDnd` | `true` | Rahatsız Etmeyin'i aşma isteği; sistem izni verilmediyse Android sessizce yok sayar |
| `lockscreenVisibility` | `PUBLIC` | Kilit ekranında içerik görünsün |

**`sound` alanı kanalda bilinçli olarak yok.** Paketin Android tarafında üç
hâl var ve ikisi tuzak: alan **hiç verilmezse** sistemin varsayılan bildirim
sesi kullanılır (istenen bu), **`null`** verilirse ses tamamen kapanır, bir
**dizge** verilirse o bir dosya adı sayılır ve config plugin'in `sounds`
dizisinde aranır. İlk denemede `sound: 'default'` yazılmıştı ve emülatörde
açılışta şu hata düştü: *"Custom sound 'default' not found in native app."*
Kendine ait bir alarm tonu istenirse ses dosyası config plugin'e eklenip adı
buraya yazılmalı — yeni bir derleme gerektirir.

**Kanal ayrı olmak zorunda.** Android'de kanalın önemi ve sesi
**oluşturulduktan sonra uygulama tarafından değiştirilemiyor**; hatırlatıcı
kanalıyla paylaşılsaydı ya tüm hatırlatıcılar alarm sesiyle çalardı ya da
etkinlik uyarısı sessiz kalırdı. Aynı nedenle, kanalın ayarı ileride
değişecekse **kimliği de değişmeli** (`events_v2` gibi) — yoksa yeni ayarlar
yalnızca uygulamayı ilk kez kuranlara uygulanır.

> **iOS'ta ses yüksekliği uygulamanın elinde değil.** Bildirim, sistemin zil
> düzeyinden çalar ve uygulama bunu aşamaz; "kritik uyarı" (`critical`) Apple'ın
> ayrıca onayladığı bir yetki ister. Elimizdeki en yakın karşılık
> `interruptionLevel: 'timeSensitive'`: bildirimi **Odak/Rahatsız Etmeyin**
> kipinde de gösterir. Etkinleşmesi için
> `com.apple.developer.usernotifications.time-sensitive` yetkisinin `app.json`
> üzerinden eklenmesi ve yeni bir derleme gerekiyor; yetki yokken iOS alanı
> sessizce `active` gibi işler.

#### Sunucu tarafı

İki değişiklik yapıldı; ikisi de etkinlik uyarılarının çalışması için şarttı.

**1. Ofset tavanı üç kademeye çıktı.** Doğrulama `src/lib/alarms.ts` içindeki
`offsetsSchemaUpTo(maxMin)` ile yapılıyor ve hatırlatıcı görevle aynı 1440
dakikalık tavanı paylaşıyordu; 14/7/2 günlük uyarılar `422` ile reddediliyordu.

| Alan grubu | Tavan | Kim kullanıyor |
|------------|-------|----------------|
| `alarmFields` | 1440 (1 gün) | Görev — aynı günün işi, "üç hafta önce uyar" anlamsız olurdu |
| `reminderAlarmFields` | **20160 (14 gün)** | Hatırlatıcı — etkinlik uyarıları |
| `longAlarmFields` | 40320 (4 hafta) | Aşı |

Tavan görevle **paylaşılmadı**: tek bir sabite çıkılsaydı görevde de anlamsız
değerler sessizce kabul edilirdi. Kademeler `src/lib/alarms.test.ts` ile
sabitlendi — sınırın iki yanı da yoklanıyor, çünkü kademeler karışırsa hata
sessiz olur (istemci uyarıyı kurduğunu sanır, sunucu reddeder).

**2. `description VARCHAR(250) NULL` sütunu eklendi**
(`migrations/018_reminder_description.sql`, `title`'dan sonra). Genişlik
istemcideki `REMINDER_DESCRIPTION_MAX` ile aynı: ikisi ayrışsaydı kullanıcının
ekranda yazabildiği metin sunucuda sessizce kesilirdi. Sütun kategoriden
bağımsız — kuralı şemaya gömmek, yarın başka bir kategoriye açıklama eklemeyi
doğrulama değişikliğine bağlardı.

Boş dizge zod katmanında `null`'a çevrilir: "hiç girilmedi" ile "boş bırakıldı"
aynı şeydir ve istemci satırı ikisinde de çizmemeli.

> `validateBody` zod'un varsayılan davranışını kullanıyor (**bilinmeyen
> anahtarlar elenir**, `.strict()` değil). Bu yüzden sütun eklenmeden önce
> `description` gönderen bir istemci hata almıyor, alan sessizce düşüyordu —
> eski istemciler yeni alanı göndermeye başladığında kırılma olmadı.

#### Neden takvim etkinliği, saat alarmı değil

Android'in **saat alarmına** yazmanın tek yolu `AlarmClock` intent'i: kullanıcıyı
saat uygulamasına atar, her görev için elle onay ister ve oluşan alarmın
kimliğini geri vermez — yani sonradan silinemez. Şartnamedeki "alarm ID'lerini
sakla, tamamlanınca sil" akışını ancak **takvim etkinliği** karşılıyor:
kimliği dönüyor, kendi hatırlatıcıları (`alarms`) var ve sessizce silinebiliyor.
iOS'ta zaten üçüncü taraf uygulamalar saat alarmı kuramaz.

Etkinlikler kullanıcının asıl takvimine değil, **"Bebiqa" adlı ayrı bir
takvime** yazılır: ebeveyn bebek uyarılarını tek hamlede gizleyebilsin ya da
silebilsin. Android'de sistemce yönetilen bir "varsayılan takvim" kavramı yok,
bu yüzden her iki platformda da aynı yol izlenir.

Takvim izni `writeOnly: true` ile istenir — uygulamanın kullanıcının
randevularını **okumaya** ihtiyacı yok. iOS 17+ bunu ayrı ve çok daha az
rahatsız edici bir izin olarak sunuyor.

> **SDK 58 tuzağı.** `expo-calendar` nesne tabanlı API'ye geçti;
> `createEventAsync` / `deleteEventAsync` gibi eski işlevler
> `expo-calendar/legacy` üzerinden alınmadıkça **çalışma zamanında hata
> fırlatıyor**. Kullanılan yeni karşılıkları: `Calendar.getCalendars()`,
> `Calendar.createCalendar()`, `calendar.createEvent()`,
> `Calendar.ExpoCalendarEvent.get(id)` ve `event.delete()`.

#### Cihaz kimliği neden saklanıyor

Takvim etkinliğinin kimliği **cihaza özgüdür**: aynı hesabın telefonu ve
tableti ayrı etkinlikler oluşturur. Kimlikle birlikte `device_uuid` de
saklanmasaydı telefon, tabletin etkinliğini silmeye çalışır ve ya hata verir
ya da — daha kötüsü — aynı kimliğe sahip alakasız bir etkinliği silerdi.
Kimlik SecureStore'da tutulur (`src/core/device/deviceId.ts`): çıkış yapıp
tekrar giren kullanıcı aynı cihazda aynı kimliği görmeli, yoksa eski
etkinlikler sahipsiz kalırdı.

#### Planlama ve temizlik

`src/core/notifications/alarmPlan.ts` saat aritmetiğini React'siz tutar
(`scratchpad/alarm_plan_test.mjs`, 27 kontrol). İki eleme kritik:

- **Geçmiş anlar atılır.** `scheduleNotificationAsync` geçmiş bir tarihi kabul
  eder ama hiç tetiklemez; 18:00'deki bir görev 17:50'de kaydedilirse "30 dk
  önce" ve "15 dk önce" çoktan geçmiştir ve bunları planlamak bildirim
  bütçesini sessizce harcardı.
- **Yinelenen anlar atılır** — yerel form henüz sunucudaki normalleştirmeden
  geçmemiş olabilir.

Görev uyarıları hatırlatıcı tekrarlarıyla **aynı bütçe havuzunda** toplanır:
iOS'un 64'lük sınırı ikisini ayırmıyor, bu yüzden kırpma da ayırmamalı. Kırpma
zamana göre yapılır, yani en yakın uyarı hangi türden olursa olsun korunur.

**Sessiz saat görev uyarılarına uygulanmaz.** Hatırlatıcı periyodik ve
yaklaşıktır; gece 03:00'e denk gelmesi tesadüftür. Görevin saatini ise
kullanıcı tek tek seçmiştir — gece yarısına koyduysa bilerek koymuştur ve
sessize almak onu işini kaçırmaya iter.

Görevler ayrı bir Android kanalı kullanır (`tasks`). Kanal, kullanıcının
ses/titreşim/öncelik ayarını yaptığı birimdir ve oluşturulduktan sonra önemi
uygulama tarafından değiştirilemez; tek kanalla "hatırlatıcıları sustur ama
görevleri duy" ayarı mümkün olmazdı.

**Temizlik** (şartname: Auto-Clear Expired Alarms) `taskAlarms.ts` içindedir:
görev tamamlandığında, iptal edildiğinde ya da silindiğinde bekleyen
bildirimler `cancelTaskAlarms(id)` ile, takvim etkinliği `removeMine()` ile
kaldırılır. Silmede sunucuya yazma atlanır (`persist: false`) — silinmiş bir
görevin alanını güncellemek 404 verirdi.

#### Hatırlatıcının takvim kaydı

Hatırlatıcılar da takvime yazılır (`src/core/notifications/reminderAlarms.ts`),
görevlerden iki farkla:

- **Yinelenen etkinlik.** Hatırlatıcı tekrar eder; takvime günlük
  `recurrenceRule` ile tek bir etkinlik yazılır. Tek tek yazılsaydı ya yüzlerce
  etkinlik ya da bir hafta sonra biten bir uyarı olurdu.
- **Yalnızca `fixed_times` modu.** `interval` modunun ("3 saatte bir") takvimde
  karşılığı yok: başlangıcı son kayda göre kayar, sabit bir saate oturmaz.
  Böyle bir hatırlatıcıyı takvime yazmak kullanıcıya **yanlış bir saat**
  göstermek olurdu, o yüzden hiç yazılmaz.

Hatırlatıcı kapatıldığında (`toggle`) takvim kaydı da kalkar, açılınca geri
kurulur; silmede önce takvim temizlenir (`persist: false`).

#### Hatırlatıcıda ofsetlerin sınırı

Ofsetler hatırlatıcıda **yalnızca `fixed_times` modunda** uygulanır: orada bir
hedef an vardır ("08:00'de D vitamini"). `interval` modunda hedef an yoktur —
"3 saatte bir" tekrarının 30 dakika öncesi tanımlanamaz, çünkü tekrar son
kayda göre kayar. O modda yalnızca tam zamanında uyarı kurulur.

Uygulanan ofset sayısı ilk üçle sınırlanır: her ofset her sabit saat için ayrı
bir `DAILY` tetikleyici demek (12 saat × 4 ofset = 48) ve iOS'un 64'lük sınırı
tek bir hatırlatıcı tarafından tüketilebilirdi.

### 12.7 Canlı Sayaç Bildirimi (kilit ekranı kontrolü)

Zamanlayıcılı üç modül — emzirme, uyku, sağma — çalışırken bildirim çubuğunda
ve kilit ekranında bir satır tutar; satırdan duraklatma ve bitirme yapılabilir.
Şartname: `modules_doc/bildirimler.md` → "Ek geliştirme".

#### Katmanlar

| Dosya | İş |
|-------|-----|
| `src/core/timers/liveTimer.ts` | Sayaç modeli ve bildirim metinleri — **saf**, düz Node ile test edilir |
| `src/core/timers/useLiveTimerStore.ts` | Çalışan sayaçların tek kaydı; bildirim aynası |
| `src/core/notifications/liveTimerNotice.ts` | Kanal, kategoriler, bildirimi sunma/kaldırma |
| `src/core/timers/timerActions.ts` | Bildirim düğmelerinin karşılığı |
| `src/core/timers/usePendingStop.ts` | "Bitir" niyetini ekrana taşıyan kanca |

Mağaza süre **saymaz**: her sayaç `startedAt` + `segmentStartedAt` + `baseSec`
ile tanımlı, geçen süre okunurken hesaplanır (§10.3 ile aynı ilke). Böylece
uygulama arka plana geçse, öldürülse ya da telefon yeniden başlasa bile süre
kaymaz.

#### Neden yeni bir native bağımlılık yok

Şartname `@notifee/react-native`, `react-native-foreground-service` ve
`react-native-live-activity` öneriyordu; üçü de eklenmedi:

- `expo-notifications` (kurulu sürüm 58.1.7) Android'de `sticky`
  (`setOngoing`) ve bildirim üstü aksiyon düğmelerini zaten sağlıyor. Paketin
  Android kaynağında `ArgumentsNotificationContentBuilder`,
  `categoryIdentifier` ve `sticky` alanlarını okuyor; `ExpoNotificationBuilder`
  da `builder.addAction(...)` ve `setOngoing(...)` çağırıyor — dokümanda
  `categoryIdentifier` "iOS" etiketli görünse de Android tarafı destekli.
- Notifee aynı alana giriyor (FCM servis kaydı) ve bu projede push altyapısı
  hiç yok (`enableRemoteNotifications: false`).
- Bu özellikteki her şey **çalışma zamanında** kurulur: kanal ve kategoriler.
  `app.json`'a satır, prebuild'e tur eklenmedi; mevcut derleme ile çalışır.

#### Bildirim

Tür başına **sabit kimlik** (`live-timer-breastfeeding` gibi). Aynı kimlikle
yeniden sunmak bildirimi **yerinde günceller**: Android'de istek kimliği
bildirim etiketi (tag) olarak kullanılıyor ve `notify()` aynı (tag, id)
çiftini üzerine yazıyor; iOS'ta da aynı kimlikli istek teslim edilmişin yerine
geçiyor. Bu yüzden meme değişiminde ikinci bir satır birikmez.

Kanal ayrıdır: `live_timer`, **`AndroidImportance.LOW`** — ses yok, titreşim
yok, heads-up yok; `lockscreenVisibility: PUBLIC` ki içerik kilit ekranından
okunabilsin. Hatırlatıcı kanalıyla (HIGH) paylaşılsaydı her duraklatmada
telefon titrerdi — ve kanalın önemi oluşturulduktan sonra uygulama tarafından
değiştirilemiyor.

Ön plan davranışı da ayrıldı (`useNotificationStore`): `data.kind` değeri
`live_timer` olan bildirimde `shouldShowBanner` ve `shouldPlaySound` **false**.
Aksi hâlde emzirme sırasında her dokunuşta ekranın üstüne kart düşerdi.

`scheduler.ts`'in `cancelScheduled()` işlevi yalnızca kendi türlerini
(`reminder` / `task` / `vaccine`) siler; canlı sayaç ayrı `data.kind` taşıdığı
için hatırlatıcı eşitlemesi onu iptal etmez.

#### Platform farkları

| Konu | Android | iOS |
|------|---------|-----|
| Kalıcılık | `sticky: true` → `setOngoing`, kaydırmayla kapanmaz | **Kapatılabilir.** iOS'ta "ongoing bildirim" diye bir şey yok; kullanıcı kaydırırsa satır gider ve bir sonraki tazelemede (durum değişimi ya da arka plana geçiş) geri gelir |
| Sessizlik | `live_timer` kanalı `LOW` → ses, titreşim ve heads-up yok | `interruptionLevel: 'passive'` + `sound: false` |
| Kilit ekranı içeriği | `lockscreenVisibility: PUBLIC` ile garanti | Kullanıcının "önizlemeleri göster" ayarına bağlı |
| Düğmeler | Kategori → `builder.addAction(...)` | Kategori → `UNNotificationAction` |
| Akan sayaç | `setUsesChronometer` expo-notifications'ta açık değil | ActivityKit gerekir |

iOS tarafındaki kapatılabilirlik kabul edildi: alternatif, bildirimi sürekli
yeniden sunmak olurdu ve bu da arka planda çalışmıyor. Sayaç her hâlükârda
ekranda görünür durumda kalıyor.

#### Düğmeler

Kategori kimliği **duruma** da bağlıdır (`timer-<tür>-<durum>`), çünkü düğme
başlığı sabittir: "Duraklat" ile "Devam et" arasındaki geçiş ancak kategori
değiştirilerek yapılabiliyor. Uykuda duraklatma yoktur (§22.3), tek düğme
"Uyandı".

Aksiyonlar uygulamayı **ön plana getirir** (`opensAppToForeground: true`).
Paketin kendi tip dokümanı şunu söylüyor: `false` ise ve uygulama öldürülmüşse
yanıt dinleyicisi hiç çalışmaz. Arka planda işlem yapmak için
`expo-task-manager` + `registerTaskAsync` (yalnızca Android) ya da bir
foreground service gerekiyordu; ikisi de yeni bağımlılık ve yeni derleme
demekti. Şimdiki davranış her iki platformda ve her durumda kesin çalışıyor.

"Bitir" kaydı **bildirim yazmaz**:

| Tür | Davranış | Neden |
|-----|----------|-------|
| Emzirme | Ekran açılır, özet ve düzeltme penceresi gelir | Bitiş annenin aktif süre düzeltmesini bekliyor (§10.2.1); o pencere bildirime sığmaz |
| Sağma | Ekran açılır, kronometre durur, süre forma düşer | Miktar henüz girilmedi |
| Uyku | Doğrudan `POST /sleep/{id}/stop` | Düzeltme penceresi yok; ebeveyni gece 03.00'te ekrana davet etmenin karşılığı da yok |

Niyet mağazada bir bayrak olarak durur, `usePendingStop` ekranda tüketir. Kanca
iki şeyi gözetir: ekran veriyi çekmeden tüketmemek (yoksa bayrak boşa gider ve
düğme hiçbir şey yapmamış görünür) ve ilk kontrolü mikro göreve bırakmak (efekt
gövdesinde senkron `setState` zincirleme render tetikliyor —
`react-hooks/set-state-in-effect`).

Soğuk başlatmada, bildirime basılarak açılan uygulamada yanıt dinleyici
kurulmadan gelir; `getLastNotificationResponseAsync` ile okunur ve işlenen
yanıtın kimliği hatırlanır — "Bitir" iki kez uygulanırsa ikinci çağrı kapanmış
seansta `422` alırdı.

#### Yaşam döngüsü

| An | Yapılan |
|----|---------|
| Açılış | Kanal ve kategoriler kurulur, yerel sağma kronometresi okunur, soğuk başlatma yanıtı işlenir |
| Bebek değişimi | Sunucudaki çalışan seanslar sorulur |
| Arka plana geçiş | Metin bir kez tazelenir — JS arka planda çalışmadığı için yazabildiğimiz **son** doğru değer |
| Ön plana dönüş | Sunucu yeniden sorulur; diğer ebeveyn uykuyu bitirmiş olabilir |
| Çıkış | Bildirimler kaldırılır, `local_timer` silinir |

Sunucu sorgusu `Promise.allSettled` kullanır ve **hata durumunda bildirim
olduğu gibi bırakılır**: "istek başarısız" ile "seans bitti" aynı şey değil;
karıştırılsa çalışan sayacın bildirimi ağ sekmesinde kaybolurdu.

#### Yetki

Salt okuyan üyeye sayaç bildirimi **gösterilmez**. Bildirimin tek amacı kilit
ekranından kontrol; viewer'ın duraklatma ve bitirme isteğini sunucu `404` ile
reddediyor (§5.5) ve düğmeyi göstermek kesin reddedilecek bir eylem vaat etmek
olurdu. Çalışan sayacı ekranda görmeye devam eder.

#### Sağma kronometresi (yeni)

`modules_doc/sut-sagma.md` "canlı sağma kronometresi" istiyordu ama ekran
yalnızca miktar formuydu ve `duration_sec` sütunu hep boş kalıyordu. Kronometre
eklendi; emzirme ve uykudan **farklı** çalışıyor, çünkü sağmanın sunucuda açık
oturumu yok: kayıt ancak miktar girilince oluşuyor. Bu yüzden durum yerelde
tutulur:

```sql
-- şema v6
CREATE TABLE local_timer (
  kind               TEXT PRIMARY KEY,
  baby_id            INTEGER,
  baby_name          TEXT,
  started_at         TEXT NOT NULL,
  segment_started_at TEXT,
  base_sec           INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'running',
  detail             TEXT
);
```

Tablo olmasa uygulama sayaç sürerken öldürüldüğünde geçen süre kaybolur ve
bildirimdeki düğmeler hiçbir şeye bağlı olmayan bir sayacı durdurmaya
çalışırdı. Kronometre durunca süre forma düşer ve kayıt yazılırken
`duration_sec` olarak gider; kronometre kullanılmadıysa alan **hiç
gönderilmez** (§22.0'daki kısmi güncelleme tuzağı).

#### Bilinçli sınır: sayaç saniye saniye akmıyor

Bildirim metni durum değişiminde ve ön plan/arka plan geçişlerinde yenilenir.
Arka planda JavaScript çalışmadığı için daha sık yenilemek mümkün değil;
işletim sistemi tarafında kendi kendine akan bir kronometre ise native hedef
istiyor (Android `setUsesChronometer`, iOS ActivityKit). Bu yüzden metin
**başlangıç anına demirlendi**: "14:32'den beri · 23 dk". Dakika değeri eskise
de cümle doğru kalır.

Dakika dakika yenileyen bir bildirim zinciri de denenmedi ve denenmemeli:
bekleyen her güncelleme ayrı bir kimlik gerektirir (aynı kimlikli ikinci
*planlı* istek öncekini iptal eder), ayrı kimlikler ise yerinde güncelleme
yerine **üst üste birikme** üretir. iOS'ta ayrıca 64'lük bekleyen bildirim
sınırını yiyip hatırlatıcıları dışarı iterdi (§12.6 ve `MAX_SCHEDULED`).

Dynamic Island ve gerçekten akan sayaç için yükseltme yolu
`modules_doc/NOTLAR-ve-EKSIKLER.md` §4.2'de yazılı.

---

### 12.8 Bildirim Sesleri ve Tekrar Sayıları

Şartname: `modules_doc/notification-voice.md` §2. Eşlemenin **tek kaynağı**
`src/core/notifications/soundCatalog.ts`; aşağıdaki tablo onun özetidir.

| Olay | Ses | Tekrar | Nereden çalar |
|------|-----|:------:|---------------|
| Bildirim kutusuna yeni satır | `bildirim8.mp3` | 2 | Uygulama içi |
| Beslenme sayacı (5 dk'da bir) | `bildirim3.mp3` | 1 | Uygulama içi |
| Uyku sayacı (30 dk'da bir) | `bildirim1.mp3` | 1 | Uygulama içi |
| Hatırlatıcı | `bildirim2.mp3` | 4 | Kanal `reminders_v2` + uygulama içi |
| Görev saati | `bildirim5.mp3` | 4 | Kanal `tasks_v2` + uygulama içi |
| Gecikmiş görev | `bildirim6.mp3` | 4 | Kanal `tasks_overdue_v2` + uygulama içi |
| Aşı ön uyarısı | `bildirim4.mp3` | 2 | Kanal `vaccines_v2` + uygulama içi |
| Aşı günü (ofset 0) | `bildirim4.mp3` | 4 | Kanal `vaccines_v2` + uygulama içi |

#### Dosyalar pakete gömülüdür

`assets/notification/*.mp3` → `app.json` → `expo-notifications` → `sounds`
dizisi, derleme sırasında Android'de `res/raw`, iOS'ta ana pakete kopyalar.
Bildirim içeriğinde ve kanal tanımında dosya **yalnızca temel adıyla** anılır
(`bildirim5.mp3`), yol verilmez. Ad `sounds` dizisinde yoksa Android kanalı
**sessiz** oluşturur ve hata vermez — bu yüzden liste ile katalog tek
kaynaktan beslenir.

**Ses eklemek/değiştirmek yeniden derleme gerektirir:**

```bash
npx expo prebuild --platform android
npx expo run:android
```

Gerekçe (şartname §2.2.4): bir bildirim sesi internet kesintisinde de,
uygulama soğuk başlarken de anında çalmak zorundadır. Adresten indirilen bir
ses, ebeveynin en çok ihtiyaç duyduğu anda sessiz kalırdı.

#### Kanal kimliklerinde `_v2` eki

Android'de bir kanalın **sesi ve önemi oluşturulduktan sonra uygulama
tarafından değiştirilemez**; yalnızca adı ve açıklaması güncellenebilir. Özel
sesler eski kimliklere (`reminders`, `tasks`, `vaccines`, `events`) yazılsaydı,
uygulamayı daha önce kurmuş hiç kimse onları duymayacaktı — kanallar zaten
sistem varsayılan sesiyle oluşmuş durumdaydı. Kuralı yine değiştirmek
gerekirse kimlik de artmalı (`_v3`).

Eski kanallar cihazda **kalır** ve kullanıcının bildirim ayarlarında görünür;
silinseydi kullanıcının o kanalda yaptığı ayar (sustur, önemi düşür) da
sessizce silinirdi. Artık hiçbir bildirim onlara gönderilmediği için
sessizleşirler.

`app.json` → `defaultChannel` de `reminders_v2` olmalı: kanalı belirtilmemiş
bildirimlerin düşeceği kanalı o alan seçiyor.

#### Tekrar sayısı neden uygulamanın işi

İşletim sistemine teslim edilen bir bildirimin sesi **bir kez** çalar. Tekrar
için N ayrı bildirim planlamak gerekirdi ve bu, iOS'un 64'lük bekleyen bildirim
bütçesini tüketirdi (`MAX_SCHEDULED`, §12.6). Bu yüzden:

- **Ön planda:** bildirim işleyicisi kendi türlerimiz için
  `shouldPlaySound: false` döndürür (Expo belgesi: bu alan kanal sesini de
  bastırır) ve `foregroundAlerts.ts` aynı sesi `expo-audio` ile tekrar
  sayısınca çalar. İkisi birden açık kalsaydı her uyarı çift duyulurdu.
- **Arka planda / kapalıyken:** ses kanaldan tek seferlik çalar, tekrar olmaz.
  Uyarı kaybolmaz; bildirim gölgede durur.

#### Kesilme

`alertSound.ts` → `stopAlert()` sesi anında keser. Tetikleyiciler: bildirim
çekmecesinin açılması, bir satıra dokunma, "tümünü okundu işaretle", bildirime
basıp uygulamayı açma, sayacın duraklatılması, görevin kapatılması ve oturum
kapanışı. Aynı anda yalnızca tek uyarı çalar; yeni uyarı çalanın yerini alır.

Çalar `createAudioPlayer` ile kuruluyor (hook değil, çünkü çağıranların çoğu
bileşen değil) ve bitişte `remove()` ile bırakılıyor. Bırakılmasaydı 5
dakikada bir çalan bir sayaç uyarısı gece boyunca yüzlerce yerli çalar
sızdırırdı.

#### Periyodik sayaç sesleri

`timerTicker.ts`, `useLiveTimerStore`'a abone: ekranlardan bağımsız çalışır,
çünkü ebeveyn emzirmeyi başlatıp ana sayfaya dönüyor. Aralık **sayacın
başlangıcına demirlenmiştir** (`tickPlan.ts` → `nextTickDelayMs`); düz bir
`setInterval` her yeniden kurulumda aralığı baştan başlatır ve 5 dakikalık
uyarı, 4 dakikada bir tazelenen bir ekranda hiç çalmazdı. Ses yalnızca sayaç
`running` iken çalar; duraklatmada o an çalan ses de kesilir.

Hesap saf ve test ediliyor: `npm test` → `scripts/tests/tick-plan.test.mjs`.

#### Gecikmiş görev döngüsü

Şartname: görev saati geçtiği hâlde tamamlanmadıysa uyarı **5 dakikada bir**,
görev kapanana ya da 24 saat dolana kadar. Üç parça birlikte çalışır:

- **Süresiz tekrar eden tetikleyici** (`scheduler.ts` →
  `scheduleOverdueRepeat`): görev **zaten gecikmişse** 300 saniyelik
  `TIME_INTERVAL` + `repeats: true` kurulur. İşletim sistemi uygulamadan
  bağımsız tekrarladığı için telefon kilitliyken ve uygulama kapalıyken de
  çalar — ve bütçeden yalnızca **bir** yer alır. 288 tarihli bildirimin
  bütçe sorununu çözen şey bu: tekrar eden tetikleyiciler `MAX_SCHEDULED`
  sınırının dışında.
- **Tarihli merdiven** (`scheduler.ts` → `overdueSlots`): görev **henüz
  gecikmemişse** tekrar eden tetikleyici kurulamaz, çünkü ancak kurulduğu
  andan itibaren sayar; görev saatini bekleyemez. Onun yerine görev saatinden
  sonraya `5, 10, 15, 20, 25, 30, 45, 60, 120, 240, 360`. dakikalara bildirim
  planlanır: ilk yarım saat gerçekten 5 dakikada bir, sonrası uygulama hiç
  açılmazsa diye seyrelen bir emniyet ağı. Uygulama bir kez açıldığında
  merdiven iptal edilir, yerine tekrar eden tetikleyici geçer.
- **Uygulama içi döngü** (`taskOverdue.ts`): uygulama ön plandayken tam 5
  dakikalık döngü. Aralık **görev saatine demirli** (`tickPlan.ts`), yani
  ekran değişimleri ritmi kaydırmaz.

Her iki yol da tam eşitlemede kurulur (`syncReminders`). Önceden gecikme
uyarısını yalnızca görevi **bu cihazda** kaydeden kişi kuruyordu
(`onTaskSaved`); eşin telefonunda açılan bir görev geciktiğinde burada hiç ses
çıkmıyordu.

Bildirimler `data.overdue: true` taşır; `kind` hâlâ `'task'`, çünkü
`cancelTaskAlarms` ve dokunma yönlendirmesi o alana bakıyor. Tekrar eden
uyarının gövdesi zamansızdır ("Hâlâ tamamlanmadı"): kaç dakika geçtiği
tetikleme anında bilinemez.

**Kalan sınır — Doze.** Android telefonu uzun süre hareketsizse kesin
alarmları ~9–15 dakikaya seyreltir; ritim o pencerede 5 dakikanın biraz
üstüne çıkabilir. Tam ritim bir **ön plan servisi** ister ve o yeni bir native
bağımlılık demek (`liveTimerNotice.ts`'teki karar). Uyarı durmaz, yalnızca
seyrelir.

#### Açık görevlerin kalıcı bildirimi

`taskNotice.ts` — `task_live` kanalında (LOW, sessiz, titreşimsiz,
`lockscreenVisibility: PUBLIC`), `sticky: true` + `autoDismiss: false` ile
sunulan satır. Açık her görev gölgede bir satır alır ve görev kapanana kadar
orada durur; kaydırmayla kapanmaz.

**Neden gerekli.** Ses geçicidir: ebeveyn 5 dakikalık uyarıyı kaçırdıysa
geriye bakacak bir iz kalmıyordu, çünkü uyarı bildirimine dokunulduğunda o da
kayboluyor. Kalıcı satır o izi tutar.

**Neden ayrı ve sessiz kanal.** Bu bir uyarı değil, durum göstergesi. Gecikme
kanalıyla (`tasks_overdue_v2`, HIGH + `bildirim6.mp3`) paylaşılsaydı her
eşitlemede telefon çalardı — satır her eşitlemede yeniden sunuluyor.

**Hangi satırların durduğu işletim sisteminden okunur**
(`getPresentedNotificationsAsync`), bellekteki bir listeden değil: uygulama
yeniden başladığında o liste boş olurdu ve kapanmış görevlerin satırları
gölgede sonsuza kadar kalırdı. En çok `MAX_NOTICES` (8) satır gösterilir, en
yakın görev önce; sınırı aşanlar satır almaz ama sesli uyarılarını yine alır.

Satırlar üç yerde kalkar: görev kapandığında (`onTaskClosed`), bildirim izni
geri alındığında ya da bebek seçimi boşaldığında (`useNotificationStore`), ve
çıkışta (`useAuthStore`) — çıkmış bir hesabın görevi telefonun bildirimlerinde
duramaz.

---

## 13. Müzik Modülü

### 13.1 Yetenekler

- Kategoriler: ninni, beyaz gürültü, doğa sesleri, klasik, kalp atışı, dua.
- Kaynaklar: APK içine gömülü (`bundled`), cihaza indirilmiş (`local_file`), sunucudan stream (`remote` → `http://192.168.1.x/bebektakip/uploads/music/...`).
- **Arka planda çalma** + kilit ekranı / bildirim gölgesi kontrolü (oynat, duraklat, sonraki).
- **Uyku zamanlayıcısı:** 5 / 10 / 15 / 30 / 45 / 60 dk veya "parça bitince". Son 20 saniyede kademeli fade-out.
- **Döngü:** tek parça loop veya çalma listesi loop (`is_loopable`).
- Uygulama içi bağımsız ses seviyesi; bildirim geldiğinde müziği 3 sn kısma (`duck`) opsiyonu.
- Dinleme kaydı `music_play_log`'a yazılır → timeline'da "Ninni dinletildi · 22:40 · 18 dk" kartı.

### 13.2 Teknik Notlar

- `react-native-track-player` tercih edilirse: `android:foregroundServiceType="mediaPlayback"`, `MediaSession` entegrasyonu hazır gelir.
- Uzak dosyalarda ilk oynatmada **indirip önbelleğe alma** (`expo-file-system` → `documentDirectory/music/`), ikinci kez offline çalma.
- Dosya formatı: MP3 128–192 kbps. Beyaz gürültü parçaları için **sorunsuz loop** (başı-sonu sessizlik içermeyecek şekilde kırpılmış) kritik.
- Yükleme limiti: `php.ini` içinde `upload_max_filesize` ve `post_max_size` ≥ 20M.
- Uyku zamanlayıcısı `setTimeout` ile değil, hedef zaman damgası + `AppState` kontrolüyle yönetilir; arka planda doğruluğu foreground service korur.

---

## 14. Bebek Profili ve Yaş Hesabı

### 14.0 Veri Modeli — `babies`

Modül 1'in sözleşmesi. `*` ile işaretli alanlar zorunludur.

| Alan | Tip | Not |
|------|-----|-----|
| `id` | BIGINT | Sunucu birincil anahtarı |
| `sync_uuid` | CHAR(36) | Çevrimdışı oluşturulan kaydın kimliği; istemci üretir |
| `first_name` * | VARCHAR(60) | |
| `last_name` | VARCHAR(60) | |
| `gender` * | ENUM | `kiz` · `erkek` · `belirtilmedi` |
| `birth_date` * | DATE | `YYYY-AA-GG`; gelecek tarih reddedilir |
| `birth_time` | TIME | |
| `birth_weight_g` | INT | **Gram**, tam sayı. 200–9000 |
| `birth_height_cm` | DECIMAL(4,1) | 20–80 |
| `head_circumference_cm` | DECIMAL(4,1) | 15–60 |
| `is_premature` | TINYINT(1) | Varsayılan `0` |
| `gestational_age_weeks` | TINYINT | 20–42; prematüre ise **zorunlu** |
| `blood_type` | ENUM | `A+` `A-` `B+` `B-` `AB+` `AB-` `0+` `0-` |
| `photo_path` | VARCHAR(255) | `/uploads/babies/...`; yanıtta `photo_url` olarak mutlak adres de döner |
| `note` | VARCHAR(500) | |
| `created_by` / `updated_by` | BIGINT | Denetim izi (§6.2) |
| `created_at` / `updated_at` / `deleted_at` | DATETIME(3) | Silme **yumuşaktır** |

**Ölçüler neden FLOAT değil?** `FLOAT` yuvarlama hatası üretir; 50.1 cm geri
okunduğunda 50.099998 olabilir. Uzunluklar `DECIMAL(4,1)` (tam), ağırlık tam
sayı **gram** olarak saklanır — böylece kg↔g dönüşümünde kayıp olmaz.

> **Spec'ten bilinçli üç sapma.** Modül tanımı `name` (tek alan), `gender`
> `male|female` ve bebek üzerinde bir `is_default` sütunu istiyordu.
> Uygulanan hâl:
> - `first_name` + `last_name` ayrı — arama ve sıralama için gerekli, zaten kullanımda.
> - `gender` üç değerli: `belirtilmedi` seçeneğini kaldırmak mevcut kayıtlarda
>   veri kaybı olurdu ve ebeveynler doğum öncesi profil açabiliyor.
> - Aktif profil `baby_members.is_selected` içinde, yani **kullanıcı başına**.
>   Bebeğin üzerinde tek bir `is_default` olsaydı anne bebek değiştirdiğinde
>   babanın ekranı da değişirdi (§5.1 paylaşım modeli).

### 14.0.1 Uç Noktalar ve Örnek İstekler

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET | `/babies` | auth — yalnızca üye olunan bebekler |
| POST | `/babies` | auth — oluşturan otomatik `owner` olur |
| GET | `/babies/{id}` | viewer |
| PUT | `/babies/{id}` | **owner** |
| DELETE | `/babies/{id}` | **owner** — yumuşak silme |
| POST | `/babies/{id}/photo` | **owner** |
| POST | `/babies/{id}/select` | viewer — kişiye özel aktif profil |

```jsonc
// POST /api/v1/babies
{
  "first_name": "Deniz", "last_name": "Yılmaz",
  "gender": "kiz", "birth_date": "2026-03-10", "birth_time": "04:25",
  "birth_weight_g": 2450, "birth_height_cm": 46.5, "head_circumference_cm": 32.1,
  "is_premature": true, "gestational_age_weeks": 34,
  "blood_type": "0+", "note": "34 haftalık doğdu"
}

// 201 yanıt (data)
{
  "baby": {
    "id": 7, "sync_uuid": "…", "first_name": "Deniz", "last_name": "Yılmaz",
    "gender": "kiz", "birth_date": "2026-03-10", "birth_time": "04:25:00",
    "birth_weight_g": 2450, "birth_height_cm": 46.5, "head_circumference_cm": 32.1,
    "is_premature": true, "gestational_age_weeks": 34,
    "photo_path": null, "photo_url": null, "blood_type": "0+",
    "note": "34 haftalık doğdu", "owner_id": 3,
    "my_permission": "owner", "is_owner": true
  }
}
```

`PUT` **kısmidir**: yalnızca gönderilen alanlar yazılır.

> **Kısmi güncellemede varsayılan tuzağı (2026-11-02'de düzeltildi).** Güncelleme
> şeması `createBabySchema.partial()` ile türetiliyordu; ancak zod'da
> `.default(...)` değerleri `.partial()` sonrasında da çalışır. Alan hiç
> gönderilmese bile varsayılanla dolduruluyordu, yani *yalnızca notu güncelleyen*
> bir istek `gender` alanını sessizce `belirtilmedi`'ye çeviriyordu. Varsayılanı
> olan alanlar (`gender`, `is_premature`) artık güncelleme şemasında
> varsayılansız `optional()` ile eziliyor. Regresyon testi: §20.

### 14.0.2 Doğrulama Kuralları

| Kural | Yanıt |
|-------|-------|
| `birth_date` gelecekte | `422 VALIDATION_ERROR` · `birth_date` |
| `is_premature = true` ve `gestational_age_weeks` yok | `422` · `gestational_age_weeks` |
| `is_premature = false` ama `gestational_age_weeks` dolu | `422` · `gestational_age_weeks` |
| Ölçü aralık dışı (ör. gram alanına 2.45 yazmak) | `422` · ilgili alan |
| Listede olmayan kan grubu | `422` · `blood_type` |

Prematüre tutarlılığı, kısmi güncellemede **gönderilen değil yürürlüğe girecek**
duruma göre denetlenir; aksi hâlde yalnız `is_premature:false` göndererek
gebelik haftası kayıtta asılı kalabilirdi.

Ölçü aralıkları tıbbi kesinlik için değil, **birim hatasını yakalamak** için
vardır: 2.45 (kg) gram alanına yazılırsa ya da boy mm olarak gönderilirse istek
sessizce kabul edilmek yerine reddedilir.


### 14.1 Yaş Hesaplama

Doğum tarihinden **tam ay + kalan gün** üretilir (takvim ayı farkları dikkate alınır):

```ts
import dayjs from 'dayjs';

export function calcAge(birthDate: string, now = dayjs()) {
  const b          = dayjs(birthDate);
  const totalDays  = now.startOf('day').diff(b.startOf('day'), 'day');
  const months     = now.diff(b, 'month');                   // tam ay
  const afterMonth = b.add(months, 'month');
  const days       = now.startOf('day').diff(afterMonth.startOf('day'), 'day');
  const weeks      = Math.floor(totalDays / 7);

  return {
    totalDays, months, days, weeks,
    label:
      months === 0
        ? (totalDays < 14 ? `${totalDays} günlük` : `${weeks} haftalık`)
        : months < 24
          ? `${months} ay ${days} gün`
          : `${Math.floor(months / 12)} yaş ${months % 12} ay`,
  };
}
```

| Durum | Gösterim |
|-------|----------|
| `months = 0` | "12 günlük" |
| `1 ≤ months < 24` | "7 ay 12 gün" |
| `months ≥ 24` | "2 yaş 3 ay" |

Yaş değeri **saklanmaz**, her gösterimde `birth_date`'ten hesaplanır. Gün değişiminde otomatik güncellenmesi için `AppState` `active` olduğunda yeniden hesap yapılır.

### 14.1.1 Düzeltilmiş Yaş (Prematüre)

Prematüre bebeklerde gelişim, doğum tarihine göre değil **beklenen doğum
tarihine** göre izlenir. 40 hafta tam gebelik kabul edilir:

```
eksik_gun        = (40 - gestational_age_weeks) × 7
duzeltilmis_gun  = gercek_yas_gun - eksik_gun
```

- 34 haftalık doğan 3 aylık bir bebek → `(40-34)×7 = 42` gün geri → **düzeltilmiş yaş ≈ 1 ay 18 gün**.
- Düzeltilmiş yaş **negatife düşebilir** (beklenen doğum tarihi henüz gelmemiştir); bu durumda "term'e X gün" biçiminde gösterilir, sıfıra kırpılmaz — kırpmak bilgiyi gizlerdi.
- Düzeltme yalnızca `is_premature = true` ve `gestational_age_weeks < 40` iken uygulanır.
- Arayüz **ikisini birden** gösterir: gerçek yaş birincil, düzeltilmiş yaş altında "düzeltilmiş" etiketiyle. Yalnız düzeltilmişi göstermek ebeveyni yanıltırdı.

Dünya Sağlık Örgütü uygulamasında düzeltme 2 yaşa kadar anlamlıdır; sonrasında
arayüz düzeltilmiş yaşı göstermeyi bırakır.

### 14.2 Fotoğraf İşleme

Seçilen fotoğraf istemcide **1:1 kırpılır** (`expo-image-picker`, `allowsEditing`), uzun kenar 512 px'e küçültülür ve `POST /babies/{id}/photo` ile `multipart/form-data` olarak yüklenir (alan adı `photo`).

Sunucu tarafı:

- Dosya adı **rastgeledir** (`<zaman>-<16 hex>.<uzantı>`): kullanıcının gönderdiği ad hiç kullanılmaz, yol gezinme (`../`) ve üzerine yazma riski kalmaz.
- Uzantı **ve** MIME whitelist'i: `jpg/jpeg/png/webp`. İkisinden biri tutmazsa dosya diske hiç yazılmaz.
- En fazla **8 MB**; aşılırsa `422 VALIDATION_ERROR` döner. Multer'ın kendi hatası JSON zarfına çevrilir, aksi hâlde istemciye HTML gövdeli bir hata giderdi.
- Yeni fotoğraf yazıldıktan sonra **eski dosya silinir**; yoksa her değişiklikte diskte referanssız dosya birikirdi.
- Yanıtta güncellenmiş `baby` döner (`photo_path` + mutlak `photo_url`).

Güvenlik: MIME + `getimagesize()` doğrulaması, uzantı whitelist (`jpg/jpeg/png/webp`), rastgele dosya adı, `uploads/` klasöründe PHP yürütmeyi kapatan `.htaccess`:

```apache
php_flag engine off
<FilesMatch "\.(php|phtml|phar)$">
  Require all denied
</FilesMatch>
```

### 14.3 Bebekler Arası Geçiş

- Üst başlıkta avatar + isim; dokunulduğunda alt sayfadan (bottom sheet) profil listesi açılır.
- Geçişte `babyStore.selectBaby(id)` → tüm ekranlar seçili `babyId`'ye bağlı sorgu yapar (sorgu anahtarlarında `babyId` yer alır).
- Aktif profil `babies.is_selected` + MMKV'de saklanır; uygulama kapanıp açıldığında aynı bebekle açılır.
- **Çalışan kronometre varken profil değiştirme:** engellenmez; kronometre ait olduğu bebeğin kaydını sürdürür ve üstte "Ali için emzirme devam ediyor — 00:06:41" şeridi görünür, dokunulduğunda o bebeğe döner.
- İkiz senaryosu: iki bebek için **eşzamanlı** iki ayrı emzirme/uyku kronometresi desteklenir (snapshot anahtarı `babyId` + `module` bazlı).

---

## 15. Günlük Akış (Timeline)

### 15.1 Veri Akışı

```
GET /timeline?baby_id=1&date=2026-11-01
        │
        └─► v_timeline (UNION ALL) → kayıtlar
                │
                └─► istemci: saat dilimine çevir → saate göre grupla → kart listesi
```

### 15.2 Kart Tipleri

| Tip | Başlık | İçerik örneği |
|-----|--------|---------------|
| Emzirme | 🤱 Emzirme | `21:02 → 21:21 · Toplam 17 dk 28 sn · Sol 7:37 / Sağ 9:51` |
| Biberon | 🍼 Biberon (Formül) | `15:40 · 120 ml · 12 dk` |
| Ek gıda | 🥣 Ek Gıda | `12:15 · Sebze püresi · 80 ml` |
| Uyku | 😴 Uyku (Gece) | `22:30 → 05:40 · 7 sa 10 dk · 2 kez uyandı` |
| Müzik | 🎵 Ninni | `22:40 · Deniz Dalgaları · 18 dk · Zamanlayıcı 30 dk` |
| Bildirim | 🔔 Hatırlatıcı | `18:05 · Emzirme hatırlatıldı` / `03:00 · Sessiz saat nedeniyle 06:31'e ertelendi` |

### 15.3 UI Davranışları

- `SectionList`, tarih başlığı sticky; sol kenarda dikey zaman çizgisi ve modül rengine göre nokta.
- Üstte gün seçici (ok tuşları + takvim); varsayılan bugün.
- Gün özeti şeridi: `Toplam besleme 8 · Emzirme 2 sa 14 dk · Biberon 360 ml · Uyku 13 sa 20 dk`.
- Devam eden kayıtlar (`status='running'`) en üstte canlı sayaçla gösterilir.
- Karta uzun basma → Düzenle / Sil (soft delete, 5 sn "geri al" snackbar'ı).
- Pasif modüllerin kartları gösterilmez (`timelineAdapter` yalnızca aktif modüller için çalışır), fakat veri silinmez.
- Gün sınırı kullanıcı ayarına bağlı: varsayılan 00:00, "gece ebeveyni" için 05:00 seçeneği (`app_settings.day_start_hour`).

---

## 16. Proje Klasör Yapısı

İki ayrı kök vardır. API kodu `C:\wamp64\www\bebektakip` içinde durur ama Apache
tarafından **servis edilmez**: sanal konak tüm yolu `127.0.0.1:4000`'e proxy'ler ve
`DocumentRoot` yalnızca `webroot/` alt klasörünü gösterir, dolayısıyla kaynak kod
web üzerinden okunamaz (bkz. §17.3).

```
C:\wamp64\www\bebektakip\   # Node.js API + yönetim paneli + bu doküman
├── package.json  tsconfig.json  .env  .env.example
├── migrations/
│   ├── 001_users_and_auth.sql
│   ├── 002_babies_and_members.sql
│   ├── 003_records.sql               # feedings, breastfeeding, sleep, diapers
│   ├── 004_reminders_and_music.sql
│   ├── 005_activity_log.sql
│   ├── 006_views.sql                 # v_timeline
│   └── 007_seed_modules.sql
├── scripts/
│   ├── migrate.ts                    # schema_migrations tablosuyla sürüm takibi
│   └── create-admin.ts               # ilk yönetici hesabı (CLI)
├── uploads/                          # web'den statik servis edilir
│   ├── avatars/  babies/  music/
└── src/
    ├── server.ts                     # giriş noktası
    ├── app.ts                        # express kurulumu, ara katman zinciri
    ├── types.ts                      # Permission, Relationship, Express augment
    ├── config/env.ts                 # zod ile doğrulanan çevre değişkenleri
    ├── db/index.ts                   # havuz + q() / one() / exec() / tx()
    ├── lib/         (errors.ts, password.ts, tokens.ts, http.ts, logger.ts)
    ├── middleware/
    │   ├── authenticate.ts           # JWT → req.user
    │   ├── babyAccess.ts             # requireBaby('viewer'|'editor'|'owner')
    │   ├── recordAccess.ts           # editor yalnızca kendi kaydına dokunur
    │   ├── validate.ts               # zod şeması (beyaz liste)
    │   └── errorHandler.ts
    ├── services/
    │   └── activity.ts                # logActivity() + diff() + listBabyActivity()
    ├── routes/
    │   ├── v1/
    │   │   ├── index.ts               # yönlendirici birleştirme
    │   │   ├── auth.ts                # kayıt, giriş, refresh rotation, profil
    │   │   ├── babies.ts              # bebekler + üyeler + sahiplik devri
    │   │   ├── invitations.ts         # davet oluştur / kabul / reddet
    │   │   ├── records.ts             # feeding + sleep + diaper (+ tekil uçlar)
    │   │   ├── breastfeeding.ts       # seans durum makinesi ve segmentler
    │   │   ├── timeline.ts            # timeline + activity + günlük rapor
    │   │   └── modules.ts             # kişiye özel modül aç/kapat
    │   └── admin/index.ts             # panel (oturum, CSRF, tüm ekranlar)
    ├── views/                        # EJS — yönetim paneli
    │   ├── partials/ (head.ejs, foot.ejs)
    │   └── pages/    (login, dashboard, users, user-detail, babies,
    │                  invitations, activity, music, system)
    └── public/admin.css              # panelin tek stil dosyası (JS yok)


C:\bebektakip\                         # React Native uygulaması (ayrı kök — bkz. §16.1)
    ├── app.json / app.config.ts
    ├── package.json  tsconfig.json
    ├── android/                      # prebuild çıktısı (manifest, gradle)
    ├── scripts/sync-app-icon.mjs     # panel logosunu başlatıcı ikonuna işler (§7.5)
    ├── assets/
    │   ├── icons/  images/
    │   └── music/                    # bundled ninniler
    └── src/
        ├── App.tsx
        ├── core/
        │   ├── api/           (client.ts, endpoints.ts, assets.ts, health.ts, session.ts)
        │   ├── branding/      (useBrandingStore.ts — panelden yüklenen logolar, §7.5)
        │   ├── sync/          (refreshAll.ts — tek uçuşlu tazeleme kuyruğu)
        │   ├── db/            (sqlite.ts, migrations/, queries/)
        │   ├── storage/       (mmkv.ts, secureStore.ts)
        │   ├── auth/          (useAuthStore.ts, tokenStore.ts, refreshQueue.ts)
        │   ├── modules/       (registry.ts, types.ts, useEnabledModules.ts)
        │   ├── navigation/    (RootNavigator.tsx, AuthNavigator.tsx, buildTabs.ts)
        │   ├── notifications/ (notifee.ts, scheduler.ts, quietHours.ts, channels.ts)
        │   ├── sync/          (queue.ts, pushPull.ts, netinfo.ts)
        │   ├── theme/         (colors.ts, typography.ts, spacing.ts)
        │   └── utils/         (date.ts, age.ts, duration.ts, units.ts)
        ├── components/        (BabySwitcher, TimerCircle, AmountInput,
        │                       TimelineCard, ActorLine, PermissionGate, …)
        ├── modules/
        │   ├── babies/        (screens/, store.ts, api.ts, types.ts)
        │   ├── family/        (MembersScreen, InviteScreen, InvitationsScreen,
        │   │                   relationship.ts, permission.ts)
        │   ├── breastfeeding/ (screens/, timer.ts, store.ts, api.ts, TimelineAdapter.ts)
        │   ├── bottle/
        │   ├── solid/
        │   ├── sleep/
        │   ├── diaper/        (screens/, api.ts, TimelineAdapter.ts)
        │   ├── music/         (player.ts, sleepTimer.ts, screens/)
        │   ├── reminders/     (screens/, scheduler.ts)
        │   ├── timeline/      (screens/, ActivityScreen.tsx)
        │   └── reports/
        └── screens/           (Login, Register, Profile, ForgotPassword, Home,
                                Settings, ModuleSettings, Profile, Onboarding)
```

`PermissionGate`, kullanıcının o bebekteki yetkisine göre çocuk bileşeni gizler veya
devre dışı bırakır. Bu yalnızca arayüz kolaylığıdır — **gerçek sınır sunucudadır** (§5.5).

```tsx
<PermissionGate require="owner" fallback={<Text>Yalnızca {ownerName} davet edebilir</Text>}>
  <Button label="Aile üyesi davet et" onPress={invite} />
</PermissionGate>
```

### 16.1 Neden mobil proje `www` altında değil?

React Native'in yeni mimarisi (New Architecture), her native kütüphane için C++ codegen
üretir ve bunları CMake + **ninja** ile derler. Android SDK ile gelen ninja, Windows'un
uzun yol desteğini (`LongPathsEnabled = 1` olmasına rağmen) kullanmaz; kendi içinde
**260 karakterlik sabit bir sınır** uygular.

En uzun nesne dosyası yolu `react-native-safe-area-context` codegen'inden gelir ve
ninja'nın denetlediği **göreli** yol şu parçalardan oluşur:

```
safeareacontext_autolinked_build/CMakeFiles/react_codegen_safeareacontext.dir/
  + <proje yolunun mangle edilmiş hali>
  + node_modules/react-native-safe-area-context/android/build/generated/source/
    codegen/jni/react/renderer/components/safeareacontext/ComponentDescriptors.cpp.o
```

| Proje yolu | Göreli yol uzunluğu | Sonuç |
|------------|--------------------|-------|
| `C:\wamp64\www\bebektakip\mobile` | 265 | ❌ derleme başarısız |
| `C:\wamp64\www\bebektakip` (alt klasörsüz) | 258 | ⚠️ sınırda |
| **`C:\bebektakip`** | **247** | ✅ kullanılan |

`.cxx` klasörünü taşımak işe yaramaz — ninja yolun yalnızca göreli kısmını denetler,
dolayısıyla tek etkili değişken projenin kök yolu uzunluğudur.

Mobil uygulamanın Apache document root'unda bulunması zaten gerekmiyor; web sunucusunun
sunması gereken tek şey PHP API'sidir. Bu ayrım aynı zamanda uygulama kaynak kodunun
yanlışlıkla HTTP üzerinden erişilebilir olmasını da engeller.

---

## 17. Veritabanı Bağlantısı ve Yerel Ortam Kurulumu

### 17.1 Çevre Değişkenleri (`.env`)

```ini
NODE_ENV=development
PORT=4000
HOST=0.0.0.0                 # LAN'dan erişim için; yalnızca yerelse 127.0.0.1

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=bebektakip
DB_USER=root
DB_PASSWORD=                 # WAMP varsayılanı: şifre yok
DB_POOL_SIZE=10
DB_TIMEZONE=Z                # mysql2: oturum UTC'ye sabitlenir

JWT_SECRET=<openssl rand -hex 32>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

SESSION_SECRET=<openssl rand -hex 32>   # yönetim paneli çerezi
ADMIN_ALLOWED_IPS=127.0.0.1             # boş bırakılırsa herkese açık

UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=20
PUBLIC_BASE_URL=http://192.168.1.35:4000
```

`src/config/env.ts` bu değerleri **zod ile doğrular** ve eksik/geçersizse sunucu hiç
başlamaz. `JWT_SECRET` ve `SESSION_SECRET` üretimde en az 32 bayt olmalıdır; varsayılan
bir değer koda gömülmez.

Havuz oluşturulurken oturum saat dilimi UTC'ye sabitlenir (§4.1 ile uyumlu):

```ts
export const pool = mysql.createPool({
  host: env.DB_HOST, port: env.DB_PORT, database: env.DB_NAME,
  user: env.DB_USER, password: env.DB_PASSWORD,
  connectionLimit: env.DB_POOL_SIZE,
  timezone: 'Z',                 // Date <-> DATETIME dönüşümü UTC
  dateStrings: false,
  charset: 'utf8mb4_tr_0900_ai_ci',
  namedPlaceholders: true,
});
```

### 17.2 Şema Kurulumu

```bash
cd C:\wamp64\www\bebektakip
npm install
npm run migrate            # migrations/*.sql dosyalarını sırayla uygular
npm run create-admin       # ilk yönetici hesabını açar (e-posta + şifre sorar)
npm run dev                # 0.0.0.0:4000 — dışarıya Apache üzerinden açılır
```

Node doğrudan `http://localhost:4000` ile de yanıt verir; uygulamanın ve panelin
kullandığı adres ise sanal konaktır: `http://bebektakip.test`.

`npm run migrate` uygulanan dosyaları `schema_migrations` tablosuna yazar; ikinci
çalıştırmada yalnızca yeni dosyaları uygular.

Doğrulama: phpMyAdmin → `bebektakip` → 20 tablo + 1 view listelenmeli.

### 17.3 Yerel Sanal Konak ve Cihazdan Erişim

> **Bu bölüm yerel geliştirme içindir ve Apache sanal konağı artık
> zorunlu değil.** `.env.local` içinde `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`
> yazmak Express'e doğrudan bağlanır: ne `Host` başlığı ne vhost gerekir, bir
> bağımlılık tamamen kalkar (§8.6). Aşağıdaki kurulum çalışmaya devam ediyor ve
> Apache üzerinden (port 80) gitmek isteyen için duruyor.
>
> Yüklenen dosyaların adresi artık göreli taşındığı için (§22.5.1) vhost adının
> cihazda çözülebilmesi de gerekmiyor — eskiden gerekiyordu ve müzik çaların
> sessizce başarısız olmasının nedeni buydu.

Yerel kurulumda backend `bebektakip.test` **isme dayalı** sanal konağı üzerinden
yayınlanır;
Apache tüm yolu `127.0.0.1:4000`'deki Node'a proxy'ler:

```apache
<VirtualHost *:80>
  ServerName bebektakip.test
  DocumentRoot "${INSTALL_DIR}/www/bebektakip/webroot"   # yalnızca bilgi sayfası
  ProxyPreserveHost On
  ProxyPass        /__down !
  ProxyPass        / http://127.0.0.1:4000/ retry=0
  ProxyPassReverse / http://127.0.0.1:4000/
</VirtualHost>
```

1. Geliştirme makinesinin `hosts` dosyasına (`C:\Windows\System32\drivers\etc\hosts`):
   ```
   127.0.0.1 bebektakip.test www.bebektakip.test
   ```
2. `.env` içinde `HOST=0.0.0.0` olmalı (varsayılan) — Apache ve emülatör aynı
   Node sürecine ulaşır.
3. Doğrulama: `curl http://bebektakip.test/api/v1/health` →
   `{"success":true,"data":{"status":"ok","api":"v1"}}`

**Emülatör / cihazdan erişim.** `bebektakip.test` yalnızca host makinenin `hosts`
dosyasında tanımlı; emülatör ve fiziksel cihaz bu adı **çözemez**. Ayrıca sanal konak
isme dayalı olduğu için IP'ye yapılan çıplak istek varsayılan konağa düşer ve `404`
döner. Bu yüzden istemci IP'ye bağlanır, konak adını `Host` başlığıyla taşır
(`src/core/config.ts` → `API_BASE_URL` + `API_HEADERS`):

**Önerilen kurulum — Apache'siz, doğrudan Express (`:4000`).** `Host` başlığı
gerekmez, çünkü Express konak adına bakmıyor:

| Ortam | `EXPO_PUBLIC_API_URL` |
|-------|----------------------|
| Android emülatör | `http://10.0.2.2:4000` |
| Fiziksel Android | `http://<makinenin-LAN-IP>:4000` |
| iOS simülatör / web | `http://localhost:4000` |

Doğru değeri makine kendisi söyler — elle `ipconfig` okumaya gerek yok:

```bash
npm run api-url
```

**Fiziksel telefonda `10.0.2.2` ve `localhost` ÇALIŞMAZ.** İkisi de cihazın
kendisini gösterir; istek hiç sunucuya ulaşmaz ve arıza "Sunucuya ulaşılamadı"
olarak görünür. En sık yapılan hata bu.

**Apache üzerinden (port 80) gidilecekse** `Host` başlığı da gerekir:

| Ortam | `EXPO_PUBLIC_API_URL` | `EXPO_PUBLIC_API_HOST_HEADER` |
|-------|----------------------|-------------------------------|
| Android emülatör | `http://10.0.2.2` | `bebektakip.test` |
| Fiziksel Android | `http://192.168.1.35` | `bebektakip.test` |
| iOS simülatör / web | `http://bebektakip.test` | — (host DNS'i kullanılır) |

`EXPO_PUBLIC_API_CANONICAL_URL=http://bebektakip.test` her iki kurulumda da
yazılmalı: sunucu yükleme adreslerini o önekle döndürüyor (§8.6). **Yanlış
olması artık ölümcül değil** — müzik ucu göreli yol döndürüyor ve `assets.ts`
tanınmayan origin'lerden gelen `/uploads/` adreslerini de taşıyor (§22.5.1).

OkHttp kullanıcının verdiği `Host` başlığını ezmez (`BridgeInterceptor` başlığı
yalnızca **yoksa** yazar), dolayısıyla bu yöntem React Native `fetch` ile çalışır.

4. Fiziksel cihaz için Windows Defender Firewall'dan **gelen** bağlantıya izin
   ver. `node.exe` için bir izin kuralı çoğu makinede zaten var (Node ilk
   çalıştığında Windows sorar); denetlemek için:

   ```powershell
   Get-NetFirewallApplicationFilter | Where-Object { $_.Program -like "*node*" } |
     Get-NetFirewallRule | Where-Object Direction -eq Inbound |
     Select-Object DisplayName, Action, Enabled, Profile
   Get-NetConnectionProfile | Select-Object InterfaceAlias, NetworkCategory
   ```

   Kuralın **profili** ile Wi-Fi bağdaştırıcısının `NetworkCategory` değeri
   örtüşmeli; örtüşmüyorsa telefon bağlanamaz. Yoksa port kuralı ekle
   (Apache kullanılıyorsa `80`, doğrudan Express ise `4000`):

   ```powershell
   New-NetFirewallRule -DisplayName "Bebiqa API" -Direction Inbound `
     -Protocol TCP -LocalPort 4000 -Action Allow -Profile Private,Public
   ```

   Sunucunun `0.0.0.0`'ı dinlediğinden de emin ol (backend `.env` → `HOST=0.0.0.0`);
   `127.0.0.1`'e bağlanırsa yalnızca makinenin kendisi erişebilir.

   Hızlı sınama: telefonun tarayıcısında `http://<LAN-IP>:4000/api/v1/health`
   adresini aç — JSON görünmeli.
5. Alternatif (USB ile, firewall ayarı gerekmez): `adb reverse tcp:80 tcp:80`
   → cihazda `http://localhost/api/v1` + aynı `Host` başlığı.
6. **Android 9+ cleartext HTTP engeli:** debug varyantında Expo'nun ürettiği
   `android/app/src/debug/AndroidManifest.xml` zaten
   `android:usesCleartextTraffic="true"` içeriyor, ek yapılandırma gerekmez.
   Release varyantında düz HTTP kullanılacaksa `network_security_config.xml`
   ile yalnızca ilgili alan adlarına izin verilmelidir.

> Şifreler ağ üzerinden düz HTTP ile gittiği için bu kurulum **yalnızca yerel ağ
> geliştirmesi içindir**. Ev ağı dışına çıkan trafik canlı sunucuya gider ve
> orası HTTPS'tir (§18).

### 17.4 Yedekleme

```bash
mysqldump -u root --single-transaction --routines bebektakip > bebektakip_20261101.sql
```

Uygulama içi "Verileri yedekle" → `GET /sync/pull?since=0` çıktısını JSON dosyası olarak cihaz indirmelerine yazar.

---

## 18. Güvenlik Notları

| Konu | Yaklaşım |
|------|----------|
| SQL enjeksiyonu | `mysql2` hazır ifadeleri (`execute`, adlandırılmış yer tutucu). Dize birleştirmeyle SQL kurulmaz; `ORDER BY` gibi dinamik alanlar beyaz listeden geçer. |
| Şifre saklama | scrypt (N=2¹⁵, r=8, p=1), kullanıcı başına 16 bayt salt, `timingSafeEqual` ile karşılaştırma |
| Oturum | Kısa ömürlü access token + dönen refresh token; yeniden kullanım tespitinde tüm oturumlar iptal |
| **Yetki yükseltme** | Yetkiler token'a gömülmez, her istekte `baby_members`'tan okunur. Sahip bir kişiyi `viewer`'a düşürdüğünde değişiklik **anında** geçerlidir. |
| **Yatay yetki ihlali** | Kaynak id'leri (`/feedings/{id}`) daima bebeğe JOIN edilerek doğrulanır; `baby_id`'nin istemciden gelen değerine güvenilmez. Üye olunmayan bebekte `404` döner (varlık sızdırılmaz). |
| Kütle atama (mass assignment) | İstek gövdeleri zod şemasıyla **beyaz listeye** alınır; `created_by`, `permission`, `is_admin` gibi alanlar gövdeden asla okunmaz |
| Kaba kuvvet | `/auth/login` IP+e-posta bazlı oran sınırı; 5 hatada hesap 15 dk kilitlenir (`users.locked_until`) |
| Davet kodları | 8 hane, kriptografik rastgele, yalnızca SHA-256 özeti saklanır, 7 gün geçerli, tek kullanımlık |
| Kullanıcı numaralandırma | `forgot-password` ve `register` yanıtları e-postanın kayıtlı olup olmadığını sızdırmaz |
| Dosya yükleme | `multer` boyut sınırı + MIME beyaz listesi + `sharp` ile yeniden kodlama (EXIF ve gömülü içerik düşer), rastgele dosya adı, `uploads/` yalnızca statik servis edilir (yürütme yok) |
| Güvenlik başlıkları | `helmet`: CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` |
| CORS | Mobil uygulama CORS kullanmaz; panel aynı kökten servis edilir. Geliştirme dışında origin beyaz listesi zorunlu. |
| Yönetim paneli | Ayrı çerez oturumu, CSRF token, `is_admin` her istekte yeniden kontrol, varsayılan olarak `127.0.0.1` ile sınırlı (§7.4) |
| Hata mesajları | Üretimde yığın izi gizlenir; istek kimliği (`request_id`) ile `pino` loguna yazılır |
| Log mahremiyeti | Şifre, token ve davet kodu asla loglanmaz; log'da e-posta maskelenir (`m***@ornek.com`) |
| Yerel ortam | `root` / şifresiz yalnızca localhost geliştirme içindir. LAN'a/dışa açılacaksa: ayrı MySQL kullanıcısı (`bebektakip_app`) + minimum yetki (`SELECT, INSERT, UPDATE, DELETE`) + güçlü şifre + **HTTPS** |
| Kişisel veri | Bebek adı/fotoğrafı hassas veridir: yalnızca kullanıcının kendi sunucusuna gider, üçüncü parti analytics kullanılmaz. Üyelikten çıkarılan kişi geçmiş kayıtları artık göremez. |
| Hesap silme | Kullanıcı silindiğinde sahip olduğu bebekler ve kayıtlar da silinir; başkasının bebeğine girdiği kayıtlar kalır ama aktör "Silinmiş kullanıcı" olarak görünür |
| APK | Release derlemede ProGuard/R8 açık, `debuggable=false`, token'lar `expo-secure-store` ile Keystore'da |

---

## 19. Geliştirme Yol Haritası

| Aşama | İçerik | Çıktı |
|-------|--------|-------|
| **0 — Hazırlık** ✅ | JDK 17 ayarı, `ANDROID_HOME`, Expo projesi (`mobile/`), emülatörde dev build | Çalışan dev build |
| **2a — Modüler kabuk** ✅ | Tema, tipler, SQLite ayna, modül kataloğu + aktif/pasif store, runtime navigasyon, bebek ekle/seç/yaş, Ayarlar switch'leri | Çalışan uygulama iskeleti |
| **1a — Node API çekirdeği** ✅ | Proje iskeleti, 7 migration, havuz, hata/log katmanı, zod env | `npm run migrate` → 24 tablo + 1 view |
| **1b — Kimlik doğrulama** ✅ | Kayıt, giriş, refresh rotation, oturum listesi, hesap kilidi | Çalışan `/auth/*` (şifre sıfırlama hariç) |
| **1c — Bebek + üyelik + davet** ✅ | `/babies`, `baby_members`, davet akışı, `requireBaby`, sahiplik devri | Paylaşım uçtan uca çalışıyor |
| **1d — Kayıt uçları + denetim izi** ✅ | Feeding, breastfeeding, sleep, diaper, timeline, activity, günlük rapor | 37 maddelik duman testi geçti |
| **1e — Yönetim paneli** ✅ | EJS düzeni, admin girişi, kullanıcılar, bebekler, davetler, etkinlik, müzik, sistem | Tarayıcıdan `/admin` |
| **1f — Kalan API uçları** | `/sleep/start`+`stop`, hatırlatıcılar, sessiz saat, müzik uçları, sync push/pull, fotoğraf yükleme, şifre sıfırlama | API sözleşmesi tamamlanır |
| **2b — Mobil kimlik doğrulama** | Giriş/kayıt ekranları, SecureStore, axios interceptor + 401 yenileme, çıkışta yerel veri temizleme | Hesapla açılan uygulama |
| **2c — Mobil aile modülü** | Üye listesi, davet gönderme/kabul, `PermissionGate`, yakınlık etiketleri | Paylaşım arayüzü |
| **2d — Profil tamamlama** | Takvim seçici, fotoğraf ekleme/kırpma, bebek düzenleme-silme, modül alt ayar panelleri | Profil modülü tam |
| **3 — Emzirme modülü** | Durum makinesi, drift-free timer, sağ/sol segment, foreground service, kurtarma diyaloğu | Emzirme sayacı tam çalışır |
| **4 — Biberon / Mama** | Miktar + ml/cl girişi, tür seçimi, hızlı kayıt butonları | Besleme kaydı tam |
| **5 — Uyku** | Kronometre + manuel giriş, gece/şekerleme, uyanma sayacı, günlük toplam | Uyku takibi |
| **6 — Timeline** | `v_timeline`, kart tipleri, gün seçici, gün özeti | Günlük akış ekranı |
| **7 — Hatırlatıcılar** | Notifee kanalları, interval planlayıcı, sessiz saat, boot receiver, bildirim logu | Akıllı bildirim |
| **8 — Müzik** | Player, arka plan servisi, uyku zamanlayıcı, kategori/liste, yükleme API'si | Ninni modülü |
| **9 — Offline sync** | SQLite şeması, `sync_queue`, push/pull, çakışma çözümü | Ağsız çalışma |
| **10 — Cila & Yayın** | Onboarding, pil optimizasyonu yönlendirmesi, ikon/splash, ProGuard, imzalı AAB | Release APK/AAB |

---

## 20. Test Stratejisi

| Seviye | Araç | Kapsam |
|--------|------|--------|
| Birim | Jest | `calcAge`, `format(ms)`, `elapsedMs`, birim dönüşümü (cl→ml), `applyQuietHours`, interval planlayıcı, gün aşan pencere normalizasyonu |
| Bileşen | React Native Testing Library | TimerCircle, AmountInput, TimelineCard, BabySwitcher |
| Entegrasyon | Jest + MSW | API client, sync kuyruğu, çakışma çözümü |
| API | **vitest + supertest** | Uç nokta sözleşmesi, idempotent `sync_uuid`, generated column doğruluğu |
| **Yetki matrisi** | vitest (tablo testi) | §5.2'deki her satır için `owner` / `editor` / `viewer` / **üye olmayan** × her uç nokta → beklenen durum kodu. Yeni bir uç nokta eklendiğinde teste eklenmezse CI düşer. |
| Manuel senaryo | Gerçek cihaz | (a) Emzirme sırasında uygulamayı kill et → süre korunuyor mu, (b) uçak modunda kayıt → bağlantı gelince sync, (c) gece 03:00 sessiz saatte hatırlatıcı → ertelendi mi, (d) müzik çalarken ekran kilidi → çalmaya devam, (e) cihaz yeniden başlat → hatırlatıcılar yeniden kuruldu mu, (f) saat dilimi / yaz saati değişimi sonrası süreler, (g) iki bebek için eşzamanlı kronometre |

### Kritik Kabul Kriterleri

1. 20 dakikalık bir emzirme seansında kaydedilen `total_active_sec`, gerçek süreden **±2 saniyeden fazla sapmaz** (uygulama arka plandayken dahil).
2. Sağ ve sol meme süreleri bağımsız ve doğru toplanır; her meme değişimi yeni bir segment sınırı oluşturur ve segmentin başlangıç/bitiş saati kaydedilir.
3. `12 cl` girilen biberon kaydı raporlarda `120 ml` olarak toplanır.
4. Sessiz saat `22:30–06:30` iken 03:00'e denk gelen hatırlatıcı, `quiet_behavior='postpone'` ise **06:31**'e ötelenir ve `notification_log`'da gerekçesiyle görünür.
5. Pasif edilen modülün ekranı, ana ekrandaki karesi, özet kutusu ve timeline kartları kaybolur; tekrar aktif edilince eski kayıtlar geri gelir.
6. Çalışan kronometre varken uygulama öldürülüp açıldığında kurtarma diyaloğu çıkar ve süre doğru devam eder.
7. Yeni besleme kaydı girildiğinde `anchor='last_record'` olan hatırlatıcının `next_trigger_at`'i yeniden hesaplanır ve eski bekleyen bildirim iptal edilir.

**Yetkilendirme ve denetim izi kabul kriterleri:**

8. `editor` yetkisindeki bir kullanıcı `POST /babies/{id}/invitations` çağırdığında **403** alır; veritabanında davet satırı oluşmaz.
9. Hiç üye olmadığı bir bebeğin id'sini deneyen kullanıcı **404** alır (403 değil) — bebeğin varlığı sızdırılmaz.
10. Baba'nın girdiği bez kaydı, anne'nin timeline'ında **"Baba Mehmet kaydetti"** satırıyla ve doğru olay saatiyle görünür; giriş saati olay saatinden farklıysa ikisi de gösterilir.
11. İstek gövdesinde `created_by: 99` gönderilse bile kayıt, token'daki kullanıcıya atfedilir.
12. Sahip bir üyeyi `viewer`'a düşürdüğünde, o kullanıcının **mevcut access token'ıyla** yaptığı bir sonraki yazma isteği **403** alır (token süresinin dolması beklenmez).
13. `editor`, başkasının girdiği kaydı `PUT`/`DELETE` ile değiştirmeye çalıştığında **403** alır; `owner` aynı işlemi yapabilir.
14. Bir kullanıcı çıkış yaptığında cihazdaki yerel SQLite verisi silinir; aynı cihazda başka bir hesapla giriş yapan kişi önceki kullanıcının kayıtlarını göremez.
15. Yönetim paneline `is_admin = 0` olan bir hesapla girilmek istendiğinde **403** döner ve deneme `activity_log`'a yazılır.

---

## 21. Açık Kararlar

| # | Konu | Seçenekler | Not |
|---|------|-----------|-----|
| 1 | Bildirim kütüphanesi | `notifee` (tam kontrol, foreground service) ⟷ `expo-notifications` (daha basit) | Foreground service ve aksiyon butonları gerekiyorsa notifee |
| 2 | Ses kütüphanesi | `react-native-track-player` (kilit ekranı kontrolü) ⟷ `expo-audio` (daha hafif) | Kilit ekranı kontrolü isteniyorsa track-player |
| 3 | Davet bildirimi | Uygulama içi liste (v1) ⟷ e-posta gönderimi (SMTP) ⟷ push bildirim | v1'de e-posta altyapısı yok; davet kodu sahip tarafından elden/WhatsApp ile iletilir |
| 4 | Gerçek zamanlı güncelleme | Periyodik senkronizasyon (v1) ⟷ WebSocket/SSE | Anne, babanın girdiği kaydı v1'de ancak senkronizasyonda görür |
| 5 | Birim tercihi | Kullanıcı global birim seçimi (ml/cl) ⟷ her kayıtta serbest seçim | Şema ikisini de destekler; UI kararı |
| 6 | Modül kapsamı | ~~Kullanıcı geneli ⟷ kullanıcı + bebek bazlı~~ → **sistem geneli** | 2026-11-02'de kapatıldı: aktiflik yalnızca `modules.is_enabled` ile, yönetim panelinden yönetilir. Anne ve babanın farklı sekme seti görmesi destek tarafında karışıklık yaratıyordu |
| 7 | Sahiplik devri | Yalnızca sahip başlatır ⟷ devralanın onayı gerekir | v1: tek adımda devir; onay akışı v2 |
| 8 | Hesap silme | Yumuşak silme (v1) ⟷ KVKK uyumlu tam silme + dışa aktarma | Veri dışa aktarma (`GET /auth/me/export`) v2'ye bırakıldı |

---

## 22. Modül API Sözleşmeleri (Modül 2–15 ve Bildirim Merkezi)

`modules_doc/` altındaki şartnamelerin uygulanmış hâli. Şartnameden bilinçli
sapmalar ve eksik şartnameler **`modules_doc/NOTLAR-ve-EKSIKLER.md`** dosyasındadır.

> **Adres biçimi.** Şartnameler `/api/v1/sleep?baby_id=` gibi düz adresler
> öneriyor; uygulamada bebek bağlamı **yola gömülüdür**
> (`/api/v1/babies/{babyId}/sleep`). Böylece yetki `requireBaby()` ara katmanı
> ile tek noktadan uygulanır ve istemciden gelen `baby_id`'ye güvenilmez (§5.5).
> Tekil kayıt uçları (`/sleep/{id}`) kaydı bebeğe JOIN ederek doğrular.

### 22.0 Kısmi güncellemede varsayılan tuzağı — **tüm modülleri etkiliyordu**

zod'da `.default(...)` değerleri `.partial()` uygulandıktan **sonra da** çalışır:
alan istekte hiç gönderilmese bile şema onu varsayılanla doldurur. Güncelleme
işleyicileri `body[col] === undefined` kontrolü yaptığı için bu, "gönderilmedi"
ile "varsayılan gönderildi" ayrımını yok ediyordu. Gerçek sonuç:

```
PUT /api/v1/sleep/12   {"note": "..."}
→ sleep_type 'night' iken 'nap' oldu, wake_count 3 iken 0 oldu
```

Aynı kusur `babies.gender`, `diapers.has_rash/cream_applied` ve
`reminders.schedule_mode` alanlarında da vardı. Düzeltme: varsayılanı olan her
alan, güncelleme şemasında varsayılansız `optional()` ile ezilir. Her modülün
test takımında bir **gerileme kontrolü** vardır.

### 22.0.1 Elle girilen kayıtta süre türetilmiyordu — **sessiz veri kaybı**

`duration_sec` yalnızca kronometre yolunda (`/sleep/:id/stop`) hesaplanıyordu.
Elle girilen bir kayıt başlangıç ve bitişi taşısa bile süre `NULL` kalıyor ve
o kayıt **günlük özet toplamlarına hiç girmiyordu**:

```
POST /babies/3/sleep  {"sleep_type":"nap","started_at":"…T10:00","ended_at":"…T11:30"}
→ duration_sec NULL;  /sleep/daily-summary  nap_sec: 0
```

Hata sessizdi: ekranda başlangıç-bitiş doğru görünüyor ama "bugün 6 saat
uyudu" rakamı eksik çıkıyordu. Kayıt detay raporu "Süre: 0 dk" derken
başlangıç ve bitişin dokuz saat arayla durması ortaya çıkardı.

Düzeltme `derivedDuration()`: süre verilmediyse bitiş eksi başlangıçtan
hesaplanır. İki kural korunur:

- Bitiş yoksa `NULL` kalır (kayıt sürüyor).
- İstemci **açıkça** bir süre gönderdiyse ona dokunulmaz; duraklatmalı
  seanslarda gerçek süre, bitiş eksi başlangıçtan kısadır.

Aynı kusur `feedings` için de vardı, orada da düzeltildi. Gerileme testi:
`duration_e2e.sh` (10 kontrol).

### 22.0.2 Modül 3 — Biberon (`bottle`)

Biberonun **kendi tablosu yoktur**: emzirme, biberon ve ek gıda aynı `feedings`
tablosunu paylaşır ve `feed_type` ile ayrılır. Böylece "günde toplam kaç ml
aldı" tek sorguyla yanıtlanır; üç ayrı tabloda aynı soru üç UNION isterdi.

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET | `/babies/{id}/feedings?type=bottle_breastmilk,bottle_formula,water` | viewer |
| GET | `/babies/{id}/feedings/daily-summary?date=YYYY-MM-DD` | viewer |
| POST | `/babies/{id}/feedings` | editor |
| PUT/DELETE | `/feedings/{id}` | editor¹ |

**`type` filtresi çoğuldur.** Biberon ekranı anne sütü + formül + su'yu birlikte
listelediği için virgülle ayrılmış tip listesi kabul edilir. İki ayrıntı önemli:

- Hazır ifadelerde `IN (?)` dizi genişletmesi **çalışmaz** (`execute()` diziyi
  tek değer sayar); yer tutucular elle üretilir.
- Her değer enum'a karşı doğrulanır. Bilinmeyen tip sessizce atılmaz, istek
  `422` ile reddedilir — sessiz atma, yazım hatası yüzünden eksik liste
  dönmesine ve kullanıcının bunu fark etmemesine yol açardı.

**Birim kuralı.** Sıvı beslemede `amount_unit` yalnızca `ml` veya `cl` olabilir;
porsiyon birimleri (`spoon`/`gram`/`bowl`/`piece`) ek gıdaya aittir ve ters
durum da reddedilir. `cl → ml` dönüşümü **yalnızca** `amount_ml` üretilen
sütununda yapılır; istemci de çevirirse iki doğruluk kaynağı oluşur.

Günlük özet yanıtı:

```json
{
  "date": "2026-11-02",
  "bottle_count": 3, "bottle_total_ml": 360, "avg_ml": 120,
  "breastmilk_count": 1, "breastmilk_ml": 120,
  "formula_count": 2,  "formula_ml": 240,
  "water_count": 1,    "water_ml": 30,
  "last_bottle_at": "2026-11-02T09:00:00.000Z",
  "since_last_bottle_sec": 7200,
  "avg_interval_sec": 10800
}
```

Üç karar not edilmeye değer:

1. **Su, `bottle_total_ml`'e dâhil değildir** — ayrı sayılır. Su beslenme değil,
   sıvı alımıdır; toplama katılsa "bugün 390 ml aldı" yanıltıcı olurdu.
2. **`since_last_bottle_sec` günden bağımsızdır.** Yalnızca bugüne bakılsaydı
   sabah 05:00'te, günün ilk biberonu henüz verilmemişken `null` dönerdi ve
   ekranda "son öğün" bilgisi tam ihtiyaç duyulan anda kaybolurdu.
3. **`avg_interval_sec` n kayıt için n-1 aralıktır**; tek kayıtta `null`.

Mobil tarafta hızlı miktar butonları (60/90/120/150) ml cinsindendir ve `cl`
seçiliyken birimi de `ml`'ye alır — yoksa "120 cl" gibi 1,2 litrelik bir kayıt
oluşurdu.

### 22.1 Modül 2 — Emzirme Sayacı (`breastfeeding`)

Seans bir **durum makinesidir** (§10.1): `start → switch/pause/resume → stop`.
Süreler saklanmaz, `breastfeeding_segments` satırlarından toplanır — saklansaydı
bir segment düzenlendiğinde toplam sessizce tutarsızlaşırdı.

**Aktif / pasif ayrımı ve annenin sonradan düzeltmesi §10.2.1'dedir**; oradaki
üç kavram (ölçülen aktif / duvar saati / aktif) karıştırılmaya çok müsait.

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET | `/babies/{id}/breastfeeding` | viewer — `?from=&to=&limit=` |
| GET | `/babies/{id}/breastfeeding/last` | viewer |
| GET | `/babies/{id}/breastfeeding/active` | viewer |
| POST | `/babies/{id}/breastfeeding/start` | editor |
| POST | `/babies/{id}/breastfeeding/{sessionId}/switch` · `/pause` · `/resume` · `/stop` | editor¹ |

```jsonc
// GET /babies/3/breastfeeding/last
{
  "last": {
    "id": 41, "start_time": "2026-11-02T08:12:00.000Z", "end_time": "2026-11-02T08:31:00.000Z",
    "status": "completed",
    "left_duration_seconds": 420, "right_duration_seconds": 680,
    "total_duration_seconds": 1100,
    "last_side": "right", "minutes_ago": 73
  },
  "next_side": "left"   // son emzirilen tarafın tersi
}
```

`last` ucu **çalışan seansı da** döndürür; kronometre yarıdayken de ekranın
üstündeki "sağdan devam" rozeti doğru taraf gösterir.

### 22.2 Modül 4 — Ek Gıda (`solid`)

Ek gıda kayıtları `feedings` tablosunda `feed_type='solid'` ile tutulur.
Eklenen alanlar: `food_category`, `reaction`, `is_three_day_rule`.

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET/POST | `/babies/{id}/feedings` | viewer / editor |
| GET | `/babies/{id}/solid/allergies` | viewer — `?include=allergic\|disliked` |
| PUT/DELETE | `/feedings/{id}` | editor¹ |

**Birim ayrımı.** `amount_unit` artık `ml · cl · spoon · gram · bowl · piece`
içerir ve karışım **reddedilir**:

| Durum | Yanıt |
|-------|-------|
| `feed_type='solid'` + `ml`/`cl` | `422` — porsiyon birimi kullan |
| `feed_type≠'solid'` + `spoon`/`gram`/… | `422` — ml veya cl kullan |

`amount_ml` üretilen (generated) sütunu artık yalnızca hacim birimlerinde
doluyor; eskiden `ELSE amount` olduğu için **2 kaşık mama 2 ml süt** sayılıyor
ve rapordaki süt toplamını bozuyordu.

```jsonc
// GET /babies/3/solid/allergies
{ "foods": [
  { "food_name": "Yumurta", "food_category": "protein", "reaction": "allergic",
    "occurrence_count": 2, "last_seen_at": "2026-11-02T12:00:00.000Z", "last_note": "Döküntü" }
]}
```

### 22.3 Modül 5 — Uyku Takibi (`sleep`)

Eklenen alan: `wake_reason` (serbest metin — şartnamede kapalı liste yok).

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET/POST | `/babies/{id}/sleep` | viewer / editor |
| POST | `/babies/{id}/sleep/start` | editor — canlı sayaç |
| POST | `/sleep/{id}/stop` | editor¹ |
| GET | `/babies/{id}/sleep/daily-summary?date=` | viewer |
| PUT/DELETE | `/sleep/{id}` | editor¹ |

**Kronometre.** `start` kaydı `ended_at = NULL`, `status='running'` ile açar.
Süre **bitişte sunucuda** hesaplanır; telefonun saati değişse bile kayıt bozulmaz.
Aynı bebekte ikinci `start` yeni kayıt açmaz, mevcut çalışan kaydı
`already_running: true` ile döner — iki ebeveyn aynı anda "uykuya daldı" derse
çift kayıt oluşmaz.

```jsonc
// GET /babies/3/sleep/daily-summary?date=2026-11-02
{
  "date": "2026-11-02",
  "night_sleep_sec": 32400, "nap_sec": 7200, "total_sleep_sec": 39600,
  "session_count": 4, "nap_count": 3,
  "last_wake_at": "2026-11-02T11:30:00.000Z",
  "awake_window_sec": 5400          // uyanıklık penceresi widget'ını besler
}
```

Gün sınırı kaydın kendi `tz_offset_min` değerine göre belirlenir; UTC'ye göre
bölmek gece 03:00'teki uykuyu bir önceki güne yazardı.

Hata: bitiş başlangıçtan önceyse veya kayıt zaten kapalıysa `422`.

### 22.4 Modül 6 — Bez Değişimi (`diaper`)

`rash_status` (`none·mild·severe`) eklendi. Eski `has_rash` boolean'ı
**türetilmiş** hâle geldi: `rash_status` tek doğruluk kaynağıdır, yazma
sırasında ikisi birlikte güncellenir. Sütun düşürülmedi — eski istemciler hâlâ
okuyor olabilir.

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET/POST | `/babies/{id}/diapers` | viewer / editor |
| GET | `/babies/{id}/diapers/daily-summary?date=` | viewer |
| PUT/DELETE | `/diapers/{id}` | editor¹ |

```jsonc
// GET /babies/3/diapers/daily-summary?date=2026-11-02
{ "date": "2026-11-02", "total_count": 6, "wet_count": 4, "dirty_count": 3,
  "dry_count": 0, "cream_applied_count": 2, "worst_rash_status": "mild" }
```

`karisik` (çiş+kaka) hem `wet_count` hem `dirty_count` içinde sayılır; bu yüzden
ikisinin toplamı `total_count`'tan büyük olabilir. `worst_rash_status` gün
içindeki **en kötü** durumu söyler — ortalama almak pişiği gizlerdi.

### 22.5 Modül 7 — Ninni & Müzik (`music`)

Kütüphane ortaktır ve yalnızca yönetim panelinden yönetilir (§7.2).

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET | `/music?category=` | auth |
| GET | `/music/favorites` | auth |
| POST | `/music/{id}/favorite` | auth — toggle |

**Favoriler kullanıcıya aittir** (`music_favorites` tablosu). Parça üzerinde tek
bir `is_favorite` bayrağı olsaydı bir kullanıcının favorisi herkesi etkilerdi.

Liste yalnızca `is_active = 1` **ve** `file_path IS NOT NULL` satırları
döndürür: dosyası olmayan bir satır, çalarda dokunulabilen ama çalmayan bir
satır olurdu.

#### 22.5.1 Parça adresi — neden göreli

Uç iki alan döndürür ve **`audio_path` asıl olanıdır**:

| Alan | Örnek | Kullanım |
|------|-------|----------|
| `audio_path` | `/uploads/music/1793…mp3` | Göreli yol; istemci kendi origin'ine ekler |
| `audio_url` | `http://bebektakip.test/uploads/music/1793…mp3` | Mutlak; yalnızca geriye dönük uyumluluk |

Önceden yalnızca mutlak adres dönüyordu ve çalmanın koşulu, cihazın
`PUBLIC_BASE_URL` konağını **çözebilmesiydi**. Yerel kurulumda bu konak
`bebektakip.test`: ne Android emülatörü ne fiziksel telefon bu adı
çözebiliyor, indirme DNS aşamasında düşüyor ve çalar sessizce hiç
başlamıyordu — "Android'de müzik çalmıyor" arızasının kökü buydu. Hata
görünmüyordu çünkü ekran `status.error` alanını hiç okumuyordu.

Üç değişiklik birlikte sorunu kapatıyor:

1. **Sunucu göreli yol döndürüyor** (`routes/v1/music.ts` → `shape`).
2. **İstemci yolu kendi origin'ine ekliyor** (`core/api/assets.ts` →
   `toDeviceUrl`). Aynı işlev savunma amaçlı üçüncü bir kural daha uyguluyor:
   tanınmayan bir origin'den gelse bile `/uploads/` altındaki her adres
   bağlanılabilir origin'e taşınıyor. `EXPO_PUBLIC_*` değerleri paketleme
   sırasında gömüldüğü için uygulama bir kanonik adresle derlenip sunucu
   sonradan başkasıyla çalışmaya başlayabiliyor; kural bu sapmayı yutuyor.
3. **Çalma hatası ekranda gösteriliyor** (`status.error`), böylece bir sonraki
   arıza sessiz kalmıyor.

#### 22.5.2 Süre ve dosya ağırlığı

`duration_sec` göçün ilk gününden beri şemadaydı ama yükleme ucu onu hiç
doldurmuyordu; çalar bu yüzden parça yüklenene kadar `0:00 / 0:00`
gösteriyordu. Süre artık yüklemede dosyadan okunuyor (`lib/audioMeta.ts` —
bağımlılıksız mp3/wav/m4a/ogg ayrıştırıcısı; `ffprobe` kurma zorunluluğu
getirmemek için kendi yazıldı). Önceden yüklenmiş satırlar için:

```bash
npx tsx scripts/backfill-audio-meta.ts          # ne yapacağını yazar
npx tsx scripts/backfill-audio-meta.ts --write  # veritabanına yazar
```

**Dosya ağırlığı bir kullanılabilirlik sorunudur.** Kütüphanedeki ilk kayıt
2 saat, 192 kbit/s **stereo**, 172 MB'lık bir beyaz gürültü dosyasıydı: telefon
parçayı akış hâlinde indiriyor ve ilk ses mobil veride dakikalarca
gecikebiliyor — kullanıcı için "çalmıyor"dan ayırt edilemez. Panel artık süreyi
ve bit hızını listeliyor, ağır dosya yüklendiğinde uyarıyor ve çalar
"Yükleniyor…" durumunu yazıyor.

Önerilen biçim: **mp3, 64 kbit/s mono**, tercihen 1–3 dakika ve döngüye uygun;
döngü düğmesi kısa kaydı kesintisiz tekrarlıyor.

Mevcut kayıt 2026-11-03'te bu biçime dönüştürüldü — **172,7 MB → 57,5 MB** (3×),
süre birebir korundu (7193 sn):

```bash
ffmpeg -i <kaynak>.mp3 -vn -ac 1 -ar 44100 -b:a 64k -codec:a libmp3lame        -write_xing 1 -id3v2_version 3 -map_metadata -1        -metadata title="..." -metadata artist="..." <hedef>.mp3
```

Bayraklardan üçü bilinçli:

- `-vn` gömülü kapak görselini atar. Beyaz gürültü dosyasında 64 KB'lık bir
  JPEG, ses verisinden **önce** indiriliyordu ve ilk sesi geciktiriyordu.
- `-write_xing 1` VBR başlığı yazar; ExoPlayer süreyi ve atlama (seek)
  konumlarını buradan okuyor. Olmasaydı çalar iki saatlik dosyada konumu
  tahmin etmek zorunda kalırdı.
- `-map_metadata -1` kaynaktaki çöp etiketleri (`major_brand=isom` gibi, bir
  mp4'ten dönüştürmeden kalma) temizler.

Özgün dosya `backups/` altında duruyor. Klasör bilinçli olarak `uploads/`
**dışında**: `uploads/` statik servis ediliyor ve orada bırakılan 172 MB'lık
yedek kimlik doğrulaması olmadan indirilebilir durumdaydı (`.orig` uzantısıyla
dahi HTTP 206 dönüyordu).

#### 22.5.3 Çalma oturumunun ömrü

**Çalar ekrana ait değil.** `core/music/useMusicStore.ts` içinde, modül
düzeyinde `createAudioPlayer` ile kuruluyor.

Gerekçe bir arızadan geliyor: çalar önce `MusicScreen` içinde `useAudioPlayer`
ile kuruluyordu ve o kanca nesneyi **bileşen söküldüğünde serbest bırakıyor**
(`useReleasingSharedObject`). Ebeveyn ninniyi başlatıp ana sayfaya döndüğü anda
çalar yok ediliyor ve ses kesiliyordu — emülatörde navigasyonla eş zamanlı
`ExoPlayerImpl: Release` olarak ölçüldü. Oysa uyutma müziğinin tek işi, telefon
bırakılıp odadan çıkıldıktan sonra çalmaya devam etmek.

Çalma artık yalnızca dört şeyle biter: ekrandaki **Durdur**, bildirim
çubuğundan kapatma, uyku zamanlayıcısı ve oturum kapanışı (`stopMusic()`,
`useAuthStore.logout`).

**Arka planda çalmanın üç koşulu** — üçü birden gerekiyor:

| Ayar | Olmazsa |
|------|---------|
| `shouldPlayInBackground: true` | Uygulama arka plana geçince ses duraklatılır |
| `interruptionMode: 'doNotMixPersistent'` | Geçici odak sistem tarafından geri alınabilir; kilit ekranı denetimleri de çalışmaz |
| `setActiveForLockScreen(true, …)` | Ses yaklaşık **3 dakika** sonra kesilir (Expo belgesi) |

Üçüncüsü aynı zamanda bildirim çubuğundaki denetimleri sağlıyor: foreground
servis (`AudioControlsService`, `foregroundServiceType="mediaPlayback"`) ve
Media3 medya kartı.

**Emülatörde ölçülen davranış (Android 16):**

| Eylem | Sonuç |
|-------|-------|
| Uygulama içinde başka ekrana geç | Çalma sürer, çalar yok edilmez |
| Uygulamadan çık (ana ekran) | `state=PLAYING(3)`, foreground servis `isForeground=true` |
| Bildirimden duraklat | `state=PAUSED(2)` |
| Bildirimden devam et | `state=PLAYING(3)` |
| Bildirimden **Duraklat** | `state=PAUSED(2)`, satır "Ninni duraklatıldı"ya döner |
| Bildirimden **Devam et** | `state=PLAYING(3)` |
| Bildirimden **Kapat** | Çalar + medya oturumu serbest, servis kalkar, iki bildirim de gider |
| Ekranda **Durdur** | Kapat ile aynı: tam teardown |

#### 22.5.4 Çaların kendi bildirimi — gerçek "Kapat" düğmesi

Ninni çalarken bildirim gölgesinde **iki** satır olur ve bu bilinçli:

| Satır | Nereden | Ne verir |
|-------|---------|----------|
| Sistem medya kartı | `setActiveForLockScreen` (Media3) | Duraklat/devam, kilit ekranı, Bluetooth ve kulaklık düğmeleri |
| `music_player` bildirimi | `core/music/musicNotice.ts` | **Duraklat / Devam et** ve **Kapat** |

**Neden ikinci bir bildirim gerekti.** Medya kartında kapatma düğmesi yok ve
eklenemiyor: `expo-audio`, Media3'ün özel düğmelerini (`CommandButton`) dışarı
açmıyor — `AudioLockScreenOptions` yalnızca ileri/geri sarma ve
sonraki/önceki parça sunuyor (`AudioControlsService.updateSessionCustomLayout`).
Kartı kaydırmak ise yalnızca kartı gizliyor; çalar duraklatılmış hâlde bellekte
kalıyor, çünkü kaydırma olayı JS'e hiç bildirilmiyor.

`expo-audio`'nun Kotlin'ini yamalamak düşünüldü ve **reddedildi**: paketin her
yükseltmesinde bozulur ve projenin kuralı native klasörleri elle düzenlememek
(AGENTS.md). Seçilen yol, uygulamada zaten çalışan desen — canlı sayaç
bildirimi de aynı şekilde kategori + aksiyon düğmeleri taşıyor
(`liveTimerNotice.ts`).

**Medya kartı silinemiyor** (foreground servisin kendisi) ve işlevsiz bir
kopya da değil: kilit ekranı ile Bluetooth/kulaklık denetimleri ondan geliyor.

Kanal `music_player`, LOW önemli ve sessiz (`mImportance=2`, `mSound=null`):
bu bir uyarı değil, denetim satırı. Kanal tetikleyiciden veriliyor
(`trigger: { channelId }`); `trigger: null` kullanılsaydı Android bildirimi
varsayılan HIGH kanala düşürürdü — canlı sayaç bildiriminde tam olarak bu
olmuştu (§12.8).

Düğmeler uygulamayı **ön plana getiriyor** (`opensAppToForeground: true`):
`false` olsaydı ve uygulama öldürülmüşse yanıt dinleyicisi hiç çalışmaz, düğme
sessizce hiçbir şey yapmış olurdu.

**Durum neden mağazaya kopyalanıyor.** `useAudioPlayerStatus` bir çalar nesnesi
istiyor; hiçbir şey çalmıyorken verilecek nesne yok. Durum bu yüzden
`playbackStatusUpdate` olayından mağazaya yansıtılıyor ve ekran çalar olsun
olmasın aynı alanları okuyor.

**Uyku zamanlayıcısı da mağazada.** Ekranda kalsaydı başka bir ekrana geçmek
zamanlayıcıyı iptal ederdi — oysa ebeveyn zamanlayıcıyı kurup telefonu
bırakıyor.

### 22.6 Modül 8 — Hatırlatıcılar (`reminders`)

Bildirimi **cihaz** gösterir (`expo-notifications`); sunucu yalnızca tanımı
saklar. Böylece uygulama çevrimdışıyken de alarm çalar ve sunucuda push
altyapısı gerekmez.

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET/POST | `/babies/{id}/reminders` | viewer / editor |
| PATCH | `/reminders/{id}/toggle` | editor¹ |
| PUT/DELETE | `/reminders/{id}` | editor¹ |

İki zamanlama modu vardır ve **mod ile veri uyuşmalıdır**, yoksa `422`:

| `schedule_mode` | Zorunlu alan | Anlamı |
|-----------------|--------------|--------|
| `interval` | `interval_minutes` | Son kayıttan/son alarmdan X dakika sonra (`anchor`) |
| `fixed_times` | `fixed_times: ["09:00","21:00"]` | Her gün belirtilen saatlerde |

Şartnamedeki `recurrence_interval_hours`, `interval_minutes`'a karşılık gelir
(dakika çözünürlüğü daha esnek). Güncellemede tutarlılık **yürürlüğe girecek**
duruma göre denetlenir; yalnızca `schedule_mode` göndererek veriyi uyumsuz
bırakmak mümkün değildir.

#### Listede düzenleme ve silme

Uçlar (`PUT` / `DELETE`) baştan beri vardı ama **arayüzde karşılıkları
yoktu**: satırda yalnızca aç/kapa anahtarı duruyordu, silme yalnızca uzun
basmayla yapılabiliyor ve bu hiçbir yerde yazmıyordu. Saatini değiştirmek
isteyen kullanıcı hatırlatıcıyı silip yeniden kurmak zorundaydı — bu da
`sync_uuid`'yi, denetim izini ve cihazdaki takvim kaydını kaybettiriyordu.

Artık her satırın altında **Düzenle** ve **Sil** düğmeleri var. Üç karar:

1. **Anahtar ile Düzenle ayrı işler.** Anahtar hatırlatıcıyı *durdurur*
   (`is_active`), Düzenle *değiştirir*. Bölüm başlığındaki ipucu bunu yazıyor;
   ikisi tek kontrolde birleştirilseydi "kapattım ama hâlâ yanlış saatte"
   şikâyeti kaçınılmazdı.
2. **Form tek tanım, iki yer.** Yeni hatırlatıcı listenin altında, düzenleme
   listenin **üstünde** açılır; altta açılsaydı çok hatırlatıcısı olan
   kullanıcıda ekran dışında kalırdı (`tasks` modülünde aynı karar).
3. **Forma tüm alanlar yüklenir.** Yalnızca başlığı taşıyıp gerisini
   varsayılanda bırakmak, kullanıcı sadece saati değiştirse bile haftalık bir
   hatırlatıcıyı sessizce günlüğe çevirirdi — §22.0'daki `.default()` tuzağının
   arayüzdeki karşılığı.

Açıklama alanında kural düzenlemede **tersine çevriliyor**: oluştururken
yalnızca etkinlikte ve doluysa gönderiliyor, düzenlerken açıkça `null`
gidiyor. Kısmi güncellemede "gönderilmedi" demek "dokunma" demek; aksi hâlde
kullanıcı açıklamayı silse ya da kategoriyi etkinlikten çıkarsa sunucudaki
eski metin olduğu yerde kalırdı.

Kaydetme `onReminderSaved` ile bitiyor: eski bildirimler iptal edilip
yenileri kuruluyor ve takvim etkinliği **güncelleniyor** — ikinci bir etkinlik
açılmıyor. Silmede önce takvim kaydı kaldırılıyor (`onReminderClosed(r, false)`),
çünkü silinmiş bir hatırlatıcının `device_alarm_ids` alanını güncellemek `404`
verirdi.

#### 22.6.1 Sessiz saatler (`quiet_hours`)

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET/POST | `/babies/{id}/quiet-hours` | viewer / editor |
| PUT/DELETE | `/quiet-hours/{id}` | editor¹ |

Tablo 005 numaralı göçten beri vardı ama **hiçbir uç onu okumuyordu**:
hatırlatıcılardaki `respect_quiet_hours` bayrağı her zaman boş bir kümeye
bakıyor, yani hiçbir etkisi olmuyordu. Uçlar bu nedenle sonradan eklendi.

- `days_mask` bit maskesidir: **bit 0 = Pazartesi** … bit 6 = Pazar, 127 = her
  gün. JS `getDay()` 0=Pazar olduğu için kaydırma gerekir ve bu dönüşüm
  istemcide tek bir yerde (`dayBit`) yapılır.
- `start_time > end_time` geçerlidir ve gece yarısını aşan pencere demektir
  (`22:00–07:00`). Eşit uçlar `422` ile reddedilir — sıfır uzunlukta aralık
  sessizce hiçbir şey yapmazdı.
- Gün maskesi her zaman pencerenin **başladığı** güne göre değerlendirilir:
  Pazartesi gecesi tanımlı bir `22:00–07:00` penceresi Salı 02:00'ı kapsar ama
  Pazartesi 02:00'ı kapsamaz.

#### 22.6.2 Cihazda planlama

`expo-notifications` yereldir; `enableRemoteNotifications: false` ile APNs
yetkilendirmesi hiç istenmez ve FCM kurulumu gerekmez. Android'de kanal
(`reminders`) **izin isteminden önce** oluşturulur: Android 13+ üzerinde kanal
yoksa istem hiç görünmez.

Planlayıcı iki biçimden birini seçer:

| Durum | Tetikleyici | Sonuç |
|-------|-------------|-------|
| Sessiz saat devrede değil | `DAILY` / `TIME_INTERVAL`, `repeats: true` | İşletim sistemi süresiz tekrarlar; uygulama hiç açılmasa da çalar |
| Sessiz saat devrede | `DATE` (her tekrar tek tek) | `days_mask` ve `quiet_behavior` tam uygulanır |

Tekrar eden bir tetikleyici güne göre değişemediği için sessiz saat devredeyken
kullanılamaz. Açık tarihli planlamanın bedeli **7 günlük ufuktur**: uygulama bu
süre boyunca hiç açılmazsa alarmlar tükenir. Uygulama her ön plana geldiğinde
(`refreshAll`, §9.2) yeniden planlandığı için pratikte sorun olmaz — ebeveyn
gün içinde zaten kayıt giriyor.

`quiet_behavior` üç değer alır: `postpone` (pencerenin bitişine ötele; zincirli
pencereler tek seferde aşılır), `silent` (sessiz göster), `skip` (hiç gösterme).

İki sınır bilinçlidir:

- **56 bildirim üst sınırı.** iOS bekleyen bildirimleri 64'te kesip fazlasını
  *sessizce* atar. En yakın zamanlılar korunacak şekilde kendimiz kırpar ve
  kırpılan sayıyı ekranda gösteririz; aksi hâlde hangi alarmın düştüğü
  belirsiz kalırdı.
- **Yalnızca kendi kayıtlarımız iptal edilir.** `cancelAllScheduledNotifications`
  yerine `data.kind === 'reminder'` filtresi kullanılır; ileride başka bir
  özellik bildirim planlarsa onu silmemek için.

`anchor: 'last_record'` yaklaşık uygulanır: başlangıç noktası sunucunun
hesapladığı `next_trigger_at`, yoksa "şimdi + aralık"tır. Kayıt girildikten
sonraki ilk eşitleme doğru noktaya taşır.

**Tam zamanlı alarm (`SCHEDULE_EXACT_ALARM`) istenmez.** Android 14 bu izni
yeni kurulumlarda varsayılan olarak reddeder ve Google Play yalnızca alarm/
takvim uygulamalarına açar. Besleme hatırlatıcısı için `bestEffort` teslim
yeterlidir; bedeli, alarmın birkaç dakika kayabilmesidir.

### 22.7 Modül 9 — Günlük Akış (`timeline`)

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET | `/babies/{id}/timeline` | viewer |

Parametreler: `date`, `tz_offset_min`, `page` (≥1), `limit` (1–100, varsayılan 20),
`categories` (virgüllü: `feeding,sleep,diaper,music,notification`).

```jsonc
{
  "date": "2026-11-02", "page": 1, "limit": 20, "has_more": true,
  "categories": ["diaper"],
  "summary": { "feeding_count": 5, "breastfeeding_sec": 1800, "bottle_ml": 240 },
  "entries": [{
    "kind": "diaper", "ref_id": 88, "subtype": "cis",
    "started_at": "2026-11-02T09:00:00.000Z", "duration_sec": null, "amount_ml": null,
    "actor": { "user_id": 4, "name": "Mehmet", "relationship": "baba",
               "display": "Baba Mehmet", "is_me": false }
  }]
}
```

`has_more`, limitten **bir fazla satır** istenerek üretilir; ayrı bir `COUNT`
sorgusu çalıştırmadan sonraki sayfanın varlığını bildirmenin ucuz yolu.
Geçersiz kategori `422` döner. `summary` sayfalanmış değil **dönen sayfayı**
anlatır; tam gün özeti için `/reports/daily` kullanılır.

### 22.7.1 Verileri sıfırla

| Metod | Yol | Gerekli |
|-------|-----|---------|
| DELETE | `/babies/{id}/data` | **owner** |

Bebeğe ait tüm kayıtları **kalıcı** siler; profil, fotoğraf ve aile üyeleri
kalır. Profil silme (`DELETE /babies/{id}`) ayrı bir işlemdir ve o yumuşak
silme kullanır.

Üç karar:

1. **Yumuşak silme değil, gerçek silme.** Kullanıcı "verilerimi sıfırla"
   dediğinde verinin tabloda durmaya devam etmesini beklemiyor. Raporlar zaten
   `deleted_at IS NULL` süzdüğü için ekranda fark edilmeyen ama veritabanında
   duran bir yığın kalırdı.
2. **Yalnızca owner.** Paylaşılan bir bebekte düzenleyici bir üyenin tüm
   geçmişi silebilmesi, geri alınamaz bir işlemi yanlış kişiye vermek olurdu.
3. **Silme sırası elle yazıldı** (`RESET_STEPS`), cascade'e güvenilmedi.
   Yabancı anahtarların bir kısmı `ON DELETE CASCADE` ama hepsi değil; sıraya
   güvenmek, şemaya ileride cascade'siz bir FK eklendiğinde sıfırlamanın yarıda
   `1451` ile patlaması demekti. Emzirme segmentleri seans üzerinden, seanslar
   besleme üzerinden bağlı olduğu için bazı adımlar `JOIN`'li siliyor.

`activity_log` en sonda siliniyor ve **sıfırlama kaydı ondan sonra** yazılıyor:
"kim ne zaman sıfırladı" izi geriye kalsın. Yanıt hangi tablodan kaç satır
silindiğini döndürür.

Mobilde düğme **Ayarlar ekranının en altında** (`ResetDataSheet`): geri
alınamaz bir işlem, ayarların tepesinde yanlışlıkla dokunulabilecek bir yerde
olmamalı. Düğme hiçbir şey silmez, onay penceresini açar; pencere neyin
silineceğini madde madde, neyin **kalacağını** ayrıca yazar. Birden fazla
bebeğin sahibiyse hangisinin verisinin silineceği sorulur — tek bebekte
seçtirmek karar içermeyen fazladan bir adım olurdu. Sıfırlamadan sonra canlı
sayaç bildirimleri de kaldırılır; yoksa kilit ekranında artık var olmayan bir
seans görünmeye devam ederdi.

### 22.8 Modül 11 — Raporlar (`reports`)

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET | `/babies/{id}/reports/daily?date=` | viewer |
| GET | `/babies/{id}/reports/summary?period=…` **+ `start_date` / `end_date`** | viewer |
| GET | `/babies/{id}/reports/trends?metric=…&days=` **+ `start_date` / `end_date`** | viewer |

#### Serbest tarih aralığı

Her iki uç da `start_date` + `end_date` (`YYYY-AA-GG`, **bitiş günü dâhil**)
kabul eder. İkisi birlikte gelmeli: yalnızca başlangıcı gönderip bitişi açık
bırakmak "bugüne kadar" mı "tek gün" mü, belirsiz. Eksik gelirse alanlar yok
sayılır ve eski `period`/`days` davranışı sürer — güncellenmemiş istemciler
çalışmaya devam eder.

Pencere çözümü **tek yerde**: `services/reportSummary.ts` → `resolveRange()`.
Özet ve eğilim aynı işlevi çağırır; iki ayrı hesap olsaydı ekranın üstündeki
toplamlar altındaki sütunlarla uyuşmazdı.

| Kip | Pencere |
|-----|---------|
| `start_date` + `end_date` | Seçilen günler, **bitiş dâhil** |
| Yalnızca `period` / `days` | Bugünün yerel gün sınırından geriye **tam günler** (bugünün yarım günü sayılmaz) |

Yanıt çözülmüş pencereyi `start_date` / `end_date` / `days` olarak **geri
döndürür**: ekrandaki başlık sunucunun gerçekten hesapladığı aralığı yazsın,
istemcide ikinci bir hesap olmasın.

**Tavan 92 gün** (`MAX_RANGE_DAYS`). Aynı pencere hem özeti hem gün gün seriyi
besliyor; sınırsız bırakılsaydı tek istek binlerce elemanlı bir seri döndürür
ve grafikte okunabilir bir şey kalmazdı. Aşıldığında ya da bitiş başlangıçtan
önce olduğunda `422`.

Mobilde ekranın **en üstünde** iki `DateField` ve hızlı aralık çipleri (Bugün ·
Son 7 · Son 30 · Son 90 gün) var; çipler ayrı bir kip değil, tarih kutularını
dolduruyorlar. Önceden dönem çipi ile grafik gün sayısı ayrı ayrı
değişebiliyordu: üstteki özet "son 7 gün", alttaki grafik "son 30 gün"
olabiliyordu. Artık tek pencere var. Geçersiz aralıkta istek **atılmaz**;
sunucu zaten reddederdi ve kullanıcı tarihleri düzeltene kadar her dokunuşta
hata kutusu görürdü.

Pencere, cihazın yerel gün sınırından geriye doğru **tam günler** alınır:
"son 7 gün" dendiğinde bugünün yarım günü sayılmaz, aksi hâlde günlük ortalama
sabah her bakıldığında düşük görünürdü.

```jsonc
// GET /babies/3/reports/trends?metric=sleep&days=7
{ "metric": "sleep", "days": 7, "series": [
  { "date": "2026-10-27", "night_sec": 32400, "nap_sec": 5400, "total_sec": 37800 },
  { "date": "2026-10-28", "night_sec": 0,     "nap_sec": 0,    "total_sec": 0 }
]}
```

Veri **olmayan günler de sıfırla** döner; yalnızca dolu günleri göndermek
grafikte boşlukları görünmez kılar ve "her gün uyumuş" izlenimi verirdi.

> **PDF dışa aktarma yapılmadı.** Sunucuda PDF üretimi yeni bir bağımlılık
> (puppeteer/pdfkit) ve şablon tasarımı gerektirir; şartnamede rapor şablonunun
> içeriği tanımlı değil. Bkz. `modules_doc/NOTLAR-ve-EKSIKLER.md` §4.

### 22.9 Modül 12 — Süt Sağma (`pumping`)

Yeni tablo: `pumping_sessions`.

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET/POST | `/babies/{id}/pumping` | viewer / editor |
| GET | `/babies/{id}/pumping/stash` | viewer |
| PATCH | `/pumping/{id}/use` | editor¹ |
| PUT/DELETE | `/pumping/{id}` | editor¹ |

Miktarlar **ml** saklanır (oz yalnızca gösterimde çevrilir); tek kanonik birim
olmasaydı stok toplamı iki birimin karışımı olurdu. `total_amount_ml`
saklanmaz, `left + right` olarak okunurken hesaplanır.

```jsonc
// GET /babies/3/pumping/stash
{ "fridge":  { "amount_ml": 50,  "session_count": 1 },
  "freezer": { "amount_ml": 140, "session_count": 1 },
  "total_available_ml": 190 }
```

`storage_location='used_immediately'` olan kayıtlar **stoğa hiç girmez** ve
oluşturulurken `is_used=1` işaretlenir. Sol ve sağ miktarın ikisi de boşsa
kayıt `422` ile reddedilir.

¹ `editor` yalnızca **kendi girdiği** kaydı değiştirebilir; `owner` hepsini.
Aksi hâlde `404` döner (varlık sızdırılmaz, §5.5).

### 22.10 Modül 10 — Aile ve Yetkiler (`family`)

Veri modeli, yetki seviyeleri ve davet akışı **§5**'te tanımlıdır; bu bölüm
yalnızca modülün mobil yüzünü ve sonradan fark edilen boşlukları toplar.

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET | `/babies/{id}/members` | viewer |
| PUT/DELETE | `/babies/{id}/members/{userId}` | owner |
| DELETE | `/babies/{id}/members/me` | viewer (sahip hariç) |
| POST | `/babies/{id}/transfer-ownership` | owner |
| GET/POST | `/babies/{id}/invitations` | owner |
| DELETE | `/babies/{id}/invitations/{invitationId}` | owner |
| GET | `/invitations/mine` | oturum |
| POST | `/invitations/accept` · `/invitations/decline` | oturum |

Backend bu uçlarla **zaten hazırdı**; eksik olan yalnızca arayüzdü. Modülün
şartnamesi de depoda yanlış içerikle duruyordu (`aisle-ve-yetkiler.md`,
`uyku-takibi.md`'nin birebir kopyasıydı) ve mobil modül kataloğunda `family`
anahtarı **hiç yoktu** — `useModuleStore` sunucu katalogundaki bu anahtarı
"bilinmeyen" sayıp atıyordu. Katalog girdisi eklenirken `sortOrder` değerleri
de sunucuyla hizalandı; güncel sıra sunucudaki `modules.sort_order`'dır
(`pumping` 7, `family` 11, `reports` 12, `tasks` 13).

Ekranda üç karar:

1. **Davet kodu bir kez gösterilir.** Düz kod yalnızca `POST .../invitations`
   yanıtında döner; veritabanında `code_hash` saklanır. Bu yüzden kod
   oluşturulduğu anda kart hâlinde gösterilir ve paylaşma düğmesi sunulur.
   Ekran yenilenirse kod geri gelmez — bu bilinçlidir, kod bir sırdır.
2. **Yönetim kontrolleri sahip değilse hiç çizilmez.** Gizlemek güvenlik
   değildir; asıl engel `requireBaby('owner')`'dadır. Amaç kullanıcıya kesin
   reddedilecek bir düğme sunmamaktır.
3. **Ayrılma ve davet kabulü bebek listesini tazeler** (`refreshAll`): aksi
   hâlde artık erişimi olmayan bir bebek seçili kalır ya da yeni katılınan
   bebek listede görünmezdi.

"Bana gelen davetler" bölümü bebek seçili olmasa da gösterilir — hiç bebeği
olmayan yeni bir kullanıcının sisteme giriş yolu tam olarak budur.

### 22.11 Modül 13 — Görevler (`tasks`)

Şartname: `modules_doc/gorevler.md`.

Aileden birine **somut bir iş** atar: *"150 ml mama hazırla — 5 ölçek, 90 ml
sıcak + 60 ml soğuk su."* Hatırlatıcıdan (§22.6) farkı, hatırlatıcının cihaza
bir alarm kurması, görevin ise bir **kişiye** atanması ve bir **durum**
taşımasıdır: kim üstlendi, bitti mi, kim bitirdi.

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET | `/babies/{id}/tasks` | viewer |
| POST | `/babies/{id}/tasks` | editor |
| GET | `/tasks/{taskId}` | viewer (üyelik) |
| PUT | `/tasks/{taskId}` | editor |
| PATCH | `/tasks/{taskId}/status` | editor |
| DELETE | `/tasks/{taskId}` | editor |

Liste süzgeçleri: `status=pending,in_progress` (virgülle çoğul, enum
doğrulamalı), `assigned=me`, `date=YYYY-AA-GG` (+ `tz_offset_min`), `limit`.
Sıralama `FIELD(status,'in_progress','pending','completed','cancelled')` sonra
`due_time` — başlanmış iş listenin tepesinde durur.

#### Tarif neden JSON sütunda

`instruction_details` bir JSON sütunudur. Alanlar görev tipine göre **tamamen**
değişiyor (mamada ölçek ve su, süt vermede stok kimliği, ilaçta doz); her biri
ayrı sütun olsaydı tablonun çoğu her satırda NULL kalırdı. Doğrulama tipe göre
uygulama katmanında yapılır ve **bilinmeyen alanlar elenir** — istemci ne
gönderirse göndersin sütuna yalnızca tanımlı alanlar yazılır.

Tipe göre şemalar:

- `formula_prep` → `formula_amount_ml` (zorunlu), `formula_scoops`,
  `hot_water_ml`, `cold_water_ml`, `special_notes`
- `breast_milk_feed` → `pumping_stash_id`, `formula_amount_ml`, `special_notes`
- `medicine` / `care` / `custom` → `dose`, `special_notes`

#### Dört doğrulama kuralı

1. **Mama görevinde tarif zorunlu.** Tarifsiz bir "mama hazırla" görevi
   bakıcıya hiçbir şey söylemez; 400 ile reddedilir.
2. **Su, toplam hacmi aşamaz.** Mama tozu da hacim kapladığı için su her zaman
   son hacimden azdır. Bu kontrol en sık yazım hatasını (90 yerine 900)
   yakalar.
3. **Atanan kişi aile üyesi olmalı** (`baby_members … is_active = 1`).
4. **Sağılmış süt kaydı** aynı bebeğe ait, silinmemiş ve `is_used = 0`
   olmalıdır — kullanılmış stoğu yeniden atamak sessiz bir veri hatası olurdu.

#### Tamamlanınca kayda dönüşme

`PATCH /tasks/{id}/status` gövdesinde `create_record: true` gelirse, tamamlanan
mama/süt görevi bir **beslenme kaydına** dönüştürülür (`bottle_formula` ya da
`bottle_breastmilk`, `note` alanında `Görevden: <başlık>`), ve süt görevinde
`pumping_sessions.is_used = 1` yapılır. Görev zaten "ne kadar verilecek"
bilgisini taşıdığı için aynı veriyi ikinci kez girmek gereksizdir.

Varsayılan **kapalıdır**. Her tamamlamada sessizce kayıt üretmek, görevi
yalnızca "yapıldı" diye işaretlemek isteyen kullanıcıyı şaşırtırdı; mobil taraf
bu yüzden üç seçenekli bir soru sorar: *Kayıt da oluştur · Yalnızca görevi
bitir · Vazgeç*. Soru yalnızca miktar bilgisi taşıyan görevlerde çıkar
(`canBecomeRecord()`); miktarsız bir "süt ver" görevi kayda dönüşemez.

#### §22.0 tuzağı burada da çıktı

`PUT /tasks/{id}` şeması `taskSchema.partial()` ile türetiliyordu. zod'da
`.default(...)` değerleri `.partial()` uygulandıktan **sonra** da çalıştığı
için, yalnızca başlığı güncelleyen bir istek `task_type`'ı sessizce `custom`'a
düşürüyordu — tarif duruyor ama görev artık mama görevi değil. Varsayılanı olan
her alan (`task_type`, `tz_offset_min`) güncelleme şemasında varsayılansız
`optional()` ile ezildi. Aynı tuzak §22.0'da tüm modüller için anlatılıyor;
**yeni modül eklerken ilk bakılacak yer burasıdır.**

#### Mobil taraf

- `src/modules/tasks/taskFormat.ts` — React'siz saf sunum mantığı: tip
  etiketleri/simgeleri, `num()` (gereksiz ondalığı kırpar), `recipeLine()`,
  `isOverdue()`, `canBecomeRecord()`. Düz Node ile koşulabildiği için
  `scratchpad/task_format_test.mjs` bunu 25 durumla doğruluyor.
- `recipeLine()` tarifi tek satırda, bakıcının uygulayacağı sırada kurar:
  *"150 ml • 5 ölçek mama • 90 ml sıcak + 60 ml soğuk su"*. Eksik alanlar
  **atlanır** — yerlerine "0" yazmak bakıcıyı yanıltırdı.
- `TasksScreen.tsx` — açık/tamamlanan süzgeci, görev kartı (simge, saat, tip,
  atanan kişi, durum rozeti, "Gecikti" rozeti, modül renginde belirgin tarif
  şeridi), tamamlama ve silme, oluşturma formu. Kart üstündeki tarif şeridi
  modülün asıl ürünüdür: bakıcının ihtiyacı olan tek şey o satırdır.
- Ana ekranda **"Bugünün Görevleri"** bölümü, en çok 3 görev ve `+N görev daha`
  bağlantısı. Yalnızca `tasks` modülü açıkken ve o gün görev varken çizilir.
- Form alanları kayıttan sonra tamamen sıfırlanmaz: tip, atanan kişi, tarih ve
  miktarlar **yerinde kalır**; arka arkaya benzer görev açmak olağan durumdur.
- Not alanının ipucu metni tipe göre değişir (`NOTE_PLACEHOLDER`); mama
  tarifine ait "önce sıcak suyu koy" ipucu bir banyo görevinde yanıltıcıydı.
- Katalogda `tasks` simgesi ✅'dir: ızgarada `timeline` ile aynı 📋 simgesini
  kullanınca iki kutu ayırt edilemiyordu.

#### Görevi sonradan düzenleme

Görevi açan kişi onu değiştirmek ister: mamanın saati kayar, miktar artar, iş
başka birine devredilir. Silip yeniden açmak bu işi görmez — görevin kimliği
(`sync_uuid`), denetim izi ve atanan kişinin bekleyen bildirimleri kaybolurdu.

`PUT /tasks/{id}` kısmi günceller. Kurallar:

1. **Kapanmış görevin içeriği değiştirilemez.** `completed` / `cancelled`
   durumdaki bir göreve içerik alanı gönderilirse `422` (projede doğrulama
   hataları `BadRequest` → 422 dönüyor). Tamamlanmış görevin tarifini
   değiştirmek denetim izini yalan yapardı: "150 ml mama verildi"
   kaydı dururken görev 200 ml'ye dönerdi. Yeniden düzenlemek isteyen önce
   `PATCH …/status` ile görevi açar.
   `device_alarm_ids` bu kısıtın **dışında**: görev kapandığında mobil taraf
   takvim kaydını siler ve kalan kimlikleri yine bu uçla yazıyor
   (`onTaskClosed`). Engellenseydi kapanan her görev telefonun takviminde
   asılı kalırdı.
2. **Değişiklik bildirilir.** Başlık, zaman, tarif, not ya da atama değiştiyse
   bildirim gider: devredildiyse yalnızca yeni kişiye *"Sana görev atandı"*,
   diğer düzenlemelerde atanan kişiye ve görevi açana *"Görev güncellendi"*.
   Atanmamış görevde hedef daraltılmaz — aileden herkes üstlenebilir, herkes
   bilmeli. Saati kayan bir görevi eski saatinde bekleyen kişi haber almazsa
   işi yanlış zamanda yapar.
3. **Denetim izine fark yazılır** (`activity_log.changes`, `diff()`): "görev
   güncellendi" tek başına saatin mi kaydığını yoksa işin mi devredildiğini
   söylemiyordu.
4. **Yalnızca takvim kimliği yazıldıysa iz tutulmaz.** Mobil taraf her
   kayıttan sonra `device_alarm_ids` için ikinci bir `PUT` yapıyor
   (`taskAlarms.ts`); sayılsaydı akışta tek bir düzenleme iki satır olurdu.

Yetki **bilerek** `editor` seviyesinde kaldı, "yalnızca oluşturan" değil:
atanan kişinin cihazı kendi takvim kaydının kimliğini bu uçla yazıyor.
Oluşturana kısıtlansaydı eşin telefonu kendi alarmını kaydedemezdi.

Mobil taraf:

- **"Düzenle" yalnızca görevi açana** çıkar (`task.creator.user_id`); atanan
  kişinin işi görevi yapmak, kapsamını değiştirmek değil. Kısıt arayüzün
  kararı, sunucunun değil.
- **Aşı görevi dışarıda**: o, randevunun kopyasıdır
  (`vaccines.assigned_task_id`) ve saatini görev ekranından değiştirmek
  görevi randevudan ayırırdı. Aşı Takibi ekranından düzenlenir.
- Form **tek yerde** tanımlı, iki yerde çizilir: yeni görev listenin altında,
  düzenleme listenin **üstünde**. Düzenleme de altta açılsaydı uzun bir
  listede ekranın dışında kalır, düğme hiçbir şey yapmamış gibi görünürdü.
- Forma **tüm** alanlar yüklenir. Yalnızca başlığı taşıyıp gerisini
  varsayılanda bırakmak, kullanıcı sadece saati değiştirse bile tarifi
  sessizce "150 ml / 5 ölçek"e döndürürdü.
- Formda karşılığı olmayan alanlar (`special_notes`, `pumping_stash_id`)
  düzenlemede **korunur**; tür değişmişse taşınmaz, çünkü yeni türün şeması
  başka.
- Seçenek listesinde olmayan bir bildirim ofseti de korunur: görev başka bir
  istemciden gelmiş olabilir ve kaydetmek onu sessizce silerdi.
- Kaydetme `onTaskSaved` ile biter: eski bildirimler iptal edilir, yenileri
  kurulur, takvim kaydı **güncellenir** — ikinci bir etkinlik açılmaz.

Uçtan uca takım: `scratchpad/tasks_e2e.sh` — 32 doğrulama.

### 22.12 Modül 14 — Aşı Takibi (`vaccines`)

Şartname: `modules_doc/asilar.md`. Göç: `migrations/015_vaccines.sql`.

Bebek oluşturulduğu anda T.C. Sağlık Bakanlığı Çocukluk Dönemi Aşı Takvimi
doğum tarihine göre hesaplanıp yazılır; ebeveynin ilk gün yapacağı iş 20 aşı
tarihini elle girmek olmamalı.

> **Tıbbi uyarı.** Tohum verisi bilgilendirme amaçlıdır, hekim yerine geçmez.
> Hiçbir doz otomatik "yapıldı" sayılmaz; hepsi *planlanan* olarak başlar ve
> ebeveyn hekimiyle doğrulayıp işaretler.

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET | `/babies/{id}/vaccines` | viewer |
| POST | `/babies/{id}/vaccines` | editor |
| GET | `/vaccines/library` | auth |
| GET | `/vaccines/{vaccineId}` | viewer (üyelik) |
| POST | `/vaccines/{vaccineId}/schedule` | editor |
| PATCH | `/vaccines/{vaccineId}/complete` | editor |
| PATCH | `/vaccines/{vaccineId}/status` | editor |
| PUT | `/vaccines/{vaccineId}` | editor |
| DELETE | `/vaccines/{vaccineId}` | editor |

#### İki tablo, iki sorumluluk

`vaccine_definitions` **sistem kütüphanesi**: ad, kategori
(`mandatory` / `optional` / `custom`), `target_month`, `dose_number`,
`description`. Bebeğe bağlı değil — *"2. ayın sonunda DaBT-İPA-Hib 1. doz"*
bilgisi her bebekte aynıdır. Her bebeğin satırına kopyalansaydı takvim
güncellendiğinde hiçbir yeri düzeltmek mümkün olmazdı.

`baby_vaccines` **bebeğin takvimi**: `planned_date`, `planned_time`,
`location`, `assigned_task_id`, `completed_date`, `doctor_name`,
`side_effects`, `notification_offsets`, `device_alarm_ids`,
`enable_device_alarm`.

Tanımların insan okunur bir `code` alanı var (`hepb_1`, `dabt_r`, `rota_2`…).
Tohum verisi her göçte yeniden uygulanabilsin diye (`ON DUPLICATE KEY`) bir
kararlı benzersiz alan gerekiyordu; ad kullanmak riskliydi — `DaBT-İPA-Hib`
yazımı değişirse aynı aşı ikinci kez eklenirdi.

Tohum: **20 zorunlu** (0 · 1 · 2 · 4 · 6 · 12 · 18 · 24 · 48 · 72 · 156. ay)
ve **10 opsiyonel** (Rotavirüs ×3, Meningokok B ×3, Meningokok ACWY, Grip,
Suçiçeği 2. doz, HPV) tanım. Opsiyoneller **otomatik planlanmaz**: hepsini
hazır listelemek "bunlar da zorunlu" izlenimi verirdi.

#### Durum türetilir, saklanmaz

ENUM beş değer taşır (`pending`, `upcoming`, `completed`, `delayed`,
`skipped`) ama sütuna yalnızca üçü yazılır: kullanıcının kararı. **"Yaklaşıyor"
ve "gecikti" ekranda hesaplanır** (`modules/vaccines/vaccineFormat.ts`).

Sunucuda hesaplanması için her gece çalışan bir iş gerekirdi ve iş çalışmadığı
gün ekran yanlış gösterirdi. Üstelik "bugün" cihazın saat diliminde anlamlı,
sunucunun UTC'sinde değil: 23:30'da bakan bir ebeveyn sunucuya göre "yarın"da
olurdu. ENUM gene de tam tutuldu — şartname bu değerleri sayıyor ve ileride
gerçekten saklanmak istenirse şema değişmesin.

#### Randevu saati ayrı sütun

`planned_date` bir **gün**, `planned_time` isteğe bağlı bir **saat**. Tek bir
DATETIME kullanılsaydı saati bilinmeyen her aşıya uydurma bir saat (00:00)
yazmak ve onu gerçek bir randevudan ayırt edememek gerekirdi. Alarmlar
istemcide gün + saat birleşiminden kurulur; saat yoksa **09:00** varsayılır
(sağlık ocağı açılışı) — 00:00 varsayımı uyarıyı bir gün önce çalardı.

#### Bildirim penceresi: 7 gün / 2 gün / 1 gün

Varsayılan `notification_offsets` = `[10080, 2880, 1440]` dakika. Görev ve
hatırlatıcının dakikalık penceresi (`[30,15,5,0]`) burada işe yaramaz: randevu
haftalar öncesinden planlanıyor ve ebeveynin izin/iş ayarlaması için erken
uyarıya ihtiyacı var. "15 dakika kaldı" uyarısı o noktada hiçbir şeyi
değiştirmez.

Bu yüzden `lib/alarms.ts` içindeki ofset tavanı **parametre** oldu
(`offsetsSchemaUpTo(maxMin)`): görev/hatırlatıcı 1440'ta kalır, aşı 40320'ye
(dört hafta) çıkar. Tek bir sabit kullanılsaydı ya aşıda doğrulama patlardı ya
da görevde "üç hafta önce uyar" gibi anlamsız bir değer sessizce kabul
edilirdi.

#### Görev atama — ayrı kayıt, gömülü alan değil

`POST /vaccines/{id}/schedule` gövdesinde `assign_task: true` gelirse `tasks`
tablosuna `task_type = 'vaccine'` bir satır açılır (başlık:
*"Aşı: KKK (1. doz)"*) ve kimliği `baby_vaccines.assigned_task_id`'ye yazılır.
Görev tipi ENUM'u bu göçte genişletildi.

Atamayı aşı satırına gömmek (`assigned_user_id` sütunu) daha az iş gibi
duruyordu ama kişiye atanmış bir işin **durumu**, **kim bitirdi** bilgisi ve
**kendi bildirimleri** var — hepsi görevler modülünde (§22.11) zaten çözülmüş.
İkinci bir atama mekanizması, iki yerde iki farklı "kime atandı" mantığı
demekti.

Yaşam döngüsü tek yönden yürür — **aşı asıl kayıt, görev ona bağlı**:

| Aşıda olan | Göreve yapılan |
|------------|----------------|
| Randevu güncellendi, atama sürüyor | Var olan görev güncellenir (yeni görev **açılmaz**) |
| Atama kaldırıldı (`assign_task: false`) | Görev `cancelled`; **silinmez** |
| Aşı `completed` | Görev `completed` + `completed_by` |
| Aşı `skipped` | Görev `cancelled` |
| Aşı `pending`'e geri alındı | Görev `pending`, tamamlama bilgileri temizlenir |
| Aşı silindi | Görev `cancelled` |

Her randevu değişikliğinde yeni görev açmak, bakıcının listesinde aynı aşı için
üç kayıt bırakırdı. Atama kaldırıldığında silmek yerine iptal etmek de
bilinçli: bakıcı listesinde *"Aşı: KKK"* gördükten sonra kaydın sessizce yok
olması işin yapılıp yapılmadığını belirsiz bırakırdı.

#### Doğum tarihi düzeltilince plan kayar

`PUT /babies/{id}` ile `birth_date` değişirse `reschedulePending()` tüm zorunlu
aşıları yeniden hesaplar. Yanlış tarihle kaydedilmiş bir bebeğin 20 aşı
tarihini elle değiştirmesini istemek özelliği kullanılmaz kılardı.

**Yalnızca dokunulmamış satırlar kayar:** `status = 'pending'`, `location`
NULL, `planned_time` NULL ve `assigned_task_id` NULL olanlar. Ebeveyn bir aşı
için gün/saat/yer ayarladıysa o artık onun kararıdır; doğum tarihi düzeltmesi
randevuyu kaydırmamalı.

#### Diğer tasarım kararları

- **`uq_bv_definition (baby_id, vaccine_definition_id)`** — aynı tanım iki kez
  planlanmaz, böylece otomatik kurulum `INSERT IGNORE` ile yeniden
  çalıştırılabilir (göçteki geriye dönük dolum ile aynı satırları hedefliyor).
  Özel aşıda tanım NULL olduğu için kısıt devreye girmez — MySQL'de NULL
  değerler UNIQUE'i tetiklemez. İstenen de bu: *"Grip aşısı"* her yıl yeniden
  girilir.
- **Kategori süzgecinde `custom` ayrıca sorulur.** Özel aşının tanım satırı
  olmadığı için `d.category` NULL'dur ve `IN (…)` NULL ile hiç eşleşmez;
  `bv.vaccine_definition_id IS NULL` koşulu eklenmeseydi "Diğer / Manuel"
  sekmesi her zaman boş görünürdü.
- **Tanım silinirse kayıt kalır** (`ON DELETE SET NULL`): yapılmış bir aşının
  kaydı kütüphane temizliğiyle kaybolmamalı. Ad `custom_vaccine_name`'den
  okunur, kategori `custom`'a düşer.
- **Ulusal takvimdeki aşının adı kilitli.** `PUT` ile
  `custom_vaccine_name` göndermek 422 döner; sessizce yok saymak, kullanıcının
  değişikliğin uygulandığını sanmasına yol açardı.
- **`side_effects` beyaz listeye alınır** (`fever`, `swelling`, `redness`,
  `irritability`, `note`). İstemci ne gönderirse göndersin JSON sütununa
  yalnızca bunlar yazılır; aksi hâlde sütun hiç okunmayan alanlarla şişer ve
  ekranın ne beklediği belirsizleşirdi.
- **Geriye dönük dolum geçmiş dozları da planlar** ve bunlar "gecikti"
  görünür. Bu "hiç yapılmamış" demek değil, "uygulamaya girilmemiş" demek;
  ebeveyn tek dokunuşla işaretleyebiliyor. Geçmişi hiç göstermemek, aşı
  kartını uygulamaya taşıma imkanını tamamen kapatırdı.

#### Mobil taraf

- `src/modules/vaccines/vaccineFormat.ts` — React'siz saf sunum mantığı:
  `effectiveStatus()` (planlanan tarih + bugün → `upcoming` / `delayed`),
  `statusLabel()`, `daysUntil()`, `whenLabel()`, `ageLabel()` (ay →
  *"2. ayın sonu"* / *"4 yaş"*), `vaccineInstant()` (gün + saat → alarm anı),
  `groupByMonth()`. Düz Node ile koşulabildiği için
  `scratchpad/vaccine_format_test.mjs` bunu doğruluyor.
- `VaccinesScreen.tsx` — üç sekme (**Ulusal Aşı Takvimi · Özel Aşılar ·
  Diğer / Manuel**), aya göre gruplanmış kartlar, durum rozeti, randevu/görev
  atama formu ve manuel aşı ekleme formu.
- `vaccineAlarms.ts` — `onVaccineSaved()` / `onVaccineClosed()`:
  `taskAlarms.ts` kalıbının aşı karşılığı. Yerel bildirim (`vaccines` kanalı)
  + cihaz takvimi etkinliği birlikte kurulur.
- Aşı bildirimi **kendi Android kanalında** (`vaccines`): kanal, kullanıcının
  ses/öncelik ayarı yaptığı birimdir ve oluşturulduktan sonra önemi uygulama
  tarafından değiştirilemez. Görevlerle aynı kanalı paylaşsaydı "görevleri
  sustur ama aşıyı duy" ayarı mümkün olmazdı.

#### Bildirim ufku — emülatörde çıkan bütçe sorunu

Aşı takvimi 13 yıla uzanıyor ve her doz üç uyarı istiyor. İlk sürümde ufuk
yoktu: tek bir bebek **39** bildirim kuruyordu (emülatörde ölçüldü) ve
`MAX_SCHEDULED` bütçesinin (56) neredeyse tamamını yiyip hatırlatıcılarla
görevleri dışarı itiyordu. Oysa 2039'daki Td rapelinin uyarısını bugün kurmanın
hiçbir faydası yok — iOS zaten bekleyen bildirimleri 64'te kesiyor.

`VACCINE_HORIZON_DAYS = 120` eklendi: bu pencerenin ötesine düşen uyarılar
planlanmıyor. 120 gün takvimdeki en seyrek aralığı (2–6 ay) kapsıyor, yani her
zaman en az bir sonraki doz planda. Uygulama her ön plana gelişte yeniden
eşitlendiği için uzaktakiler zamanı gelince ekleniyor. Ölçüm 39 → **9**.

Atlanan uyarılar `trimmed` sayılmaz: kırpılmış değil, henüz sırası gelmemiş
alarmlardır. Hatırlatıcılar ekranındaki durum kartı artık görev ve aşı
uyarılarını ayrı sayıyor; yoksa "cihazda 39 bildirim var ama listede hiç
hatırlatıcı görmüyorum" gibi açıklanamaz bir fark kalıyordu.

#### Emülatörde bulunan hata: tamamlama başka aşının yerini yazıyordu

Tamamlama paneli `location` alanını da gönderiyordu ve değeri **randevu
formunun** durumundan (`place`) okuyordu. O durum son açılan karta ait olduğu
için, Hepatit B'ye girilen sağlık merkezi BCG tamamlandığında onun kaydına
yazıldı. Panelde yer alanı hiç yok; alan artık gönderilmiyor ve sunucu
`COALESCE` ile var olanı koruyor.

Uçtan uca takım: `scratchpad/vaccines_e2e.sh` — 67 doğrulama.
Saf mantık: `scratchpad/vaccine_format_test.mjs` — 60 doğrulama.
Emülatörde elle doğrulandı: otomatik takvim (20 doz, aya göre gruplanmış),
durum rozetleri, randevu + görev atama, görevin `tasks` listesinde
belirmesi, tamamlama ve yan etki kaydı, kütüphaneden ve elle aşı ekleme,
cihaz takvimine yazılan etkinlikler (`device_alarm_ids` dolu), bildirim
sayacı.

### 22.13 Bildirim Merkezi (`notifications`)

Şartname: `modules_doc/bildirimler.md`. Göç: `migrations/016_notifications.sql`.

Sağ üst köşedeki zil, okunmamış rozeti ve dokununca ilgili ekrana götüren
liste. Aileden **başkasının** yaptığı işi haber verir: *"Baba Mehmet aşı
randevusu girdi"*, *"Sana görev atandı"*.

> **Dosya adı aynı, şartname değişti.** `modules_doc/bildirimler.md` önceden
> çoklu zamanlı cihaz bildirimi + takvim alarmını tanımlıyordu; onun karşılığı
> §12.5 ve §12.6'da duruyor ve **kaldırılmadı**. Dosya bu turda Bildirim
> Merkezi şartnamesiyle değiştirildi.

#### Cihaz bildiriminden farkı

| | Cihaz bildirimi (§12.5) | Bildirim merkezi (§22.13) |
|---|---|---|
| Nerede durur | Telefonun bildirim gölgesi / takvimi | Sunucudaki `notifications` tablosu |
| Kim görür | Yalnızca o cihaz | Kullanıcının tüm cihazları |
| Ne haber verir | **Senin** kurduğun alarmın vakti geldi | **Başkasının** yaptığı iş |
| Geçmişi | Yok | Var, okundu durumu tutulur |

İkisi birbirinin yerine geçmez; aynı olay için ikisi birden kurulabilir.

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET | `/notifications` | auth |
| GET | `/notifications/unread-count` | auth |
| PATCH | `/notifications/{id}/read` | auth |
| PATCH | `/notifications/read-all` | auth |
| DELETE | `/notifications/{id}` | auth |

#### Neden `/babies/{id}/notifications` değil

Satırlar **kullanıcıya** aittir, bebeğe değil; `baby_id` yalnızca bir süzgeç.
Bu yüzden burada `requireBaby()` yok: yetki zaten `user_id = me` koşuluyla
sağlanıyor ve kimse başkasının kutusunu göremez. Bebek bağlamlı bir yol
seçilseydi *"tüm bebeklerimin bildirimleri"* sorgusu imkansız olurdu — ebeveyn
zili açtığında hangi bebekte olduğuna bakmaksızın her şeyi görmek istiyor.

#### Yazarken dağıtım

Her alıcı için **ayrı satır** yazılır (`notifyFamily`). Alternatif, tek satır +
ayrı bir "kim okudu" tablosuydu; okunmamış sayısını bulmak her seferinde bir
LEFT JOIN gerektirirdi ve rozet uygulamanın en sık çalışan sorgusu. Aile en
fazla birkaç kişi olduğu için çoğaltmanın maliyeti yok.

**Tek kural: aktör kendi işini haber almaz.** Kendi girdiği mama kaydını "yeni
kayıt var" diye bildirmek rozeti anlamsızlaştırırdı. Kural tek yerde
(`recipients()`) uygulanıyor; çağrı noktalarına bırakılsaydı biri unutur ve o
modül kendi kendine bildirim göndermeye başlardı.

Yazımlar çağıranın **transaction'ı içinde** yapılır: bildirim, haber verdiği
olaydan ayrı düşemez. Olay geri alınırsa bildirim de alınmalı, yoksa kullanıcı
var olmayan bir kayda yönlendirilir.

#### Rutin kayıtlar birleştirilir

Bir bebeğe günde yirmiden fazla besleme/uyku/bez girilebiliyor. Her biri ayrı
satır olsaydı rozet kalıcı olarak "99+" gösterir ve hiçbir şey ifade etmezdi.

`routine` türünde, **aynı kişinin aynı 60 dakika içindeki okunmamış** bildirimi
varsa yeni satır açılmaz: var olanın gövdesi ve zamanı güncellenir,
`group_count` artar — *"Baba Mehmet: Altını değiştirdi (çiş) · toplam 3 kayıt"*.
Birleşmiş satırda `target_id` düşürülür: hangi tekil kayda gidileceği belirsiz,
hedef ekran (akış) korunur.

Aşı, görev, hatırlatıcı ve aile bildirimlerinde birleştirme **yapılmaz**:
onlar seyrek ve her biri ayrı bir karar; ikisini tek satırda toplamak bilgiyi
yok ederdi.

#### Tetikleyiciler

| Olay | Tür | Kime |
|------|-----|------|
| Besleme / uyku bitişi / bez / sağma kaydı | `routine` | Aktör dışındaki tüm üyeler (birleştirilir) |
| Görev oluşturuldu, **atanmış** | `task` | Yalnızca atanan |
| Görev oluşturuldu, **atanmamış** | `task` | Tüm üyeler — aileden isteyen üstleniyor, haberi olmayan üstlenemez |
| Görev tamamlandı | `task` | Yalnızca görevi açan |
| Aşı randevusu girildi | `vaccine` | Tüm üyeler; göreve atanan kişi **bunun yerine** `task` metnini alır |
| Aşı yapıldı | `vaccine` | Tüm üyeler |
| Hatırlatıcı kuruldu | `reminder` | Tüm üyeler |
| Davet kabul edildi | `family` | Mevcut üyeler |
| Yetki değiştirildi | `family` | Yalnızca etkilenen kişi |

Aşı randevusunda atanan kişi genel satırdan `excludeUserIds` ile çıkarılır;
yoksa tek olay ona iki satır olurdu. Yetki değişikliği yalnızca etkilenene
gider: onun için uygulamanın ne yapabileceği değişiyor ve bunu fark etmeden
"Kaydet"e basıp hata alması kötü bir karşılaşma olurdu.

**Uyku başlatma bildirim üretmez**, bitiş üretir: başlangıç ve bitiş için ayrı
bildirim tek uykuyu iki habere böler ve ilkinde süre bilgisi de olmaz.

**"Başlandı" durumu bildirilmez**, yalnızca tamamlama: her geçişi haber vermek
tek görevi üç bildirime bölerdi.

#### Karşılanamayan tetikleyici: "hatırlatıcı süresi geldiğinde"

Şartname bunu da istiyor ama **sunucuda zamanlayıcı yok**: hatırlatıcılar
cihazda planlanıyor (`core/notifications/scheduler.ts`), push altyapısı da yok
(§12.1). Sunucu bir hatırlatıcının ne zaman çaldığını bilmiyor, bilse bile
haber veremez.

Karşılanabilen ve işe yarayan kısım uygulandı: aileden biri hatırlatıcı
**kurduğunda** diğerleri haber alıyor — aynı alarmı ikinci kez kurmasınlar
diye. Gerçek "çaldı" bildirimi, sunucu tarafı push eklendiğinde (§19) anlamlı
olur.

#### `target_screen` modül anahtarıdır

Şartname `VaccineDetail` / `TaskDetail` gibi adlar öneriyor; bu uygulamada
kayıt başına detay ekranı **yok** ve navigasyon ağacı modül anahtarlarından
runtime'da üretiliyor (§9). Ulaşılamayan bir ekran adı saklamak, bildirime
dokunulduğunda hiçbir şey olmaması demekti. Saklanan değerler: `vaccines`,
`tasks`, `reminders`, `timeline`, `family`, `babies`.

#### Modül kataloğuna eklenmez

`modules` tablosuna satır yazılmadı. Bildirim merkezi bir modül değil, kabuk
altyapısı: zil üst şeritte, hesap paneli ve alt çubuk gibi navigasyon ağacının
dışında duruyor. Kataloğa eklenseydi ana ekrandaki ızgarada 15. bir kutu
belirir ve aynı şeye iki ayrı yoldan (zil + kutu) ulaşılırdı. Kapatılabilir
olmasının da karşılığı yok: kapalı bir bildirim merkezi, aile üyelerinin
birbirinden habersiz kalması demek.

#### Sert silme

Diğer modüllerde kayıtlar yumuşak siliniyor çünkü denetim izinde kalmaları
gerekiyor. Bildirim bir kayıt değil, bir **haber**: asıl olay zaten kendi
tablosunda ve `activity_log`'da duruyor. Silinen haberi saklamak, kutusunu
temizleyen kullanıcıya hiçbir şey kazandırmazdı.

#### Mobil taraf

- `src/core/notifications/useInboxStore.ts` — kutu durumu (liste, rozet,
  yükleniyor). `useNotificationStore` ile **karıştırılmamalı**: o cihaz
  alarmlarını planlıyor, bu sunucudaki kutuyu okuyor. Ayrı dosya ve ayrı ad
  bilinçli.
- `src/components/NotificationBell.tsx` — üst şeritteki zil ve kırmızı rozet.
  99'dan fazlası "99+" yazılır; dört haneli bir sayı rozeti şeridin yarısı
  kadar genişletirdi.
- `src/components/NotificationSheet.tsx` — alttan açılan liste; tür ikonları,
  "Tümünü okundu işaretle", okunmamışlar için sol kenarda mavi şerit, boş
  durum. Dokununca `target_screen` modül anahtarına `navigateTo` ile gidilir
  ve satır okundu işaretlenir.
- Rozet `refreshAll` ile tazelenir (açılış, giriş, ön plana gelme) ve her
  okundu/silme işleminden sonra yerel olarak düşürülür; sunucuya ikinci bir
  tur atılmaz.

Uçtan uca takım: `scratchpad/notifications_e2e.sh` — 44 doğrulama.

### 22.14 Ek geliştirmeler — e-posta, doğrudan fotoğraf yükleme, esnek hatırlatıcı

Şartname: `modules_doc/ek-gelistirmeler.md`. Göç:
`migrations/017_reminder_recurrence.sql`.

Üç bağımsız geliştirme. Ortak noktaları yok; birlikte belgelenmelerinin sebebi
tek bir şartname dosyasından gelmeleri.

---

#### 1. E-posta servisi (Nodemailer + SMTP)

Ayarlar `.env`'den okunur ve **hepsi opsiyoneldir**:

| Değişken | Açıklama |
|---|---|
| `SMTP_HOST` | Sunucu adı. Boşsa e-posta tamamen kapalıdır. |
| `SMTP_PORT` | Varsayılan 465. |
| `SMTP_SECURE` | Verilmezse porttan türetilir: 465 → implicit TLS, diğerleri → STARTTLS. |
| `EMAIL_USER` / `EMAIL_PASS` | Kimlik bilgileri. |
| `EMAIL_FROM` | Gönderen adresi; boşsa `EMAIL_USER`. |
| `EMAIL_FROM_NAME` | Görünen ad, varsayılan "Bebiqa". |
| `MAIL_DRY_RUN` | `true` ise gönderim yapılmaz, yalnızca loga yazılır. |

**Neden opsiyonel.** Zorunlu olsaydı SMTP hesabı olmayan bir geliştirme
makinesinde sunucu hiç açılmazdı. Oysa e-posta hiçbir akışın zorunlu parçası
değil: davet kodu API yanıtında da dönüyor ve elden iletilebiliyor.
`config/env.ts` bunu `mailEnabled` bayrağıyla tek noktada değerlendirir.

**Gönderim asla isteği düşürmez.** `sendMail` hata fırlatmaz, `{ sent, reason }`
döndürür. Davet kaydı oluşmuşken SMTP'ye ulaşılamadığı için 500 dönmek,
kullanıcıya "davet gönderilemedi" dedirtirdi — oysa davet vardır. Bu yüzden
`POST /babies/{id}/invitations` yanıtına `email_sent` alanı eklendi: istemci
kodun elden iletilmesi gerekip gerekmediğini biliyor.

**`MAIL_DRY_RUN` neden var.** Uçtan uca testler davet ve rapor uçlarını
çağırıyor. Gerçekten gönderselerdi her koşu, var olmayan test adreslerine
(`@ornek.com`) posta yağdırıp gönderen hesabın itibarını zedeleyecekti. Bayrak
açıkken akış sonuna kadar çalışır — şablon kurulur, PDF üretilir — yalnızca son
adım atlanır ve loga maskelenmiş adresle bir satır yazılır (§18).

**Havuz kapatılmalı.** `pool: true` açık bağlantı tuttuğu için Node süreci iş
bitse de kapanmıyordu; tek seferlik betikler sonsuza dek asılı kalıyordu.
`closeMail()` eklendi ve `server.ts`'teki kapanış kancasına bağlandı.

Kullanım yerleri:

| Olay | Kime | Not |
|---|---|---|
| Aile daveti oluşturuldu | Davet edilen adrese | Kod, yakınlık, yetki ve geçerlilik süresi |
| Aşı randevusu girildi | Aktör dışındaki üyelere | **Yalnızca yer girildiğinde** |
| Dönem özeti istendi | İsteyene (ya da `to_family` ile aileye) | PDF ekiyle |

Aşı e-postası yalnızca bir **yer** girildiğinde gönderilir: yersiz bir randevu
henüz taslak sayılıyor ve her tarih denemesinde aileye e-posta yağdırmak
bildirimden beter olurdu.

#### PDF'te yazı tipi gömmek zorunlu

PDFKit'in gömülü standart yazı tipleri (Helvetica ve arkadaşları)
WinAnsi/cp1252 ile sınırlı ve bu küme Türkçedeki `ğ ş İ ı` harflerini
**içermiyor** — rapor bozuk karakterlerle çıkardı. `dejavu-fonts-ttf`
paketindeki DejaVu Sans gömülüyor (`FontFile2`); fontsource paketleri yalnızca
woff/woff2 veriyor ve PDFKit onları okuyamıyor.

Yazı tipi yolu `createRequire(import.meta.url)` ile **modüle göre** çözülür;
sunucu başka bir dizinden başlatıldığında da bulunur.

> **Zamanlanmış gönderim yok.** Şartname "haftalık/aylık özet rapor çıktıları"
> diyor ama sunucuda cron/kuyruk altyapısı bulunmuyor ve eklemek işletim
> tarafında ayrı bir süreç gerektiriyor. Uç nokta **istek üzerine** çalışıyor.
> Zamanlayıcı eklendiğinde aynı fonksiyonu çağırması yeterli.

Dönem toplamları `services/reportSummary.ts`'e taşındı: `/reports/summary` ile
`/reports/email` aynı sayıları kullanıyor. Hesap uç noktanın içinde kalsaydı
kopyalanacak ve iki rapor zamanla ayrışacaktı — kullanıcının fark etmesi en zor
hata türü.

---

#### Hesap postaları: kayıt ve şifre sıfırlama

İki şablon daha var (`lib/mailer.ts`):

| Şablon | Ne zaman | Not |
|--------|----------|-----|
| `welcomeMail` | `POST /auth/register` sonrası | Hesabı **doğrulamaz**; uygulama e-posta doğrulaması istemiyor ve bunu zorunlu adıma çevirmek kaydolan ebeveyni uygulamadan çıkarırdı |
| `passwordResetMail` | `POST /auth/forgot-password` | Sıfırlama **kodunu** taşır |

İki ayrıntı önemli:

- **Gönderim beklenmez** (`void sendMail(...)`). `sendMail` zaten hata
  fırlatmıyor; yine de beklenseydi SMTP yavaşken kullanıcı kayıt ya da
  sıfırlama ekranında saniyelerce asılı kalırdı.
- **`forgot-password` her durumda `sent: true` döner.** Hesap bulunamadığında
  farklı yanıt vermek, adres adres deneyerek hangi e-postaların kayıtlı
  olduğunu çıkarmaya izin verirdi (§18). Postanın gidip gitmediği de yanıta
  konmuyor, aynı nedenle.

Şifre sıfırlamada bağlantı değil **kod** öne çıkarılıyor: mobilde derin
bağlantı (deep link) altyapısı yok, uygulama içi sıfırlama ekranı kodu elle
istiyor. Bağlantı yine veriliyor ama ikincil.

Aile daveti postası (`invitationMail`) zaten vardı — "ebeveynlik bildirimi"
onunla karşılanıyor.

#### 2. Bebek fotoğrafı: `POST`/`PUT` üzerinden doğrudan yükleme

`POST /babies/{id}/photo` zaten vardı (multer + disk depolama + eski dosyanın
silinmesi). Bu turda eklenenler:

- Boyut sınırı **8 MB → 5 MB** (şartname).
- `POST /babies` ve `PUT /babies/{id}` artık `multipart/form-data` kabul
  ediyor; fotoğraf kaydın kendisiyle **aynı istekte** gidebiliyor.

#### Multipart'ta tür çevrimi neden ayrı bir katman

Multipart'ta her alan dizgedir: `birth_weight_g` `"2450"`, `is_premature`
`"true"` gelir. Oluşturma şeması ise `z.number().int()` ve `z.boolean()`
bekliyor.

Şemayı `coerce`'e çevirmek **JSON yolunu da gevşetirdi**:
`z.coerce.number()` boş dizgeyi `0`, `z.coerce.boolean()` ise `"false"`
metnini **true** yapıyor — ikisi de sessiz veri hatası (0 gramlık doğum
ağırlığı, ters dönmüş prematüre bayrağı). Bu yüzden çevrim `acceptBabyForm`
içinde, yalnızca `Content-Type` multipart olduğunda yapılıyor; JSON istekleri
bu katmandan **dokunulmadan** geçiyor ve doğrulaması bit bit aynı kalıyor.

Kurallar:

- Boş ya da `"null"` alan **silinir** ("gönderilmedi" demektir).
- Sayılarda ondalık ayracı olarak virgül kabul edilir (`49,5`).
- Boolean'da yalnızca `"true"` / `"1"` doğru sayılır.

Fotoğraf `INSERT`'in içine değil, hemen sonrasına bağlanır: dosya adı multer
diske yazdıktan sonra belli oluyor ve transaction'ı bir disk yazımı boyunca
açık tutmanın karşılığı yok. Bağlama başarısız olsa bile bebek kaydı doğru,
yalnızca fotoğraf eksik kalır.

Güncellemede yalnızca fotoğraf gönderen istek de geçerlidir — "güncellenecek
alan yok" hatası vermez — ve yeni dosya yazıldıktan sonra eskisi diskten
silinir (`dropPhotoFile`).

---

#### 3. Hatırlatıcılar: `event` kategorisi ve esnek zamanlama

Kategori ENUM'u şartnamedeki kümeye genişletildi:
`feeding`, `sleep`, `diaper`, `medicine`, `vaccine`, `doctor`, `event`,
`custom` — artı var olan `breastfeeding` ve `pumping`. O ikisi **korundu**: o
modüllerin hatırlatıcıları zaten kullanımda ve listeden düşürülmeleri kayıtlı
satırları doğrulamadan geçemez hâle getirirdi.

Yeni alanlar:

| Alan | Değerler |
|---|---|
| `recurrence_type` | `none` · `daily` · `weekly` · `custom_days` |
| `repeat_days` | ISO gün dizisi: **1 = Pazartesi … 7 = Pazar** |
| `start_date` | İlk geçerli gün (`YYYY-AA-GG`) |
| `end_date` | Son geçerli gün, dahil; boşsa süresiz |

**ISO gün numarası seçildi**, JS'in `getDay()` düzeni (0 = Pazar) değil: hem
sunucuda hem Türkiye'de haftanın ilk günü Pazartesi. Çevrim istemcide tek
noktada yapılıyor; iki yerde yapılsaydı biri unutulduğunda alarm bir gün
kayardı — `quiet_hours.days_mask` ile aynı tuzak (§12.4).

**`repeat_days` neden JSON, bit maskesi değil.** En fazla yedi küçük tam sayı,
yalnızca kendi satırıyla okunuyor ve hiç sorgulanmıyor. Bit maskesi daha
kompakt olurdu ama istemciye dizi olarak gidip gelmesi gerekiyor ve her iki
uçtaki çevrim, kazanılan birkaç bayttan daha çok hata kaynağı.

Doğrulama (`checkRecurrence`) — tutarsızlık sessiz kalırsa hatırlatıcı ya hiç
çalmaz ya da yanlış günde çalar, kullanıcı bunu ancak alarmı kaçırınca fark
eder:

1. `custom_days` seçiliyse `repeat_days` boş olamaz.
2. `none` seçiliyse `start_date` zorunludur — "bir kez çal" ile "ne zaman"
   sorusu yanıtsız kalamaz.
3. `end_date < start_date` reddedilir.
4. `interval` modunda `daily` dışında tekrar biçimi kabul edilmez: "son
   kayıttan 3 saat sonra" kuralı günlere değil son kayda bağlı; ikisini
   birlikte kabul etmek kullanıcıya uygulanmayacak bir ayar göstermek olurdu.

Var olan satırlar göçte `daily`ye ayarlanır — bugüne kadarki davranış buydu.
Aksi hâlde göç, çalışır durumdaki hatırlatıcıların bir kısmını sessizce
susturacaktı.

**§22.0 tuzağı burada da çıktı:** `recurrence_type`'ın varsayılanı `daily` ve
güncelleme şeması `reminderSchema.partial()` ile türetiliyor. Yalnızca başlığı
değiştiren bir istek, haftalık bir hatırlatıcıyı sessizce günlüğe
çeviriyordu; alan güncelleme şemasında varsayılansız `optional()` ile ezildi.

#### Mobil taraf

- `BabyForm` artık **kamera** seçeneği de sunuyor (galeri/kamera sorusu) ve
  fotoğrafı kayıtla aynı istekte gönderiyor; önce kaydedip sonra ikinci bir
  istekle yüklemiyor.
- Hatırlatıcı formunda kategori listesi on seçeneğe çıktı ve her birinin kendi
  simgesi var; "Etkinlik" 🎉 yerine `calendar-star` ikonuyla çiziliyor
  (emoji kuralı, `components/Icon.tsx`).
- Zamanlama kipi üç chip: **Her gün · Belirli günler · Tek seferlik**. Belirli
  günler seçilince Pzt–Paz chip'leri açılıyor.
- `quietHours.ts`'teki `rawOccurrences` tekrar kurallarını uyguluyor:
  `start_date`/`end_date` penceresi ve gün süzgeci. `canRepeat` artık
  **yalnızca `daily`** için süresiz tekrar eden tetikleyiciye izin veriyor —
  tek bir DAILY tetikleyici "yalnızca Pzt/Çar/Cum" ya da "15 Aralık'ta bitsin"
  kuralını ifade edemez ve hatırlatıcı her gün çalmaya devam ederdi.

Uçtan uca takım: `scratchpad/extras_e2e.sh` — 46 doğrulama.
Yardımcı betikler: `scripts/smtp-probe.ts` (bağlantı doğrular, posta
göndermez), `scripts/pdf-probe.ts` (örnek PDF üretir),
`scripts/mail-probe.ts` (tam boru hattını gönderenin **kendi** adresine
göndererek dener).

### 22.15 Modül 15 — Gelişim Takibi (`growth`)

Göç: `migrations/019_growth.sql`. Kilo, boy ve baş çevresinin zaman içindeki
seyri. Diğer kayıt modüllerinden iki yapısal farkı var.

| Metod | Yol | Gerekli |
|-------|-----|---------|
| GET | `/babies/{id}/growth` | viewer |
| GET | `/babies/{id}/growth/summary` | viewer |
| POST | `/babies/{id}/growth` | editor |
| GET | `/growth/{id}` | viewer (üyelik) |
| PUT | `/growth/{id}` | editor |
| DELETE | `/growth/{id}` | editor |

Liste süzgeçleri: `from`, `to` (ikisi de dahil, `YYYY-AA-GG`), `limit`.

#### Ölçüm bir GÜN olayıdır, bir an değil

`measured_on` **DATE** ve tabloda `tz_offset_min` **yok**. Terazi okuması
saate göre değişmez; "5 Kasım'da 6,2 kg" cümlesinin saatle işi yoktur. Saat
dilimi sorusu ancak "bu an hangi güne düşüyor" diye sorulduğunda doğar, burada
gün zaten istemciden takvim günü olarak geliyor. Bunun yan faydası, grafiğin
x ekseninin saat dilimi kaymasından etkilenmemesi.

#### Bir güne bir ölçüm

`UNIQUE KEY uq_growth_day (baby_id, measured_on)` ve POST **ekleme değil
üzerine yazma** yapıyor (`ON DUPLICATE KEY UPDATE`). Aynı günü iki kez girmek
grafikte aynı x'te iki nokta demek ve "hangisi doğru" sorusunu cevapsız
bırakmak olurdu.

Yumuşak silinmiş satır da tekil anahtarı tutmaya devam ettiği için POST,
`deleted_at = NULL` ile satırı **diriltiyor**. Olmasaydı silinmiş bir gün bir
daha hiç girilemezdi (uçtan uca takımda doğrulanıyor).

Mobil tarafta bunun karşılığı: ayrı bir "düzenle" kipi yok. Geçmişten bir
satıra dokunmak o günü forma yüklüyor, kaydetmek o günü güncelliyor.

#### Üç ölçü, en az biri

Evde çoğu zaman yalnızca tartı var; boy ve baş çevresi doktor kontrolüne
kalıyor. Bu yüzden üç sütun da NULL olabilir ama **hepsi birden olamaz** —
üçü de boş bir satır yalnızca bir tarih demek, grafikte boşluk ve listede
anlamsız bir satır üretirdi. Kural uygulama katmanında; tek sütunluk bir
`CHECK` kısmi ölçümü de yasaklardı.

Sınırlar birim hatası (kilogram yerine gram, metre yerine santim) içindir,
tıbbi doğruluk denetimi değil: kilo 500–30000 **gram** (tam sayı), boy
20–130 cm, baş çevresi 15–65 cm. Aynı sınırlar istemcide de var
(`growthFormat.ts` → `parseMeasure`) ki hangi alanın sorunlu olduğu ağ turu
beklemeden görünsün.

#### Özet ucu — seri **ölçü başına** hesaplanır

`GET /growth/summary` her ölçü için ayrı bir seri döndürüyor: `latest`,
`previous`, `birth` (bebek profilinden), `change`, `since_birth`, `per_day`
ve `count`.

Kritik nokta: seri satır başına değil **ölçü başına** kuruluyor. Bir günde
yalnızca tartıya çıkılmış olabilir ve o satırın boş boy alanı, bir önceki
gerçek boy ölçümünü "önceki" olmaktan çıkarmamalı. Hesap üç ayrı sorgu yerine
tek sorgu + JS ile yapılıyor; 0-3 yaş için satır sayısı (günde en fazla bir)
bunu rahatça kaldırıyor.

`per_day` iki ölçüm arasındaki hızdır ve asıl bilgi odur: "6,2 kg" tek başına
bir şey söylemez, "günde 28 g alıyor" söyler.

#### Yetki: editor başkasının ölçümünü de değiştirebilir

Diğer kayıt modüllerinde kural "editor yalnızca kendi girdiğini değiştirir".
Burada bilerek gevşetildi: bir besleme kaydı "ben şunu yaptım" demek, oysa
ölçüm bebeğe ait **tek bir olgudur**. Aynı günü iki ebeveynin iki satırda
tutması zaten engelli; düzeltmeyi yalnızca girene bırakmak, yanlış yazılmış
bir kilonun eşi evde değilken düzeltilememesi demekti.

`PUT` şemasında `measured_on` **yok**: günü değiştirmek başka bir güne taşımak
demek ve tekil anahtarla çakışabilir. Yanlış güne girilen ölçüm silinip doğru
güne yeniden girilir.

#### Mobil taraf

- `src/modules/growth/growthFormat.ts` — React'siz saf sunum mantığı:
  `formatWeight()` (1000 gramın **altında gram** yazar; yenidoğanda 3250 g ile
  3100 g arasındaki fark "3,2 / 3,1 kg" olarak yazılınca kayboluyordu),
  `formatDelta()` (işaretli, gerçek eksi işaretiyle — bebek ilk haftalarda
  kilo kaybedebilir), `formatPace()`, `chartBars()`, `parseMeasure()`.
- `formatPace()` kiloda **günlük**, boy ve baş çevresinde **haftalık** yazar:
  günde 0,03 cm hiçbir şey anlatmıyor.
- `chartBars()` mini sütun grafiğini hazırlar. **Taban sıfır değil**, serinin
  en küçük değeri (biraz aşağı çekilmiş): bebek 6,1 → 6,3 kg arasında
  gezinirken sıfırdan başlayan bir eksen üç özdeş sütun çizer ve değişimi
  tamamen gizler. Tek ölçüm varsa oran 1 döner; yarım sütun "yarı yolda" gibi
  yanlış bir şey anlatırdı.
- Grafik **bağımlılıksız**: projede `react-native-svg` yok, sütunlar düz
  `View` ile yüzdelik yükseklikle çiziliyor. Bir grafik kütüphanesi eklemek
  yeni bir native bağımlılık ve yeniden derleme demekti.
- Giriş birimi **gram**, gösterim **kg**. Bebek profilindeki "Doğum kilosu
  (gram)" alanıyla aynı birim; kilogram kabul edilseydi "6,2" ile "6200" aynı
  kutuya girer ve hangisinin kastedildiği belirsiz kalırdı.
- Ekranın üstü ölçümler değil **değişim kartlarıdır**: büyük sayı son ölçüm,
  altında değişim, hız ve doğumdan beri fark. İlk ölçümde değişim satırı hiç
  yazılmaz — "+0" yazmak ilk ölçümü bir değişim gibi gösterirdi.

#### Kapsam dışı: persentil eğrileri

DSÖ persentil eğrileri (3/15/50/85/97) bilinçli olarak **yapılmadı**. Eğri
çizmek yaş+cinsiyet için LMS tablolarını pakete gömmeyi gerektiriyor ve
eksik/yanlış bir tablo ebeveyne tıbbi bir yargı verdirir. Modül bunun yerine
bebeğin **kendi eğrisini** gösteriyor: ne kadar sürede ne kadar değişti.

Uçtan uca takım: 27 doğrulama (üzerine yazma, diriltme, ölçü başına seri,
dört doğrulama kuralı).

---

## 23. Reklam Entegrasyonu — AdMob Geçiş Reklamı

`modules_doc/Reklam.md` şartnamesinin uygulanmış hâli. **Ayarların tamamı
yönetim panelinden gelir** (§7.6); bu bölüm istemci tarafını anlatıyor.

### 23.1 Kütüphane ve native yapılandırma

| | |
|---|---|
| Paket | `react-native-google-mobile-ads` **17.4.0** |
| Gereksinim | React Native ≥ 0.86, **yalnızca New Architecture** |
| Projedeki durum | RN 0.88, `newArchEnabled=true` — uyumlu |
| Alt sınırlar | Android API 24+, iOS 15.1+ |

Kurulum `npx expo install` ile yapıldı (`npm install` değil: SDK ile uyumlu
sürümü o seçiyor, `AGENTS.md`).

`Info.plist` ve `AndroidManifest.xml` **elle düzenlenmedi** — düzenlenemez de:
`android/` ve `ios/` Continuous Native Generation çıktısıdır ve bir sonraki
`expo prebuild` elle yazılan her satırı siler. Aynı işi paketin **config
plugin**'i yapıyor, `app.json` üzerinden:

```jsonc
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": "ca-app-pub-3940256099942544~3347511713",
    "iosAppId":     "ca-app-pub-3940256099942544~1458002511",
    "userTrackingUsageDescription": "Reklamları ilgi alanlarına göre …"
  }
]
```

> **Buradaki App ID'ler Google'ın resmî ÖRNEK kimlikleri**, gerçek hesabın
> değil. Yer tutucu bırakılamıyordu: eklenti `androidAppId` olmadan manifest'e
> `com.google.android.gms.ads.APPLICATION_ID` yazmıyor ve native SDK
> **açılışta çöküyor** (eklentinin kendi uyarısı: "will crash on Android
> without it"). Örnek kimlikler yalnızca test reklamı döndürür, gelir
> üretmez. Gerçek kimlikler alındığında panelin **Reklamlar** ekranı
> `app.json`'a yapıştırılacak bloğu hazır gösteriyor (§7.6); değiştirdikten
> sonra `expo prebuild` + yeniden derleme **zorunlu**.

Eklenti ayrıca `OPTIMIZE_INITIALIZATION` ve `OPTIMIZE_AD_LOADING` bayraklarını
`true` yazıyor (eklenti varsayılanı) — SDK başlatması ve reklam yüklemesi ana
iş parçacığından çıkıyor, ANR riski düşüyor.

`userTrackingUsageDescription` iOS ATT izin cümlesini `Info.plist`'e yazar.
Bu da derleme zamanı değeri; panelde `ad_settings.att_text` olarak saklanması
kaydın tek yerde durması içindir (§7.6).

**Yeniden derleme şart.** Yalnızca `Reload` yetmez; native modül eklendiği
için geliştirme derlemesi gerekiyor:

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="C:/Users/<kullanıcı>/AppData/Local/Android/Sdk"
npx expo prebuild --platform android
npx expo run:android
```

> `android/local.properties` dosyasında `sdk.dir` **ileri eğik çizgiyle** ya da
> **çift ters eğik çizgiyle** yazılmalı. Java `.properties` biçimi tek ters
> eğik çizgiyi kaçış karakteri sayıp yutuyor: `C:\Users\…` →
> `C:Users…` olur ve Gradle "Invalid file path" ile düşer; hata mesajı
> sebebi hiç göstermiyor.

### 23.2 `adService` sözleşmesi

`src/core/ads/adService.ts` — React'siz, tek örnekli, ekranlardan bağımsız.
Ekranların bildiği tek şey:

```ts
export function showAdAfterAction(trigger: AdTrigger = 'save'): void
```

**Değişmez kural: reklam hiçbir koşulda kaydı etkilemez.** Fonksiyon `void`
döner, hiç `throw` etmez, her native çağrı `try/catch` içindedir. Ağ yoksa,
SDK kurulmamışsa (Expo Go, prebuild atlanmış derleme) ya da AdMob hata
verirse kullanıcı hiçbir şey fark etmez.

Başlatma `App.tsx` kabuğunda **bir kez**: `initAds()`. Sıra önemli — önce
`setRequestConfiguration` (çocuklara yönelik beyanı, içerik derecesi, test
cihazları), sonra UMP izni (`AdsConsent.gatherConsent`), en sonda
`MobileAds().initialize()`. SDK başlatma sırasında reklam ön yükleyebildiği
için beyan ve izin ondan önce yerinde olmalı; tersi sırada ilk istek yanlış
yapılandırmayla gider.

`initAds()` **`await` edilmiyor**: AdMob başlatması ağa çıkıyor ve açılışı ona
bağlamak, reklam kapalı bir kurulumda ya da ağ yokken uygulamayı bekletirdi.
Panelde reklam kapalıysa `initAds` hiç başlatmıyor — kapalı bir sistemde
SDK'yı ayağa kaldırmak boşa açılış süresi.

**Ön yükleme ve yeniden yükleme.** `AdEventType.CLOSED` olayında hemen yeni
reklam yüklenir; AdMob bir örneği yalnızca bir kez gösterdiği için
yüklemezsek ilk reklamdan sonra bir daha hiç reklam gelmez — sessiz bir gelir
kaybı. `ERROR` olayında yeniden yükleme **30 saniye gecikmeli**: hata
genelde "no fill" ya da ağ yokluğu ve hemen yeniden denemek istek selipi
üretir.

**Gösterim sayacı `OPENED` olayında artar**, `show()` çağrısında değil:
yüklenmemiş ya da hata veren bir reklam oturum kotasını harcamamalı, yoksa
kullanıcı hiçbir şey görmediği hâlde sonraki gösterimler sessizce atlanırdı.

**Kimlik seçimi:** `__DEV__ || config.use_test_ids` ise `TestIds.INTERSTITIAL`,
değilse panelden gelen platform birimi. Geliştirme derlemesinin canlı birim
istemesi için hiçbir gerekçe yok; kendi canlı reklamına tıklamak hesabın
kalıcı kapatılma sebebi.

Panelden kimlik ya da kişiselleştirme değişirse `watchAdSettings()` aboneliği
reklam örneğini yeni ayarla yeniden kuruyor. Reklam **kapatıldığında** aynı
abonelik bekleyen gecikmeli gösterimi iptal ediyor — yoksa panelde kapatılan
reklam bir kez daha açılırdı.

### 23.3 Güvenlik kapıları

Kapılar **gösterim anında** değerlendiriliyor (gecikme dolduğunda), tetikleme
anında değil: 3 saniye içinde kullanıcı uygulamadan çıkabilir, ninni açabilir
ya da onay penceresi hâlâ kapanmamış olabilir. Reklam şu durumlarda
gösterilmez:

| Kapı | Gerekçe |
|------|---------|
| `shouldShowFor(trigger)` `false` | Panelde ana anahtar kapalı, bu tetikleyici seçili değil ya da bu platform için birim kimliği girilmemiş |
| UMP `canRequestAds` `false` | İzin akışı reklam isteğine izin vermiyor |
| Frekans sınırı dolu | `frequency_minutes` / `session_cap`; `0` sınırı kaldırır |
| `AppState.currentState !== 'active'` | Arka plandayken gösterilen reklam, kullanıcı geri döndüğünde alakasız bir yerde açılır |
| **Ninni / beyaz gürültü çalıyor** | Tam ekran reklam sesi keser ve uyutulmaya çalışılan bebeği uyandırır — modülün bütün amacını boşa çıkaran tek senaryo |
| Kaydetme onay penceresi açık | İki tam ekran katman üst üste binmemeli; kullanıcı neyin onaylandığını okuyamadan reklam açılırdı |
| Reklam yüklenmemiş | **Hata değil**, sessiz geçiş; yeniden yükleme tetiklenir |
| `respect_quiet_hours` açık ve sessiz saatteyiz | Panel varsayılanı kapalı (Reklam.md §0.3-B). Kullanıcı pencere tanımlamamışsa **23:00–07:00** varsayılır |

**Frekans sınırının hesabı ayrı ve saf bir modülde:**
`src/core/ads/frequency.ts` → `allowedByFrequency()`. `react-native` ya da
AdMob SDK'sı içe aktarmadığı için düz Node altında doğrulanıyor
(`scripts/tests/ad-frequency.test.mjs`, 20 doğrulama; `quietHours.ts` ve
`tickPlan.ts` ile aynı gerekçe). Bu hesap yanlış giderse sonuç "ekranı
reklamla dolduran uygulama" ve Google'ın hesabı askıya alması — test
edilmemiş bırakılacak yer değil. Kapsanan durumlar: ilk gösterim
(`lastShownAt = 0` beklemeye tabi değil), bekleme süresinin sınırları,
oturum tavanı, `0` değerlerinin sınırı kaldırması, **saatin geri alınması**
(negatif geçen süre "süre geçmedi" sayılır — yoksa saati oynatmak sınırı
atlatmanın en kolay yolu olurdu) ve şartnamedeki "arka arkaya üç kayıt"
senaryosu.

Sessiz saat pencereleri ağa çıkmadan okunuyor: `useNotificationStore`
eşitlemede çektiği listeyi `quietHours` alanında saklıyor
(`quietHours.coveringWindow` ile değerlendirilir). Reklam göstermek için
istek atmak, en kötü anda — bebek uyurken — gecikme ve veri harcaması olurdu.

### 23.4 Tetikleyiciler

Dört tetikleyici türü var ve her biri panelde **ayrı** açılıp kapatılıyor
(§7.6). `withSaveFeedback` varsayılan olarak `'save'` gönderiyor.

| Tetik | Nereden | Panel varsayılanı |
|-------|---------|-------------------|
| `save` | `withSaveFeedback()` — **14 ekranın tamamı** | açık |
| `complete` | `TasksScreen.complete()` (üç dal) + aşı "yapıldı" akışı | açık |
| `invite` | `FamilyScreen` davet oluşturma | açık |
| `timer_start` | `SleepScreen.onStart()`, `BreastfeedingScreen.onStart/onSwitch` | **kapalı** |

"Kaydet" ve "Değişiklikleri Kaydet" düğmelerinin tamamı zaten tek bir
sarmalayıcıdan geçiyordu (`withSaveFeedback`), bu yüzden 14 ekran tek satırla
kapsandı: `BottleScreen`, `DiaperScreen`, `SolidScreen`, `PumpingScreen`,
`RemindersScreen`, `VaccinesScreen`, `TasksScreen`, `BabyForm`,
`BabiesScreen`, `FamilyScreen`, `ProfileScreen`, `GrowthScreen`,
`BreastfeedingScreen` (özet kaydet), `SleepScreen` ("Uyandı").

Tetik yalnızca **başarılı** kayıtta atılıyor ve `succeed()`ten **sonra**:
hata veren bir kaydın üstüne reklam açmak kullanıcıyı hatayı okumadan
ekrandan atmak olurdu; `succeed`ten önce çağırmak ise gecikme dolduğunda onay
penceresini hâlâ açık görüp gösterimi sessizce atlamak olurdu.

`timer_start`ın varsayılan kapalı olması bilinçli (Reklam.md §0.3-C): geçiş
reklamı doğal **bitiş** noktalarına ait, Sol/Sağ ve "Uykuya daldı" ise işi
**başlatma** anı. Emzirmede bu düğmeler tek beslenmede 3-4 kez basılıyor ve
sayaç akarken ekranı kapatan reklam ölçülen sürenin doğruluğuna da gölge
düşürüyor. Panelden açılabilir; o zaman tek emniyet frekans sınırı olur.

### 23.5 `withSaveFeedback` neden ayrı dosyada

`src/core/feedback/withSaveFeedback.ts`, deposu olan
`useSaveFeedbackStore.ts`'ten **ayrıldı**. Sebep dairesel import:

```
adService → useSaveFeedbackStore   (onay penceresi kapısı)
useSaveFeedbackStore → adService   (reklam tetiği)
```

Daire, çağrıların hepsi çalışma zamanında olduğu için Metro altında büyük
olasılıkla sorunsuz çalışırdı — ama modül yükleme sırasına bağlı bir
kırılganlık ve hata verdiğinde "neden `showAdAfterAction` undefined"
sorusuna çıkar, sebebi hiç belli olmaz. Bölmeden sonra graf tek yönlü:

```
useSaveFeedbackStore   (yaprak)
adService              → useSaveFeedbackStore
withSaveFeedback       → ikisi
```

### 23.6 Kapsam dışı

- **Banner ve ödüllü reklam yok.** Şartname yalnızca geçiş reklamı istiyor.
- **Mediation (AdMob dışı ağlar) yok.** Tek ağ ile başlanıyor.
- **Reklamsız satın alma akışı yok.** Panelin `ads_enabled` anahtarı sistem
  geneli bir kapı; kullanıcı başına reklam kaldırma ayrı bir iş
  (RevenueCat / `expo-in-app-purchases`) ve reklam entegrasyonuyla birlikte
  yapılmamalı.
- **iOS derlemesi yok.** Bu makinede iOS derlenemiyor; `iosAppId` ve ATT
  metni yapılandırıldı ama doğrulanmadı (Reklam.md §0.3-F: önce Android).

### 23.7 Emülatörde doğrulama — **yapıldı (5 Kasım 2026)**

Android 16 (API 37) emülatöründe, panelde reklam **açık** + "test kimlikleri"
**açık** iken uçtan uca sürüldü. Sonuçlar:

| # | Senaryo | Sonuç |
|---|---------|-------|
| 1 | Bez değişimi → **Kaydet** | Kayıt **anında** düştü (sayaç 0→1), onay penceresi açıldı, **3. saniyede** "Test Ad" rozetli geçiş reklamı açıldı |
| 2 | Reklamı kapat → yeni kayıt | Reklam yine geldi — `CLOSED` sonrası otomatik yeniden yükleme çalışıyor |
| 3 | **Uçak modunda** kaydet | Reklam yok, **çökme yok**, hata formda düzgün göründü ("Sunucuya ulaşılamadı") |
| 4 | 3 dk içinde ikinci kayıt | Reklam **yok** — frekans sınırı devrede, kayıt normal düştü |
| 5 | **Ninni çalarken** kaydet | Reklam **yok**. Müzik durdurulup **aynı** kayıt tekrarlandığında reklam geldi — kapının sebebi kesin |
| 6 | Emzirme **Sol → Sağ** | `trigger_timer_start` kapalıyken reklam yok; panelden açılıp uygulama ön plana alınınca aynı düğmede reklam geldi. **Sayaç her iki hâlde de kesintisiz** (01:06 · Sol 00:43 · Sağ 00:00) |
| 7 | Görev **Tamamlandı** ve **Davet Oluştur** | İkisinde de reklam geldi — `complete` ve `invite` tetikleri çalışıyor |
| 8 | Panelden reklamı **kapat** → kaydet | Reklam yok; ayar yeniden derleme olmadan, ön plana gelişteki tazelemeyle uygulandı |

Oturum boyunca `FATAL EXCEPTION` ve `ReactNativeJS:E` satırı **sıfır**.
Uygulama adı, giriş ekranı, izin sayfası ve JWT `issuer` alanı "Bebiqa"
olarak doğrulandı.

> **Android 16'da yerel ağ izni — geliştirme tuzağı.**
> RN 0.88'in **debug** manifest'i `android.permission.ACCESS_LOCAL_NETWORK`
> bildiriyor (`com.facebook.react:react-android:0.88.1`; reklam SDK'sından
> **değil**). Android 16, uygulamanın ilk yerel ağ erişiminde kullanıcıya
> "yakındaki cihazları bul ve bağlan" iznini soruyor. **Reddedilirse** cihaz
> `10.0.2.2` adresine hiç ulaşamıyor: Metro'ya bağlanamadığı için uygulama
> "Unable to load script" veriyor, API de erişilemez oluyor. Belirti sebebi
> hiç göstermiyor — `adb reverse` kurulu ve `adb shell` ile aynı adrese
> erişilebiliyor olsa bile. Çözüm izni vermek:
> ```bash
> adb shell pm grant com.bebiqa.app android.permission.ACCESS_LOCAL_NETWORK
> ```
> Yayın derlemesini etkilemiyor (izin yalnızca debug manifest'inde) ve canlı
> API genel internet adresinde olduğu için kullanıcıda bu istem çıkmıyor.

Reklam SDK'sının manifest'e eklediği izinler ayrı:
`com.google.android.gms.permission.AD_ID`, `ACCESS_ADSERVICES_AD_ID`,
`ACCESS_ADSERVICES_ATTRIBUTION`, `ACCESS_ADSERVICES_TOPICS`
(`play-services-ads-api:25.5.0`). Play Console **veri güvenliği formunda**
reklam kimliği toplandığı beyan edilmeli (§7.6, madde 7).

#### Yeniden koşmak için

`npx tsc --noEmit && npx expo lint` temiz olduktan sonra, panelde
(`/admin/ads`) reklam **açık** + "test kimlikleri" **açık** iken:

1. Bez değişimi → **Kaydet** → kayıt anında düşüyor, onay penceresi 1,6 sn'de
   kapanıyor, **3. saniyede** test reklamı açılıyor ("Test Ad" rozetli).
2. Reklamı kapat → bir sonraki kayıtta reklam yine hazır (otomatik yeniden
   yükleme).
3. **Uçak modunda kaydet** → reklam gelmiyor, kayıt ve onay penceresi normal
   çalışıyor. **En kritik test.**
4. Arka arkaya 3 kayıt → frekans sınırı devrede, ikinci ve üçüncüde reklam yok.
5. Ninni çalarken kaydet → reklam açılmıyor.
6. Emzirme **Sol → Sağ** → sayaç kesintisiz; panel varsayılanıyla reklam hiç
   gelmiyor (`timer_start` kapalı).
7. Görev **Tamamlandı** ve **Davet Oluştur** → reklam geliyor.
8. Panelde reklamı **kapat** → bir sonraki kayıtta reklam gelmiyor (uygulamayı
   ön plana alıp tazeleme beklenir).

Teşhis için `adDebugState()`: başlatıldı mı, hangi birim kimliği, yüklü mü,
bu oturumda kaç gösterim, son gösterim zamanı, bekleyen zamanlayıcı var mı.
Frekans sınırının gerçekten devrede olduğunu emülatörde görmenin tek yolu.
