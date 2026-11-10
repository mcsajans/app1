#!/usr/bin/env node
/**
 * Yönetim panelinden yüklenen UYGULAMA LOGOSUNU başlatıcı ikonuna işler.
 *
 * Neden bir betik? Android başlatıcı ikonu APK'ya derleme sırasında gömülür;
 * sunucudan indirilen bir görselle çalışma zamanında değiştirilemez. Bu yüzden
 * akış şudur:
 *
 *   panelden logo yükle  →  node scripts/sync-app-icon.mjs --yes  →  yeniden derle
 *
 * Ayrıntı: TEKNIK_DOKUMAN.md §7.5
 */
import http from 'node:http';
import { decodePng, encodePng, centerOnCanvas } from './lib/png.mjs';
import { writeFile, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Varsayılan canlı sunucu; yerel kurulumda `BEBIQA_API` ile ezilir
// (örn. BEBIQA_API=http://bebektakip.test node scripts/sync-app-icon.mjs).
const API = process.env.BEBIQA_API ?? 'https://babylog.mcsajans.com';

/**
 * Logo doğrudan kopyalanmaz: kare bir tuvale ortalanıp kenarlarda boşluk
 * bırakılır. Aksi halde Android'in uyarlanabilir ikon maskesi logoyu daire
 * biçiminde kırpıyor ve kenarları kesiyor.
 */
const CANVAS = 1024;
const BRAND_BG = [0xe6, 0xf4, 0xfe]; // app.json -> android.adaptiveIcon.backgroundColor

const TARGETS = [
  // app.json -> icon : iOS/web ve genel ikon. Saydamlık istenmez, zemin verilir.
  { file: path.join(ROOT, 'assets', 'icon.png'), scale: 0.72, background: BRAND_BG },
  // Uyarlanabilir ikonun ÖN PLANI: saydam kalmalı, güvenli alan için daha küçük.
  { file: path.join(ROOT, 'assets', 'android-icon-foreground.png'), scale: 0.6, background: null },
];

class Abort extends Error {}

function bail(message) {
  throw new Abort(message);
}

/**
 * Düz node:http kullanılıyor: global fetch (undici) Windows'ta açık keep-alive
 * soketiyle çıkışta libuv assertion uyarısı bastırıyordu ve betiğin çıktısı
 * hatalıymış gibi görünüyordu.
 */
function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers: { connection: 'close' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('zaman aşımı')));
  });
}

const confirmed = process.argv.includes('--yes');

async function main() {
const res = await get(`${API}/api/v1/branding`).catch((e) => bail(`API'ye ulaşılamadı: ${e.message}`));
if (res.status !== 200) bail(`/api/v1/branding beklenmeyen yanıt verdi (HTTP ${res.status})`);

const body = JSON.parse(res.body.toString('utf8'));
const url = body?.data?.app_logo;
if (!url) bail('Panelde henüz bir uygulama logosu yüklenmemiş (/admin/system).');

// URL'in sonunda önbellek kırıcı `?v=...` var; uzantı ondan ÖNCE okunmalı.
const ext = path.extname(new URL(url).pathname).toLowerCase();
if (ext !== '.png') {
  bail(`Başlatıcı ikonu PNG olmalı, panele yüklenen "${ext}". Panelden PNG yükle.`);
}

console.log('Kaynak :', url);
console.log('Hedefler:');
for (const t of TARGETS) console.log('  - ' + path.relative(ROOT, t.file));

if (!confirmed) {
  console.log('\nBu dosyaların ÜZERİNE YAZILACAK. Onaylamak için: --yes');
  process.exit(0);
}

// İlk çalıştırmada özgün dosyaların yedeği alınır. Yedek VARSA dokunulmaz:
// aksi halde ikinci çalıştırma, özgün tasarımı üretilmiş ikonla ezerdi.
for (const { file } of TARGETS) {
  const backup = file + '.bak';
  try {
    await access(backup);
    continue; // özgün yedek zaten duruyor
  } catch {
    // yedek yok, almaya çalış
  }
  try {
    await access(file);
    await copyFile(file, backup);
    console.log('yedek:', path.relative(ROOT, backup));
  } catch {
    // Dosya yoksa yedek de gerekmez.
  }
}

const img = await get(url).catch((e) => bail(`Logo indirilemedi: ${e.message}`));
if (img.status !== 200) bail(`Logo indirilemedi (HTTP ${img.status})`);
const buf = img.body;

const logo = decodePng(buf);
console.log(`logo: ${logo.width}x${logo.height}`);

for (const { file, scale, background } of TARGETS) {
  const out = encodePng(centerOnCanvas(logo, CANVAS, scale, background));
  await writeFile(file, out);
  console.log(`yazıldı: ${path.relative(ROOT, file)} (${CANVAS}x${CANVAS}, logo %${Math.round(scale * 100)})`);
}

console.log(`
Tamam. Şimdi mipmap kaynaklarını yeniden üret ve derle:

  npx expo prebuild --platform android
  npx expo run:android

prebuild ŞART: 'expo run:android' tek başına assets/ altındaki değişikliği
fark etmez, android/app/src/main/res/mipmap-* dosyaları eski kalır.

Logo, kırpılmaması için kare tuvale ortalandı. Özgün dosyalar .bak olarak duruyor.`);
}

try {
  await main();
} catch (err) {
  console.error('HATA: ' + (err instanceof Error ? err.message : String(err)));
  process.exitCode = 1;
}
