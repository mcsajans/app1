import zlib from 'node:zlib';

/**
 * Bağımlılıksız, küçük bir PNG oku/yaz katmanı.
 *
 * Yalnızca ikon üretimi için gereken kadarını destekler: 8 bit derinlik,
 * interlace yok. Desteklenmeyen bir biçim gelirse sessizce yanlış görsel
 * üretmek yerine açık hata verir.
 */

function readChunks(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('Geçerli bir PNG değil');
  }
  const chunks = [];
  let pos = 8;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    chunks.push({ type, data: buf.subarray(pos + 8, pos + 8 + len) });
    pos += 12 + len;
  }
  return chunks;
}

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function unfilter(raw, width, height, bpp) {
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos];
    pos += 1;
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const off = y * stride;
    const prev = y > 0 ? off - stride : -1;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? out[off + x - bpp] : 0;
      const b = prev >= 0 ? out[prev + x] : 0;
      const c = prev >= 0 && x >= bpp ? out[prev + x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[off + x] = v & 255;
    }
  }
  return out;
}

/** PNG -> { width, height, rgba } (her piksel 4 bayt). */
export function decodePng(buf) {
  const chunks = readChunks(buf);
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  if (!ihdr) throw new Error('IHDR bulunamadı');

  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const depth = ihdr.data[8];
  const colorType = ihdr.data[9];
  const interlace = ihdr.data[12];

  if (depth !== 8) throw new Error(`Yalnızca 8 bit PNG destekleniyor (gelen: ${depth} bit)`);
  if (interlace !== 0) throw new Error('Interlaced (Adam7) PNG desteklenmiyor');
  const ch = CHANNELS[colorType];
  if (!ch) throw new Error(`Bilinmeyen renk tipi: ${colorType}`);

  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
  const pixels = unfilter(zlib.inflateSync(idat), width, height, ch);

  const rgba = Buffer.alloc(width * height * 4);
  const plte = chunks.find((c) => c.type === 'PLTE')?.data;
  const trns = chunks.find((c) => c.type === 'tRNS')?.data;

  for (let i = 0; i < width * height; i += 1) {
    const s = i * ch;
    const d = i * 4;
    if (colorType === 6) {
      pixels.copy(rgba, d, s, s + 4);
    } else if (colorType === 2) {
      rgba[d] = pixels[s]; rgba[d + 1] = pixels[s + 1]; rgba[d + 2] = pixels[s + 2]; rgba[d + 3] = 255;
    } else if (colorType === 0) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = pixels[s]; rgba[d + 3] = 255;
    } else if (colorType === 4) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = pixels[s]; rgba[d + 3] = pixels[s + 1];
    } else {
      const idx = pixels[s];
      if (!plte) throw new Error('Paletli PNG ama PLTE yok');
      rgba[d] = plte[idx * 3]; rgba[d + 1] = plte[idx * 3 + 1]; rgba[d + 2] = plte[idx * 3 + 2];
      rgba[d + 3] = trns && idx < trns.length ? trns[idx] : 255;
    }
  }

  return { width, height, rgba };
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])) >>> 0, data.length + 8);
  return out;
}

/** { width, height, rgba } -> PNG (RGBA, 8 bit). */
export function encodePng({ width, height, rgba }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Kutu filtresiyle yeniden boyutlandırma — logo gibi düz görseller için yeterli. */
export function resize(src, w, h) {
  const out = Buffer.alloc(w * h * 4);
  const xr = src.width / w;
  const yr = src.height / h;
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.floor(y * yr);
    const y1 = Math.max(y0 + 1, Math.min(src.height, Math.ceil((y + 1) * yr)));
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.floor(x * xr);
      const x1 = Math.max(x0 + 1, Math.min(src.width, Math.ceil((x + 1) * xr)));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const s = (sy * src.width + sx) * 4;
          const alpha = src.rgba[s + 3];
          r += src.rgba[s] * alpha; g += src.rgba[s + 1] * alpha; b += src.rgba[s + 2] * alpha;
          a += alpha; n += 1;
        }
      }
      const d = (y * w + x) * 4;
      if (a > 0) {
        out[d] = Math.round(r / a); out[d + 1] = Math.round(g / a); out[d + 2] = Math.round(b / a);
      }
      out[d + 3] = Math.round(a / n);
    }
  }
  return { width: w, height: h, rgba: out };
}

/**
 * Logoyu kare bir tuvalin ortasına, kenarlarda boşluk bırakacak şekilde koyar.
 * `scale` logonun tuvalin kaçta kaçını kaplayacağını belirler.
 */
export function centerOnCanvas(src, size, scale, background) {
  const maxEdge = Math.round(size * scale);
  const ratio = Math.min(maxEdge / src.width, maxEdge / src.height);
  const w = Math.max(1, Math.round(src.width * ratio));
  const h = Math.max(1, Math.round(src.height * ratio));
  const small = resize(src, w, h);

  const rgba = Buffer.alloc(size * size * 4);
  if (background) {
    for (let i = 0; i < size * size; i += 1) {
      rgba[i * 4] = background[0];
      rgba[i * 4 + 1] = background[1];
      rgba[i * 4 + 2] = background[2];
      rgba[i * 4 + 3] = 255;
    }
  }

  const ox = Math.round((size - w) / 2);
  const oy = Math.round((size - h) / 2);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const s = (y * w + x) * 4;
      const d = ((y + oy) * size + (x + ox)) * 4;
      const alpha = small.rgba[s + 3] / 255;
      if (alpha === 0) continue;
      const inv = 1 - alpha;
      rgba[d] = Math.round(small.rgba[s] * alpha + rgba[d] * inv);
      rgba[d + 1] = Math.round(small.rgba[s + 1] * alpha + rgba[d + 1] * inv);
      rgba[d + 2] = Math.round(small.rgba[s + 2] * alpha + rgba[d + 2] * inv);
      rgba[d + 3] = Math.max(rgba[d + 3], small.rgba[s + 3]);
    }
  }
  return { width: size, height: size, rgba };
}
