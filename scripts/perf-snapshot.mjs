#!/usr/bin/env node
// Perf snapshot — read-only numbers for the boot path (everything
// dist/index.html pulls before first render) plus static animation counters.
// Always exits 0; it measures, it doesn't gate.
//
//   node scripts/perf-snapshot.mjs                      # table
//   node scripts/perf-snapshot.mjs --json               # machine-readable
//   node scripts/perf-snapshot.mjs --baseline perf/before.json   # + delta column
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const baselineIdx = args.indexOf("--baseline");
const baselinePath = baselineIdx >= 0 ? args[baselineIdx + 1] : null;

const DIST = "dist";
const INDEX = join(DIST, "index.html");
if (!existsSync(INDEX)) {
  console.log(`${INDEX} missing — run \`npm run build\` first.`);
  process.exit(0);
}

// ── Boot path from index.html ──────────────────────────────────────────────
const html = readFileSync(INDEX, "utf8");
const tags = html.match(/<(?:script|link)\b[^>]*>/g) ?? [];
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
const entry = tags.filter((t) => t.startsWith("<script") && /type="module"/.test(t)).map((t) => attr(t, "src"));
const preload = tags.filter((t) => /rel="modulepreload"/.test(t)).map((t) => attr(t, "href"));
const css = tags.filter((t) => /rel="stylesheet"/.test(t)).map((t) => attr(t, "href"));

// Hashed chunk name → stable stem ("index-CL-Qdbb2.js" → "index.js") so a
// baseline from an older build still lines up row by row.
const stem = (file) => file.replace(/^.*\//, "").replace(/-[\w-]{8}(\.\w+)$/, "$1");
const measure = (href) => {
  const buf = readFileSync(join(DIST, href.replace(/^\//, "")));
  return { file: href.replace(/^\/assets\//, ""), stem: stem(href), raw: buf.length, gzip: gzipSync(buf).length };
};
const sum = (rows) => rows.reduce((a, r) => ({ raw: a.raw + r.raw, gzip: a.gzip + r.gzip }), { raw: 0, gzip: 0 });

const bootJs = [...entry, ...preload].map(measure);
const bootCss = css.map(measure);
const bootSet = new Set([...entry, ...preload].map((h) => h.replace(/^.*\//, "")));

// ── Every JS chunk: Sentry + largest non-boot ──────────────────────────────
const assetsDir = join(DIST, "assets");
const allJs = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
let sentry = null;
const nonBoot = [];
for (const f of allJs) {
  const buf = readFileSync(join(assetsDir, f));
  const hits = (buf.toString("latin1").match(/sentry/gi) ?? []).length;
  const row = { file: f, stem: stem(f), raw: buf.length, gzip: gzipSync(buf).length };
  if (!sentry || hits > sentry.hits) sentry = { ...row, hits, preloaded: bootSet.has(f) };
  if (!bootSet.has(f)) nonBoot.push(row);
}
nonBoot.sort((a, b) => b.raw - a.raw);
const largestNonBoot = nonBoot.slice(0, 5);

// ── Static counters ────────────────────────────────────────────────────────
const indexCss = readFileSync("src/index.css", "utf8");
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
};
let raf = 0;
for (const p of walk("src")) raf += (readFileSync(p, "utf8").match(/requestAnimationFrame\(/g) ?? []).length;

const snapshot = {
  boot: { js: bootJs, css: bootCss },
  totals: { bootJs: sum(bootJs), css: sum(bootCss) },
  sentry,
  largestNonBoot,
  indexCss: {
    bytes: Buffer.byteLength(indexCss),
    keyframes: (indexCss.match(/@keyframes\b/g) ?? []).length,
    infinite: (indexCss.match(/\binfinite\b/g) ?? []).length,
  },
  raf,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
  process.exit(0);
}

// ── Table ──────────────────────────────────────────────────────────────────
const base = baselinePath ? JSON.parse(readFileSync(baselinePath, "utf8")) : null;
const kb = (n) => (n / 1024).toFixed(1).padStart(8) + " KB";
const delta = (cur, prev) => {
  if (prev == null) return "".padStart(11);
  const d = cur - prev;
  return ((d >= 0 ? "+" : "-") + (Math.abs(d) / 1024).toFixed(1)).padStart(8) + " KB";
};
// Baseline rows keyed by stem. Boot rows are keyed separately from the rest:
// rollup names every unnamed dynamic chunk "index", so the entry would
// otherwise collide with a non-boot "index.js" and lose its delta. A stem
// that repeats within one group is ambiguous → no delta.
const keyed = (rows) => {
  const m = new Map();
  for (const r of rows) if (r) m.set(r.stem, m.has(r.stem) ? null : r);
  return m;
};
const bootBase = base ? keyed([...base.boot.js, ...base.boot.css]) : new Map();
const restBase = base ? keyed(base.largestNonBoot) : new Map();
const line = (label, row, prevRaw) =>
  console.log(`  ${label.padEnd(36)}${kb(row.raw)}${kb(row.gzip)}${base ? delta(row.raw, prevRaw) : ""}`);
const head = (title) => console.log(`\n${title}\n  ${"file".padEnd(36)}${"raw".padStart(11)}${"gzip".padStart(11)}${base ? "Δ raw".padStart(11) : ""}`);

head("Boot JS (entry + modulepreload)");
for (const r of bootJs) line(r.file, r, bootBase.get(r.stem)?.raw);
line("= Boot JS", snapshot.totals.bootJs, base?.totals.bootJs.raw);
head("CSS");
for (const r of bootCss) line(r.file, r, bootBase.get(r.stem)?.raw);
line("= CSS", snapshot.totals.css, base?.totals.css.raw);

head("Sentry chunk (most \"sentry\" hits)");
line(`${sentry.file} (${sentry.hits} hits, ${sentry.preloaded ? "PRELOADED" : "not preloaded"})`, sentry, base?.sentry?.raw);

head("Largest non-boot chunks");
for (const r of largestNonBoot) line(r.file, r, restBase.get(r.stem)?.raw);

const num = (label, cur, prev) =>
  console.log(`  ${label.padEnd(36)}${String(cur).padStart(11)}${base && prev != null ? ((cur - prev >= 0 ? "+" : "") + (cur - prev)).padStart(11) : ""}`);
console.log("\nStatic counters");
num("src/index.css bytes", snapshot.indexCss.bytes, base?.indexCss.bytes);
num("@keyframes", snapshot.indexCss.keyframes, base?.indexCss.keyframes);
num("'infinite' occurrences", snapshot.indexCss.infinite, base?.indexCss.infinite);
num("requestAnimationFrame( in src/**", snapshot.raf, base?.raf);
console.log();
