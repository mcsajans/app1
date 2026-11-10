This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

**Bu proje Expo Router kullanmaz.** React Navigation (`@react-navigation/*`) ile
*runtime'da üretilen* bir navigasyon ağacı kullanılır — çünkü ekranlar, yönetim
panelinden sistem geneli aktif/pasif edilen modül listesinden türetilir
(bkz. `TEKNIK_DOKUMAN.md` §9). Dosya tabanlı yönlendirme bu dinamik yapıya
uymadığı için bilinçli olarak tercih edilmedi.

**Modül sekmesi yoktur.** Tek düzeyli bir `native-stack` kullanılır: kök ekran
ana sayfadır, tüm açık modüller oradaki 4 sütunlu ızgaradan itilir. Alt
gezinme çubuğu (`BottomNav`) modülden bağımsız sabit bir iskelettir: ana
sayfa, akış, hızlı kayıt, raporlar, hesap.

Üst şerit, alt çubuk, hesap paneli ve hızlı kayıt sayfası navigasyon ağacının
**dışında**, App kabuğunda durur; yönlendirmeyi `navigationRef` ile yaparlar.

- Görsel dil ve renkler: `src/core/theme/index.ts` — değerler
  `modules_doc/tasarim.jpg` şablonundan örneklendi, göz kararı değiştirme
- İkonlar: `src/components/Icon.tsx` — tek kaynak, semantik adlar
  (`bottle`, `sleep`…). Emoji kullanma; yalnızca bildirim başlıklarında kalır.
  Yeni ikon gerekiyorsa sözlüğe ekle, ekranda doğrudan set adı yazma
- Tarih/saat girişi: `src/components/DateTimeField.tsx` (sistem seçicisi;
  düz metin kutusu kullanma)
- Navigasyon ağacı: `src/core/navigation/RootNavigator.tsx`
- Ağaç dışından yönlendirme: `src/core/navigation/navigationRef.ts`
- Modül anahtarı → ekran eşlemesi: `src/core/navigation/moduleScreens.ts`
- Modül kataloğu ve aktiflik mantığı: `src/core/modules/catalog.ts`
- Yeni modül eklerken: kataloğa meta ekle → `moduleScreens.ts`'e ekranı bağla.
  Navigasyonda ve ana ekranda elle bir şey değiştirmek gerekmez.

## Sistem geneli ayarlar yönetim panelinden gelir

Modül aktifliği, logolar ve **reklam ayarları** `.env`'de değil sunucudaki
veritabanında durur; yazan tek yer yönetim panelidir
(`C:\wamp64\wwwebektakip`, `/admin`). İstemci bunları açık uçlardan okur
ve SQLite'ta önbellekler:

- Modüller: `GET /modules` → `src/core/modules/useModuleStore.ts`
- Logolar: `GET /branding` → `src/core/branding/useBrandingStore.ts`
- Reklam (AdMob): `GET /ads/config` → `src/core/ads/useAdSettingsStore.ts`
  (panel: `/admin/ads`, tablo: `ad_settings`, bkz. `TEKNIK_DOKUMAN.md` §7.6)

Genel erişime açık içerik sayfaları (gizlilik politikası, iOS ATT metni…) da
panelden yazılır: `/admin/pages`, tablo `pages`, sunucu `GET /<slug>` ile kökten
servis eder (`TEKNIK_DOKUMAN.md` §7.7). Sayfa gövdesi **ham HTML kabul etmez** —
`src/lib/pages.ts` içindeki sınırlı Markdown ile işlenir; sayfa panelle aynı
origin'de yayınlandığı için oraya script girmesi yönetim oturumuna karşı
kullanılabilir.

Yeni bir sistem ayarı gerekiyorsa `EXPO_PUBLIC_*` **eklemeyin**: o değerler
pakete gömülür ve değiştirmek yeniden derleme gerektirir. Panelde bir alan +
açık bir uç + mobil tarafta önbellekli bir depo deseni izlenir.

Reklam birimi kimlikleri, frekans sınırı ve tetikleyiciler çalışma zamanı
okunur. AdMob **App ID** ve iOS **ATT metni** ise derleme zamanı değerleridir
(`app.json`); panel onları saklar ve yapıştırılacak bloğu gösterir.

## Reklam (AdMob) — ekranlardan tek çağrı

Geçiş reklamı `src/core/ads/adService.ts` üzerinden gösterilir
(`TEKNIK_DOKUMAN.md` §23). Ekranların bildiği tek şey:

```ts
showAdAfterAction('save' | 'complete' | 'invite' | 'timer_start')
```

- Kayıt/sayaç işlemi **önce** ve `await` ile; reklam çağrısı `await`
  edilmez, `void` döner ve hiç `throw` etmez. Reklam hiçbir koşulda kaydı
  etkilemez.
- "Kaydet" / "Değişiklikleri Kaydet" düğmelerine **elle tetik eklemeyin**:
  `withSaveFeedback()` sarmalayıcısı zaten atıyor (14 ekran).
- `adService` içine sabit sayı yazmayın — frekans sınırı, gecikme, kimlikler
  ve tetikleyici açık/kapalı durumu panelden gelir.
- `withSaveFeedback` bilerek `useSaveFeedbackStore`tan ayrı dosyada:
  `adService` o depoyu okuduğu için aynı dosyada olunca dairesel import
  oluşuyor (§23.5).

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
