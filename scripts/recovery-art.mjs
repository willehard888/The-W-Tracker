// Recovery drawings: from a generated two-panel sheet to the same bundled
// frames the strength library animates.
//
// Everkinetic has no stretches, so recovery movements are drawn new, one
// sheet per movement (left = start, right = end), in the Everkinetic style.
// This script turns a sheet into public/illustrations/frames/{id}-relaxation.svg
// and {id}-tension.svg plus the 112 px thumb, and refuses a sheet that would
// animate badly rather than ship a drawing that is "close enough".
//
//   npm i --no-save sharp potrace
//   node scripts/recovery-art.mjs refs <outDir> <everkineticId...>
//   node scripts/recovery-art.mjs trace <sheet.png> <id>
//   then: node scripts/bake-gold-thumbs.mjs && npx vite-node scripts/generate-illustration-frames.mts
//
// Raw sheets stay outside the repo; only the traced output is committed.
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import potrace from "potrace";

const W = 1536, H = 1024;
const INK = 160; // luminance below this is line

const [cmd, ...args] = process.argv.slice(2);

/** Everkinetic pairs laid out in the sheet format, as style references. */
async function refs(outDir, ids) {
  for (const id of ids) {
    const panel = (state) =>
      sharp(`public/illustrations/frames/${id}-${state}.svg`, { density: 300 })
        .resize({ width: 700, height: 900, fit: "contain", background: "#ffffff" })
        .flatten({ background: "#ffffff" }).png().toBuffer();
    const [a, b] = await Promise.all([panel("relaxation"), panel("tension")]);
    await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } })
      .composite([{ input: a, left: 34, top: 62 }, { input: b, left: 802, top: 62 }])
      .png().toFile(`${outDir}/ref-${id}.png`);
    console.log(`ref ${id}`);
  }
}

/** Grey pixels of the sheet, flattened on white, at the sheet's own size. */
async function grey(path) {
  const { data, info } = await sharp(path).flatten({ background: "#ffffff" })
    .resize(W, H, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

const inkBox = (g, x0, x1) => {
  let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
  for (let y = 0; y < g.h; y++) for (let x = x0; x < x1; x++) {
    if (g.data[y * g.w + x] < INK) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { minX, maxX, minY, maxY };
};

/** The blank column nearest the centre, or null when the panels touch. */
const splitColumn = (g) => {
  const blank = (x) => { for (let y = 0; y < g.h; y++) if (g.data[y * g.w + x] < INK) return false; return true; };
  for (let d = 0; d < g.w * 0.15; d++) {
    if (blank(g.w / 2 + d)) return g.w / 2 + d;
    if (blank(g.w / 2 - d)) return g.w / 2 - d;
  }
  return null;
};

const traceSvg = (png) => new Promise((ok, bad) =>
  potrace.trace(png, { threshold: INK, turdSize: 20, optTolerance: 0.4, color: "#333", background: "#FFF" },
    (err, svg) => (err ? bad(err) : ok(svg))));

/** Checks, split, one shared crop, trace. Exits non-zero with the reason on refusal. */
async function trace(sheet, id) {
  if (!/^\d{4}$/.test(id) || Number(id) < 300) throw new Error(`id must be 4 digits from 0300: ${id}`);
  const g = await grey(sheet);
  const cut = splitColumn(g);
  if (cut == null) return refuse("no blank column between the panels");
  const a = inkBox(g, 0, cut), b = inkBox(g, cut, g.w);
  if (!a || !b) return refuse("a panel is empty");
  const edge = Math.round(g.w * 0.02);
  if (a.minX < edge || b.maxX > g.w - edge || Math.min(a.minY, b.minY) < edge || Math.max(a.maxY, b.maxY) > g.h - edge)
    return refuse("ink touches the sheet edge");
  if (Math.abs(a.maxY - b.maxY) > g.h * 0.04) return refuse(`ground lines differ (${a.maxY} vs ${b.maxY})`);

  // One box for both frames: the union of the two panels' ink, each measured
  // from its own panel's left edge, so the viewBox is identical by construction.
  const la = { l: a.minX, r: a.maxX }, lb = { l: b.minX - cut, r: b.maxX - cut };
  const pad = Math.round(g.h * 0.04);
  const left = Math.max(0, Math.min(la.l, lb.l) - pad);
  const top = Math.max(0, Math.min(a.minY, b.minY) - pad);
  const width = Math.min(cut, Math.max(la.r, lb.r) + pad) - left;
  const height = Math.min(g.h, Math.max(a.maxY, b.maxY) + pad) - top;

  const frame = async (x0) => sharp(sheet).flatten({ background: "#ffffff" }).resize(W, H, { fit: "fill" })
    .extract({ left: x0 + left, top, width, height }).greyscale().png().toBuffer();
  const [rel, ten] = [await frame(0), await frame(cut)];

  const out = {};
  for (const [state, png] of [["relaxation", rel], ["tension", ten]]) {
    const { width: tw, height: th } = await sharp(png).metadata();
    let svg = await traceSvg(png);
    // Everkinetic frames are 275 pt tall; the width keeps this drawing's aspect.
    svg = svg.replace(/<svg[^>]*>/, `<svg width="${Math.round((275 * tw) / th)}pt" height="275pt" viewBox="0 0 ${tw} ${th}" xmlns="http://www.w3.org/2000/svg">`);
    if (svg.length > 35_000) return refuse(`${state} SVG is ${svg.length} bytes`);
    out[state] = svg;
  }
  for (const [state, svg] of Object.entries(out)) writeFileSync(`public/illustrations/frames/${id}-${state}.svg`, svg);
  await sharp(Buffer.from(out.tension), { density: 150 }).resize({ width: 112 }).flatten({ background: "#ffffff" })
    .webp({ quality: 80 }).toFile(`public/illustrations/${id}.webp`);
  console.log(`ok ${id} ${width}x${height} ${out.relaxation.length}+${out.tension.length} bytes`);
}

function refuse(why) {
  console.error(`refused: ${why}`);
  process.exit(2);
}

if (cmd === "refs") await refs(args[0], args.slice(1));
else if (cmd === "trace") await trace(args[0], args[1]);
else { console.error("usage: refs <outDir> <ids...> | trace <sheet.png> <id>"); process.exit(1); }
