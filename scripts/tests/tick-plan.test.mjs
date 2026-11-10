/**
 * `src/core/notifications/tickPlan.ts` doğrulaması.
 *
 *     node scripts/tests/tick-plan.test.mjs
 *
 * Mobil projede test koşucusu yok (bkz. modules_doc/NOTLAR-ve-EKSIKLER.md §4),
 * bu yüzden saf modüller düz Node ile sürülüyor. Kaynak dosya okunup
 * TypeScript ek bilgileri sıyrılıyor; `tickPlan.ts` hiçbir şey içe
 * aktarmadığı için bu yeterli ve derleme adımı gerekmiyor.
 *
 * Periyodik uyarıların hesabı burada doğrulanıyor: şartnamedeki 5 dk / 30 dk
 * aralıkları ve gecikmiş görevin 24 saatlik güvenlik zaman aşımı
 * (modules_doc/notification-voice.md §2.1, §2.2.3).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, '..', '..', 'src', 'core', 'notifications', 'tickPlan.ts');

const src = readFileSync(target, 'utf8')
  .replace(/export const MIN_DELAY_MS = 1_000;/, 'const MIN_DELAY_MS = 1000;')
  .replace(/export function nextTickDelayMs\([^)]*\): number \{/s,
           'function nextTickDelayMs(elapsedMs, intervalMs) {')
  .replace(/export function shouldNagOverdue\(params: \{[\s\S]*?\}\): boolean \{/,
           'function shouldNagOverdue(params) {')
  .replace(/const \{ dueMs, nowMs, closed, maxMs \} = params;/,
           'const { dueMs, nowMs, closed, maxMs } = params;');

const mod = new Function(`${src}\nreturn { nextTickDelayMs, shouldNagOverdue, MIN_DELAY_MS };`)();
const { nextTickDelayMs, shouldNagOverdue } = mod;

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  if (got === want) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}: ${got} !== ${want}`); }
};

const MIN = 60_000;
console.log('nextTickDelayMs — beslenme (5 dk aralık)');
eq('sayaç yeni başladı → 5 dk', nextTickDelayMs(0, 5 * MIN), 5 * MIN);
eq('1 dk geçti → 4 dk kaldı', nextTickDelayMs(1 * MIN, 5 * MIN), 4 * MIN);
eq('7 dk geçti → 3 dk kaldı', nextTickDelayMs(7 * MIN, 5 * MIN), 3 * MIN);
eq('tam 5 dk → sonraki kat, 5 dk', nextTickDelayMs(5 * MIN, 5 * MIN), 5 * MIN);
eq('4 dk 59 sn → 1 sn', nextTickDelayMs(5 * MIN - 1000, 5 * MIN), 1000);
eq('4 dk 59.5 sn → taban 1 sn', nextTickDelayMs(5 * MIN - 100, 5 * MIN), 1000);
eq('negatif geçen süre → tam aralık', nextTickDelayMs(-5000, 5 * MIN), 5 * MIN);

console.log('nextTickDelayMs — uyku (30 dk aralık)');
eq('yeni başladı → 30 dk', nextTickDelayMs(0, 30 * MIN), 30 * MIN);
eq('45 dk geçti → 15 dk kaldı', nextTickDelayMs(45 * MIN, 30 * MIN), 15 * MIN);
eq('3 saat 5 dk → 25 dk kaldı', nextTickDelayMs(185 * MIN, 30 * MIN), 25 * MIN);

console.log('nextTickDelayMs — geçersiz aralık fırlatır');
try { nextTickDelayMs(0, 0); fail++; console.log('  FAIL fırlatmadı'); }
catch { pass++; console.log('  ok   intervalMs=0 fırlattı'); }

console.log('shouldNagOverdue (24 saat zaman aşımı)');
const MAX = 24 * 60 * MIN;
const now = Date.parse('2026-11-03T12:00:00Z');
const at = (offsetMin) => now - offsetMin * MIN;
eq('tam zamanında (0 dk) → döngü var', shouldNagOverdue({ dueMs: at(0), nowMs: now, closed: false, maxMs: MAX }), true);
eq('1 dk gecikti → döngü var', shouldNagOverdue({ dueMs: at(1), nowMs: now, closed: false, maxMs: MAX }), true);
eq('henüz zamanı gelmedi → döngü yok', shouldNagOverdue({ dueMs: at(-10), nowMs: now, closed: false, maxMs: MAX }), false);
eq('tamamlandı → döngü yok', shouldNagOverdue({ dueMs: at(60), nowMs: now, closed: true, maxMs: MAX }), false);
eq('23 sa 59 dk → döngü var', shouldNagOverdue({ dueMs: at(24 * 60 - 1), nowMs: now, closed: false, maxMs: MAX }), true);
eq('tam 24 saat → zaman aşımı, döngü yok', shouldNagOverdue({ dueMs: at(24 * 60), nowMs: now, closed: false, maxMs: MAX }), false);
eq('25 saat → döngü yok', shouldNagOverdue({ dueMs: at(25 * 60), nowMs: now, closed: false, maxMs: MAX }), false);
eq('geçersiz tarih → döngü yok', shouldNagOverdue({ dueMs: NaN, nowMs: now, closed: false, maxMs: MAX }), false);

console.log(`\n${pass} geçti, ${fail} başarısız`);
process.exit(fail ? 1 : 0);
