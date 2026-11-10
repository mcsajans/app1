/**
 * Çoklu bildirim zamanlarının hesabı (modules_doc/bildirimler.md).
 *
 * React'e ve `expo-notifications`'a bağımlı değil: saat aritmetiği modülün en
 * kolay yanlış yapılan kısmı ve düz Node altında doğrulanabilir olması işe
 * yarıyor (`scratchpad/alarm_plan_test.mjs`).
 */

/** Şartnamedeki varsayılan: 30 dk, 15 dk, 5 dk önce ve tam zamanında. */
export const DEFAULT_OFFSETS = [30, 15, 5, 0];

/**
 * Aşı takviminin varsayılanı: 7 gün, 2 gün ve 1 gün önce
 * (modules_doc/asilar.md). Randevu haftalar öncesinden planlandığı için
 * dakikalık pencerenin orada karşılığı yok.
 */
export const VACCINE_OFFSETS = [10080, 2880, 1440];

/**
 * Etkinlik hatırlatıcısının seçenekleri: 14 gün, 7 gün, 2 gün, 1 gün önce ve
 * aynı gün (tam saatinde).
 *
 * Etkinlik haftalar öncesinden planlanıyor; dakikalık ön uyarının ("30 dk
 * önce") burada karşılığı yok. Dizi **dakika** cinsinden, tıpkı diğer ofsetler
 * gibi: 14 gün = 20160 dk.
 */
export const EVENT_OFFSETS = [20160, 10080, 2880, 1440, 0];

/**
 * Etkinliğin tam anı: 'YYYY-AA-GG' tarih + 'SS:DD' saat → yerel `Date`.
 *
 * Tarih ve saat ayrı alanlarda tutuluyor (`start_date` ve `fixed_times`),
 * çünkü hatırlatıcı şeması tekrar eden kayıtlar için tasarlandı. Etkinlikte
 * tekrar yok, o yüzden ikisi burada tek bir ana birleştiriliyor.
 *
 * Dizge birleştirip `Date.parse`'a vermek yerine alanlar tek tek veriliyor:
 * `new Date('2026-11-20T09:00')` bazı ortamlarda UTC sayılıyor ve etkinlik
 * saat dilimi farkı kadar kayıyordu.
 */
export function eventInstant(
  startDate: string | null | undefined,
  time: string | null | undefined,
): Date | null {
  if (!startDate || !time) return null;

  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
  const clock = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!day || !clock) return null;

  const at = new Date(
    Number(day[1]), Number(day[2]) - 1, Number(day[3]),
    Number(clock[1]), Number(clock[2]), 0, 0,
  );
  return Number.isFinite(at.getTime()) ? at : null;
}

export type AlarmSlot = {
  /** Bildirimin çalacağı an. */
  at: Date;
  /** Hedef zamandan kaç dakika önce (0 = tam zamanında). */
  offsetMin: number;
};

/**
 * Hedef zamana göre bildirim anlarını üretir.
 *
 * Üç şey elenir:
 *
 * 1. **Geçmiş anlar.** `scheduleNotificationAsync` geçmiş bir tarihi kabul
 *    eder ama hiç tetiklemez; 18:00'deki bir görev 17:50'de kaydedilirse
 *    "30 dk önce" ve "15 dk önce" çoktan geçmiştir. Bunları planlamak
 *    bildirim bütçesini sessizce harcardı.
 * 2. **Yinelenen anlar.** Ofsetler sunucuda benzersizleştiriliyor ama yerel
 *    taslak hâlindeki bir form henüz oradan geçmemiş olabilir.
 * 3. **Geçersiz tarih.** Bozuk `due_time` ile hiç slot üretilmez; çağıran
 *    boş listeyi "planlanacak bir şey yok" diye okur.
 *
 * `null` ofset listesi "kullanıcı tüm bildirimleri kapattı" demektir ve boş
 * dizi ile aynı sonucu verir — ayrım sunucuda anlamlı, burada değil.
 */
export function alarmSlots(
  dueTime: string | Date,
  offsets: number[] | null | undefined,
  now: Date = new Date(),
): AlarmSlot[] {
  if (!offsets || offsets.length === 0) return [];

  const due = dueTime instanceof Date ? dueTime.getTime() : Date.parse(dueTime);
  if (!Number.isFinite(due)) return [];

  const nowMs = now.getTime();
  const seen = new Set<number>();
  const slots: AlarmSlot[] = [];

  for (const offsetMin of offsets) {
    if (!Number.isFinite(offsetMin) || offsetMin < 0) continue;
    const at = due - offsetMin * 60_000;
    if (at <= nowMs) continue;
    if (seen.has(at)) continue;
    seen.add(at);
    slots.push({ at: new Date(at), offsetMin });
  }

  return slots.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * Bildirim gövdesi: "15 dakika kaldı" / "7 gün kaldı" / "Şimdi".
 *
 * Saat yerine kalan süre yazılır — bildirim ekranında kullanıcı zaten saati
 * görüyor, işine yarayan bilgi ne kadar vakti olduğudur.
 *
 * Bir günden uzun ofsetler **güne** çevrilir. Aşı modülü 7 günlük (10080 dk)
 * uyarı kuruyor ve saat cinsinden yazıldığında bildirim "168 saat kaldı"
 * diyordu; kimse zamanı böyle okumuyor. 1440 da artık "1 gün kaldı" diyor,
 * "24 saat kaldı" değil.
 */
export function offsetLabel(offsetMin: number): string {
  if (offsetMin <= 0) return 'Şimdi';
  if (offsetMin < 60) return `${offsetMin} dakika kaldı`;

  if (offsetMin >= 1440) {
    const days = Math.floor(offsetMin / 1440);
    const restHours = Math.round((offsetMin % 1440) / 60);
    if (restHours === 0) return `${days} gün kaldı`;
    return `${days} gün ${restHours} saat kaldı`;
  }

  const hours = Math.floor(offsetMin / 60);
  const mins = offsetMin % 60;
  if (mins === 0) return `${hours} saat kaldı`;
  return `${hours} saat ${mins} dakika kaldı`;
}

/**
 * Ayar ekranında seçili ofsetleri tek satırda özetler.
 *
 * Birim ofsetin büyüklüğüne göre seçilir: aşıda "10080 dk önce" yazmak
 * okunabilir bir cümle değildi.
 */
export function offsetsSummary(offsets: number[] | null | undefined): string {
  if (!offsets || offsets.length === 0) return 'Bildirim yok';
  const sorted = [...new Set(offsets)].sort((a, b) => b - a);
  const parts = sorted.map((o) => {
    if (o === 0) return 'tam zamanında';
    if (o % 1440 === 0) return `${o / 1440} gün önce`;
    if (o % 60 === 0) return `${o / 60} saat önce`;
    return `${o} dk önce`;
  });
  return parts.join(', ');
}

/**
 * Hedef zaman geçmişte mi? Geçmiş görevlerin cihaz alarmı da temizlenir —
 * "süresi dolduğunda" kuralı (şartname, Otomatik Alarm Kapatma).
 */
export function isExpired(dueTime: string | Date, now: Date = new Date()): boolean {
  const due = dueTime instanceof Date ? dueTime.getTime() : Date.parse(dueTime);
  return Number.isFinite(due) && due <= now.getTime();
}
