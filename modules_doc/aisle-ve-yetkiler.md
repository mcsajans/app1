Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **10. Modül olan "Aile ve Yetkiler" (`family`)** geliştirmesini yapacaksın.

> **Not:** Bu dosyanın özgün içeriği kaybolmuştu — depodaki kopya yanlışlıkla
> `uyku-takibi.md` ile birebir aynıydı (bkz. `NOTLAR-ve-EKSIKLER.md` §1.1).
> Aşağıdaki şartname, **hâlihazırda uygulanmış olan** veri modeli ve uçlardan
> geriye dönük yazıldı; yani belge kodu değil, kod belgeyi doğruluyor. Özgün
> metinde fazladan bir istek varsa bu dosyaya eklenmelidir.

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

### Modül 10: Aile ve Yetkiler (`family`) Gereksinimleri

Bir bebeğin kaydı tek bir ebeveyne ait değildir: anne, baba, bakıcı ve
büyükanne/büyükbaba aynı bebeği farklı yetkilerle takip eder. Bu modül "kim
görebilir, kim yazabilir, kim yönetebilir" sorusunu yanıtlar.

#### 1. Backend (Node.js) İhtiyaçları:

- **Veri Modeli — Üyelik (`baby_members`):**
  - `id` (Primary Key)
  - `baby_id` (Foreign Key -> `babies.id`, Zorunlu)
  - `user_id` (Foreign Key -> `users.id`, Zorunlu)
  - `permission` (Enum: 'owner', 'editor', 'viewer' - Zorunlu)
  - `relationship` (Enum: 'anne', 'baba', 'dede', 'babaanne', 'anneanne', 'hala', 'teyze', 'amca', 'dayi', 'kardes', 'ustanne', 'ustbaba', 'bakici', 'diger')
  - `relationship_label` (String, Opsiyonel serbest metin — enum yetmediğinde)
  - `is_active` (Boolean — ayrılan/çıkarılan üye silinmez, pasife alınır)
  - `joined_at`, `created_at`, `updated_at`

- **Veri Modeli — Davet (`baby_invitations`):**
  - `id` (Primary Key)
  - `baby_id`, `invited_by` (Foreign Key -> `users.id`)
  - `email` (String, Zorunlu — davet bu adresle eşleşmek zorundadır)
  - `relationship`, `permission` ('editor' | 'viewer'; 'owner' davetle verilemez)
  - `code_hash` (String — davet kodunun **özeti**; düz kod saklanmaz)
  - `status` (Enum: 'pending', 'accepted', 'declined', 'revoked', 'expired')
  - `expires_at` (DateTime — 7 gün), `accepted_at`, `accepted_by`

- **Yetki Kuralları (sunucuda zorunlu kılınacak):**
  - `viewer` yalnızca okur; `editor` kayıt ekler/düzenler; `owner` ek olarak üye ve davet yönetir, sahipliği devreder, bebeği siler.
  - Her bebeğe bağlı uç, yetkiyi **tek bir ara katmanda** denetlemelidir (`requireBaby('viewer'|'editor'|'owner')`). Yetki denetimi uç uç yazılmamalıdır.
  - Üye olunmayan bir bebekte `403` değil **`404`** dönülmelidir: `403`, "bu id'de bir bebek var" bilgisini sızdırır ve id taramasına açık hâle getirir.
  - Sahip kendini çıkaramaz, kendi yetkisini değiştiremez ve ayrılamaz; önce sahipliği devretmeli ya da bebeği silmelidir.
  - Aynı bebek + e-posta için aynı anda yalnızca bir `pending` davet bulunabilir; yeni davet eskisini iptal eder.

- **API End-point'leri:**
  - `GET /api/v1/babies/:babyId/members` -> Üyeleri ve çağıranın kendi yetkisini listeleme
  - `PUT /api/v1/babies/:babyId/members/:userId` -> Üyenin yetkisini / yakınlığını güncelleme (yalnızca `owner`)
  - `DELETE /api/v1/babies/:babyId/members/:userId` -> Üyeyi aileden çıkarma (yalnızca `owner`)
  - `DELETE /api/v1/babies/:babyId/members/me` -> Kendi isteğiyle ayrılma
  - `POST /api/v1/babies/:babyId/transfer-ownership` -> Sahipliği devretme (eski sahip `editor` olur)
  - `POST /api/v1/babies/:babyId/invitations` -> Davet oluşturma; düz davet kodu **yalnızca bu yanıtta bir kez** döner
  - `GET /api/v1/babies/:babyId/invitations` -> Bebeğe ait davetleri listeleme (yalnızca `owner`)
  - `DELETE /api/v1/babies/:babyId/invitations/:invitationId` -> Bekleyen daveti iptal etme
  - `GET /api/v1/invitations/mine` -> Oturum sahibine gelen bekleyen davetler
  - `POST /api/v1/invitations/accept` -> Daveti kabul etme (`code` veya `invitation_id` ile)
  - `POST /api/v1/invitations/decline` -> Daveti reddetme

- **Denetim İzi:** üye ekleme/çıkarma, yetki değişikliği, davet ve sahiplik devri `activity_log`'a yazılmalıdır — "kim ne zaman kimin yetkisini değiştirdi" sorusu yanıtlanabilir olmalıdır.

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - Backend API'leri ile haberleşecek `familyService` modülünün yazılması.
- **UI & Ekranlar:**
  - **Aile Üyeleri Listesi:**
    - Her üye için yakınlık + ad (örn. "Baba Mehmet"), e-posta, katılma tarihi ve yetki etiketi.
    - Kendi satırının "(sen)" ile işaretlenmesi.
  - **Yetki Yönetimi (yalnızca sahip):**
    - Üye başına yetki ve yakınlık değiştirme, aileden çıkarma, sahipliği devretme.
    - Geri alınamaz işlemlerin (çıkarma, devir) onay diyaloğu ile korunması.
    - Sahip olmayan kullanıcıda bu kontroller **hiç çizilmemeli** — kesin reddedilecek bir düğme sunulmamalı.
  - **Davet Akışı:**
    - E-posta + yakınlık + yetki ile davet oluşturma.
    - Davet kodunun oluşturulduğu anda kart hâlinde gösterilmesi ve paylaşma (Share) düğmesi — kod bir daha okunamaz.
    - Bekleyen davetlerin listelenmesi ve iptal edilebilmesi.
  - **Davet Kabul Ekranı:**
    - Gelen davetlerin listelenmesi, kabul/reddet.
    - Elle "davet kodu gir" alanı (e-postadaki bağlantı çalışmadığında).
    - Kabul sonrası bebek listesinin tazelenmesi.
  - **Ayrılma:**
    - Sahip olmayan üye için "Aileden ayrıl"; kayıtların silinmeyeceğinin açıkça belirtilmesi.

---

### Uygulama Adımları (Lütfen Sırayla Çalış):

1. **Adım 1:** Node.js backend projesinde `baby_members` ve `baby_invitations` şemalarını oluştur; `requireBaby` ara katmanını yazıp tüm bebek bağlamlı uçlara uygula.
2. **Adım 2:** Üye ve davet uçlarını yaz; sahip kısıtlarını (kendini çıkarma, kendi yetkisini değiştirme, ayrılma) ve 404-yerine-403 kuralını test et.
3. **Adım 3:** Tamamlanan backend API'lerinin istek/yanıt detaylarını `TEKNIK_DOKUMAN.md` dosyasına kaydet.
4. **Adım 4:** React Native projesine geç; `familyService` modülünü oluştur, üye listesi ve yetki yönetimi UI'sını geliştir.
5. **Adım 5:** Davet oluşturma, kod paylaşma ve davet kabul akışlarını geliştirip test et.
