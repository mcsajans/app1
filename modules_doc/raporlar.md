Sen kıdemli bir Full-Stack Yazılım Mimarısın. Projemizde Bebek & Çocuk Takip Sistemi için **11. Modül olan "Raporlar" (`reports`)** geliştirmesini yapacaksın.

### Proje Mimarısı & Çalışma Kuralları
1. **Dizin Yapısı & Bağımsızlık:**
  - Projemiz iki ayrı dizinden oluşuyor: Backend (`/backend` veya Node.js projesinin olduğu dizin) ve Mobil App (`/app` veya React Native projesinin olduğu dizin).
  - Backend ve Mobile App projeleri birbirinden bağımsız dizinlerde çalışmaktadır.
2. **Dokümantasyon:**
  - Projede yapılan tüm mimari kararlar, API end-point tanımları ve veri modelleri projenin kök dizininde (veya ilgili dizinde) yer alan `teknik_dokuman.md` dosyasına eksiksiz şekilde yazılacak/güncellenecektir.
3. **Geliştirme Akışı (Strict Step-by-Step Order):**
  - **ÖNCE BACKEND:** İlk olarak verileri haftalık/aylık bazda gruplayan istatistiksel sorgular ve doktor paylaşımı için PDF çıktı üretme servisleri yazılmalıdır.
  - **DOKÜMANTASYON:** API ve veri yapısı tamamlandığında `teknik_dokuman.md` dosyasına ilgili modül detayları eklenmelidir.
  - **SONRA REACT NATIVE:** Backend API'leri hazır hale geldikten sonra React Native tarafında grafik kütüphaneleri ve rapor görselleştirme ekranları geliştirilmelidir.

---

### Modül 11: Raporlar (`reports`) Gereksinimleri

#### 1. Backend (Node.js) İhtiyaçları:
- **API End-point'leri:**
  - `GET /api/v1/reports/summary?baby_id=:babyId&period=daily|weekly|monthly` -> Seçilen döneme ait toplam uyku süreleri, beslenme hacimleri ve bez değişim sayıları istatistiği
  - `GET /api/v1/reports/trends?baby_id=:babyId&metric=sleep|feeding|diaper` -> Zaman içindeki eğilim grafik verileri (Çizgi/Sütun grafik verisi)
  - `GET /api/v1/reports/export-pdf?baby_id=:babyId&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` -> Doktor kontrolleri için PDF raporu üretme ve indirme bağlantısı dönme

#### 2. Mobil App (React Native) İhtiyaçları:
- **Servis Katmanı:**
  - `reportService` entegrasyonu.
- **UI & Ekranlar:**
  - **Analiz & Grafik Ekranı (`react-native-chart-kit` veya `victory-native` kullanımı):**
    - Uyku Trend Grafiği (Gece vs Gündüz şekerleme süreleri).
    - Beslenme Analizi (Süt/Mama miktarları, emzirme süreleri).
    - Bez Değişim Sayıları ve Pişik Durumu dağılım grafiği.
  - **Tarih Aralığı Seçici:**
    - Son 7 Gün, Son 30 Gün veya Özel Tarih Aralığı seçimi.
  - **PDF Dışa Aktar (Export):**
    - Tek tıkla doktor kontrolü için PDF oluşturma ve paylaşma (Share) butonu.

---

### Uygulama Adımları (Lütfen Sırayla Çalış):
1. **Adım 1:** Node.js backend projesinde istatistiksel veri toplama sorgularını ve PDF rapor oluşturma servisini yaz.
2. **Adım 2:** Tamamlanan raporlama API'lerini ve çıktı formatlarını `teknik_dokuman.md` dosyasına kaydet.
3. **Adım 3:** React Native projesine geç; `reportService` ve grafik kütüphanesi entegrasyonunu kurgula.
4. **Adım 4:** Rapor grafikleri, tarih aralığı filtreleri ve PDF paylaşım UI bileşenlerini geliştirip test et.