import type { NotificationType } from '../api/modules';

/**
 * Bildirim kutusunun saf sunum mantığı — React'e bağımlı değil.
 *
 * `taskFormat.ts` ve `vaccineFormat.ts` ile aynı gerekçe: göreli zaman
 * hesabının sınırları (59 dk / 60 dk, 23 saat / dün) kolay yanlış yapılan
 * kısım ve düz Node altında doğrulanabilir olması işe yarıyor
 * (`scratchpad/inbox_format_test.mjs`).
 */

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  vaccine: 'Aşı',
  task: 'Görev',
  reminder: 'Hatırlatıcı',
  routine: 'Kayıt',
  family: 'Aile',
};

/**
 * Türün ikonu — `components/Icon.tsx` sözlüğündeki semantik ad.
 *
 * Şartname emoji öneriyor (💉 📋 ⏰ 👥) ama uygulamanın geri kalanı vektör
 * ikon setine geçti: emoji her platformda farklı çiziliyor, boyutu yazı
 * tipine bağlı ve rengi temayla uyuşmuyor (components/Icon.tsx). Emoji
 * yalnızca işletim sistemine düz metin giden bildirim **başlıklarında**
 * kalıyor; orada bir bileşen çizdiremiyoruz.
 *
 * Bu dosya React'siz kalmalı, o yüzden burada yalnızca **ad** durur.
 */
export const NOTIFICATION_TYPE_ICONS = {
  vaccine: 'vaccines',
  task: 'tasks',
  reminder: 'bell',
  routine: 'timeline',
  family: 'family',
} as const satisfies Record<NotificationType, string>;

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

/**
 * Göreli zaman: *"az önce"*, *"3 dk önce"*, *"2 saat önce"*, *"dün"*,
 * *"5 gün önce"*, *"12 Kasım"*.
 *
 * Mutlak saat yerine geçen süre yazılır: kullanıcı listeye "ne zaman oldu"
 * diye bakıyor, "saat kaçtı" diye değil. Bir haftadan eskisi tarihe döner —
 * "23 gün önce" kimsenin zihninde bir güne karşılık gelmiyor.
 *
 * **Gelecek zamanlar** da "az önce" sayılır: sunucu ile cihaz saati birkaç
 * saniye kayabiliyor ve "-1 dk önce" yazmak hata gibi görünürdü.
 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return '';

  const mins = Math.floor((now.getTime() - at) / 60_000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'dün';
  if (days < 7) return `${days} gün önce`;

  const d = new Date(at);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * Listenin tepesindeki özet — rozet metni.
 *
 * Sıfırda boş dize döner; "0 okunmamış" yazmak, hiçbir şey yazmamaktan daha
 * çok yer kaplıyor ve aynı bilgiyi veriyor.
 */
export function unreadLabel(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}
