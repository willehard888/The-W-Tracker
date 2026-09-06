#!/usr/bin/env node
/**
 * codemod-motion — one entrance grammar, one press system.
 *
 *   node scripts/codemod-motion.mjs           dry run
 *   node scripts/codemod-motion.mjs --write
 *
 * 1. animate-reveal(-delay-N) → home-rise(-N): the v1 entrance (199 uses)
 *    joins the v2 blur-rise cascade Home already uses.
 * 2. Strips every `active:scale-*` outside components/ui/button.tsx —
 *    press depth is global (button / [role=button] 0.97, a.tap-card 0.98),
 *    per-element scales were a third competing press system. Sites whose
 *    nearest enclosing tag is not a button get the shared `.press` class
 *    (same 0.97 depth) so nothing loses the feedback it had.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const write = process.argv.includes("--write");
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".tsx") && !f.includes(".test.") && !p.endsWith("components/ui/button.tsx")) files.push(p);
  }
};
walk("src");

let reveals = 0, scales = 0;
const review = [];
for (const file of files) {
  const src = readFileSync(file, "utf8");
  let out = src.replace(/\banimate-reveal-delay-(\d)\b/g, (_, n) => { reveals++; return `home-rise-${n}`; });
  out = out.replace(/\banimate-reveal\b/g, () => { reveals++; return "home-rise"; });
  const lines = out.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/(?<!group-)active:scale-/.test(lines[i])) continue;
    // nearest enclosing tag above (same line first)
    let tag = null;
    for (let j = i; j >= Math.max(0, i - 15) && !tag; j--) {
      const m = lines[j].match(/<([A-Za-z][\w.]*)(?=[\s>/])/g);
      if (m) tag = m[m.length - 1].slice(1);
    }
    lines[i] = lines[i].replace(/(?<!group-)active:scale-\S+ ?/g, () => { scales++; return ""; });
    // Not a button: the universal button press rule does not reach it, so the
    // shared .press class (same 0.97 depth) keeps the feedback it had.
    if (!/^(button|Button|motion\.button)$/.test(tag ?? "") && !/(?<![\w-])press(?![\w-])/.test(lines[i])) {
      const q = lines[i].indexOf('"');
      if (q >= 0) { lines[i] = lines[i].slice(0, q + 1) + "press " + lines[i].slice(q + 1); review.push(`${file}:${i + 1}  <${tag}> → .press`); }
    }
  }
  out = lines.join("\n");
  if (out !== src) {
    if (write) writeFileSync(file, out);
    console.log(`  ${file}`);
  }
}
console.log(`\n${reveals} animate-reveal → home-rise, ${scales} active:scale stripped${write ? " (written)" : " (dry run)"}`);
if (review.length) console.log(`\nnot a button — given .press (${review.length}):\n` + review.join("\n"));
