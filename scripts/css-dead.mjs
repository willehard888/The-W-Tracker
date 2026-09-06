#!/usr/bin/env node
/**
 * css-dead — dead @keyframes and class rules in src/index.css.
 *
 *   node scripts/css-dead.mjs            report
 *   node scripts/css-dead.mjs --write    delete them (re-run until clean)
 *
 * A keyframe is dead when its name is referenced nowhere outside its own
 * declaration; a class when it never appears in any source file (ts/tsx/
 * html/js, other css, tailwind config) and no template literal builds a
 * class with its prefix. A rule is deleted only when EVERY selector in its
 * list contains a dead class (`.dead .live` can never match). `:not()`
 * contents are ignored; selectors with escapes, attribute selectors or
 * :is/:where/:has are always kept. Exempt prefixes: home-rise-,
 * animate-reveal-delay-, tfl- (built dynamically or by delay index).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CSS = "src/index.css";
const EXEMPT = /^(home-rise-|animate-reveal-delay-|tfl-)/;
const write = process.argv.includes("--write");

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css|html|m?js)$/.test(f) && p !== CSS) files.push(p);
  }
};
walk("src");
files.push("index.html");
for (const f of readdirSync(".")) if (/^tailwind\.config\./.test(f)) files.push(f);
const corpus = files.map((f) => readFileSync(f, "utf8")).join("\n");
const dynamicPrefixes = [...new Set([...corpus.matchAll(/([a-zA-Z][\w-]*-)\$\{/g)].map((m) => m[1]))];

const boundary = (name) => new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, "g");
const count = (src, name) => (src.match(boundary(name)) ?? []).length;

/** Top-level nodes of a CSS block: { prelude, start, end, bodyStart, bodyEnd } (bodyStart<0 = no block). */
function parse(src, from, to) {
  const nodes = [];
  let i = from;
  const skipComment = () => { const j = src.indexOf("*/", i + 2); i = j < 0 ? to : j + 2; };
  const skipString = (q) => { i++; while (i < to && src[i] !== q) { if (src[i] === "\\") i++; i++; } i++; };
  while (i < to) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && src[i + 1] === "*") { skipComment(); continue; }
    const start = i;
    let depthParen = 0;
    // prelude until "{" or ";"
    while (i < to) {
      const ch = src[i];
      if (ch === "/" && src[i + 1] === "*") { skipComment(); continue; }
      if (ch === '"' || ch === "'") { skipString(ch); continue; }
      if (ch === "(") depthParen++;
      else if (ch === ")") depthParen--;
      else if (depthParen === 0 && (ch === "{" || ch === ";")) break;
      i++;
    }
    if (i >= to) break;
    if (src[i] === ";") { nodes.push({ prelude: src.slice(start, i).trim(), start, end: i + 1, bodyStart: -1, bodyEnd: -1 }); i++; continue; }
    const prelude = src.slice(start, i).trim();
    const bodyStart = i + 1;
    let depth = 1; i++;
    while (i < to && depth > 0) {
      const ch = src[i];
      if (ch === "/" && src[i + 1] === "*") { skipComment(); continue; }
      if (ch === '"' || ch === "'") { skipString(ch); continue; }
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    nodes.push({ prelude, start, end: i, bodyStart, bodyEnd: i - 1 });
  }
  return nodes;
}

const NESTING = /^@(media|supports|layer|container)\b/;
const classesOf = (selector) => {
  const s = selector.replace(/:not\([^)]*\)/g, "");
  if (/[\\[]|:(is|where|has)\(/.test(s)) return null; // keep
  return [...s.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map((m) => m[1]);
};
const splitSelectors = (prelude) => {
  const out = []; let depth = 0, cur = "";
  for (const ch of prelude) {
    if (ch === "(") depth++; else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
};

const css = readFileSync(CSS, "utf8");
const keyframeDecl = /^@(?:-webkit-)?keyframes\s+([\w-]+)/;
const liveCache = new Map();
const classLive = (name) => {
  if (liveCache.has(name)) return liveCache.get(name);
  const live = EXEMPT.test(name) || dynamicPrefixes.some((p) => name.startsWith(p)) || count(corpus, name) > 0;
  liveCache.set(name, live);
  return live;
};
const keyframeLive = (name) => {
  const decls = (css.match(new RegExp(`@(?:-webkit-)?keyframes\\s+${name}(?![\\w-])`, "g")) ?? []).length;
  return dynamicPrefixes.some((p) => name.startsWith(p)) || count(corpus, name) > 0 || count(css, name) - decls > 0;
};

const deadRanges = [];
const deadKeyframes = new Set();
const deadClasses = new Set();
function visit(from, to) {
  for (const n of parse(css, from, to)) {
    if (n.bodyStart < 0) continue;
    const kf = n.prelude.match(keyframeDecl);
    if (kf) { if (!keyframeLive(kf[1])) { deadKeyframes.add(kf[1]); deadRanges.push(n); } continue; }
    if (n.prelude.startsWith("@")) { if (NESTING.test(n.prelude)) visit(n.bodyStart, n.bodyEnd); continue; }
    const selectors = splitSelectors(n.prelude);
    let allDead = selectors.length > 0;
    for (const sel of selectors) {
      const cls = classesOf(sel);
      const dead = cls !== null && cls.some((c) => !classLive(c));
      if (dead) for (const c of cls) if (!classLive(c)) deadClasses.add(c);
      if (!dead) allDead = false;
    }
    if (allDead) deadRanges.push(n);
  }
}
visit(0, css.length);

// Empty nesting at-rules after deletion (whitespace/comments only) go too.
const removeSet = new Set(deadRanges.map((n) => n.start));
const emptyAfter = (from, to) => {
  for (const n of parse(css, from, to)) if (!removeSet.has(n.start)) return false;
  return true;
};
function sweepEmpty(from, to) {
  for (const n of parse(css, from, to)) {
    if (n.bodyStart < 0 || removeSet.has(n.start) || !NESTING.test(n.prelude)) continue;
    sweepEmpty(n.bodyStart, n.bodyEnd);
    if (emptyAfter(n.bodyStart, n.bodyEnd)) { removeSet.add(n.start); deadRanges.push(n); }
  }
}
sweepEmpty(0, css.length);

// Widen each range to swallow a comment that sits directly above it.
const ranges = deadRanges
  .filter((n, i, arr) => arr.findIndex((m) => m.start === n.start) === i)
  .map((n) => {
    let s = n.start;
    const before = css.slice(0, s);
    const m = before.match(/\/\*(?:[^*]|\*(?!\/))*\*\/\s*$/);
    if (m && !before.slice(0, before.length - m[0].length).endsWith("}")) s = before.length - m[0].length;
    else if (m) s = before.length - m[0].length;
    return { start: s, end: n.end };
  })
  .sort((a, b) => a.start - b.start);
// drop ranges nested inside an earlier one
const merged = [];
for (const r of ranges) { const last = merged[merged.length - 1]; if (last && r.start < last.end) { last.end = Math.max(last.end, r.end); } else merged.push({ ...r }); }

let out = "", pos = 0;
for (const r of merged) { out += css.slice(pos, r.start); pos = r.end; }
out += css.slice(pos);
out = out.replace(/\n{3,}/g, "\n\n");

const saved = css.length - out.length;
console.log(`dead keyframes (${deadKeyframes.size}): ${[...deadKeyframes].sort().join(" ") || "—"}`);
console.log(`dead classes (${deadClasses.size}): ${[...deadClasses].sort().join(" ") || "—"}`);
console.log(`rules to delete: ${merged.length}, bytes: ${saved} of ${css.length}`);
if (write && saved > 0) { writeFileSync(CSS, out); console.log(`wrote ${CSS} — re-run until clean (keyframes referenced only by deleted rules die next pass)`); }
