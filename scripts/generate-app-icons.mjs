import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(root, "public");

const SOURCE_WIDTH = 63;
const SOURCE_HEIGHT = 57;
const SOURCE_PIXELS = Buffer.from("PASTE_REDACTED", "base64");
const NAVY = [7, 29, 64, 255];

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

function sourcePixel(x, y) {
  if (x < 0 || x >= SOURCE_WIDTH || y < 0 || y >= SOURCE_HEIGHT) return NAVY;
  const offset = (y * SOURCE_WIDTH + x) * 4;
  return [
    SOURCE_PIXELS[offset],
    SOURCE_PIXELS[offset + 1],
    SOURCE_PIXELS[offset + 2],
    SOURCE_PIXELS[offset + 3],
  ];
}

function bilinear(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = x - x0;
  const ty = y - y0;
  const p00 = sourcePixel(x0, y0);
  const p10 = sourcePixel(x1, y0);
  const p01 = sourcePixel(x0, y1);
  const p11 = sourcePixel(x1, y1);
  return p00.map((_, c) => Math.round(
    p00[c] * (1 - tx) * (1 - ty) +
    p10[c] * tx * (1 - ty) +
    p01[c] * (1 - tx) * ty +
    p11[c] * tx * ty
  ));
}

function renderIcon(size, maskable = false) {
  const pixels = Buffer.alloc(size * size * 4);
  const squareSource = Math.max(SOURCE_WIDTH, SOURCE_HEIGHT);
  const safeScale = maskable ? 0.88 : 1;
  const renderedSize = size * safeScale;
  const renderedOffset = (size - renderedSize) / 2;
  const sourceYOffset = (squareSource - SOURCE_HEIGHT) / 2;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let colour = NAVY;
      if (
        px >= renderedOffset &&
        px < renderedOffset + renderedSize &&
        py >= renderedOffset &&
        py < renderedOffset + renderedSize
      ) {
        const sxSquare = ((px - renderedOffset + 0.5) / renderedSize) * squareSource - 0.5;
        const sySquare = ((py - renderedOffset + 0.5) / renderedSize) * squareSource - 0.5;
        const sx = sxSquare;
        const sy = sySquare - sourceYOffset;
        colour = bilinear(sx, sy);
      }

      const offset = (py * size + px) * 4;
      pixels[offset] = colour[0];
      pixels[offset + 1] = colour[1];
      pixels[offset + 2] = colour[2];
      pixels[offset + 3] = colour[3];
    }
  }

  return encodePng(size, size, pixels);
}

mkdirSync(outputDirectory, { recursive: true });
for (const [fileName, size, maskable] of [
  ["academic-hub-icon-v9-32.png", 32, false],
  ["academic-hub-icon-v9-180.png", 180, false],
  ["academic-hub-icon-v9-192.png", 192, false],
  ["academic-hub-icon-v9-512.png", 512, false],
  ["academic-hub-icon-v9-512-maskable.png", 512, true],
]) {
  writeFileSync(resolve(outputDirectory, fileName), renderIcon(size, maskable));
  console.log(`Generated ${fileName} (${size}x${size})`);
}
