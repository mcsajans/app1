Geliştirme Talimatları: E-posta Servisi, Profil Fotoğrafı Yükleme ve Etkinlik Hatırlatıcıları

Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde E-posta Gönderimi (SMTP/Nodemailer), Bebek Profil Fotoğrafı Yükleme (Media Upload) ve Hatırlatıcılar (reminders) Modülüne Etkinlik Kategorisi ekleme geliştirmelerini yapacaksın.

Proje Mimarisi & Çalışma Kuralları

Dizin Yapısı: Backend (/backend) ve Mobil App (/app) bağımsız dizinlerde çalışmaktadır.

Dokümantasyon: Yapılan tüm yeni yapılandırmalar, veritabanı alanları ve API değişiklikleri teknik_dokuman.md dosyasına eksiksiz işlenmelidir.

Geliştirme Akışı (Strict Step-by-Step Order):

ÖNCE BACKEND: Node.js tarafındaki e-posta yapılandırması, dosya yükleme (Multer vb.) altyapısı, veritabanı şeması ve API end-point'leri geliştirilmeli ve test edilmelidir.

DOKÜMANTASYON: API ve yapılandırma detayları teknik_dokuman.md dosyasına kaydedilmelidir.

SONRA REACT NATIVE: Backend API'leri hazır hale geldikten sonra React Native tarafına geçilmeli, görsel seçici, form yükleme ve etkinlik hatırlatıcı UI bileşenleri geliştirilmelidir.

Geliştirme Detayları & Gereksinimler

1. E-posta Gönderim Servisi (SMTP & Nodemailer)

Node.js backend projesine Nodemailer kütüphanesini entegre et. E-posta servis ayarlarını .env dosyası üzerinden oku.

.env Yapılandırması:

SMTP_HOST=host1.mcsajans.com
SMTP_PORT=465
EMAIL_USER=noreply@mcsajans.com
EMAIL_PASS=339!U6drs
EMAIL_FROM=noreply@mcsajans.com


Kullanım Senaryoları:

Aile davet kodları/e-postaları (family modülü).

Aşı ve kritik doktor randevusu bilgilendirmeleri.

Haftalık/Aylık özet rapor çıktıları (PDF eki ile).

2. Bebek Profil Fotoğrafı Yükleme (Media Upload)

Backend (Node.js):

Görsel yüklemeleri için Multer veya benzeri bir dosya yükleme aracı entegre et.

POST /api/v1/babies/:id/photo end-point'ini kurgula:

multipart/form-data kabul etmeli.

Sadece görsel formatlarını (jpg, jpeg, png, webp) kabul etmeli, max 5MB sınırı koymalı.

Yüklenen resmi statik klasöre veya bulut depolamaya kaydedip photo_url alanını güncellemelidir.

POST /api/v1/babies ve PUT /api/v1/babies/:id end-point'lerine direct dosya yükleme opsiyonu ekle.

Mobil App (React Native):

Görsel seçimi için react-native-image-picker veya expo-image-picker entegre et.

Bebek profili oluşturma ve düzenleme ekranlarında kamera/galeri erişim izinleri ve dairesel profil fotoğrafı önizlemesi ekle.

Görsel seçildiğinde FormData yapısıyla backend API'sine yükle.

3. Hatırlatıcılar Modülüne "Etkinlik" (event) Kategorisi & Esnek Zamanlama

Backend (Node.js):

reminders veri şemasındaki category alanına 'event' seçeneğini ekle:

category Enum: 'feeding', 'sleep', 'diaper', 'medicine', 'vaccine', 'doctor', 'event', 'custom'

Esnek Zamanlama Alanları Ekle/Güncelle:

recurrence_type (Enum: 'none', 'daily', 'weekly', 'custom_days')

repeat_days (Array of Integers - Örn: [1, 3, 5] -> Pazartesi, Çarşamba, Cuma)

start_date (Date)

end_date (Date - Opsiyonel bitiş tarihi)

POST /api/v1/reminders ve PUT /api/v1/reminders/:id end-point'lerini bu yeni zamanlama parametrelerini kabul edecek şekilde güncelle.

Mobil App (React Native):

Hatırlatıcı Oluşturma Ekranı:

Kategori seçeneklerine "Etkinlik" (🎉 / 🎈) ikonlu seçim alanını ekle.

Zamanlama modunda:

Tek Seferlik: Belirli gün ve saat.

Günlük: Her gün belirlenen saatte.

Haftalık / Belirli Günler: Haftanın günlerini çoklu seçebilme (Pazartesi, Salı, Çarşamba vb. chip butonlar).

Etkinlik Alarmı & Bildirim Zamanlayıcı:

Belirlenen gün ve haftalık periyotlara göre cihazda arka plan yerel bildirimi ve alarmları zamanla (scheduleNotification).

Uygulama Adımları (Lütfen Sırayla Çalış):

Adım 1: Backend'de .env e-posta ayarlarını ve Nodemailer servisini kurgula.

Adım 2: Backend'de dosya yükleme (Multer) middleware'ini ve photo_url güncelleme API'sini yaz.

Adım 3: Backend reminders veri şemasını 'event' kategorisi, recurrence_type ve repeat_days parametreleriyle güncelle.

Adım 4: Tüm yeni API yapılandırmalarını ve istek/yanıt formatlarını teknik_dokuman.md dosyasına kaydet.

Adım 5: React Native tarafında galeri/kamera görsel seçici bileşenini ve profil fotoğrafı yükleme servis entegrasyonunu geliştir.

Adım 6: React Native hatırlatıcı ekranına "Etkinlik" kategorisini, günlük/haftalık periyodik seçim bileşenlerini ekle ve test et.

Sırasıyla bu adımları takip ederek geliştirmeye başla.