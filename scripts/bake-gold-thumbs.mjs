// Run after adding illustrations:  npm i --no-save sharp && node scripts/bake-gold-thumbs.mjs
// (sharp is not a project dependency; a test fails when a thumbnail has no gold twin.)
//
// Bakes the CSS treatment `invert(1) sepia(0.7) saturate(3) hue-rotate(-18deg) brightness(0.9)`
// into copies of the illustration thumbnails, with CSS's own math (sRGB space,
// clamped after every step), so a list row shows a plain image instead of
// running a five-stage filter per thumbnail.
import sharp from "sharp";
import { readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../public/illustrations", import.meta.url));
const OUT = join(SRC, "gold");
mkdirSync(OUT, { recursive: true });

const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mul = (m, [r, g, b]) => [clamp(m[0]*r + m[1]*g + m[2]*b), clamp(m[3]*r + m[4]*g + m[5]*b), clamp(m[6]*r + m[7]*g + m[8]*b)];
const a = 0.7, s = 3, h = (-18 * Math.PI) / 180, c = Math.cos(h), n = Math.sin(h);
const SEPIA = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131].map((v, i) => v * a + ([0, 4, 8].includes(i) ? 1 - a : 0));
const SAT = [0.213 + 0.787*s, 0.715 - 0.715*s, 0.072 - 0.072*s, 0.213 - 0.213*s, 0.715 + 0.285*s, 0.072 - 0.072*s, 0.213 - 0.213*s, 0.715 - 0.715*s, 0.072 + 0.928*s];
const HUE = [
  0.213 + c*0.787 - n*0.213, 0.715 - c*0.715 - n*0.715, 0.072 - c*0.072 + n*0.928,
  0.213 - c*0.213 + n*0.143, 0.715 + c*0.285 + n*0.140, 0.072 - c*0.072 - n*0.283,
  0.213 - c*0.213 - n*0.787, 0.715 - c*0.715 + n*0.715, 0.072 + c*0.928 + n*0.072,
];

const files = readdirSync(SRC).filter((f) => /^\d+\.webp$/.test(f));
let bytes = 0;
for (const f of files) {
  const { data, info } = await sharp(join(SRC, f)).flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 3) {
    let px = [1 - data[i] / 255, 1 - data[i + 1] / 255, 1 - data[i + 2] / 255]; // invert(1)
    px = mul(SEPIA, px); px = mul(SAT, px); px = mul(HUE, px);
    data[i] = Math.round(clamp(px[0] * 0.9) * 255); data[i + 1] = Math.round(clamp(px[1] * 0.9) * 255); data[i + 2] = Math.round(clamp(px[2] * 0.9) * 255);
  }
  const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).webp({ quality: 88 }).toBuffer();
  await sharp(out).toFile(join(OUT, f));
  bytes += out.length;
}
console.log(files.length, "thumbnails baked,", Math.round(bytes / 1024), "kB");
