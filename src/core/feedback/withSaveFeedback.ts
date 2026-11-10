import { showAdAfterAction } from '../ads/adService';
import type { AdTrigger } from '../ads/useAdSettingsStore';
import { useSaveFeedbackStore } from './useSaveFeedbackStore';

/**
 * `withSaveFeedback` neden ayrı dosyada:
 *
 * Reklam servisi, kaydetme onay penceresi açıkken reklam göstermemek için
 * `useSaveFeedbackStore`u okuyor. Sarmalayıcı da reklam tetiğini atmak için
 * `adService`i çağırıyor. İkisi aynı dosyada olunca
 * `adService → useSaveFeedbackStore → adService` dairesi oluşuyordu.
 *
 * Daire, çağrıların hepsi çalışma zamanında olduğu için Metro altında
 * büyük olasılıkla sorunsuz çalışırdı — ama modül yükleme sırasına bağlı
 * bir kırılganlık, hata verdiğinde "neden `showAdAfterAction` undefined"
 * sorusuna çıkar ve sebebi hiç belli olmaz. Bölme bunu tamamen kaldırıyor:
 *
 *   useSaveFeedbackStore  (yaprak)
 *   adService             → useSaveFeedbackStore
 *   withSaveFeedback      → ikisi
 */

/**
 * Kaydetme işini sarmalar: düğmeye basıldığı anda pencere açılır, iş bitince
 * onay metnine döner, hata olursa kapanır.
 *
 * Hata **yeniden fırlatılır** — ekranların kendi `catch` blokları ve
 * `FormError` satırları olduğu gibi çalışmaya devam etsin. Pencerenin işi
 * onaylamak; hata anlatmak formun işi, çünkü hangi alanın sorunlu olduğunu
 * yalnızca form biliyor.
 *
 * **Reklam tetiği de burada** (Reklam.md §2 Adım 3): "Kaydet" ve
 * "Değişiklikleri Kaydet" düğmelerinin tamamı bu sarmalayıcıdan geçtiği için
 * 14 ekran tek satırla kapsanıyor. Tetik yalnızca **başarılı** kayıtta
 * atılıyor: hata veren bir kaydın üstüne reklam açmak, kullanıcıyı hatayı
 * okumadan ekrandan atmak olurdu.
 *
 * `adTrigger` panelde ayrı ayrı açılıp kapatılabilen tetikleyiciyi seçer
 * (TEKNIK_DOKUMAN.md §7.6). Varsayılan `'save'`; aşı "yapıldı" akışı
 * `'complete'`, davet oluşturma `'invite'` geçiyor — yoksa panelin o iki
 * anahtarı hiçbir zaman işe yaramazdı.
 */
export async function withSaveFeedback<T>(
  fn: () => Promise<T>,
  message?: string,
  adTrigger: AdTrigger = 'save',
): Promise<T> {
  const { begin, succeed, fail } = useSaveFeedbackStore.getState();
  begin();
  try {
    const result = await fn();
    succeed(message);
    /*
     * `succeed`ten SONRA: reklam servisi onay penceresinin kapanmasını
     * bekliyor (`phase !== 'hidden'` kapısı). Önce çağırmak, gecikme dolduğu
     * anda pencereyi hâlâ açık görüp gösterimi sessizce atlamak olurdu.
     *
     * `await` edilmiyor ve hata fırlatmıyor; `showAdAfterAction` sözleşmesi
     * bu. Yine de savunma amaçlı try/catch: reklam katmanındaki bir hata
     * KESİNLİKLE kaydı başarısız göstermemeli.
     */
    try {
      showAdAfterAction(adTrigger);
    } catch {
      // Reklam hatası kaydı etkilemez.
    }
    return result;
  } catch (err) {
    fail();
    throw err;
  }
}
