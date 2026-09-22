#!/usr/bin/env node
// Marks — the drawn icons that replaced the app's emoji (tiers, badges,
// check-in habits, sports, quests, pillars, onboarding, mood, referral).
//
//   eval "$(grep '^export OPENAI_API_KEY=' ~/.zshrc | tail -1)"   # never echo it
//   npm i --no-save sharp
//   node scripts/mark-art.mjs comps <outdir>                 # 4 style sheets × 4 subjects
//   node scripts/mark-art.mjs gen <family> [id...] [--style <name>] [--ref <png>] [--redo]
//   node scripts/mark-art.mjs cut <sheet.png> <outdir> <id1> <id2> <id3> <id4>
//   node scripts/mark-art.mjs key <in.png> <out.webp> [--px 256]
//   node scripts/mark-art.mjs contact <outdir> <family>       # 4-up review sheet
//
// Every sheet is a 2×2 grid on solid black, one subject per quadrant. `cut`
// splits it, `key` turns black into alpha (an icon painted on black is its
// own colour times its own coverage: alpha = max channel, colour = channel ÷
// alpha), and writes a webp into public/marks/<family>/<id>.webp. Raw sheets
// stay out of the repo; only the keyed marks are committed.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { FAMILIES, fileId } from "./marks-catalog.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GEN = join(ROOT, ".claude/skills/impeccable/scripts/generate-image.mjs");
const OUT_ROOT = join(ROOT, "public/marks");

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

// ── Style language ──────────────────────────────────────────────────────────
// The founder's taste: premium glossy vector, Apple/Duolingo-grade, crisp
// edges, no noise (see memory: founder-visual-taste). Each candidate keeps the
// palette and the ground and changes only the material.
const PALETTE = "Palette: gold #E5AE2E, pale gold #F6D77A, deep gold #93721F and ember orange #F0752E only";
const GROUND = "on a solid pure black background (#000000). No text, no letters, no numbers, no border, no frame, no drop shadow on the ground, no background shapes, no vignette. Crisp edges, no noise, no film grain.";

export const STYLES = {
  glossy: `a glossy three-dimensional app icon in the language of Apple and Duolingo icons: smooth rounded volumes, a soft bevel, two-tone shading, one bright specular highlight, a clean bold silhouette`,
  enamel: `a hard-enamel pin badge: raised polished gold metal outlines, recessed flat enamel fills in deep plum #1a1420 and ember, one small glint on the metal, thick clean lines, bold simple shapes`,
  relief: `a sculpted matte-gold relief medallion: the subject carved in low relief on a round gold coin, satin metal, one directional light from the top left, crisp bevelled edges`,
  flat: `flat glossy vector like a premium sticker: a bold simple silhouette in two golds with an ember core, one crescent gloss highlight, no outlines, no gradients except the gloss`,
};

const sheetPrompt = (style, subjects) =>
  `Four icons for a premium dark fitness app, arranged in a 2×2 grid: top-left ${subjects[0]}; top-right ${subjects[1]}; bottom-left ${subjects[2]}; bottom-right ${subjects[3]}. Each icon is centered in its quadrant, the same size (about 60% of the quadrant), the same style and the same lighting. Every icon is rendered as ${STYLES[style]}. ${PALETTE}, ${GROUND}`;

// ── Generation ───────────────────────────────────────────────────────────────
const generate = (prompt, out, refs = []) => {
  const tmp = out + ".prompt.txt";
  writeFileSync(tmp, prompt);
  for (let attempt = 1; attempt <= 6; attempt++) {
    const args = [GEN, "--prompt-file", tmp, "--out", out, "--size", "1024x1024", "--quality", "high"];
    for (const r of refs) args.push("--ref", r);
    const r = spawnSync(process.execPath, args, { encoding: "utf8", env: process.env });
    if (r.status === 0) return true;
    const text = (r.stderr || "") + (r.stdout || "");
    if (!/429/.test(text)) {
      console.error(text.slice(0, 400));
      return false;
    }
    const wait = 15 + Math.floor(Math.random() * 20);
    console.log(`429 — waiting ${wait}s`);
    spawnSync("sleep", [String(wait)]);
  }
  return false;
};

// ── Cut + key ────────────────────────────────────────────────────────────────
export const cut = async (sheet, outdir, ids) => {
  mkdirSync(outdir, { recursive: true });
  const img = sharp(sheet);
  const { width, height } = await img.metadata();
  const w = Math.floor(width / 2), h = Math.floor(height / 2);
  const cells = [[0, 0], [w, 0], [0, h], [w, h]];
  for (let i = 0; i < 4 && i < ids.length; i++) {
    if (!ids[i]) continue;
    const [left, top] = cells[i];
    await sharp(sheet).extract({ left, top, width: w, height: h }).png().toFile(join(outdir, `${ids[i]}.png`));
  }
};

/**
 * Black → alpha. The generator's ground is 0–4 in every channel. A warm pixel
 * (gold, ember: r > b) is the mark's colour times its coverage, so
 * a = max(r,g,b)/ceil recovers coverage and shown/a the colour — that is what
 * makes an anti-aliased gold edge soft instead of a fringe. A cool dark pixel
 * (b ≥ r: the enamel's plum inlay, a white glint) is paint, not coverage, and
 * stays opaque above the ground; dividing it by a guessed coverage would
 * bleach the plum to grey.
 */
export const key = async (input, output, px = 256, { ground = 5, ceil = 232 } = {}) => {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  for (let i = 0, o = 0; i < data.length; i += 3, o += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const m = Math.max(r, g, b);
    if (m <= ground) { out[o + 3] = 0; continue; }
    const cool = b >= r * 0.9;
    if (cool) {
      out[o] = r; out[o + 1] = g; out[o + 2] = b;
      out[o + 3] = Math.round(clamp((m - ground) / 9) * 255);
      continue;
    }
    const a = clamp((m - ground) / (ceil - ground));
    out[o] = Math.min(255, Math.round(r / a));
    out[o + 1] = Math.min(255, Math.round(g / a));
    out[o + 2] = Math.min(255, Math.round(b / a));
    out[o + 3] = Math.round(a * 255);
  }
  let img = sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
  // Trim to the ink, pad square, then size — a mark that sits off-centre in
  // its quadrant lands centred in its tile.
  const trimmed = await img.trim({ threshold: 12 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const side = Math.max(meta.width, meta.height);
  const pad = Math.round(side * 0.08);
  const canvas = side + pad * 2;
  // Two instances: sharp orders resize before extend inside one pipeline,
  // whatever order the calls are written in.
  const squared = await sharp(trimmed)
    .extend({
      top: Math.floor((canvas - meta.height) / 2), bottom: Math.ceil((canvas - meta.height) / 2),
      left: Math.floor((canvas - meta.width) / 2), right: Math.ceil((canvas - meta.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png().toBuffer();
  await sharp(squared).resize(px, px).webp({ quality: 90, alphaQuality: 90 }).toFile(output);
};

// ── Commands ─────────────────────────────────────────────────────────────────
const COMP_SUBJECTS = [
  "a royal crown (the Elite tier emblem)",
  "a flame (a streak badge)",
  "a crescent moon with one small star (the Sleep habit)",
  "a lightning bolt (the HIIT sport)",
];
const COMP_IDS = ["crown", "flame", "moon", "bolt"];

const main = async () => {
  const VALUE_FLAGS = new Set(["style", "ref", "px", "sheets", "parallel"]);
  const positional = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) { if (VALUE_FLAGS.has(argv[i].slice(2))) i++; continue; }
    positional.push(argv[i]);
  }
  const [cmd, ...rest] = positional;
  if (cmd === "comps") {
    const outdir = resolve(rest[0] ?? "comps");
    mkdirSync(outdir, { recursive: true });
    const only = arg("style");
    const styles = only ? [only] : Object.keys(STYLES);
    await Promise.all(styles.map(async (style) => {
      const sheet = join(outdir, `${style}.png`);
      if (!existsSync(sheet) || flag("redo")) {
        console.log(`generating ${style}…`);
        if (!generate(sheetPrompt(style, COMP_SUBJECTS), sheet)) { console.log(`FAIL ${style}`); return; }
      }
      const cutDir = join(outdir, style);
      await cut(sheet, cutDir, COMP_IDS);
      for (const id of COMP_IDS) await key(join(cutDir, `${id}.png`), join(cutDir, `${id}.webp`), 256);
      console.log(`done ${style}`);
    }));
    return;
  }
  if (cmd === "gen") {
    // gen <family> [id…] --style enamel --ref <sheet.png> --sheets <dir>
    // Four subjects per sheet, the chosen comp sheet as the style reference so
    // sheet N looks like sheet 1. Keyed marks land in public/marks/<family>/.
    const [family, ...only] = rest;
    const entries = FAMILIES[family];
    if (!entries) { console.error(`unknown family ${family}`); process.exit(1); }
    const style = arg("style", "enamel");
    const ref = arg("ref");
    const sheetsDir = resolve(arg("sheets", "sheets"));
    mkdirSync(sheetsDir, { recursive: true });
    const outDir = join(OUT_ROOT, family);
    mkdirSync(outDir, { recursive: true });
    const px = family === "tier" || family === "badge" ? 256 : 128;
    const wanted = entries.filter(([id]) => (only.length ? only.includes(id) : flag("redo") || !existsSync(join(outDir, `${fileId(family, id)}.webp`))));
    if (!wanted.length) { console.log("nothing to do"); return; }
    const groups = [];
    for (let i = 0; i < wanted.length; i += 4) groups.push(wanted.slice(i, i + 4));
    // A short last group is padded with earlier subjects; their cells are not cut.
    const last = groups[groups.length - 1];
    while (last.length < 4) last.push([null, entries[last.length % entries.length][1]]);
    const parallel = Number(arg("parallel", "3"));
    let next = 0;
    const worker = async () => {
      while (next < groups.length) {
        const gi = next++;
        const group = groups[gi];
        const tag = `${family}-${Date.now().toString(36)}-${gi}`;
        const sheet = join(sheetsDir, `${tag}.png`);
        const subjects = group.map(([, subject]) => subject);
        const prompt = (ref ? "Match the material, palette, lighting and line weight of the reference image exactly. " : "") + sheetPrompt(style, subjects);
        console.log(`sheet ${gi + 1}/${groups.length}: ${group.map(([id]) => id ?? "·").join(", ")}`);
        if (!generate(prompt, sheet, ref ? [ref] : [])) { console.log(`FAIL ${tag}`); continue; }
        const ids = group.map(([id]) => (id ? fileId(family, id) : null));
        const cutDir = join(sheetsDir, tag);
        await cut(sheet, cutDir, ids);
        for (const id of ids) if (id) await key(join(cutDir, `${id}.png`), join(outDir, `${id}.webp`), px);
      }
    };
    await Promise.all(Array.from({ length: Math.min(parallel, groups.length) }, worker));
    console.log(`done ${family}`);
    return;
  }
  if (cmd === "cut") {
    const [sheet, outdir, ...ids] = rest;
    await cut(sheet, outdir, ids);
    return;
  }
  if (cmd === "key") {
    const [input, output] = rest;
    await key(input, output, Number(arg("px", "256")));
    return;
  }
  if (cmd === "contact") {
    // contact <family> <out.png> — every mark of the family at 160 px on the app ground, catalog order.
    const [family, out] = rest;
    const entries = FAMILIES[family] ?? [];
    const files = entries.map(([id]) => join(OUT_ROOT, family, `${fileId(family, id)}.webp`)).filter((f) => existsSync(f));
    const tiles = await Promise.all(files.map((f) => sharp(f).resize(160, 160).png().toBuffer()));
    const cols = 6, cell = 176, rows = Math.ceil(tiles.length / cols);
    await sharp({ create: { width: cols * cell + 8, height: Math.max(1, rows) * cell + 8, channels: 4, background: { r: 14, g: 12, b: 19, alpha: 1 } } })
      .composite(tiles.map((input, i) => ({ input, left: 8 + (i % cols) * cell, top: 8 + Math.floor(i / cols) * cell })))
      .png().toFile(out);
    console.log(`${tiles.length} marks → ${out}`);
    return;
  }
  console.error("usage: mark-art.mjs comps|gen|cut|key|contact …");
  process.exit(1);
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
