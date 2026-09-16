#!/usr/bin/env node
/**
 * codemod-type-scale — hand-written pixel sizes onto the named ladder.
 *
 *   node scripts/codemod-type-scale.mjs --dry-run
 *   node scripts/codemod-type-scale.mjs --write
 *
 * The app carried two type ladders at once: Tailwind's stock steps and its own
 * 10–27px range, the second written out as `text-[Npx]` 1157 times because no
 * name existed for it. `tailwind.config.ts` now names those rungs, and this
 * moves the call sites onto them.
 *
 * THIS IS A RENAME, NOT A RESIZE. Every mapping below is size-for-size, and the
 * rungs are declared as bare strings so they emit a font-size and nothing else —
 * exactly what `text-[Npx]` emitted. Two things follow from that:
 *
 *   - Stock names are NOT valid targets. `.text-xs` is
 *     `font-size:.75rem;line-height:1rem`, so mapping `text-[12px]` onto it
 *     would hand 299 elements a line-height they never had. 12/14/16/18/20/24
 *     each get their own size-only rung instead.
 *   - Off-ladder sizes are left alone. 11.5, 12.5, 19 and 26px would each move
 *     by up to 1px if snapped, and a rename commit is the wrong place to move
 *     text. They are handled separately, one named site at a time.
 *
 * Above 27px is display territory — hero, celebration and share-image sizes
 * that should stay arbitrary and are not on the ladder at all.
 *
 * The token `text-[Npx]` is unambiguous, so it is replaced wherever it appears
 * rather than only inside double-quoted strings; that also catches the one
 * template literal (PublicProfile.tsx:52). Comment lines are skipped.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const write = process.argv.includes("--write");
const norm = (p) => (sep === "/" ? p : p.split(sep).join("/"));

/** px → rung. Size-for-size; anything absent stays arbitrary on purpose. */
const RUNG = {
  10: "label", 11: "label", 12: "meta", 13: "dense", 14: "note",
  15: "read", 16: "copy", 17: "lead", 18: "subhead", 20: "head",
  22: "title", 24: "major", 27: "beat",
};

const TOKEN = /text-\[(\d+)px\]/g;

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f) && !f.includes(".test.")) files.push(norm(p));
  }
};
walk("src");

let total = 0;
const skipped = new Map();
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  let n = 0;
  const out = src.replace(TOKEN, (m, px, offset) => {
    const line = src.slice(0, offset).split("\n").length;
    if (/^\s*(\/\/|\/\*|\*)/.test(lines[line - 1])) return m;
    const rung = RUNG[Number(px)];
    if (!rung) {
      skipped.set(m, (skipped.get(m) ?? 0) + 1);
      return m;
    }
    n++;
    return `text-${rung}`;
  });
  if (n) {
    total += n;
    console.log(`${file}  ${n}`);
    if (write) writeFileSync(file, out);
  }
}

console.log(`\n${total} sizes moved onto the ladder${write ? " (written)" : " (dry run)"}`);
if (skipped.size) {
  console.log("\nleft arbitrary (off-ladder or display):");
  for (const [m, c] of [...skipped].sort((a, b) => b[1] - a[1])) console.log(`  ${m}  ${c}`);
}
