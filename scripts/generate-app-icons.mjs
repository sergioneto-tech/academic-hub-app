import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(root, "public");
const SAMPLE_SCALE = 3;

const crcTable = new Uint32Array(256);
for (let value = 0; value < 256; value += 1) {
  let current = value;
  for (let bit = 0; bit < 8; bit += 1) {
    current = (current & 1) ? (0xedb88320 ^ (current >>> 1)) : (current >>> 1);
  }
  crcTable[value] = current >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0;
    pixels.copy(raw, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function mix(a, b, amount) {
  return Math.round(a + (b - a) * amount);
}

function sampleIcon(x, y) {
  const distanceFromCentre = Math.min(1, Math.hypot(x - 0.5, y - 0.5) / 0.72);
  let red = mix(14, 4, distanceFromCentre);
  let green = mix(39, 17, distanceFromCentre);
  let blue = mix(74, 39, distanceFromCentre);

  const gold = [216, 180, 90];
  const white = [247, 249, 252];
  const radius = Math.hypot(x - 0.5, y - 0.5);

  if (radius >= 0.365 && radius <= 0.388) [red, green, blue] = gold;

  const aLeft = distanceToSegment(x, y, 0.365, 0.68, 0.445, 0.31) <= 0.027;
  const aRight = distanceToSegment(x, y, 0.445, 0.31, 0.535, 0.68) <= 0.027;
  const aCross = distanceToSegment(x, y, 0.395, 0.535, 0.495, 0.535) <= 0.018;
  if (aLeft || aRight || aCross) [red, green, blue] = gold;

  const hLeft = Math.abs(x - 0.61) <= 0.027 && y >= 0.34 && y <= 0.68;
  const hRight = Math.abs(x - 0.755) <= 0.027 && y >= 0.34 && y <= 0.68;
  const hCross = Math.abs(y - 0.515) <= 0.022 && x >= 0.61 && x <= 0.755;
  if (hLeft || hRight || hCross) [red, green, blue] = white;

  const highlight = Math.max(0, 1 - Math.hypot(x - 0.35, y - 0.27) / 0.46) * 0.08;
  red = mix(red, 255, highlight);
  green = mix(green, 255, highlight);
  blue = mix(blue, 255, highlight);

  return [red, green, blue, 255];
}

function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = SAMPLE_SCALE * SAMPLE_SCALE;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const totals = [0, 0, 0, 0];
      for (let sy = 0; sy < SAMPLE_SCALE; sy += 1) {
        for (let sx = 0; sx < SAMPLE_SCALE; sx += 1) {
          const x = (px + (sx + 0.5) / SAMPLE_SCALE) / size;
          const y = (py + (sy + 0.5) / SAMPLE_SCALE) / size;
          const sample = sampleIcon(x, y);
          for (let channel = 0; channel < 4; channel += 1) totals[channel] += sample[channel];
        }
      }

      const offset = (py * size + px) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        pixels[offset + channel] = Math.round(totals[channel] / samples);
      }
    }
  }

  return encodePng(size, size, pixels);
}

mkdirSync(outputDirectory, { recursive: true });
for (const [fileName, size] of [
  ["favicon-32.png", 32],
  ["apple-touch-icon.png", 180],
  ["pwa-192.png", 192],
  ["pwa-512.png", 512],
]) {
  writeFileSync(resolve(outputDirectory, fileName), renderIcon(size));
  console.log(`Generated ${fileName} (${size}x${size})`);
}
