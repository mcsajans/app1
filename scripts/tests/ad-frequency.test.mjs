/**
 * `src/core/ads/frequency.ts` doğrulaması.
 *
 *     node scripts/tests/ad-frequency.test.mjs
 *
 * Mobil projede test koşucusu yok (bkz. modules_doc/NOTLAR-ve-EKSIKLER.md §4),
 * bu yüzden saf modüller düz Node ile sürülüyor — `tick-plan.test.mjs` ile
 * aynı yöntem: kaynak okunup TypeScript ek bilgileri sıyrılıyor.
 * `frequency.ts` hiçbir şey içe aktarmadığı için bu yeterli.
 *
 * Neden test ediliyor: frekans sınırı yanlış hesaplanırsa sonuç "her kayıtta
 * reklam" olur; Google bunu "disruptive interstitial" sayıp AdMob hesabını
 * askıya alabiliyor (modules_doc/Reklam.md §0.1).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, '..', '..', 'src', 'core', 'ads', 'frequency.ts');

const src = readFileSync(target, 'utf8')
  .replace(/export type FrequencyState = \{[\s\S]*?\n\};\n/, '')
  .replace(/export function allowedByFrequency\(s: FrequencyState\): boolean \{/,
           'function allowedByFrequency(s) {');

const { allowedByFrequency } = new Function(`${src}\nreturn { allowedByFrequency };`)();

let pass = 0;
let fail = 0;
const eq = (name, got, want) => {
  if (got === want) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}: ${got} !== ${want}`);
  }
};

const MIN = 60_000;
const NOW = Date.parse('2026-11-05T12:00:00Z');
/** Panel varsayılanları: 3 dakikada bir, oturumda 5. */
const base = { frequencyMinutes: 3, sessionCap: 5, lastShownAt: 0, shownThisSession: 0, now: NOW };
const at = (minutesAgo) => NOW - minutesAgo * MIN;

console.log('ilk gösterim');
eq('hiç gösterilmedi → izin var', allowedByFrequency(base), true);
eq('lastShownAt = 0 beklemeye tabi değil', allowedByFrequency({ ...base, frequencyMinutes: 999 }), true);

console.log('\nbekleme süresi (3 dakika)');
eq('0 dk önce → izin yok', allowedByFrequency({ ...base, lastShownAt: at(0) }), false);
eq('1 dk önce → izin yok', allowedByFrequency({ ...base, lastShownAt: at(1) }), false);
eq('2 dk 59 sn önce → izin yok', allowedByFrequency({ ...base, lastShownAt: NOW - (3 * MIN - 1000) }), false);
eq('tam 3 dk önce → izin var', allowedByFrequency({ ...base, lastShownAt: at(3) }), true);
eq('10 dk önce → izin var', allowedByFrequency({ ...base, lastShownAt: at(10) }), true);

console.log('\noturum tavanı (5)');
eq('4 gösterim → izin var', allowedByFrequency({ ...base, shownThisSession: 4 }), true);
eq('5 gösterim → izin yok', allowedByFrequency({ ...base, shownThisSession: 5 }), false);
eq('6 gösterim → izin yok', allowedByFrequency({ ...base, shownThisSession: 6 }), false);
eq('tavan dolu + bekleme bitti → yine izin yok',
  allowedByFrequency({ ...base, shownThisSession: 5, lastShownAt: at(60) }), false);

console.log('\nsıfır = sınır yok (panel bunu belirtiyor)');
eq('frequencyMinutes 0 → bekleme yok', allowedByFrequency({ ...base, frequencyMinutes: 0, lastShownAt: at(0) }), true);
eq('sessionCap 0 → tavan yok', allowedByFrequency({ ...base, sessionCap: 0, shownThisSession: 999 }), true);
eq('ikisi de 0 → her zaman izin', allowedByFrequency({
  frequencyMinutes: 0, sessionCap: 0, lastShownAt: at(0), shownThisSession: 999, now: NOW,
}), true);

console.log('\nsaat geri alınırsa (negatif geçen süre)');
// Saati ileri alıp geri almak, sınırı atlatmanın en kolay yolu olurdu.
eq('son gösterim GELECEKTE → izin yok', allowedByFrequency({ ...base, lastShownAt: at(-30) }), false);
eq('son gösterim 1 sn gelecekte → izin yok', allowedByFrequency({ ...base, lastShownAt: NOW + 1000 }), false);

console.log('\nşartname senaryosu: arka arkaya üç kayıt');
// Reklam.md §2 Adım 5, test 4: ikinci ve üçüncü kayıtta reklam gelmemeli.
let state = { ...base };
eq('1. kayıt → reklam', allowedByFrequency(state), true);
state = { ...state, lastShownAt: NOW, shownThisSession: 1, now: NOW + 20_000 };
eq('2. kayıt (20 sn sonra) → reklam yok', allowedByFrequency(state), false);
state = { ...state, now: NOW + 40_000 };
eq('3. kayıt (40 sn sonra) → reklam yok', allowedByFrequency(state), false);
state = { ...state, now: NOW + 3 * MIN };
eq('4. kayıt (3 dk sonra) → reklam var', allowedByFrequency(state), true);

console.log(`\n${pass} geçti, ${fail} başarısız`);
process.exit(fail ? 1 : 0);
