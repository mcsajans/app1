# BebekTakip Mobil Uygulaması - Kurulum ve Çalıştırma Rehberi (SETUP)

Bu doküman, BebekTakip mobil projesini **yeni veya başka bir bilgisayarda** sıfırdan ayağa kaldırmak için izlenmesi gereken adımları içerir.

---

## 📋 1. Ön Gereksinimler

Projeyi başka bir bilgisayarda çalıştırmadan önce aşağıdaki araçların kurulu olduğundan emin olun:

1. **Node.js**: LTS sürümü (v18.0.0 veya üstü)
   - İndirmek için: [nodejs.org](https://nodejs.org/)
2. **Git**: [git-scm.com](https://git-scm.com/)
3. **Paket Yöneticisi**: **Bun** (önerilir) veya **npm**
   - Bun kurulumu (PowerShell): `powershell -c "irm bun.sh/install.ps1 | iex"`
4. **Mobil Test Cihazı veya Emülatör**:
   - **Fiziksel Cihaz için**: Telefona App Store / Google Play üzerinden **Expo Go** uygulamasını yükleyin.
   - **Emülatör için**: Android Studio (Android Emulator) veya macOS üzerinde Xcode (iOS Simulator).

---

## 🚀 2. Adım Adım Kurulum

### Adım 1: Projeyi GitHub'dan Klonlayın

Terminal veya komut satırını açıp projeyi indirin:

```bash
git clone <github-repository-url>
cd bebektakip
```

### Adım 2: Bağımlılıkları Yükleyin (Dependency Installation)

Proje Expo SDK ve React Native bağımlılıklarını yüklemek için paket yöneticisini çalıştırın:

```bash
# Bun kullanıyorsanız (Önerilen):
bun install

# veya npm kullanıyorsanız:
npm install
```

> ⚠️ **Önemli Not:** Yeni bir paket eklerken `npm install <paket>` yerine her zaman `npx expo install <paket>` komutunu kullanın. Bu komut Expo SDK sürümüyle tam uyumlu paket versiyonlarını otomatik çözer.

### Adım 3: Çevre Değişkenlerini (.env) Oluşturun

Proje kök dizinindeki örnek `.env.example` dosyasından kendi `.env` dosyanızı oluşturun:

```bash
# Windows Command Prompt / PowerShell veya Bash üzerinde:
cp .env.example .env
```

`.env` dosyasını açıp sunucu (API) adresi ve gerekli ortam değişkenlerini kendi yerel veya canlı yönetim paneli sunucunuza göre ayarlayın.

### Adım 4: Geliştirme Sunucusunu Başlatın

Proje sunucusunu başlatmak için aşağıdaki komutu çalıştırın:

```bash
npx expo start
# veya Bun ile:
bunx expo start
```

Sunucu başladıktan sonra terminalde bir **QR Kod** görüntülenecektir:

- **Fiziksel Telefon ile Test:**
  - **Android:** Expo Go uygulamasını açıp QR kodu okutun.
  - **iOS:** Telefonun kamerasını açıp QR kodu okutun (Expo Go uygulamasında açılacaktır).
  - *Not:* Telefon ile bilgisayarın aynı Wi-Fi ağına bağlı olduğundan emin olun.

- **Emülatör ile Test:**
  - Terminal açıkken `a` tuşuna basarak **Android Emülatöründe** başlatabilirsiniz.
  - Terminal açıkken `i` tuşuna basarak **iOS Simülatöründe** başlatabilirsiniz (Sadece macOS).
  - Terminal açıkken `w` tuşuna basarak **Web** ortamında başlatabilirsiniz.

---

## 🛠️ 3. Yararlı Komutlar ve Kontroller

Projede geliştirme yaparken ve push etmeden önce aşağıdaki komutları kullanabilirsiniz:

```bash
# 1. TypeScript Tip Kontrolü (Hata var mı bakmak için)
npx tsc --noEmit

# 2. Lint Kontrolü (Kod stili kontrolü)
npx expo lint

# 3. Expo Teşhis Araçları (Uyumsuz paketleri tespit etmek için)
npx expo-doctor

# 4. Uyumsuz Paket Versiyonlarını Otomatik Düzeltme
npx expo install --fix
```

---

## 📦 4. EAS Build & OTA Güncellemeler (Opsiyonel)

Uygulamanın Android APK/AAB veya iOS IPA çıktılarını almak için EAS CLI kullanılır:

```bash
# EAS CLI sürümünü çalıştırma:
bunx eas-cli build --platform android --profile preview

# OTA (Over-The-Air) güncelleme gönderme:
bunx eas-cli update --branch main --message "Yeni güncelleme"
```

---

## ❓ Sıkça Karşılaşılan Sorunlar ve Çözümleri

1. **Expo Go "Network Error" veya Bağlantı Hatası:**
   - Bilgisayar ve telefonun **aynı Wi-Fi** ağında olduğundan emin olun.
   - Gerekirse geliştirme sunucusunu tünel modunda başlatın:
     ```bash
     npx expo start --tunnel
     ```

2. **Node Modules Uyuşmazlığı:**
   - `node_modules` klasörünü ve `bun.lock` / `package-lock.json` silip tekrar yükleyin:
     ```bash
     rm -rf node_modules
     bun install
     ```

---

## 📱 5. iOS Ortamında Çalıştırma Rehberi

iOS cihazlarda veya macOS ortamında projeyi test edip ayağa kaldırmak için izlenebilecek 3 farklı yöntem bulunmaktadır:

### Yöntem A: Fiziksel iPhone / iPad Cihazında Çalıştırma (En Kolay Yöntem)

Fiziksel bir iOS cihazda test yapmak için **Mac bilgisayar zorunluluğu yoktur** (Windows veya Linux bilgisayarla da çalışır):

1. **Gerekli Mobil Uygulama:** iPhone veya iPad cihazınızda **App Store**'u açın ve **[Expo Go](https://apps.apple.com/app/expo-go/id982107779)** uygulamasını indirin.
2. **Aynı Ağ Bağlantısı:** Bilgisayarınız ile iPhone cihazınızın **aynı Wi-Fi ağına** bağlı olduğundan emin olun.
3. **Sunucuyu Başlatma:** Bilgisayar terminalinde geliştirme sunucusunu çalıştırın:
   ```bash
   bunx expo start
   ```
4. **Uygulamayı Açma:**
   - iPhone **Kamera** uygulamasını açın ve terminaldeki **QR Kodunu** taratın.
   - Ekranda beliren "Expo Go uygulamasında aç" bildirimine dokunun.
5. **Wi-Fi veya Ağ Bağlantı Sorunları İçin Tünel Modu (Tunnel):**
   Fiziksel cihaz ve bilgisayar aynı Wi-Fi ağında değilse veya ağ kısıtlaması varsa tünel modu kullanın:
   ```bash
   bunx expo start --tunnel
   ```

---

### Yöntem B: macOS Üzerinde iOS Simulator İle Çalıştırma

iOS Simülatöründe çalıştırmak için **macOS** işletim sistemine sahip bir bilgisayar gereklidir:

1. **Xcode Kurulumu:** App Store üzerinden **Xcode** uygulamasını indirin.
2. **Command Line Tools:** Terminal açıp şu komut ile komut satırı araçlarını etkinleştirin:
   ```bash
   xcode-select --install
   ```
3. **Simülatör Bileşenleri:** Xcode'u açıp `Settings > Components` menüsünden bir iOS Simulator sürümü indirin.
4. **Simülatörü Başlatma:** Terminalde proje sunucusunu başlattıktan sonra klavyeden `i` tuşuna basın:
   ```bash
   bunx expo start
   # Terminal açıkken 'i' tuşuna basın
   ```
   *Expo CLI otomatik olarak iOS Simülatörünü başlatacak ve uygulamayı yükleyecektir.*

---

### Yöntem C: EAS Cloud Build İle iOS Derlemesi Almak (.ipa / Development Build)

Projenin yerel native derlemesini (IPA paketini) yerel Mac veya Xcode kullanmadan bulutta derlemek için Expo Application Services (EAS) kullanılır:

1. **Apple Developer Hesabı:** iOS cihazlara doğrudan derleme yüklemek için aktif bir **Apple Developer Account** gereklidir.
2. **Bulut Derlemesi Komutu:**
   ```bash
   # Geliştirme derlemesi (Development Build) almak için:
   bunx eas-cli build --platform ios --profile development

   # App Store / TestFlight veya Ad-Hoc profil için:
   bunx eas-cli build --platform ios --profile production
   ```

