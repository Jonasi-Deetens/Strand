// Draws the Strand app icon (sun over a wave on sand) as a 1024px PNG without
// any image dependency, so `npm run tauri icon` has a source to work from.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { crc32 } from "node:zlib";

const SIZE = 1024;

const hex = (value) => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];

const SKY = hex("#0c2429");
const SEA = hex("#2a999f");
const SEA_LIGHT = hex("#74d1d3");
const SAND = hex("#e8dbc4");
const SUN = hex("#f0b429");

const pixels = new Uint8Array(SIZE * SIZE * 4);

const setPixel = (x, y, [r, g, b], alpha = 255) => {
  const index = (y * SIZE + x) * 4;
  pixels[index] = r;
  pixels[index + 1] = g;
  pixels[index + 2] = b;
  pixels[index + 3] = alpha;
};

const radius = SIZE * 0.46;
const centre = SIZE / 2;

for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    const dx = x - centre;
    const dy = y - centre;
    const distance = Math.hypot(dx, dy);
    if (distance > radius) {
      setPixel(x, y, SKY, 0);
      continue;
    }

    const sandLine = SIZE * 0.72;
    const waveLine =
      SIZE * 0.54 + Math.sin((x / SIZE) * Math.PI * 3) * SIZE * 0.035;
    const foamLine = waveLine + SIZE * 0.045;

    let colour = SKY;
    if (y > sandLine) colour = SAND;
    else if (y > foamLine) colour = SEA;
    else if (y > waveLine) colour = SEA_LIGHT;
    else {
      const sunDistance = Math.hypot(x - SIZE * 0.5, y - SIZE * 0.34);
      if (sunDistance < SIZE * 0.14) colour = SUN;
    }

    // Feather the outer edge so the circle is not aliased.
    const edge = radius - distance;
    const alpha = edge < 2 ? Math.round((edge / 2) * 255) : 255;
    setPixel(x, y, colour, Math.max(0, alpha));
  }
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y += 1) {
  raw[y * (SIZE * 4 + 1)] = 0;
  Buffer.from(pixels.buffer, y * SIZE * 4, SIZE * 4).copy(
    raw,
    y * (SIZE * 4 + 1) + 1,
  );
}

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // truecolour with alpha
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const target = process.argv[2] ?? "app-icon.png";
writeFileSync(target, png);
console.log(`wrote ${target} (${png.length} bytes)`);
