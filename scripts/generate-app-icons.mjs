import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(root, "public");
const SAMPLE_SCALE = 4;

const crcTable = new Uint32Array(256);
for (let value = 0; value < 256; value += 1) {
  let current = value;
  for (let bit = 0; bit < 8; bit += 1) current = (current & 1) ? (0xedb88320 ^ (current >>> 1)) : (current >>> 1);
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

function roundedRectDistance(x, y, centreX, centreY, halfWidth, halfHeight, radius) {
  const dx = Math.abs(x - centreX) - (halfWidth - radius);
  const dy = Math.abs(y - centreY) - (halfHeight - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

function mix(a, b, amount) {
  return Math.round(a + (b - a) * amount);
}

function blend(base, overlay, alpha) {
  return [mix(base[0], overlay[0], alpha), mix(base[1], overlay[1], alpha), mix(base[2], overlay[2], alpha), 255];
}

function sampleIcon(x, y) {
  const transparent = [0, 0, 0, 0];
  const navy = [8, 35, 82, 255];
  const navyLight = [18, 65, 145, 255];
  const white = [250, 251, 253, 255];
  const gold = [203, 157, 72, 255];
  const goldLight = [222, 181, 91, 255];

  const tileDistance = roundedRectDistance(x, y, 0.5, 0.5, 0.455, 0.455, 0.13);
  if (tileDistance > 0) return transparent;

  const radial = Math.max(0, 1 - Math.hypot(x - 0.35, y - 0.25) / 0.8);
  let colour = blend(navy, navyLight, radial * 0.32);

  const aLeft = distanceToSegment(x, y, 0.245, 0.72, 0.41, 0.28) <= 0.046;
  const aRight = distanceToSegment(x, y, 0.41, 0.28, 0.565, 0.72) <= 0.046;
  const aCross = distanceToSegment(x, y, 0.31, 0.555, 0.50, 0.555) <= 0.028;
  if (aLeft || aRight || aCross) colour = white;

  const hLeft = Math.abs(x - 0.535) <= 0.041 && y >= 0.285 && y <= 0.72;
  const hRight = Math.abs(x - 0.735) <= 0.041 && y >= 0.285 && y <= 0.72;
  const hCross = Math.abs(y - 0.525) <= 0.034 && x >= 0.535 && x <= 0.735;
  if (hLeft || hRight || hCross) colour = gold;

  const hHighlight = Math.abs(x - 0.715) <= 0.012 && y >= 0.31 && y <= 0.69;
  if (hHighlight) colour = goldLight;
  return colour;
}

function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = SAMPLE_SCALE * SAMPLE_SCALE;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const totals = [0, 0, 0, 0];
      for (let sy = 0; sy < SAMPLE_SCALE; sy += 1) {
        for (let sx = 0; sx < SAMPLE_SCALE; sx += 1) {
          const sample = sampleIcon((px + (sx + 0.5) / SAMPLE_SCALE) / size, (py + (sy + 0.5) / SAMPLE_SCALE) / size);
          for (let channel = 0; channel < 4; channel += 1) totals[channel] += sample[channel];
        }
      }
      const offset = (py * size + px) * 4;
      for (let channel = 0; channel < 4; channel += 1) pixels[offset + channel] = Math.round(totals[channel] / samples);
    }
  }
  return encodePng(size, size, pixels);
}

mkdirSync(outputDirectory, { recursive: true });
for (const [fileName, size] of [
  ["academic-hub-icon-v3-32.png", 32],
  ["academic-hub-icon-v3-180.png", 180],
  ["academic-hub-icon-v3-192.png", 192],
  ["academic-hub-icon-v3-512.png", 512],
]) {
  writeFileSync(resolve(outputDirectory, fileName), renderIcon(size));
  console.log(`Generated ${fileName} (${size}x${size})`);
}
