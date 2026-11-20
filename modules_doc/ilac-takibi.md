# Modül 16 — İlaç Takibi (`medication`)

**Durum:** **uygulandı** (2026-11-21). Dosyanın ilk hâli kodlamadan önce
verilen kararları taşıyordu; §11'de uygulamada ne değişti ve ne eksik kaldı
yazıyor. Uç sözleşmesi ve ayrıntılar: `TEKNIK_DOKUMAN.md` §22.16.

İlaç takibi `TEKNIK_DOKUMAN.md` §1.2'de "v2+ kapsam dışı" olarak geçiyordu;
aynı listedeki gelişim takibi ve aşı takvimi bu arada yazıldı, sıradaki bu.

---

## 1. Bugün ne var, neden yetmiyor

İlaç kelimesi kod tabanında üç yerde geçiyor ve üçü de **farklı** bir soruyu
cevaplıyor:

| Yer | Ne yapıyor | Neyi yapmıyor |
|-----|------------|---------------|
| `tasks.task_type = 'medicine'` (Modül 13) | Bir aile üyesine "ilaç içir" görevi atar, `details.dose` serbest metin | Görev tamamlanınca ilacın **ne zaman, ne kadar** verildiği kaydı kalmaz; kür kavramı yok |
| `reminders.category = 'medicine'` (Modül 9) | Periyodik bildirim planlar | Bildirim "verildi" bilgisini geri almaz; doz geçmişi tutulmaz |
| `feedings.note` / serbest notlar | Ebeveyn el yordamıyla yazar | Aranabilir, toplanabilir, raporlanabilir değil |

Eksik olan tek şey ortak: **verilmiş dozun kaydı.** Gece 03:00'te uyanan
ebeveynin sorduğu soru "hatırlatıcı kurdum mu" değil, *"en son ne zaman
verildi, şimdi verebilir miyim"*. Bu soru ancak her dozun zaman damgalı bir
satır olmasıyla cevaplanır — görev ve hatırlatıcı plandır, kayıt değildir.

İki ebeveynli kullanım bunu keskinleştiriyor: ateş düşürücüyü anne 22:40'ta
verdiyse, baba 23:10'da aynı şişeyi eline aldığında bunu **telefonda
görmelidir**. Projenin varlık sebebi olan "paylaşımlı kayıt" ilkesinin en
kritik uygulaması bu modül.

---

## 2. Kapsam

**Kapsam içi**

- İlaç/kür tanımı: ad, biçim (şurup, damla, fitil, krem…), kuvvet ("100 mg/5 ml"),
  varsayılan doz, veriliş yolu, program (sabit saatler / X saatte bir / gerektikçe),
  kür başlangıç-bitiş.
- Doz kaydı: ne zaman, ne kadar, kim verdi, atlandı mı, not.
- "Sonraki doz" hesabı ve bildirimi; kür bitince bildirimlerin susması.
- Geçmiş, günlük akış ve rapor entegrasyonu; dışa aktarma.

**Kapsam dışı (bilinçli)**

- **Doz hesaplama.** Uygulama kilograma göre mg önermez, maksimum günlük dozu
  ilaç veritabanından bilmez, etkileşim uyarısı vermez. Gerekçe §3(a).
- İlaç barkodu/prospektüs veritabanı, eczane stoğu, reçete okuma.
- Yetişkin ilaçları: kayıt bebeğe bağlı (`baby_id`), anneye değil.

---

## 3. Tasarım kararları

### (a) Uygulama doz **önermez**, yalnızca kaydeder

Bu modülün tek işi ebeveynin söylediğini yazmak ve geri okumaktır. "6 kg bebek
için 4 ml" türünde bir hesap, uygulamayı tıbbi tavsiye veren bir ürün hâline
getirir: hem sorumluluk hem de mağaza politikası açısından başka bir kategori.
Ekranda görünen tek "akıl" şudur: *son doz ne zaman verildi, kür bitimine kaç
gün kaldı.* Varsayılan doz alanı da hesaplanmaz — ebeveyn bir kez yazar, sonraki
dozlarda hazır gelir.

### (b) Erken doz **engellenmez**, işaretlenir

"En az 6 saat arayla" kuralı ihlal edildiğinde sunucu kaydı **reddetmez**.
Gerekçe: ilaç gerçek dünyada çoktan verilmiştir; kaydı reddetmek ilacı geri
almaz, yalnızca izini siler ve bir sonraki dozu hesaplayan tek veriyi yok eder.
Kayıt `is_early = 1` ile yazılır, yanıt bir `warning` taşır, ekran kaydı
kırmızı rozetle gösterir.

Bu, projedeki alışılmış 409 davranışının bilinçli istisnasıdır: uyku ve
emzirmede çakışan kayıt **veriyi bozar** (günlük toplam şişer), burada ise
çakışma **gerçeğin kendisidir**.

### (c) Program üç biçim, fazlası yok

| `schedule_type` | Anlamı | Sonraki doz |
|-----------------|--------|-------------|
| `fixed_times` | Günün belirli saatleri (`08:00, 20:00`) | Takvimden |
| `interval` | "X saatte bir" | Son dozdan + `interval_hours` |
| `as_needed` | Gerektikçe (ateş düşürücü) | Hesaplanmaz; yalnızca `min_interval_hours` kontrolü |

Dördüncü bir biçim (haftanın günleri, azalan doz şeması) ilk sürüme
girmiyor: antibiyotik + ateş düşürücü + D vitamini bu üçünü kapsıyor ve
hatırlatıcı modülündeki `custom_days` desteği gerekirse sonradan buraya da
taşınabilir.

### (d) Kür ve doz **iki ayrı tablo**

Tek tabloda tutulsaydı (her doz kendi ilaç adını taşısın) üç şey kaybolurdu:
kür bitiş tarihi, "bugün 3 dozun 2'si verildi" sayımı ve ilaç adının tutarlı
yazımı ("Calpol" / "calpol" / "kalpol"). Ayrıca `as_needed` ilaçlar kür değildir
ama yine de bir tanımı vardır — şişe evde durur, aylarca kullanılır.

Kür kaydı **olmadan** da doz girilebilmeli (`medication_id NULL`): acil bir
anda ebeveyn önce dozu yazar, tanımı sonra doldurur. Tanımı zorunlu kılmak, en
telaşlı anda dört alanlı bir form açmak demekti.

### (e) Atlanan doz da bir kayıttır

`status`: `given` | `skipped`. "Vermedim çünkü ateş düşmüştü" bilgisi doktorun
soracağı bir şey ve boşluktan ayırt edilmeli: kayıt yoksa "verildi mi, yoksa
yazmayı mı unuttuk" sorusu cevapsız kalır.

### (f) Giriş biçimi: emzirme/uykudaki **sekme** düzeni

Doz girişi de aynı iki soruyu soruyor — "şimdi mi, geçmişte mi". 2026-11-21'de
emzirme ve uyku modüllerinde kurulan düzen aynen kullanılır (`IconTabs`,
`src/components/ui.tsx`):

```
İlaç: Parol Şurup  ·  Doz: 4 ml
┌───────────────┬────────────────┐
│ ⏱ Anlık       │ 📅 Geri tarihli │
└───────────────┴────────────────┘
 Anlık                      Geri tarihli
 [ Şimdi verdim ]           Veriliş zamanı [tarih][saat]
 ☐ önceki bir saatte verdim  Doz [ 4 ] [ml ▾]
   └ yalnızca SAAT           [ not ]
 [ not ]                     [ Bilgileri kaydet ]
```

Saat-yalnız giriş kuralı ortak: `momentFromClock()`
(`src/core/records/manualWindow.ts`) ileri kalan saati düne yazar — "gece
02:00'de verdim" sabah 09:00'da girilebilsin diye. Tavan burada **48 saat**
(`MAX_MEDICATION_BACKDATE_SEC`): ilaç kaydı geriye dönük girilir ama bir
haftalık toplu giriş tıbbi olarak anlamsız.

### (g) Bildirim ilaca ait, hatırlatıcı modülüne devredilmez

İlk düşünce `reminders` modülünü kullanmaktı; vazgeçildi, çünkü ilaç bildirimi
üç şeyi bilmek zorunda: kür bitiş tarihi (bildirim kendiliğinden susmalı),
"bu doz verildi" işareti (verilince o günün bildirimi düşmeli) ve erken doz
koruması. Hatırlatıcılar bunların hiçbirini bilmiyor ve bilmesi için
kategorisine özel mantık eklemek, genel modülü tek bir tüketici için
bozmak olurdu. Aşı modülü de aynı sebeple kendi bildirimlerini kuruyor
(`src/core/notifications/` altındaki aşı planlayıcısı).

Bildirim eylemleri: **Verildi** (tek dokunuşla doz kaydı), **1 saat ertele**.

### (h) Reklam gösterilmez

Doz kaydının ardından geçiş reklamı açmak, ilacı verirken telefona bakan
ebeveyni en kötü anda ekrandan atar; ayrıca sağlık bağlamında reklam
göstermek mağaza politikası açısından da tartışmalı. Teknik sonuç:
`withSaveFeedback()` sarmalayıcısı tetiği **zorunlu** attığı için
(`adTrigger` varsayılanı `'save'`) sarmalayıcıya "tetik yok" seçeneği
eklenmeli — `adTrigger: AdTrigger | null`. Kaydetme onay penceresi
korunur, yalnızca reklam çağrısı atlanır.

### (i) Yetki: `editor`, görüntüleme `viewer`

Diğer kayıt modülleriyle aynı (`requireBaby('editor')`). Bakıcıya ilaç
verdirten aile, ona zaten düzenleme yetkisi veriyor; ayrı bir "ilaç yetkisi"
tanımlamak yetki matrisini (§5.5) tek modül için ikiye bölerdi.

### (j) Sağlık verisi olarak işaretlenir

İlaç kaydı diğer kayıtlardan daha hassastır. Üç sonuç:
1. Yönetim paneli bu tabloların **içeriğini** göstermez; sayaç ve hata
   ayıklama için yalnızca satır sayısı.
2. Hesap silme akışında (§ KVKK bölümü) diğer kayıtlarla birlikte silinir.
3. Dışa aktarmada ayrı bir bölüm olarak çıkar ki doktora gösterilebilsin.

---

## 4. Veri modeli

`migrations/023_medication.sql` *(öneri)* — ev stilini izler: `sync_uuid`,
`tz_offset_min`, `entry_source`, yumuşak silme, `created_by`/`updated_by`.

```sql
CREATE TABLE IF NOT EXISTS medications (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sync_uuid      CHAR(36)        NOT NULL,
  baby_id        BIGINT UNSIGNED NOT NULL,

  name           VARCHAR(120)    NOT NULL,       -- "Parol Şurup"
  form           ENUM('syrup','drops','tablet','suppository','cream','spray','other')
                                 NOT NULL DEFAULT 'syrup',
  strength       VARCHAR(60)     NULL,           -- "120 mg/5 ml" — serbest metin, hesaplanmaz
  route          ENUM('oral','rectal','topical','nasal','other') NOT NULL DEFAULT 'oral',

  -- Varsayılan doz: formu her açışta yeniden yazmamak için. Hesaplanmaz (§3a).
  default_amount DECIMAL(6,2)    NULL,
  amount_unit    ENUM('ml','mg','damla','adet','olcek','doz') NOT NULL DEFAULT 'ml',

  schedule_type  ENUM('fixed_times','interval','as_needed') NOT NULL DEFAULT 'as_needed',
  fixed_times    JSON            NULL,           -- ["08:00","20:00"] — TimeListField ile girilir
  interval_hours DECIMAL(4,1)    NULL,           -- schedule_type='interval'
  -- Erken doz UYARISI için; engellemek için değil (§3b).
  min_interval_hours DECIMAL(4,1) NULL,
  max_doses_per_day  TINYINT UNSIGNED NULL,

  started_on     DATE            NOT NULL,
  ends_on        DATE            NULL,           -- NULL → süresiz (D vitamini)
  prescriber     VARCHAR(120)    NULL,           -- "Dr. ..." / "Aile hekimi"
  reason         VARCHAR(200)    NULL,           -- "Orta kulak iltihabı"
  note           VARCHAR(500)    NULL,
  status         ENUM('active','finished','stopped') NOT NULL DEFAULT 'active',

  created_by     BIGINT UNSIGNED NOT NULL,
  updated_by     BIGINT UNSIGNED NULL,
  created_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                 ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at     DATETIME(3)     NULL,

  UNIQUE KEY uq_medication_uuid (sync_uuid),
  KEY idx_medication_baby (baby_id, status, started_on),
  CONSTRAINT fk_medication_baby FOREIGN KEY (baby_id) REFERENCES babies(id) ON DELETE CASCADE,
  CONSTRAINT fk_medication_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS medication_doses (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sync_uuid      CHAR(36)        NOT NULL,
  baby_id        BIGINT UNSIGNED NOT NULL,
  -- NULL olabilir: tanımsız, tek seferlik doz (§3d).
  medication_id  BIGINT UNSIGNED NULL,
  -- Tanım yoksa adı burada durur; tanım varsa kopyalanır (ad sonradan
  -- değişse bile geçmiş satır o günkü adı göstersin).
  name_snapshot  VARCHAR(120)    NOT NULL,

  given_at       DATETIME(3)     NOT NULL,
  tz_offset_min  SMALLINT        NOT NULL DEFAULT 180,
  amount         DECIMAL(6,2)    NULL,
  amount_unit    ENUM('ml','mg','damla','adet','olcek','doz') NOT NULL DEFAULT 'ml',

  status         ENUM('given','skipped') NOT NULL DEFAULT 'given',
  -- Minimum aralıktan önce verildi: kayıt kabul edilir, işaretlenir (§3b).
  is_early       TINYINT(1)      NOT NULL DEFAULT 0,
  skip_reason    VARCHAR(200)    NULL,
  note           VARCHAR(500)    NULL,
  entry_source   ENUM('manual','timer','notification','task') NOT NULL DEFAULT 'manual',

  created_by     BIGINT UNSIGNED NOT NULL,
  updated_by     BIGINT UNSIGNED NULL,
  created_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                 ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at     DATETIME(3)     NULL,

  UNIQUE KEY uq_dose_uuid (sync_uuid),
  KEY idx_dose_baby_time (baby_id, given_at),
  KEY idx_dose_medication (medication_id, given_at),
  CONSTRAINT fk_dose_baby FOREIGN KEY (baby_id) REFERENCES babies(id) ON DELETE CASCADE,
  -- Tanım silinirse dozlar kalır: geçmiş kaybolmaz, yalnızca bağ kopar.
  CONSTRAINT fk_dose_medication FOREIGN KEY (medication_id)
    REFERENCES medications(id) ON DELETE SET NULL,
  CONSTRAINT fk_dose_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;
```

Ayrıca aynı göçte:

- `modules` kataloğuna satır: `('medication','İlaç Takibi','Kür ve doz takibi, sonraki doz hatırlatması','medication',0,0,16)`
  — **`default_on = 0`**: her bebek ilaç kullanmıyor, ızgarayı herkese
  kalabalıklaştırmanın anlamı yok (ek gıda ve sağma da öyle).
- `activity_log.entity` ENUM'una `'medication'` eklenir.
- `v_timeline` görünümüne `UNION ALL` ile doz satırları
  (`kind='medication'`, `started_at = given_at`, `subtype = form`,
  `note = name_snapshot + doz`).

---

## 5. Uçlar

`babyRecordsRouter` deseni; hepsi `requireBaby(...)` ile korunur.

| Yöntem | Yol | Yetki | Açıklama |
|--------|-----|-------|----------|
| GET | `/babies/{id}/medications` | viewer | `?status=active` — kürler + her biri için `last_dose_at`, `next_due_at`, `today_given` |
| POST | `/babies/{id}/medications` | editor | Kür/ilaç tanımı |
| PUT | `/medications/{id}` | editor | Düzenleme |
| POST | `/medications/{id}/finish` | editor | `status='finished'`, bildirimler susar |
| DELETE | `/medications/{id}` | editor | Yumuşak silme; dozlar kalır |
| GET | `/babies/{id}/medication-doses` | viewer | `?from=&to=&medication_id=` |
| POST | `/babies/{id}/medication-doses` | editor | Doz kaydı; **422** geçersiz değer, erken dozda **200 + `warning`** |
| PUT | `/medication-doses/{id}` | editor | Saat/doz düzeltme |
| DELETE | `/medication-doses/{id}` | editor | Yumuşak silme |
| GET | `/babies/{id}/medications/due` | viewer | Bildirim planlayıcısının okuduğu özet: sıradaki dozlar |

**Doğrulama kuralları** (`src/lib/manualEntry.ts` içindeki yardımcılarla aynı
ruhta):

- `given_at` gelecekte olamaz (`FUTURE_TOLERANCE_SEC = 120`) → **422**.
- `given_at` 48 saatten eski olamaz → **422**.
- `amount` 0'dan büyük, `DECIMAL(6,2)` sınırları içinde → **422**.
- `min_interval_hours` ihlali → **kabul**, `is_early = 1`, yanıtta
  `warning: "Son doz 2 saat 10 dakika önce verildi"` (§3b).
- `max_doses_per_day` aşımı → yine kabul, aynı biçimde uyarı.
- Kür `ends_on`'dan sonra doz → kabul, uyarı (kür uzamış olabilir).

Yani bu modülde **409 yok**: çakışma kavramı burada veri hatası değil,
klinik bir durum.

---

## 6. Bildirimler

`src/core/notifications/` altında ilaç planlayıcısı (`medicationAlarms.ts`),
aşı ve görev planlayıcılarıyla aynı iskelet:

- Kanal: mevcut `reminders` kanalı yeterli; ayrı kanal, kullanıcıya ayarlanacak
  bir şey daha demek.
- Kimlik: `med-{medicationId}-{occurrenceTs}` — yeniden planlamada eski
  bildirimler kimliğinden bulunup iptal edilir (aşı modülündeki desen).
- `fixed_times`: kür aralığındaki her gün için saatler.
  `interval`: son dozdan türetilir, her doz kaydında yeniden planlanır.
  `as_needed`: bildirim kurulmaz — yalnızca "artık verebilirsin" bilgisi
  ekranda gösterilir.
- Eylemler: **Verildi** → `entry_source='notification'` ile doz yazar;
  **1 saat ertele**.
- Sessiz saat (`quiet_hours`) ilaç bildirimlerini **bastırmaz**: gece 02:00
  dozu tam da bastırılmaması gereken bildirimdir. Bu, sessiz saat kuralının
  belgelenmiş tek istisnası olur.

---

## 7. Mobil taraf

| Dosya | İş |
|-------|-----|
| `src/modules/medication/MedicationScreen.tsx` | Aktif kürler, bugünün dozları, geçmiş |
| `src/modules/medication/DosePanel.tsx` | Sekmeli doz girişi (§3f) |
| `src/modules/medication/MedicationFormSheet.tsx` | Kür ekleme/düzenleme (`BottomSheet`) |
| `src/core/api/modules.ts` | `medicationService` |
| `src/core/modules/types.ts` + `catalog.ts` | `'medication'` anahtarı, meta, `sortOrder: 16` |
| `src/core/navigation/moduleScreens.ts` | Ekran bağı |
| `src/components/Icon.tsx` | `medication: 'pill'` — anahtar modül anahtarıyla **aynı** olmak zorunda (`ModuleMeta` açıklaması) |
| `src/core/theme/index.ts` | `moduleTint.medication` |

Ekran iskeleti:

```
[Aktif kürler]
  💊 Parol Şurup · 4 ml · 6 saatte bir
     Son doz 13:40 · Sonraki 19:40        [ Verildi ]
  💊 D Vitamini · 3 damla · her gün 10:00
     Bugün verildi ✓                      [ Verildi ]

[+ İlaç ekle]

[Bugün]
  13:40  Parol Şurup 4 ml        — anne
  10:05  D Vitamini 3 damla      — baba
  02:10  Parol Şurup 4 ml  erken — anne
```

"Verildi" düğmesi **tek dokunuş**: varsayılan dozu ve şu anı kullanır, form
açmaz. Sekmeli panel yalnızca düzeltme/geçmiş giriş için açılır. Gerekçe aynı:
ilaç verilirken bir el bebekte.

---

## 8. Diğer modüllerle ilişki

- **Günlük Akış (Modül 10):** `v_timeline`'a eklenir; `kind='medication'`
  satırı ilaç adı + dozla çizilir. Görünüm **düz sütun** taşıyor
  (`note`=ad, `amount_ml`=miktar, `subtype`=birim); "Parol Surup · 4 ml"
  metnini ekran birleştiriyor. SQL'de birleştirmek harmanlama sorunu
  çıkarıyordu (aşağıya bak). Filtre listesine (`timeline.ts` içindeki
  `kind` kümesi ve mobildeki kategori rozetleri) eklenmesi unutulmamalı.
- **Görevler (Modül 13):** `task_type='medicine'` görevi tamamlandığında
  ebeveyne "bunu doz olarak da kaydedeyim mi?" sorulur. Otomatik kaydetmek
  yanlış olur: görev "ilacı hazırla" da olabilir.
- **Hatırlatıcılar (Modül 9):** `category='medicine'` hatırlatıcıları durur,
  ama ilaç modülü açıkken ekranda "bunun yerine kür tanımla" ipucu verilir.
  Kaldırılmaz — eski kullanıcıların kurduğu hatırlatıcılar çalışmaya devam
  etmeli.
- **Aşı Takibi (Modül 14):** aşı sonrası ateş düşürücü en sık senaryolardan
  biri; aşı detayındaki yan etki bölümünden tek dokunuşla doz kaydı açılabilir.
- **Raporlar (Modül 12):** haftalık özete "verilen doz sayısı / atlanan doz"
  satırı; kür bazında tamamlanma yüzdesi.

---

## 9. Uygulama sırası

1. **Göç** `023_medication.sql` — iki tablo, katalog satırı, `activity_log`
   ENUM'u, `v_timeline` güncellemesi.
2. **Sunucu** `src/routes/v1/medication.ts` — uçlar, zod şemaları,
   `logActivity`, `notifyRoutine`; `src/lib/medication.ts` içinde saf
   yardımcılar (`nextDueAt`, `isEarly`, `dosesOnDay`) ve bunların
   `vitest` testleri — saf olmaları tam da bunun için.
3. **Doküman** `TEKNIK_DOKUMAN.md`: yeni bölüm (§16 sırası boşsa oraya),
   §22 uç tablosuna satırlar, §4.3 timeline görünümü güncellemesi.
4. **Mobil** servis → katalog/ikon/tema → ekran → sekmeli panel →
   bildirim planlayıcısı.
5. **`withSaveFeedback`** imzasına `adTrigger: AdTrigger | null` (§3h).
6. **E2E** `scripts/e2e/medication_e2e.sh` — diğer modüllerin deseni:
   kür aç, doz yaz, erken doz uyarısı, atlanan doz, kür bitir, yetki
   (viewer 403), yumuşak silme.

---

## 10. Uygulandı — ne yapıldı

**Sunucu**

- `migrations/023_medication.sql` — `medications` + `medication_doses`,
  modül kataloğu satırı (`default_on = 0`), `activity_log.entity` ENUM'u,
  `v_timeline` görünümüne doz satırları.
- `src/lib/medication.ts` *(saf)* + `medication.test.ts` — 27 vitest testi:
  `nextDueAt`, `earlyWarning`, `dailyLimitWarning`, `assertDoseMoment`,
  `assertSchedule`, `localDay`, `humanGap`, `minutesOfClock`.
- `src/routes/v1/medication.ts` — 10 uç; `index.ts`'e bağlandı.
- `src/services/activity.ts` — `'medication'` varlık türü.
- `src/routes/v1/timeline.ts` — `medication` kategori süzgecine eklendi.

**Yönetim paneli**

- Modül satırı göçle geliyor; `/admin/modules` ekranı veri güdümlü olduğu
  için aç/kapa anahtarı kendiliğinden çıktı.
- Panel ana sayfasına **yalnızca sayı** eklendi ("İlaç kaydı"); içerik
  hiçbir ekranda gösterilmiyor (§3j).

**Mobil**

- `src/modules/medication/`: `MedicationScreen`, `DoseSheet`,
  `MedicationFormSheet`, `labels.ts`.
- `src/core/api/modules.ts` — `medicationService` ve tipleri.
- Katalog/tema/ikon/navigasyon: `medication` anahtarı, şeftali ton,
  `pill` ikonu, ekran eşlemesi.
- `src/core/notifications/medicationAlarms.ts` — sıradaki doz uyarıları
  (`/medications/due` → yerel bildirim); `scheduler.ts`'e
  `cancelMedicationAlarms()`.
- `withSaveFeedback()` artık `adTrigger: null` kabul ediyor; ilaç ekranı
  reklam tetiklemiyor (§3h).
- Günlük akış: `kind = 'medication'` için ikon, etiket, ton ve süzgeç;
  kart alt başlığında ilacın adı ve dozu.
- `src/components/records.tsx` — `useNowMs()`: "35 dk sonra" gibi göreli
  metinler için saf saat kaynağı (render'da `Date.now()` React derleyicisinin
  saflık kuralına takılıyor).

### Uygulamada değişen kararlar

- **`GET /medications` türetilmiş alanları tek sorguda topluyor** (son doz,
  bugünkü sayım). Planda kür başına sorgu vardı; liste uçlarında N+1 doğru
  değil. `/medications/due` ise kür başına tek satır okuyor — orada liste
  zaten yalnızca aktif kürler.
- **`v_timeline`'da metin SQL'de kurulmuyor** (`migrations/027`). İlk
  sürüm notu `CONCAT` + `CASE` ile kuruyordu ve iki ortamda iki ayrı hata
  verdi:
  - Yerelde (utf8mb4) dizgi sabitleri bağlantının harmanlamasını alıyor,
    sütunlar `utf8mb4_unicode_ci`: UNION "Illegal mix of collations" dedi.
    Açık `COLLATE utf8mb4_unicode_ci` yazarak geçildi.
  - Canlıda veritabanı **utf8mb3** ("utf8") olduğu için bu kez o açık
    harmanlama reddedildi: *"COLLATION 'utf8mb4_unicode_ci' is not valid
    for CHARACTER SET 'utf8'"* — göç 023 yarıda kaldı.

  Harmanlama adı yazmak iki ortamda birden doğru olamaz; çözüm ifadeyi
  **kaldırmaktı**. Görünüm artık düz sütun döndürüyor, metni ekran
  birleştiriyor; böylece veritabanının karakter setinden bağımsız. Ders:
  görünümlerde dizgi üretme — sabit, `CASE` ve `CONCAT` harmanlama
  taşır.
- **Doz sayfasında "atlandı" bir durum çipi**, ayrı bir akış değil: aynı
  formun tek alanı değişiyor (miktar yerine sebep).

### Henüz yapılmadı

1. **Bildirim eylemleri.** Uyarı kuruluyor ama üzerindeki "Verildi" /
   "1 saat ertele" düğmeleri yok (kategori + yanıt yönlendirmesi gerekiyor;
   `timerActions.ts` deseni). Şu an bildirime dokunmak uygulamayı açıyor.
2. **Görev entegrasyonu.** `task_type='medicine'` tamamlandığında "doz olarak
   da kaydedeyim mi?" sorusu (§8).
3. **Rapor satırları.** Haftalık özete verilen/atlanan doz sayısı (§8).
4. **Aşı ekranından kısa yol** (§8).
5. **E2E betiği** (§9 adım 6) — depoda şu an hiç e2e betiği yok.

---

## 11. Açık sorular

1. **Birim çevrimi.** "5 ml = 1 ölçek" eşlemesi tutulmalı mı? İlk sürümde
   hayır; iki birimde girilen dozların toplamı raporda ayrı satır olur.
2. **Çoklu bebek.** İkizlerde aynı ilaç iki ayrı kür olarak mı açılır?
   Önerilen: evet (kayıt `baby_id`'ye bağlı), ama ekleme formunda "diğer
   bebeğe de ekle" kutucuğu.
3. **Rıza metni.** Sağlık verisi için `consents` modülünde ayrı bir madde
   gerekiyor mu, yoksa mevcut "kayıt verisi" maddesi kapsıyor mu? Hukuki
   kontrol gerekir; teknik taraf hazır (`/admin/pages` + `consents`).
4. **Sessiz saat istisnası** (§6) kullanıcıya nasıl anlatılır — ayar
   ekranında tek satır açıklama yeterli mi?


---

## Ek Geliştirme — Liste ve ekleme ayrıldı, reklam açıldı (2026-11-21)

**Ekleme düğmeleri listenin dışına çıktı.** "İlaç ekle" ve "Tek seferlik doz"
ilaç kartının **içinde**, son ilacın "Verildi / Doz kaydı / Ayrıntı"
satırının hemen altında duruyordu; aynı ilaca ait bir eylemmiş gibi
okunuyordu. Artık ekranın en üstünde, kartların dışında.

**Her ilaç kendi kartında.** Tek kartta alt alta dizilen üç düğmeli satırlar
hangi düğmenin hangi ilaca ait olduğunu bulanıklaştırıyordu. Liste artık
"Süren ilaçlar" başlığı altında, ilaç başına bir kart.

**Reklam açıldı.** İlk sürümde bu modülde reklam bilinçli olarak kapalıydı
(§3h, sağlık bağlamı). Ürün kararıyla diğer modüllerle aynı hâle getirildi:
kür ve doz kaydından sonra `save` tetiği atılıyor. Panelden kapatılabilir
(`/admin/ads`), `withSaveFeedback`in `adTrigger: null` seçeneği de yerinde
duruyor — gerekirse tek satırla geri alınır.

---

## Reklam davranışı (2026-11-21)

| Eylem | Tetik |
|-------|-------|
| "+ İlaç ekle" → Kaydet | `save` |
| "Doz kaydı" / "Tek seferlik doz" → Kaydet | `save` |
| "Verildi" (tek dokunuş) | `save` |
| Kürü bitir / sil | — (reklam yok) |

İlk sürümde bu modülde reklam bilinçli olarak kapalıydı (sağlık bağlamı,
§3h); ürün kararıyla diğer modüllerle aynı hâle getirildi. Panelden
kapatılabilir ve `withSaveFeedback`in `adTrigger: null` seçeneği yerinde
duruyor.

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
