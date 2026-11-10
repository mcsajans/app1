import type { QuietHour, Reminder } from '../api/modules';

/**
 * Sessiz saat ve tekrar hesabının **saf** kısmı.
 *
 * `expo-notifications` ya da `react-native` import etmez; bu yüzden düz
 * Node altında çalıştırılıp doğrulanabilir. Tarih matematiği (gece yarısını
 * aşan pencereler, gün maskesi, zincirlenmiş pencereler) modülün en kolay
 * yanlış yapılan kısmı olduğu için planlayıcıdan ayrı tutuldu.
 */

const MIN = 60_000;
const DAY_MIN = 24 * 60;

/** 'HH:MM' → gün başından itibaren dakika. */
export function toMinutes(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

/**
 * JS `getDay()` 0=Pazar iken `days_mask` bit 0 = Pazartesi. Kaydırma burada
 * tek noktada yapılır; iki yerde yapılsa biri unutulduğunda pencere yanlış
 * güne kayardı.
 */
export function dayBit(date: Date): number {
  const js = date.getDay();
  return 1 << ((js + 6) % 7);
}

function activeOn(w: QuietHour, date: Date): boolean {
  return w.is_enabled && (w.days_mask & dayBit(date)) !== 0;
}

/**
 * Verilen an sessiz pencerenin içinde mi?
 *
 * Gece yarısını aşan pencerelerde (22:00–07:00) günün hangi tarafında
 * olduğumuz önemlidir: 23:30 pencerenin **başladığı** güne, 02:00 ise bir
 * önceki günün penceresine aittir. Gün maskesi her zaman pencerenin başladığı
 * güne göre değerlendirilir; yoksa yalnızca Pazartesi geceleri için tanımlı
 * bir pencere, Pazartesi 00:30'u da kapsıyor sanılırdı.
 */
export function windowCovers(w: QuietHour, at: Date): boolean {
  const start = toMinutes(w.start_time);
  const end = toMinutes(w.end_time);
  const minute = at.getHours() * 60 + at.getMinutes();

  if (start < end) {
    return activeOn(w, at) && minute >= start && minute < end;
  }

  if (minute >= start) return activeOn(w, at);
  if (minute < end) return activeOn(w, new Date(at.getTime() - DAY_MIN * MIN));
  return false;
}

/** Anı kapsayan ilk sessiz saat, yoksa null. */
export function coveringWindow(windows: QuietHour[], at: Date): QuietHour | null {
  return windows.find((w) => windowCovers(w, at)) ?? null;
}

/**
 * Sessiz saat(ler)in bittiği ilk an. Zincirlenmiş pencereler (21:00–23:00 ve
 * 23:00–07:00) tek seferde aşılır; aksi hâlde ötelenen alarm hemen bir sonraki
 * sessiz pencerenin içine düşerdi. Döngü, hatalı veriyle sonsuza gitmemesi
 * için sekiz adımda kesilir.
 */
export function escapeQuiet(windows: QuietHour[], from: Date): Date {
  let at = from;
  for (let guard = 0; guard < 8; guard += 1) {
    const w = coveringWindow(windows, at);
    if (!w) return at;

    const end = toMinutes(w.end_time);
    const next = new Date(at);
    next.setHours(Math.floor(end / 60), end % 60, 0, 0);
    // Bitiş saati şu andan geriyse pencere gece yarısını aşıyor: ertesi gün.
    if (next.getTime() <= at.getTime()) next.setDate(next.getDate() + 1);
    at = next;
  }
  return at;
}

/**
 * JS `getDay()` (0 = Pazar) → ISO gün numarası (1 = Pazartesi … 7 = Pazar).
 *
 * Sunucu `repeat_days` alanını ISO düzeninde saklıyor (TEKNIK_DOKUMAN §22.14).
 * Çevrim **tek noktada** yapılır; iki yerde yapılsaydı biri unutulduğunda
 * alarm bir gün kayardı — `days_mask` ile aynı tuzak.
 */
export function isoDay(date: Date): number {
  const js = date.getDay();
  return js === 0 ? 7 : js;
}

/** 'YYYY-AA-GG' → o günün yerel gece yarısı; geçersizse null. */
function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

/**
 * Hatırlatıcı bu **günde** geçerli mi? (saat ayrı; burada yalnızca takvim)
 *
 * Tekrar kuralları (TEKNIK_DOKUMAN §22.14):
 *
 *  - `start_date` / `end_date` penceresi her biçimde uygulanır.
 *  - `none`        yalnızca `start_date` günü.
 *  - `daily`       her gün.
 *  - `weekly`      `start_date`in haftanın günü — tarih yoksa her gün sayılır,
 *                  çünkü "hangi gün" sorusunun başka yanıtı yok ve susturmak
 *                  kullanıcının kurduğu alarmı sessizce yok etmek olurdu.
 *  - `custom_days` `repeat_days` listesindeki günler.
 */
export function activeOnDay(reminder: Reminder, day: Date): boolean {
  const start = parseDay(reminder.start_date);
  const end = parseDay(reminder.end_date);

  // Pencere gün sınırında karşılaştırılır; `day` zaten bir gün başlangıcı
  // değilse saat farkı sınırı yanlış tarafa düşürebilirdi.
  const at = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  if (start && at.getTime() < start.getTime()) return false;
  if (end && at.getTime() > end.getTime()) return false;

  switch (reminder.recurrence_type) {
    case 'none':
      return start !== null && sameDay(at, start);
    case 'weekly':
      return start === null || isoDay(at) === isoDay(start);
    case 'custom_days': {
      const days = reminder.repeat_days ?? [];
      return days.length === 0 ? false : days.includes(isoDay(at));
    }
    case 'daily':
    default:
      return true;
  }
}

function atTimeOnDay(day: Date, hhmm: string): Date {
  const d = new Date(day);
  const mins = toMinutes(hhmm);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

/**
 * Ufuk içindeki ham tekrar anları — sessiz saat **uygulanmadan**, artan sırada.
 *
 * `interval` modunda başlangıç noktası sunucunun hesapladığı
 * `next_trigger_at`tır (anchor='last_record' ise son kaydın zamanını bilen
 * taraf sunucudur). Geçmişte kalmışsa veya hiç yoksa "şimdi + aralık"
 * kullanılır; her eşitlemede yeniden hesaplandığı için kayıt girildikten
 * sonraki ilk eşitleme doğru noktaya taşır.
 */
export function rawOccurrences(reminder: Reminder, now: Date, horizonDays: number): Date[] {
  const horizonEnd = now.getTime() + horizonDays * DAY_MIN * MIN;

  if (reminder.schedule_mode === 'fixed_times') {
    const out: Date[] = [];
    const times = reminder.fixed_times ?? [];
    for (let d = 0; d <= horizonDays; d += 1) {
      const day = new Date(now.getTime() + d * DAY_MIN * MIN);
      // Tekrar kuralı gün düzeyinde süzer: "yalnızca Pzt/Çar/Cum" ya da
      // "15 Aralık'ta bitsin" burada uygulanıyor.
      if (!activeOnDay(reminder, day)) continue;
      for (const t of times) {
        const at = atTimeOnDay(day, t);
        if (at.getTime() > now.getTime() && at.getTime() <= horizonEnd) out.push(at);
      }
    }
    return out.sort((a, b) => a.getTime() - b.getTime());
  }

  const step = (reminder.interval_minutes ?? 0) * MIN;
  if (step <= 0) return [];

  const anchorMs = reminder.next_trigger_at ? Date.parse(reminder.next_trigger_at) : NaN;
  let cursor = Number.isFinite(anchorMs) && anchorMs > now.getTime()
    ? anchorMs
    : now.getTime() + step;

  const out: Date[] = [];
  while (cursor <= horizonEnd) {
    out.push(new Date(cursor));
    cursor += step;
  }
  return out;
}

/**
 * Tekrar eden (süresiz) tetikleyici kullanılabilir mi?
 *
 * Koşul: sessiz saat hiç devrede değil. Devredeyse tekrarların bir kısmı
 * atlanacak/ötelenecek demektir ve tek bir tekrar eden tetikleyici güne göre
 * değişemediği için bunu ifade edemez.
 */
export function canRepeat(reminder: Reminder, windows: QuietHour[]): boolean {
  /*
   * Tekrar biçimi "her gün" DEĞİLSE süresiz tetikleyici kullanılamaz.
   *
   * Tek bir DAILY tetikleyici "yalnızca Pzt/Çar/Cum", "tek seferlik" ya da
   * "15 Aralık'ta bitsin" kuralını ifade edemez. Bu denetim olmasaydı haftalık
   * bir hatırlatıcı her gün çalmaya devam ederdi — kullanıcının kurduğu
   * ayarın tam tersi.
   */
  /*
   * Alan eksikse 'daily' kabul edilir: `migrations/017` uygulanmamış bir
   * sunucu bu alanı hiç döndürmüyor ve o durumda eski davranış (her gün)
   * geçerli. `undefined`ı "günlük değil" saymak, güncellenmemiş bir sunucuya
   * bağlanan istemcide tüm süresiz tetikleyicileri sessizce kapatırdı.
   */
  if ((reminder.recurrence_type ?? 'daily') !== 'daily') return false;
  // Başlangıcı gelecekte ya da bitişi tanımlı olan bir hatırlatıcı da
  // süresiz tekrar edemez.
  if (reminder.end_date) return false;
  if (reminder.start_date && reminder.start_date > localDayString(new Date())) return false;

  if (!reminder.respect_quiet_hours) return true;
  return windows.filter((w) => w.is_enabled).length === 0;
}

/** Yerel günün 'YYYY-AA-GG' hâli — dizge karşılaştırması için. */
function localDayString(d: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
