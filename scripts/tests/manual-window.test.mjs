/**
 * `src/core/records/manualWindow.ts` doğrulaması.
 *
 *     node scripts/tests/manual-window.test.mjs
 *
 * Mobil projede test koşucusu yok (bkz. modules_doc/NOTLAR-ve-EKSIKLER.md §4).
 * `tick-plan.test.mjs` kaynağı okuyup tip bilgisini elle sıyırıyordu; Node 22+
 * TypeScript'i kendisi soyduğu için (`--experimental-strip-types` artık
 * varsayılan) burada modül **doğrudan** içe aktarılıyor. Koşul: dosyanın
 * yalnızca silinebilir tip sözdizimi içermesi — `manualWindow.ts` saf olduğu
 * için bu sağlanıyor.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FUTURE_TOLERANCE_SEC,
  MAX_BREAST_SPAN_SEC,
  MAX_SLEEP_SPAN_SEC,
  composeMoment,
  momentFromClock,
  splitWindow,
  suggestSleepType,
  validateWindow,
} from '../../src/core/records/manualWindow.ts';

const NOW = new Date(2026, 10, 21, 12, 0, 0).getTime(); // 21 Kasım 2026, 12:00 yerel
const minsAgo = (m) => NOW - m * 60_000;

test('composeMoment tarih + saati yerel ana çevirir', () => {
  const ms = composeMoment('2026-11-21', '13:20');
  const d = new Date(ms);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 10);
  assert.equal(d.getDate(), 21);
  assert.equal(d.getHours(), 13);
  assert.equal(d.getMinutes(), 20);
});

test('composeMoment eksik girdide NaN döner', () => {
  assert.ok(Number.isNaN(composeMoment(null, '13:20')));
  assert.ok(Number.isNaN(composeMoment('2026-11-21', null)));
});

test('geçmişteki kapalı aralık geçerli', () => {
  assert.equal(
    validateWindow({ startMs: minsAgo(120), endMs: minsAgo(30), maxSpanSec: MAX_SLEEP_SPAN_SEC, nowMs: NOW }),
    null,
  );
});

test('bitişsiz (açık) pencere geçerli', () => {
  assert.equal(
    validateWindow({ startMs: minsAgo(45), endMs: null, maxSpanSec: MAX_SLEEP_SPAN_SEC, nowMs: NOW }),
    null,
  );
});

test('gelecek başlangıç reddedilir, saat kayması payı kabul edilir', () => {
  const future = validateWindow({
    startMs: NOW + 10 * 60_000, endMs: null, maxSpanSec: MAX_SLEEP_SPAN_SEC, nowMs: NOW,
  });
  assert.equal(future?.field, 'start');

  const withinSkew = validateWindow({
    startMs: NOW + (FUTURE_TOLERANCE_SEC - 10) * 1000,
    endMs: null, maxSpanSec: MAX_SLEEP_SPAN_SEC, nowMs: NOW,
  });
  assert.equal(withinSkew, null);
});

test('bitiş başlangıçtan önce veya eşitse reddedilir', () => {
  assert.equal(
    validateWindow({ startMs: minsAgo(30), endMs: minsAgo(90), maxSpanSec: MAX_SLEEP_SPAN_SEC, nowMs: NOW })?.field,
    'end',
  );
  const t = minsAgo(30);
  assert.equal(
    validateWindow({ startMs: t, endMs: t, maxSpanSec: MAX_SLEEP_SPAN_SEC, nowMs: NOW })?.field,
    'end',
  );
});

test('30 günden eski başlangıç reddedilir', () => {
  const issue = validateWindow({
    startMs: minsAgo(31 * 24 * 60), endMs: minsAgo(31 * 24 * 60 - 60),
    maxSpanSec: MAX_SLEEP_SPAN_SEC, nowMs: NOW,
  });
  assert.match(issue?.message ?? '', /30 günden eski/);
});

test('süre tavanı modüle göre değişir', () => {
  assert.equal(
    validateWindow({ startMs: minsAgo(20 * 60), endMs: NOW, maxSpanSec: MAX_SLEEP_SPAN_SEC, nowMs: NOW }),
    null,
  );
  // Aynı pencere emzirmede 6 saat tavanını aşar.
  assert.match(
    validateWindow({ startMs: minsAgo(20 * 60), endMs: NOW, maxSpanSec: MAX_BREAST_SPAN_SEC, nowMs: NOW })?.message ?? '',
    /6 saatten uzun/,
  );
});

test('uyku tipi önerisi 19:00–05:00 arası gecedir', () => {
  const at = (h, m = 0) => new Date(2026, 10, 21, h, m).getTime();
  assert.equal(suggestSleepType(at(13)), 'nap');
  assert.equal(suggestSleepType(at(18, 59)), 'nap');
  assert.equal(suggestSleepType(at(19)), 'night');
  assert.equal(suggestSleepType(at(23, 30)), 'night');
  assert.equal(suggestSleepType(at(4, 59)), 'night');
  assert.equal(suggestSleepType(at(5)), 'nap');
});

test('splitWindow toplamı pencereyi aşmaz', () => {
  assert.deepEqual(splitWindow(1500, 0.5), { leftSec: 750, rightSec: 750 });
  assert.deepEqual(splitWindow(1501, 0.5), { leftSec: 751, rightSec: 750 });
  assert.deepEqual(splitWindow(1500, 1), { leftSec: 1500, rightSec: 0 });
  assert.deepEqual(splitWindow(1500, 0), { leftSec: 0, rightSec: 1500 });
  // Sınır dışı oranlar kırpılır.
  assert.deepEqual(splitWindow(600, 2), { leftSec: 600, rightSec: 0 });
  assert.deepEqual(splitWindow(600, -1), { leftSec: 0, rightSec: 600 });
});

test('momentFromClock saati bugüne yazar', () => {
  const ms = momentFromClock('11:30', NOW);
  const d = new Date(ms);
  assert.equal(d.getDate(), 21);
  assert.equal(d.getHours(), 11);
  assert.equal(d.getMinutes(), 30);
  assert.equal(d.getSeconds(), 0);
});

test('momentFromClock ileri bir saati düne taşır', () => {
  // Saat 12:00 iken "23:50" ancak dün olabilir.
  const ms = momentFromClock('23:50', NOW);
  assert.equal(new Date(ms).getDate(), 20);
  assert.ok(ms < NOW);
});

test('momentFromClock tolerans içindeki saati bugün bırakır', () => {
  const ms = momentFromClock('12:01', NOW);
  assert.equal(new Date(ms).getDate(), 21);
});

test('momentFromClock geçersiz girdide NaN döner', () => {
  assert.ok(Number.isNaN(momentFromClock(null, NOW)));
  assert.ok(Number.isNaN(momentFromClock('25:00', NOW)));
  assert.ok(Number.isNaN(momentFromClock('1130', NOW)));
});
