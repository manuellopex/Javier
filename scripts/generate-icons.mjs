/**
 * Generates AURA PWA icons as PNGs without external dependencies:
 * dark background with a glowing teal core + ring, drawn per-pixel and
 * encoded with zlib. Run: npm run icons
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const BG = [7, 10, 15];
const ACCENT = [57, 210, 192];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, draw) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y, size);
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * Math.min(1, Math.max(0, t)));
}

function drawIcon(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const d = Math.hypot(x - cx, y - cy) / (size / 2); // 0 center → 1 edge

  let r = BG[0];
  let g = BG[1];
  let b = BG[2];

  // ambient glow
  const glow = Math.max(0, 1 - d * 1.6) * 0.25;
  r = mix(r, ACCENT[0], glow);
  g = mix(g, ACCENT[1], glow);
  b = mix(b, ACCENT[2], glow);

  // core
  if (d < 0.22) {
    const t = 1 - d / 0.22;
    r = mix(r, ACCENT[0], 0.55 + 0.45 * t);
    g = mix(g, ACCENT[1], 0.55 + 0.45 * t);
    b = mix(b, ACCENT[2], 0.55 + 0.45 * t);
  }

  // ring
  const ringDist = Math.abs(d - 0.55);
  if (ringDist < 0.045) {
    const t = 1 - ringDist / 0.045;
    r = mix(r, ACCENT[0], 0.85 * t);
    g = mix(g, ACCENT[1], 0.85 * t);
    b = mix(b, ACCENT[2], 0.85 * t);
  }

  return [r, g, b, 255];
}

mkdirSync(join(root, 'public/icons'), { recursive: true });
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(join(root, 'public/icons', name), png(size, drawIcon));
  console.log(`✓ public/icons/${name}`);
}
