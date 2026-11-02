// Generates icon.png, the app icon of the UA Edition, from the design's app
// mark (docs/design, the notification of «Поза застосунком»): the red square
// with the ink wedge `polygon(0 0,100% 22%,100% 78%,0 100%)`, 12 by 18 in a
// 38 square, centred. Opaque RGB, as the App Store asks.
//
//   node editions/uk/assets/generate-icon.mjs
//
// The output is deterministic: the same script writes the same bytes.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const SIZE = 1024;
const RED = [0xff, 0x3b, 0x2f];
const INK = [0x14, 0x0c, 0x0a];
const WEDGE_WIDTH = (SIZE * 12) / 38;
const WEDGE_HEIGHT = (SIZE * 18) / 38;
const LEFT = (SIZE - WEDGE_WIDTH) / 2;
const TOP = (SIZE - WEDGE_HEIGHT) / 2;
// Each pixel is sampled 4 × 4 times, so the wedge's slanted edges are smooth.
const SAMPLES = 4;

/** Whether a point lies inside the wedge: its left edge full height, its right edge from 22% to 78%. */
function inWedge(x, y) {
  const u = (x - LEFT) / WEDGE_WIDTH;
  const v = (y - TOP) / WEDGE_HEIGHT;
  if (u < 0 || u > 1) return false;
  return v >= 0.22 * u && v <= 1 - 0.22 * u;
}

const rows = Buffer.alloc((SIZE * 3 + 1) * SIZE);
for (let y = 0; y < SIZE; y += 1) {
  const row = y * (SIZE * 3 + 1);
  for (let x = 0; x < SIZE; x += 1) {
    let covered = 0;
    for (let sy = 0; sy < SAMPLES; sy += 1)
      for (let sx = 0; sx < SAMPLES; sx += 1)
        if (inWedge(x + (sx + 0.5) / SAMPLES, y + (sy + 0.5) / SAMPLES)) covered += 1;
    const share = covered / SAMPLES ** 2;
    for (let channel = 0; channel < 3; channel += 1)
      rows[row + 1 + x * 3 + channel] = Math.round(
        RED[channel] * (1 - share) + INK[channel] * share,
      );
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header.writeUInt8(8, 8); // bits per channel
header.writeUInt8(2, 9); // RGB, no alpha

writeFileSync(
  fileURLToPath(new URL('icon.png', import.meta.url)),
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
