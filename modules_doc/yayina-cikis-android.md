# Android Yayın Rehberi — adım adım

Bu dosya **senin yapacağın** işleri sırayla anlatır. Kod ve yapılandırma
tarafı hazır; aşağıdaki adımların çoğu hesap, panel ve Play Console işi —
kodla yapılamayan, yapılmaması gereken şeyler.

Son güncelleme: 2026-11-21 · Hedef: **yalnızca Android** (iOS bu turda yok).

---

## 0. Hazır olanlar (kod tarafı)

| Konu | Durum |
|------|-------|
| `app.json` — paket adı `com.bebiqa.app`, sürüm 1.0.0, versionCode 1 | ✅ |
| Uyarlanabilir ikon (ön plan / arka plan / monokrom, 1024×1024) | ✅ |
| İzinler (bildirim, kesin alarm, takvim, fotoğraf, titreşim, boot) | ✅ |
| AdMob App ID (`app.json` → plugin) | ✅ |
| R8 / ProGuard kuralı (Room + WorkManager çökmesi) | ✅ |
| `eas.json` → `production` profili: **AAB**, `autoIncrement`, canlı API adresi | ✅ |
| Uygulama sürümü artık `app.json`'dan okunuyor (`expo-constants`) | ✅ (bu turda) |
| Panelde "test kimlikleri açık" uyarısı | ✅ (bu turda) |
| `npx expo-doctor` → 20/20 | ✅ |
| `tsc` + `expo lint` + testler | ✅ |

**Kod tarafında senden beklenen bir şey yok.** Aşağısı tamamen operasyon.

---

## 1. Sunucu (API) — önce burası

Mobil sürüm canlı API'ye bağlanacak (`https://babylog.mcsajans.com`).
Bugün kontrol ettim: **sunucudaki kod güncel ama veritabanı göçleri
uygulanmamış.** Göçler uygulanmadan yayınlarsan ilaç modülü, alt banner ve
bebek değişimi reklamı canlıda çalışmaz.

### 1.1 Göçleri uygula

Sunucuda, proje klasöründe:

```bash
npm run migrate
```

Beklenen: `023_medication.sql` … `027_timeline_collation_fix.sql`
"uygulanıyor … tamam".

> **Panelde "Reklamlar → Kaydet" hata verdiyse sebebi de bu.** Sütunlar
> olmayınca `UPDATE ad_settings SET banner_enabled = ? …` cümlesi
> "Unknown column" ile düşüyordu; ekranda ham bir JSON hatası çıkıyordu.
> İki tarafı da düzelttim: kayıt artık var olan sütunları yazıp eksikleri
> **adıyla** bildiriyor ("Kısmen kaydedildi … `npm run migrate` çalıştır"),
> panel hataları da JSON yerine HTML sayfa olarak görünüyor. Yine de asıl
> çözüm göçleri uygulamak — eksik alanlar uygulanana kadar kaydedilmez.

> **023 bir kez hata verdiyse normal.** Canlı veritabanı `utf8mb3` ("utf8")
> karakter setinde; 023'ün ilk sürümü görünümde `COLLATE utf8mb4_unicode_ci`
> yazıyordu ve sunucu *"COLLATION 'utf8mb4_unicode_ci' is not valid for
> CHARACTER SET 'utf8'"* dedi. Düzeltildi: görünüm artık harmanlama adı
> içermiyor. **Güncel kodu çektikten sonra `npm run migrate`'i yeniden
> çalıştır** — 023 baştan uygulanır (tabloları `IF NOT EXISTS` ile kurduğu
> için yarıda kalmış hâli sorun değil) ve 026-027 de gelir.

Doğrulama (kendi makinenden):

```bash
curl -s https://babylog.mcsajans.com/api/v1/ads/config
```

`banner_enabled` **true**, `triggers.baby_switch` **true** görünmeli. Şu an
ikisi de `false` — çünkü sütunlar yok.

### 1.2 Sunucu `.env`

- `MAIL_DRY_RUN` satırını **sil** (varsa): e-posta gerçekten gitsin.
  Yerel `.env`'de açıktı ve "şifre sıfırlama kodu gelmiyor" şikâyetinin
  sebebi buydu — 2026-11-21'de kapatıldı, SMTP doğrulandı ve gerçek bir
  test postası gönderildi. **Canlı sunucudaki `.env`'i de kontrol et.**
  Durum artık panelde görünüyor: `/admin/system` → "E-posta" satırı.
- `PUBLIC_BASE_URL=https://babylog.mcsajans.com` (yükleme ve logo adresleri
  bunu taşıyor).
- JWT ve oturum sırları üretim değerleri olsun, geliştirmedekiyle aynı olmasın.

### 1.3 Yönetim paneli — `/admin/pages`

**Gizlilik politikası sayfası yayında olmalı.** Hem Google Play hem AdMob
zorunlu tutuyor ve uygulama içindeki onay metinleri de oradan geliyor.
Sayfanın herkese açık adresini not et (ör.
`https://babylog.mcsajans.com/gizlilik-politikasi`).

### 1.4 Yönetim paneli — `/admin/ads`

1. **AdMob App ID**'ler girili mi kontrol et (Android zorunlu).
2. **Geçiş reklamı** ve **banner** birim kimliklerini gir — ikisi AdMob'da
   **ayrı birimlerdir**, birini diğerine yazmak sessizce "no fill" üretir.
3. **"Test kimlikleri kullan" kutusunu KAPAT.** Açık kalırsa mağazadaki
   kullanıcılar test reklamı görür ve **gelir oluşmaz**. Panel artık bu
   durumda sarı uyarı gösteriyor.
4. **Gizlilik politikası adresini** gir (canlı reklam için zorunlu alan).
5. **app-ads.txt**: AdMob'un verdiği satırı yapıştır. Şu an
   `https://babylog.mcsajans.com/app-ads.txt` **404** dönüyor; doldurunca
   sunucu otomatik servis edecek.
6. **Kendi cihazlarını test cihazı olarak ekle** (panelde "test cihazları").
   Kendi reklamına tıklamak AdMob hesabının kalıcı kapatılma sebebidir.
7. Frekans sınırı ve oturum tavanını gözden geçir (şu an 3 dk / 5).

### 1.5 Yönetim paneli — `/admin/modules`

Yayında hangi modüllerin açık olacağına karar ver. Varsayılan kapalı
olanlar: **Ek Gıda**, **Süt Sağma**, **Raporlar**, **İlaç Takibi**.

---

## 2. Depoyu commit et

**EAS, derlemeyi git'ten alır.** Şu an çalışma ağacında commit edilmemiş çok
sayıda değişiklik var; commit etmeden derleme alırsan **eski kod** derlenir.

```bash
cd C:\bebektakip
git status                      # neler değişti, bir gözden geçir
git add -A
git commit -m "Yayın hazırlığı: ilaç modülü, alt banner, modal formlar"
```

Sunucu deposu (`C:\wamp64\www\bebektakip`) ayrı bir depo; oradaki
değişiklikleri de commit et ve sunucuya dağıt.

---

## 3. Sürüm numarası

- `app.json` → `expo.version`: mağazada görünen sürüm (**1.0.0** ilk yayın
  için uygun). Her yeni yayında elle artır.
- `expo.android.versionCode`: **EAS otomatik artırıyor**
  (`eas.json` → `autoIncrement: true`). Elle dokunma.
- Uygulama içindeki sürüm satırı artık `app.json`'dan okunuyor; ayrıca
  güncellemen gereken bir yer yok.

---

## 4. EAS hesabı

```bash
npx eas-cli@latest login        # Expo hesabı
npx eas-cli@latest whoami
```

Proje daha önce EAS'a bağlanmadıysa:

```bash
npx eas-cli@latest init
```

(`app.json`'a bir `extra.eas.projectId` ekler — commit et.)

---

## 5. İmza anahtarı (keystore)

Play'e yüklenen her sürüm aynı anahtarla imzalanmalı. En kolay yol EAS'ın
yönetmesi:

```bash
npx eas-cli@latest credentials
# Android → production → Keystore → Set up a new keystore
```

**Anahtarı yedekle.** `npx eas-cli@latest credentials` içinden indirip
güvenli bir yerde sakla; kaybedersen aynı uygulamayı bir daha
güncelleyemezsin (Play App Signing kullanıyorsan yükleme anahtarını
sıfırlatabilirsin ama bu ayrı bir süreç).

---

## 6. Derleme

Önce yerel kontroller (hepsi temiz olmalı):

```bash
npx tsc --noEmit
npx expo lint
npm test
npx expo-doctor
```

Sonra üretim derlemesi (Play için **AAB**):

```bash
npx eas-cli@latest build --platform android --profile production
```

Derleme bulutta çalışır, 10–25 dakika sürer ve sonunda bir `.aab` bağlantısı
verir. `production` profili canlı API adresini gömüyor
(`EXPO_PUBLIC_API_URL=https://babylog.mcsajans.com`); `.env.local`
`.gitignore`'da olduğu için derlemeye **karışmaz**.

### Cihazda son deneme (isteğe bağlı ama önerilir)

```bash
npx eas-cli@latest build --platform android --profile preview
```

Bu APK'yı telefona kurup canlı sunucuyla bir tur at: giriş, bebek ekleme,
bir kayıt, bildirim, reklam. **Reklamlara tıklama** (test cihazı olarak
eklediysen sorun yok).

---

## 7. Play Console — uygulama kaydı

1. [play.google.com/console](https://play.google.com/console) → **Uygulama
   oluştur**: ad "Bebiqa", dil Türkçe, tür **Uygulama**, **Ücretsiz**.
2. Paket adı `com.bebiqa.app` (ilk yüklemede AAB'den gelir, sonradan
   değişmez).

### Mağaza kaydı için hazırlaman gerekenler

| Öğe | Şart |
|-----|------|
| Uygulama simgesi | 512×512 PNG (elimizdeki `assets/icon.png` 1024×1024; küçült) |
| Öne çıkan görsel | 1024×500 PNG/JPG |
| Telefon ekran görüntüleri | **en az 2**, 16:9 veya 9:16, min 320 px |
| Kısa açıklama | en fazla 80 karakter |
| Tam açıklama | en fazla 4000 karakter |
| Kategori | Ebeveynlik / Sağlık ve Fitness |
| İletişim e-postası | zorunlu |
| Gizlilik politikası URL'i | §1.3'teki adres |

---

## 8. Play Console — beyanlar (en çok takılan yer)

### 8.1 Veri güvenliği (Data safety)

Uygulamanın topladıkları:

- **Kişisel bilgi:** ad, e-posta (hesap için) — *toplanıyor, hesap yönetimi*
- **Sağlık ve fitness:** bebeğin beslenme/uyku/aşı/ilaç kayıtları —
  *toplanıyor, uygulama işlevselliği*
- **Fotoğraflar:** bebek profil fotoğrafı — *toplanıyor, uygulama işlevselliği*
- **Cihaz tanımlayıcıları / reklam kimliği:** AdMob SDK'sı topluyor —
  *reklamcılık*
- Veriler **aktarılıyor mu?** Evet (kendi sunucumuz, AdMob).
- **Şifreleniyor mu?** Evet (HTTPS).
- **Silme talebi** yolu var mı? Evet — uygulama içinde hesap silme var.

### 8.2 Reklamlar

"Uygulamanız reklam içeriyor mu?" → **Evet**.

### 8.3 İçerik derecelendirmesi

Anketi doldur; uygulamada şiddet/cinsellik/kumar yok. Kategori: **Yardımcı
program / Ebeveynlik**.

### 8.4 Hedef kitle ve çocuklar

**"Çocuklara yönelik" DEĞİL** seç. Uygulamayı kullanan ebeveyn, çocuk değil.
Panelde de `child_directed` kapalı — ikisi tutarlı olmalı, aksi hâlde
kişiselleştirilmiş reklam politikası ihlali doğar.

### 8.5 İzin beyanları

- **SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM:** Play ayrı bir form soruyor.
  Gerekçe: *"Uygulama, ebeveynin kurduğu beslenme/ilaç/aşı hatırlatıcılarını
  tam zamanında çalmak için kesin alarm kullanır; hatırlatıcı uygulamanın
  ana işlevidir."*
- **Fotoğraf erişimi (READ_MEDIA_IMAGES):** bebeğin profil fotoğrafını
  seçmek için; yalnızca kullanıcı seçtiğinde okunur.
- **POST_NOTIFICATIONS:** beyan gerektirmez.

---

## 9. Yükleme ve yayın

1. **Test → Dahili test**: AAB'yi yükle, kendini test kullanıcısı olarak
   ekle, bağlantıdan kur ve bir tur at.
2. Sorun yoksa **Üretim** parkuruna yükselt (ilk incelemede birkaç gün
   sürebilir).
3. İstersen yüklemeyi komutla da yapabilirsin — Google Cloud'dan bir
   **service account JSON** gerekir:

```bash
npx eas-cli@latest submit --platform android --profile production
```

(`eas.json` → `submit.production` içine `serviceAccountKeyPath` eklenir.)

---

## 10. Yayın sonrası kontrol listesi

- [ ] Mağazadan kurduğun sürümde **giriş** ve **bir kayıt** çalışıyor mu?
- [ ] Ayarlar ekranındaki API adresi `https://babylog.mcsajans.com` mu?
- [ ] Reklamlar **gerçek** mi (test rozeti yok)? Rozet varsa panelde test
      kimlikleri hâlâ açıktır.
- [ ] Alt banner görünüyor ve ekranın altını daraltıyor mu?
- [ ] `https://babylog.mcsajans.com/app-ads.txt` 200 dönüyor mu? AdMob
      konsolunda "app-ads.txt bulundu" görünene kadar birkaç gün geçebilir.
- [ ] Bildirimler çalışıyor mu (hatırlatıcı kur, 2 dakika sonrasına)?
- [ ] AdMob konsolunda gösterim sayacı artıyor mu?

---

## 11. Sık yapılan hatalar

| Hata | Sonuç |
|------|-------|
| Commit etmeden `eas build` | Eski kod derlenir, yeni özellikler yok |
| Göçleri sunucuda çalıştırmamak | İlaç modülü ve banner canlıda çalışmaz |
| Test kimliklerini kapatmamak | Reklam var, **gelir yok** |
| Kendi reklamına tıklamak | AdMob hesabı kalıcı kapatılır |
| Gizlilik politikası URL'i boş | Play ve AdMob reddeder |
| `child_directed` ile kişiselleştirilmiş reklamı birlikte açmak | Families politikası ihlali (panel zaten engelliyor) |
| Keystore'u yedeklememek | Uygulamayı bir daha güncelleyememe |

---

## 12. iOS (bu turda kapsam dışı)

`app.json`'da bundle id, ATT metni ve SKAdNetwork listesi hazır ama bu
makinede iOS derlenemiyor ve Apple Developer hesabı/sertifika süreci ayrı.
iOS'a geçildiğinde `eas build --platform ios` ve App Store Connect adımları
eklenecek.
