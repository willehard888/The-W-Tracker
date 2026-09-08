#!/usr/bin/env node
/**
 * codemod-eyebrow-demote — the inverse of codemod-eyebrow.mjs.
 *
 *   node scripts/codemod-eyebrow-demote.mjs --dry-run
 *   node scripts/codemod-eyebrow-demote.mjs --write
 *
 * `.eyebrow` is committed brand, but it is allowed at most ONCE per screen —
 * for a date or a status, never as a kicker above a heading. Everywhere else
 * the tracked uppercase micro-label becomes a plain label:
 *
 *   eyebrow     → text-[11px] font-bold
 *   eyebrow-sm  → text-[10px] font-bold
 *
 * `text-muted-foreground` is appended only when the class string carries no
 * colour token of its own — `.eyebrow` supplied the muted default, so a string
 * that relied on it would otherwise inherit the parent colour.
 *
 * Only double-quoted class strings are rewritten: every `eyebrow` call site in
 * src is one (`className="…"` or a `cn("…")` fragment), and comment lines and
 * the KEEP list below are skipped.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const write = process.argv.includes("--write");
const norm = (p) => (sep === "/" ? p : p.split(sep).join("/"));

/** Owned by other streams, or deliberate letterspacing — never touched. */
const SKIP = [
  /^src\/components\/ui\//,
  "src/lib/status-tiers.ts",
  "src/components/StatusNameplate.tsx",
  "src/components/StatusBadge.tsx",
  "src/components/profile/IdentityCore.tsx",
  "src/components/profile/ProfileHero.tsx",
  "src/components/ProfileActivityPulse.tsx",
  "src/components/tribe/TribeHero.tsx",
  "src/pages/Landing.tsx",
  "src/components/TribeReportsDialog.tsx",
  "src/components/TribeManageDialog.tsx",
  "src/pages/WeeklyBriefing.tsx",
  "src/pages/Recipes.tsx",
  "src/pages/Exercises.tsx",
  "src/App.tsx",
  "src/components/BottomNav.tsx",
  "src/components/StatusHeader.tsx",
  "src/pages/Tribes.tsx",
  "src/pages/Profile.tsx",
  "src/pages/Squad.tsx",
  "src/index.css",
];

/** The one eyebrow each screen keeps — `file:line` of the opening `"`. */
const KEEP = new Set([
  "src/pages/Index.tsx:278",
  "src/pages/DailyCheckin.tsx:782",
  "src/components/coach/v2/CoachBriefHero.tsx:52",
  "src/components/journey/WhealthIndexCard.tsx:93",
  "src/components/vault/VaultArticleSheet.tsx:118",
  "src/pages/TribeBattles.tsx:263",
  "src/pages/PublicProfile.tsx:277",
  // Owned by another stream, not this screen's keeper.
  "src/pages/nutrition/NutritionPhotoReview.tsx:466",
]);

/** From codemod-eyebrow.mjs: `text-…` that names a colour, not a size/align. */
const COLOUR = /^text-(?!\[\d|xs$|sm$|base$|lg$|xl$|\dxl$|left$|center$|right$|justify$|ellipsis$|nowrap$|wrap$|balance$|pretty$|clip$)/;
/** A size the call site already sets — it overrode .eyebrow's 11px, so keep it alone. */
const SIZE = /^text-(\[[\d.]+px\]|xs|sm|base|lg|xl|\dxl)$/;
const PLAIN = { eyebrow: "text-[11px]", "eyebrow-sm": "text-[10px]" };

const demote = (str) => {
  const tokens = str.split(/\s+/).filter(Boolean);
  const at = tokens.findIndex((t) => t in PLAIN);
  if (at < 0) return null;
  const rest = tokens.filter((_, i) => i !== at);
  const size = rest.some((t) => SIZE.test(t)) ? [] : [PLAIN[tokens[at]]];
  const colour = rest.some((t) => COLOUR.test(t)) ? [] : ["text-muted-foreground"];
  return [...tokens.slice(0, at), ...size, "font-bold", ...colour, ...tokens.slice(at + 1)].join(" ");
};

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".tsx") && !f.includes(".test.") && !SKIP.some((s) => (s instanceof RegExp ? s.test(norm(p)) : s === norm(p)))) files.push(norm(p));
  }
};
walk("src");

let total = 0;
let kept = 0;
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  let n = 0;
  const out = src.replace(/"([^"\\\n]*)"/g, (m, inner, offset) => {
    const line = src.slice(0, offset).split("\n").length;
    if (/^\s*(\/\/|\/\*|\*)/.test(lines[line - 1])) return m;
    if (KEEP.has(`${file}:${line}`)) { if (demote(inner)) kept++; return m; }
    const next = demote(inner);
    if (!next) return m;
    n++;
    console.log(`${file}:${line}\n  - ${inner}\n  + ${next}`);
    return `"${next}"`;
  });
  if (n) {
    total += n;
    if (write) writeFileSync(file, out);
  }
}
console.log(`\n${total} class strings demoted, ${kept} kept${write ? " (written)" : " (dry run)"}`);
