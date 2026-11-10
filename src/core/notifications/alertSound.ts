import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { ALERTS, type AlertKind } from './soundCatalog';

/**
 * Uygulama içi bildirim sesi — tekrar sayısıyla ve anında kesilebilir
 * (`modules_doc/notification-voice.md` §2.2.1).
 *
 * İşletim sisteminin bildirim sesi tek çalıyor; şartname ise olaya göre 1, 2
 * ya da 4 tekrar istiyor ve kullanıcı bildirime dokunduğu anda sesin
 * **kesilmesini** istiyor. İkisi de ancak sesi uygulamanın kendisi çalarsa
 * mümkün, bu yüzden bu dosya var.
 *
 * Mağaza (zustand) kullanılmıyor: ses bir arayüz durumu değil, yan etki.
 * Çağıranların çoğu da bileşen değil — bildirim kutusu mağazası, sayaç
 * mağazası, görev izleyici. Modül düzeyinde tek bir çalar tutmak, hangi
 * ekranın monte olduğundan bağımsız çalışmasını sağlıyor.
 *
 * ## Neden tek seferde tek ses
 *
 * İki uyarı üst üste gelebiliyor (görev saati + bildirim kutusu). İkisini
 * birden çalmak gürültüden başka bir şey üretmezdi, bu yüzden **yeni uyarı
 * eskisinin yerini alır**. Seçim bilinçli: sıraya almak, kullanıcı ekrana
 * baktıktan dakikalar sonra çalan sesler üretirdi.
 *
 * ## Ses kipine dokunulmaz
 *
 * `setAudioModeAsync` **genel** bir ayar: çağıran son yer tüm çalarları
 * etkiliyor. Müzik çalar onu kendi ihtiyacına göre kuruyor
 * (`doNotMixPersistent` + arka plan). Uyarı sesi de kipi değiştirseydi ninni
 * oturumunun arka plan davranışını bozardı. Uyarı, ninninin **üzerine**
 * çalar; ikisi de aynı uygulamanın ses odağını paylaşıyor.
 */

/** Tekrarlar arasındaki kısa boşluk — iki çalma arasında ayırt edilebilir aralık. */
const GAP_MS = 350;

type Session = {
  kind: AlertKind;
  player: AudioPlayer;
  /** Kaçıncı tekrar çalıyor (1'den başlar). */
  round: number;
  /** Tekrarlar arası bekleyen zamanlayıcı. */
  timer: ReturnType<typeof setTimeout> | null;
  /** Çalma bitişini dinleyen abonelik. */
  subscription: { remove: () => void } | null;
  /** Oturum kapatıldı mı — geciken geri çağrıları susturur. */
  cancelled: boolean;
};

let active: Session | null = null;

/**
 * Oturumu kapatır ve kaynakları bırakır.
 *
 * `createAudioPlayer` kendiliğinden serbest kalmıyor (hook'un tersine);
 * `remove()` çağrılmazsa her uyarı bir yerli çalar sızdırır. Gece boyunca
 * 5 dakikada bir çalan bir sayaç uyarısında bu yüzlerce çalar demek.
 */
function teardown(session: Session): void {
  session.cancelled = true;
  if (session.timer) clearTimeout(session.timer);
  session.timer = null;
  session.subscription?.remove();
  session.subscription = null;
  try {
    session.player.pause();
    session.player.remove();
  } catch {
    // Çalar zaten bırakılmış olabilir (hızlı iki `stopAlert` çağrısı);
    // ikinci bırakma hatası kullanıcıyı ilgilendiren bir şey değil.
  }
}

/**
 * Çalan uyarıyı anında keser.
 *
 * Şartname §2.2.1: kullanıcı bildirim kartına dokunduğunda, kapatma düğmesine
 * bastığında ya da ilgili ekrana geçtiğinde ses, tekrar sayısı bitmemiş olsa
 * dahi kesilmeli.
 *
 * @param kind Verilirse yalnızca o tür kesilir; verilmezse ne çalıyorsa.
 */
export function stopAlert(kind?: AlertKind): void {
  if (!active) return;
  if (kind !== undefined && active.kind !== kind) return;
  teardown(active);
  active = null;
}

/** Şu an bir uyarı çalıyor mu (ve hangisi)? Tanılama ve test için. */
export function activeAlert(): AlertKind | null {
  return active?.kind ?? null;
}

/**
 * Uyarı sesini şartnamedeki tekrar sayısınca çalar.
 *
 * **Asla fırlatmaz.** Ses, olayın kendisinden daha az önemli: ses cihazı
 * meşgulse ya da sistem odağı vermediyse bildirim yine görünmeli. Hata
 * sessizce yutulur.
 *
 * @param kind  Hangi olay — tekrar sayısı ve dosya `soundCatalog`'tan gelir.
 * @param times Tekrar sayısını geçersiz kılar (aşı gününde 4'e çıkmak gibi).
 */
export function playAlert(kind: AlertKind, times?: number): void {
  const spec = ALERTS[kind];
  const total = Math.max(1, times ?? spec.repeat);

  // Yeni uyarı eskisinin yerini alır.
  stopAlert();

  let player: AudioPlayer;
  try {
    player = createAudioPlayer(spec.asset);
  } catch {
    return;
  }

  const session: Session = {
    kind,
    player,
    round: 1,
    timer: null,
    subscription: null,
    cancelled: false,
  };
  active = session;

  const finish = () => {
    if (session.cancelled) return;
    teardown(session);
    if (active === session) active = null;
  };

  const playRound = () => {
    if (session.cancelled) return;
    try {
      /*
       * Başa alıp çalmak gerekiyor: aynı çalar nesnesi yeniden kullanılıyor
       * ve ikinci tekrar, dosyanın sonundan başlayıp anında bitiyordu.
       * `seekTo` bir söz döndürüyor ama beklenmiyor — beklemek tekrarlar
       * arasına görünür bir gecikme koyuyordu ve konum sıfırlaması çalmadan
       * önce zaten uygulanıyor.
       */
      void player.seekTo(0).catch(() => undefined);
      player.play();
    } catch {
      finish();
    }
  };

  /*
   * Bitiş `playbackStatusUpdate` ile yakalanıyor.
   *
   * Sabit bir zamanlayıcı (ör. "3 saniye sonra tekrar et") yanlış olurdu:
   * dosyaların uzunluğu 1 ile 7 saniye arasında değişiyor ve süreyi koda
   * yazmak, ses dosyası değiştiğinde sessizce bozulan bir varsayım olurdu.
   */
  session.subscription = player.addListener('playbackStatusUpdate', (status) => {
    if (session.cancelled) return;
    if (status.error) {
      finish();
      return;
    }
    if (!status.didJustFinish) return;

    if (session.round >= total) {
      finish();
      return;
    }
    session.round += 1;
    session.timer = setTimeout(playRound, GAP_MS);
  });

  playRound();
}

/**
 * Tüm uyarıları susturur — oturum kapanışında çağrılır.
 *
 * `stopAlert()` ile aynı işi yapıyor ama adı niyeti anlatıyor; çıkış akışında
 * "hangi türü durduracağım" sorusu sorulmasın.
 */
export function stopAllAlerts(): void {
  stopAlert();
}
