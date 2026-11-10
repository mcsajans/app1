/**
 * Bildirim sesleri ve tekrar sayıları — tek kaynak
 * (`modules_doc/notification-voice.md` §2.1).
 *
 * **Sesler uygulamanın içine gömülüdür**, sunucudan indirilmez. Şartname bunu
 * açıkça istiyor (§2.2.4) ve gerekçesi sağlam: bir bildirim sesi internet
 * kesintisinde de, uygulama soğuk başlarken de **anında** çalmak zorunda.
 * Adresten indirilen bir ses, ebeveynin en çok ihtiyaç duyduğu anda (gece,
 * kötü bağlantı) sessiz kalırdı. Şartnamedeki
 * `https://.../uploads/notification/bildirimN.mp3` adresleri bu yüzden
 * yalnızca **kaynak dosyanın nereden geldiğini** gösteriyor; çalışma anında
 * kullanılmıyorlar.
 *
 * Dosyalar iki ayrı yoldan çalıyor ve ikisi de aynı listeden besleniyor:
 *
 *  1. **Uygulama ayaktayken** — `alertSound.ts`, `expo-audio` ile
 *     `require()` edilmiş yerel varlığı çalar ve **tekrar sayısını** uygular.
 *  2. **İşletim sistemi bildirimi olarak** — `scheduler.ts`, Android kanalına
 *     ve bildirim içeriğine dosya **adını** verir. Dosyalar
 *     `app.json` → `expo-notifications` → `sounds` dizisi sayesinde
 *     `res/raw` (Android) ve ana pakete (iOS) kopyalanır.
 *
 * > **Tekrar sayısı yalnızca 1. yolda uygulanabilir.** İşletim sistemine
 * > teslim edilen bir bildirim sesini bir kez çalar; "4 tekrar" için 4 ayrı
 * > bildirim planlamak gerekirdi ve bu, iOS'un 64'lük bekleyen bildirim
 * > bütçesini tüketirdi (bkz. `scheduler.ts` → `MAX_SCHEDULED`). Uygulama
 * > kapalıyken tek çalma olur; kullanıcı uygulamayı açtığında geri kalan
 * > uyarılar ekranda zaten duruyor.
 */

/** Hangi olay hangi sesi çalar. */
export type AlertKind =
  /** Bildirim kutusuna yeni satır düştü. */
  | 'inbox'
  /** Beslenme sayacı (biberon/emzirme/sağma) çalışırken periyodik. */
  | 'feedingTick'
  /** Uyku sayacı çalışırken periyodik. */
  | 'sleepTick'
  /** Zamanlı/periyodik hatırlatıcı. */
  | 'reminder'
  /** Görev saati geldi. */
  | 'taskDue'
  /** Görev gecikti — tamamlanana kadar tekrarlar. */
  | 'taskOverdue'
  /** Aşı ön uyarısı (7/2/1 gün önce). */
  | 'vaccine'
  /** Aşı günü geldi. */
  | 'vaccineDay';

export type AlertSpec = {
  /**
   * `require()` edilmiş yerel varlık — uygulama içi çalma bunu kullanır.
   *
   * Metro `require`'ı derleme sırasında çözüyor, bu yüzden yol **sabit
   * olmak zorunda**: değişkenle kurulmuş bir yol paketlenmez ve çalışma
   * anında bulunamaz.
   */
  asset: number;
  /**
   * İşletim sistemi bildirimi için dosya **adı** (yol değil).
   *
   * Expo belgesi bunu açıkça söylüyor: `sounds` dizisine eklenen dosyaya
   * yalnızca temel adıyla başvurulur.
   */
  file: string;
  /** Şartnamedeki tekrar sayısı (§2.1). */
  repeat: number;
  /** Ekranda ve kayıtta görünen kısa ad. */
  label: string;
};

export const ALERTS: Readonly<Record<AlertKind, AlertSpec>> = {
  inbox: {
    asset: require('../../../assets/notification/bildirim8.mp3'),
    file: 'bildirim8.mp3',
    repeat: 2,
    label: 'Bildirim menüsü',
  },
  feedingTick: {
    asset: require('../../../assets/notification/bildirim3.mp3'),
    file: 'bildirim3.mp3',
    repeat: 1,
    label: 'Beslenme sayacı',
  },
  sleepTick: {
    asset: require('../../../assets/notification/bildirim1.mp3'),
    file: 'bildirim1.mp3',
    repeat: 1,
    label: 'Uyku sayacı',
  },
  reminder: {
    asset: require('../../../assets/notification/bildirim2.mp3'),
    file: 'bildirim2.mp3',
    repeat: 4,
    label: 'Hatırlatıcı',
  },
  taskDue: {
    asset: require('../../../assets/notification/bildirim5.mp3'),
    file: 'bildirim5.mp3',
    repeat: 4,
    label: 'Görev zamanı',
  },
  taskOverdue: {
    asset: require('../../../assets/notification/bildirim6.mp3'),
    file: 'bildirim6.mp3',
    repeat: 4,
    label: 'Gecikmiş görev',
  },
  vaccine: {
    asset: require('../../../assets/notification/bildirim4.mp3'),
    file: 'bildirim4.mp3',
    repeat: 2,
    label: 'Aşı uyarısı',
  },
  /*
   * Aynı dosya, farklı tekrar sayısı: şartname "2 tekrar (aşı süresinde 4
   * tekrar)" diyor. Ayrı bir `AlertKind` olması şart, çünkü tekrar sayısı
   * sesin kendisine değil **olaya** bağlı.
   */
  vaccineDay: {
    asset: require('../../../assets/notification/bildirim4.mp3'),
    file: 'bildirim4.mp3',
    repeat: 4,
    label: 'Aşı günü',
  },
};

/*
 * `bildirim7.mp3` kütüphanede duruyor ama şartnamenin §2.1 tablosunda
 * karşılığı yok — hiçbir olaya bağlı değil. Dosya bilinçli olarak
 * paketleniyor (`app.json` → `sounds`): bir olaya atanması gerektiğinde
 * yeniden derleme gerekmesin. Kullanılmadığı sürece sessiz kalır.
 */

/** Periyodik sayaç sesleri — şartnamedeki aralıklar (§2.1). */
export const TICK_INTERVAL_MS: Readonly<Record<'feeding' | 'sleep', number>> = {
  /** Beslenme: sayaç aktifken her 5 dakikada 1. */
  feeding: 5 * 60_000,
  /** Uyku: sayaç aktifken her 30 dakikada 1. */
  sleep: 30 * 60_000,
};

/** Gecikmiş görev uyarısının tekrar aralığı (§2.2.3). */
export const OVERDUE_INTERVAL_MS = 5 * 60_000;

/**
 * Gecikmiş görev döngüsünün güvenlik zaman aşımı (§2.2.3).
 *
 * Şartname "veya maksimum 24 saatlik güvenlik zamanaşımı" diyor: kullanıcı
 * görevi hiç kapatmazsa uyarı sonsuza kadar çalmasın.
 */
export const OVERDUE_MAX_MS = 24 * 60 * 60_000;
