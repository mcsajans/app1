Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **12. Modül olan "Süt Sağma" (`pumping`)** geliştirmesini yapacaksın.

### Proje Mimarısı & Çalışma Kuralları
1. **Dizin Yapısı & Bağımsızlık:**
  - Projemiz iki ayrı dizinden oluşuyor: Backend (`/backend` veya Node.js projesinin olduğu dizin) ve Mobil App (`/app` veya React Native projesinin olduğu dizin).
  - Backend ve Mobile App projeleri birbirinden bağımsız dizinlerde çalışmaktadır.
2. **Dokümantasyon:**
  - Projede yapılan tüm mimari kararlar, API end-point tanımları ve veri modelleri projenin kök dizininde (veya ilgili dizinde) yer alan `teknik_dokuman.md` dosyasına eksiksiz şekilde yazılacak/güncellenecektir.
3. **Geliştirme Akışı (Strict Step-by-Step Order):**
  - **ÖNCE BACKEND:** İlk olarak Node.js tarafındaki veri modelleri, dondurucu/buzdolabı stok takip mantığı ve API end-point'leri geliştirilmeli ve test edilmelidir.
  - **DOKÜMANTASYON:** API ve veri yapısı tamamlandığında `teknik_dokuman.md` dosyasına ilgili modül detayları eklenmelidir.
  - **SONRA REACT NATIVE:** Backend API'leri hazır hale geldikten sonra React Native tarafına geçilmeli, sağma kronometresi, stok takibi ve UI bileşenleri geliştirilmelidir.

---

### Modül 12: Süt Sağma (`pumping`) Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:
- **Veri Modeli (Schema/Entity):**
  - `id` (UUID/Primary Key)
  - `baby_id` (UUID, Foreign Key -> `babies.id`, Zorunlu)
  - `left_amount` (Float, Sol Göğüsten Sağılan Miktar - ml/oz)
  - `right_amount` (Float, Sağ Göğüsten Sağılan Miktar - ml/oz)
  - `total_amount` (Float, Toplam Sağılan Miktar - ml/oz)
  - `pumped_at` (DateTime/ISOString, Sağma Zamanı - Zorunlu)
  - `storage_location` (Enum: 'fridge', 'freezer', 'used_immediately', Saklama Yeri - Varsayılan: 'fridge')
  - `is_used` (Boolean, Süt Tüketildi mi / Stoktan Düşüldü mü? - Varsayılan: false)
  - `notes` (Text, Opsiyonel ebeveyn notu)
  - `created_at`, `updated_at`

- **API End-point'leri:**
  - `POST /api/v1/pumping` -> Yeni süt sağma kaydı oluşturma
  - `GET /api/v1/pumping?baby_id=:babyId` -> Seçili bebeğe ait sağma geçmişini listeleme
  - `GET /api/v1/pumping/stash?baby_id=:babyId` -> Dondurucu ve buzdolabındaki mevcut süt stoğu toplamını getirme
  - `PATCH /api/v1/pumping/:id/use` -> Stoktaki bir sütü kullanıldı/tüketildi olarak işaretleme
  - `DELETE /api/v1/pumping/:id` -> Sağma kaydını silme

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - `pumpingService` entegrasyonu.
- **UI & Ekranlar:**
  - **Sağma Ekleme Ekranı / Kronometre:**
    - Sol ve Sağ göğüs için ayrı ayrı ml/cl miktar girdisi veya canlı sağma kronometresi.
    - Saklama Yeri Seçimi (Buzdolabı, Derin Dondurucu, Hemen Tüketildi).
  - **Süt Stoğu (Milk Stash) Widget'ı:**
    - Buzdolabında ve dondurucuda toplam kaç ml kullanılabilir süt kaldığını gösteren stok kartı.
  - **Geçmiş & Liste Ekranı:**
    - Geçmiş sağma oturumlarının kronolojik listesi ve stok durumları.

---

### Uygulama Adımları (Lütfen Sırayla Çalış):
1. **Adım 1:** Node.js backend projesinde `pumping` veritabanı şemasını oluştur, stok hesaplama logic'lerini ve API end-point'lerini yaz (`baby_id` ilişkili).
2. **Adım 2:** Tamamlanan backend API'lerinin istek/yanıt detaylarını `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native projesine geç; `pumpingService` modülünü oluştur, sağma kronometresi ve stok takip state'ini kurgula.
4. **Adım 4:** Sağma kayıt formu, dondurucu süt stoğu widget'ı ve geçmiş listesi UI bileşenlerini geliştirip test et.
---

## Ek Geliştirme — Ekleme modali ve başlangıç reklamı (2026-11-21)

**"+ Sağma ekle" düğmesi ve alt sayfa.** Miktar formu ekranda sabit
duruyordu; stok kartı, kronometre ve geçmiş arasında sıkışıyor, sağma biten
anne miktarı girmek için ekranı tarıyordu. Form artık `PumpingFormSheet`
içinde ve düğmeyle açılıyor. Kronometreden kalan süre varsa ekranda
"Ölçülen süre hazır: 03:20" satırı duruyor ve aynı bilgi sayfanın içinde de
görünüyor — kaydı yazarken `duration_sec` olarak gidiyor.

**"Sağmaya başla" → 3 saniye sonra tam ekran reklam** (`timer_start`
tetiği, panelden kapatılabilir). Gecikme bu çağrıya özel (`delayMs: 3000`);
panelin genel değeri 2 saniye. Gerekçe: pompayı kuran kullanıcı telefonu
bırakıyor, bir saniye fazla bekleme reklamın "tam elden bırakırken" açılma
olasılığını azaltıyor. Reklam `await` edilmiyor ve hiç `throw` etmiyor —
sayaç her hâlükârda başlıyor.

**Kayıttan sonra da reklam** (`save` tetiği, `withSaveFeedback`).

Uyku modülündeki sessizlik (`muted`) burada **yok**: sağma sırasında bebeğin
uyuyor olması gerekmiyor ve sesi kısmak reklam gelirini düşürüyor
(`TEKNIK_DOKUMAN.md` §23.4).

---

## Reklam davranışı (2026-11-21)

| Eylem | Tetik | Gecikme |
|-------|-------|---------|
| "Sağmaya başla" | `timer_start` | **3 sn** |
| "+ Sağma ekle" → Kaydet | `save` | panel değeri (2 sn) |

Ses kısılmıyor — sağma sırasında bebeğin uyuyor olması gerekmiyor ve sesi
kısmak reklam gelirini düşürüyor (uyku modülünde tersi geçerli).

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
