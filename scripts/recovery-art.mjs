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
//   node scripts/recovery-art.mjs trace <sheet.png> <id> [--step]
//     --step: the movement itself moves the lowest point (a foot steps back),
//             so the ground-line check is skipped for this sheet after review.
//     --align: a wall or post is in the picture; line its tallest vertical
//             stroke up across the two frames so the prop does not jump.
//     --shift=N: move the second frame by N px, when a prop is mostly hidden
//             behind the figure and --align finds nothing to match.
//   node scripts/recovery-art.mjs contact <out.png> <sheet.png...>   (review, 4 per image)
//   node scripts/recovery-art.mjs breathe <id...|all>
//     The breathing and guided figures: rebuilds BOTH frames from the exhaled
//     drawing, the inhaled one by a smooth warp of the rib cage (BREATH below).
//     A generated pair is two separate drawings — 20–70 % of one frame's ink had
//     no partner within 3 px in the other — and the runner cross-fades them on
//     the breath, so every line doubled. From one drawing, only the chest moves.
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
/**
 * How far the second frame must move so the props line up: the columns that
 * are mostly ink (a wall line, both edges of a post) are matched as a set, so
 * a two-edged post cannot lock onto the wrong edge.
 */
const propShift = (g, cut) => {
  const tall = (x0, x1, share) => {
    const cols = new Set();
    for (let x = x0; x < x1; x++) {
      let n = 0;
      for (let y = 0; y < g.h; y++) if (g.data[y * g.w + x] < INK) n++;
      if (n > g.h * share) cols.add(x - x0);
    }
    return cols;
  };
  // A wall runs most of the height; a room corner's edge only part of it.
  let share = 0.4, a = tall(0, cut, share), b = tall(cut, g.w, share);
  if (!a.size || !b.size) { share = 0.2; a = tall(0, cut, share); b = tall(cut, g.w, share); }
  let best = 0, most = -1;
  for (let s = -200; s <= 200; s++) {
    let n = 0;
    for (const x of a) if (b.has(x + s)) n++;
    if (n > most || (n === most && Math.abs(s) < Math.abs(best))) { most = n; best = s; }
  }
  return most > 0 ? best : 0;
};

async function trace(sheet, id, step = false, align = false, manual = 0) {
  if (!/^\d{4}$/.test(id) || Number(id) < 300) throw new Error(`id must be 4 digits from 0300: ${id}`);
  const g = await grey(sheet);
  const cut = splitColumn(g);
  if (cut == null) return refuse("no blank column between the panels");
  const a = inkBox(g, 0, cut), b = inkBox(g, cut, g.w);
  if (!a || !b) return refuse("a panel is empty");
  const edge = Math.round(g.w * 0.01); // closer than this, a hand or foot is likely cut off
  if (a.minX < edge || b.maxX > g.w - edge || Math.min(a.minY, b.minY) < edge || Math.max(a.maxY, b.maxY) > g.h - edge)
    return refuse("ink touches the sheet edge");
  if (!step && Math.abs(a.maxY - b.maxY) > g.h * 0.04) return refuse(`ground lines differ (${a.maxY} vs ${b.maxY})`);

  // One box for both frames: the union of the two panels' ink, each measured
  // from its own panel's origin, so the viewBox is identical by construction.
  // The second panel's origin is `cut`, or shifted so a prop's edge lines up.
  const shift = manual || (align ? propShift(g, cut) : 0);
  const bx = cut + shift;
  const la = { l: a.minX, r: a.maxX }, lb = { l: b.minX - bx, r: b.maxX - bx };
  const pad = Math.round(g.h * 0.04);
  const left = Math.max(0, Math.min(la.l, lb.l) - pad, -bx);
  const top = Math.max(0, Math.min(a.minY, b.minY) - pad);
  const width = Math.min(cut, g.w - bx, Math.max(la.r, lb.r) + pad) - left;
  const height = Math.min(g.h, Math.max(a.maxY, b.maxY) + pad) - top;

  const frame = async (x0) => sharp(sheet).flatten({ background: "#ffffff" }).resize(W, H, { fit: "fill" })
    .extract({ left: x0 + left, top, width, height }).greyscale().png().toBuffer();
  const [rel, ten] = [await frame(0), await frame(bx)];

  const out = {};
  for (const [state, png] of [["relaxation", rel], ["tension", ten]]) {
    const { width: tw, height: th } = await sharp(png).metadata();
    let svg = await traceSvg(png);
    // Everkinetic frames are 275 pt tall; the width keeps this drawing's aspect.
    svg = svg.replace(/<svg[^>]*>/, `<svg width="${Math.round((275 * tw) / th)}pt" height="275pt" viewBox="0 0 ${tw} ${th}" xmlns="http://www.w3.org/2000/svg">`);
    if (svg.length > 40_000) return refuse(`${state} SVG is ${svg.length} bytes`);
    out[state] = svg;
  }
  for (const [state, svg] of Object.entries(out)) writeFileSync(`public/illustrations/frames/${id}-${state}.svg`, svg);
  await sharp(Buffer.from(out.tension), { density: 150 }).resize({ width: 112 }).flatten({ background: "#ffffff" })
    .webp({ quality: 80 }).toFile(`public/illustrations/${id}.webp`);
  console.log(`ok ${id} ${width}x${height} ${out.relaxation.length}+${out.tension.length} bytes${shift ? ` (aligned ${shift}px)` : ""}`);
}

/**
 * Where each figure breathes, in the frame's own 0–1 coordinates:
 * [cx, cy, RX, RY, kx, ky]. (cx, cy) is what stays put — the sternum for a
 * figure seen from the front, the SPINE for one seen from the side, the BACK
 * on the floor for one lying down — RX/RY the reach of the movement, kx/ky how
 * far the rib cage opens along each axis (0.07 = 7 % at the centre, falling
 * smoothly to nothing at the reach, so no line ever breaks).
 */
const BREATH = {
  "0323": [0.33, 0.43, 0.36, 0.26, 0.07, 0.035], // seated, three-quarter view
  "0373": [0.31, 0.33, 0.40, 0.22, 0.07, 0.02],  // on a bench, side view
  "0374": [0.22, 0.235, 0.85, 0.075, 0.07, 0.0], // standing, side view
  "0375": [0.50, 0.42, 0.42, 0.24, 0.06, 0.03],  // seated, front view, hand on chest
  "0376": [0.27, 0.72, 0.13, 0.75, 0.0, 0.16],   // supine, hand on belly
  "0377": [0.235, 0.75, 0.12, 0.80, 0.0, 0.16],  // supine
  "0378": [0.27, 0.58, 0.12, 0.55, 0.0, 0.16],   // supine, arms out
  "0379": [0.33, 0.41, 0.36, 0.26, 0.07, 0.035], // seated, three-quarter view
  "0380": [0.24, 0.31, 0.45, 0.20, 0.07, 0.02],  // on a bench, side view
  "0381": [0.26, 0.60, 0.12, 0.65, 0.0, 0.16],   // supine
  "0382": [0.22, 0.24, 0.95, 0.075, 0.07, 0.0],  // standing, side view
  "0383": [0.40, 0.62, 0.16, 0.70, 0.03, 0.10],  // side-lying
};

async function breathe(ids) {
  for (const id of ids) {
    const spec = BREATH[id];
    if (!spec) return refuse(`no BREATH entry for ${id}`);
    const [cx, cy, RX, RY, kx, ky] = spec;
    const src = `public/illustrations/frames/${id}-relaxation.svg`;
    const vb = (await sharp(src).metadata());
    const box = /viewBox="0 0 (\d+) (\d+)"/.exec((await import("node:fs")).readFileSync(src, "utf8"));
    const [vw, vh] = box ? [Number(box[1]), Number(box[2])] : [vb.width, vb.height];
    // Twice the frame's own size: a 3 px line is 6 px here, enough for the
    // bilinear sampling below to keep its edge.
    const w = vw * 2, h = vh * 2;
    const { data } = await sharp(src, { density: 300 }).flatten({ background: "#ffffff" })
      .resize(w, h, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const at = (x, y) => {
      const x0 = Math.max(0, Math.min(w - 1, Math.floor(x))), y0 = Math.max(0, Math.min(h - 1, Math.floor(y)));
      const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), fx = x - x0, fy = y - y0;
      return (data[y0 * w + x0] * (1 - fx) + data[y0 * w + x1] * fx) * (1 - fy)
           + (data[y1 * w + x0] * (1 - fx) + data[y1 * w + x1] * fx) * fy;
    };
    const warped = Buffer.alloc(w * h);
    const px = cx * w, py = cy * h, rx = RX * w, ry = RY * h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ux = (x - px) / rx, uy = (y - py) / ry, r2 = ux * ux + uy * uy;
      if (r2 >= 1) { warped[y * w + x] = data[y * w + x]; continue; }
      const f = (1 - r2) * (1 - r2);
      // Inverse map: this output pixel shows what stood closer to the centre.
      warped[y * w + x] = Math.round(at(px + (x - px) / (1 + kx * f), py + (y - py) / (1 + ky * f)));
    }
    const png = (buf) => sharp(buf, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
    const out = {};
    // Both frames through the same raster and the same tracer, so everything
    // outside the chest is the same drawing to the pixel.
    for (const [state, buf] of [["relaxation", data], ["tension", warped]]) {
      let svg = await traceSvg(await png(buf));
      // Traced at 2×, shown in the frame's own units: the viewBox does not
      // grow, so running this again starts from the same size.
      svg = svg.replace(/<svg[^>]*>/, `<svg width="${Math.round((275 * vw) / vh)}pt" height="275pt" viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg">`)
        .replace("<path ", '<g transform="scale(0.5)"><path ').replace("</svg>", "</g></svg>");
      if (svg.length > 60_000) return refuse(`${id} ${state} SVG is ${svg.length} bytes`);
      out[state] = svg;
    }
    for (const [state, svg] of Object.entries(out)) writeFileSync(`public/illustrations/frames/${id}-${state}.svg`, svg);
    await sharp(Buffer.from(out.tension), { density: 150 }).resize({ width: 112 }).flatten({ background: "#ffffff" })
      .webp({ quality: 80 }).toFile(`public/illustrations/${id}.webp`);
    console.log(`ok ${id} ${w}x${h} ${out.relaxation.length}+${out.tension.length} bytes`);
  }
}

/** Four sheets on one image, labelled by file name, for reviewing a batch by eye. */
async function contact(out, sheets) {
  const cell = { w: W / 2, h: H / 2 };
  const tiles = await Promise.all(sheets.slice(0, 4).map(async (path, i) => {
    const name = path.split("/").pop().replace(/\.png$/, "");
    const label = Buffer.from(`<svg width="${cell.w}" height="28"><text x="8" y="21" font-family="Helvetica" font-size="20" fill="#c00">${name}</text></svg>`);
    const img = await sharp(path).resize(cell.w, cell.h).composite([{ input: label, top: 0, left: 0 }]).png().toBuffer();
    return { input: img, left: (i % 2) * cell.w, top: Math.floor(i / 2) * cell.h };
  }));
  await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } }).composite(tiles).png().toFile(out);
  console.log(`contact ${out}`);
}

function refuse(why) {
  console.error(`refused: ${why}`);
  process.exit(2);
}

if (cmd === "refs") await refs(args[0], args.slice(1));
else if (cmd === "trace") {
  const manual = Number(args.find((a) => a.startsWith("--shift="))?.slice(8) ?? 0);
  await trace(args[0], args[1], args.includes("--step"), args.includes("--align"), manual);
}
else if (cmd === "contact") await contact(args[0], args.slice(1));
else if (cmd === "breathe") await breathe(args[0] === "all" ? Object.keys(BREATH) : args);
else { console.error("usage: refs <outDir> <ids...> | trace <sheet.png> <id> | contact <out.png> <sheets...> | breathe <id...|all>"); process.exit(1); }
