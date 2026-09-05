#!/usr/bin/env node
/**
 * codemod-eyebrow — hand-rolled uppercase micro-labels → .eyebrow / .eyebrow-sm
 *
 *   node scripts/codemod-eyebrow.mjs           dry run: counts + review list
 *   node scripts/codemod-eyebrow.mjs --write
 *
 * Rewrites double-quoted class strings in src/**\/*.tsx that combine
 * `uppercase` with a tracking token and a 9–12 px size (or tracking-[0.22em]
 * with no size): size, weight, tracking and uppercase collapse into one class
 * (9–10 px → eyebrow-sm, 11–12 px / text-xs → eyebrow); colour, margins and
 * layout tokens stay. Strings with no colour token now inherit .eyebrow's
 * muted default instead of the parent colour — listed as NEEDS-COLOUR-REVIEW.
 * Skips src/components/ui, StatusHeader and Landing (deliberate letterspacing).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const write = process.argv.includes("--write");
const SKIP = /src\/components\/ui\/|StatusHeader\.tsx|Landing\.tsx/;
const SIZE = /^text-\[(9|10|11|12)px\]$|^text-xs$/;
const TRACK = /^tracking-(wider|widest|\[0\.\d+em\])$/;
const WEIGHT = /^font-(medium|semibold|bold|extrabold|black)$/;
const COLOUR = /^text-(?!\[\d|xs$|sm$|base$|lg$|xl$|\dxl$|left$|center$|right$|justify$|ellipsis$|nowrap$|wrap$|balance$|pretty$|clip$)/;

const rewrite = (str) => {
  const tokens = str.split(/\s+/).filter(Boolean);
  if (!tokens.includes("uppercase")) return null;
  const track = tokens.find((t) => TRACK.test(t));
  if (!track) return null;
  const size = tokens.find((t) => SIZE.test(t));
  let cls;
  if (size) cls = size === "text-xs" || /1[12]px/.test(size) ? "eyebrow" : "eyebrow-sm";
  else if (track === "tracking-[0.22em]") cls = "eyebrow";
  else return null;
  const rest = tokens.filter((t) => t !== "uppercase" && !TRACK.test(t) && !SIZE.test(t) && !WEIGHT.test(t));
  return { out: [cls, ...rest].join(" "), hasColour: rest.some((t) => COLOUR.test(t)) };
};

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".tsx") && !f.includes(".test.") && !SKIP.test(p)) files.push(p);
  }
};
walk("src");

let total = 0;
const review = [];
for (const file of files) {
  const src = readFileSync(file, "utf8");
  let n = 0;
  const out = src.replace(/"([^"\\\n]*)"/g, (m, inner, offset) => {
    const r = rewrite(inner);
    if (!r) return m;
    n++;
    if (!r.hasColour) review.push(`${file}:${src.slice(0, offset).split("\n").length}  ${r.out}`);
    return `"${r.out}"`;
  });
  if (n) {
    total += n;
    if (write) writeFileSync(file, out);
    console.log(`${String(n).padStart(3)}  ${file}`);
  }
}
console.log(`\n${total} class strings → eyebrow/eyebrow-sm${write ? " (written)" : " (dry run)"}`);
if (review.length) console.log(`\nNEEDS-COLOUR-REVIEW (${review.length}) — no colour token, now muted by default:\n` + review.join("\n"));
