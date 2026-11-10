#!/usr/bin/env node
/**
 * Bu makine için doğru `EXPO_PUBLIC_API_URL` değerini yazar.
 *
 *     node scripts/api-url.mjs
 *
 * Neden gerekiyor: adres artık koda gömülü değil (TEKNIK_DOKUMAN §8.6) ve
 * doğru değer **nereden bağlandığına** göre değişiyor. En sık yapılan hata,
 * fiziksel telefonda `10.0.2.2` ya da `localhost` bırakmak: ikisi de cihazın
 * **kendisini** gösterdiği için hiçbir istek sunucuya ulaşmıyor ve arıza
 * "Sunucuya ulaşılamadı" olarak görünüyor. Bu betik makinenin LAN adresini
 * bulup yazıyor, böylece elle `ipconfig` okumak gerekmiyor.
 */
import { networkInterfaces } from 'node:os';

const PORT = process.argv[2] ?? '4000';

/**
 * Dışarıdan erişilebilir IPv4 adresleri.
 *
 * `internal` (loopback) ve IPv6 elenir. Sanal bağdaştırıcılar (VirtualBox,
 * WSL, Docker, Hyper-V) da elenir: telefon o ağlarda değil ve listenin
 * başında görünürlerse yanlış adres kopyalanır.
 */
const VIRTUAL = /virtual|vethernet|wsl|docker|vmware|vbox|loopback|bluetooth/i;

const candidates = Object.entries(networkInterfaces())
  .filter(([name]) => !VIRTUAL.test(name))
  .flatMap(([name, addrs]) =>
    (addrs ?? [])
      .filter((a) => a.family === 'IPv4' && !a.internal)
      .map((a) => ({ name, address: a.address })),
  );

/** Wi-Fi öne alınır: telefon neredeyse her zaman kablosuz ağda. */
candidates.sort((a, b) => {
  const score = (n) => (/wi-?fi|wlan|kablosuz/i.test(n) ? 0 : 1);
  return score(a.name) - score(b.name);
});

console.log('Bebiqa — mobil istemcinin API adresi\n');
console.log('Android emülatörü:');
console.log(`  EXPO_PUBLIC_API_URL=http://10.0.2.2:${PORT}\n`);
console.log('iOS simülatörü / web:');
console.log(`  EXPO_PUBLIC_API_URL=http://localhost:${PORT}\n`);

if (candidates.length === 0) {
  console.log('Fiziksel telefon:');
  console.log('  LAN adresi bulunamadı — ağa bağlı mısın?');
} else {
  console.log('Fiziksel telefon (telefon AYNI Wi-Fi ağında olmalı):');
  for (const { name, address } of candidates) {
    console.log(`  EXPO_PUBLIC_API_URL=http://${address}:${PORT}      # ${name}`);
  }
}

console.log(`
Değeri proje kökündeki .env.local dosyasına yaz, sonra:

  npx expo start --clear        # Metro .env*'i YALNIZCA başlangıçta okur
  npx expo run:android          # dev build değerleri DERLEME sırasında gömer

Yalnızca Reload yetmez.

Sunucu 0.0.0.0'ı dinlemeli (backend .env → HOST=0.0.0.0) ve Windows güvenlik
duvarı node.exe'ye gelen bağlantıya izin vermeli. Denemek için telefonun
tarayıcısında şu adresi aç — JSON görmelisin:

  http://${candidates[0]?.address ?? '<LAN-IP>'}:${PORT}/api/v1/health
`);
