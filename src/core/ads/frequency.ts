/**
 * Reklam frekans sınırının **saf** kısmı (Reklam.md §0.1).
 *
 * `react-native` ya da AdMob SDK'sı içe aktarmıyor; bu yüzden düz Node
 * altında çalıştırılıp doğrulanabiliyor (`quietHours.ts` ve `tickPlan.ts`
 * ile aynı gerekçe). Ayrı dosyada olmasının sebebi önemsiz değil: bu hesap
 * yanlış giderse sonuç "ekranı reklamla dolduran uygulama" ve Google'ın
 * **hesabı askıya alması** — askıya alınmış bir AdMob hesabının geliri sıfır.
 *
 * Sayılar yönetim panelinden gelir (TEKNIK_DOKUMAN.md §7.6); burada sabit yok.
 */

export type FrequencyState = {
  /** Panelden: en az kaç dakikada bir. `0` sınırı kaldırır. */
  frequencyMinutes: number;
  /** Panelden: oturum başına en fazla kaç gösterim. `0` sınırı kaldırır. */
  sessionCap: number;
  /**
   * Son gösterimin zamanı (ms). Hiç gösterilmediyse `0`.
   *
   * `0` özel bir değer: "henüz gösterilmedi" demek ve bekleme süresi
   * uygulanmaz. Epoch'u gerçek bir zaman saymak, uygulamanın ilk kaydında
   * reklamı 56 yıllık bir beklemeye tabi tutmuş gibi davranmak olurdu —
   * aslında tersi, hemen gösterilmesi gerekiyor.
   */
  lastShownAt: number;
  /** Bu oturumda gösterilen reklam sayısı. */
  shownThisSession: number;
  /** Şimdi (ms). Test edilebilirlik için dışarıdan geçiyor. */
  now: number;
};

/**
 * Frekans sınırı bu gösterime izin veriyor mu?
 *
 * Sınır dolduğunda gösterim **sessizce atlanır** — kullanıcıya hiçbir şey
 * söylenmez, kayıt akışı etkilenmez.
 */
export function allowedByFrequency(s: FrequencyState): boolean {
  if (s.sessionCap > 0 && s.shownThisSession >= s.sessionCap) return false;

  if (s.frequencyMinutes > 0 && s.lastShownAt > 0) {
    const elapsedMin = (s.now - s.lastShownAt) / 60_000;
    /*
     * `elapsedMin` NEGATİF olabilir: kullanıcı telefonun saatini geri alırsa
     * ya da yaz saati uygulaması değişirse. Negatifi "süre geçmedi" saymak
     * doğru davranış — saat ileri alınıp geri alındığında reklamı serbest
     * bırakmak, sınırı atlatmanın en kolay yolu olurdu.
     */
    if (elapsedMin < s.frequencyMinutes) return false;
  }

  return true;
}
