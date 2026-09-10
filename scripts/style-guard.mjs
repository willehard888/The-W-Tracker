#!/usr/bin/env node
// Style guard — the design system's regression fence (same pattern as
// type-debt.mjs). Every rule is a row: what it bans, why, and which files
// are allowed to keep it. Output is file:line so a hit is one click away.
// Canvas-drawing files are excluded from the colour rules: CSS var() doesn't
// resolve in canvas.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const norm = (p) => (sep === "/" ? p : p.split(sep).join("/"));
const PAGES = /^src\/pages\//;
const UI = /^src\/components\/ui\//;

/** { re, msg, only?: RegExp, exempt?: string[]|RegExp, stripComments?: bool } */
const RULES = [
  { re: /42[_ ]78%[_ ]54%/, msg: "literal gold — use hsl(var(--gold))", exempt: ["src/components/StoryShareModal.tsx", "src/components/AmbientParticles.tsx"] },
  { re: /18[_ ]95%[_ ]58%/, msg: "literal ember — use hsl(var(--ember))", exempt: ["src/components/StoryShareModal.tsx", "src/components/AmbientParticles.tsx"] },
  { re: /purple-[1-9]00/, msg: "stock violet — use gold/ember tokens" },
  // Vocabulary
  { re: /tracking-\[0\.22em\]|tracking-widest|tracking-\[0\.1[468]em\]/, msg: "hand-rolled eyebrow — use .eyebrow / .eyebrow-sm",
    exempt: [UI, "src/components/StatusHeader.tsx", "src/pages/Landing.tsx", "src/components/StoryShareModal.tsx", "src/components/paywall/PilotCodeRedeem.tsx"] },
  { re: /\.toLocaleString\(\)/, msg: "locale grouping — use fmtInt/fmtUnit from @/lib/format", stripComments: true, exempt: ["src/lib/format.ts"] },
  { re: /\.\.\.(?=["'`<]|\s*<\/)/, msg: "three dots — use the … glyph", stripComments: true, exempt: ["src/main.tsx"] },
  { re: /(?<![\w.])confirm\(/, msg: "window.confirm — use ConfirmDialog", exempt: [/__tests__/] },
  // Layout: the shell scrolls, pages do not
  { re: /min-h-screen|h-screen|\[100dvh\]/, msg: "page owns the viewport — pages are min-h-full (the shell scrolls)", only: PAGES, exempt: ["src/pages/TribeLeaderboard.tsx", "src/pages/ButtonGallery.tsx", "src/pages/Landing.tsx", "src/pages/Auth.tsx", "src/pages/Onboarding.tsx", "src/pages/OAuthCallback.tsx", "src/pages/ChooseUsername.tsx", "src/pages/NotFound.tsx"] },
  { re: /\bpb-(24|28|32)\b/, msg: "nav clearance padding — the shell already clears the tab bar", only: PAGES, exempt: ["src/pages/TribeLeaderboard.tsx", "src/pages/ButtonGallery.tsx"] },
  { re: /(flex-1|h-full)[^"'`]*overflow-y-auto|overflow-y-auto[^"'`]*(flex-1|h-full)/, msg: "page-level scroller — only the shell scrolls", only: PAGES, exempt: ["src/pages/Chat.tsx"] },
  // Motion
  { re: /(?<!group-)active:scale-/, msg: "per-element press scale — press depth is global (.press for non-buttons)", exempt: ["src/components/ui/button.tsx"] },
  { re: /animate-reveal|animate-stagger-/, msg: "v1 entrance — use home-rise(-N)" },
  { re: /\btransition-all\b/, msg: "transition-all animates 11 properties and overrides .press — name the ones that move (transition-colors, transition-[width], …)" },
  { re: /document\.body\.style\.overflow/, msg: "body scroll lock is a no-op — use useScrollLock", exempt: ["src/contexts/ScrollContainerContext.tsx"] },
  // Hit areas: a raw small button without a hit-area expansion
  // Newline- and `=>`-tolerant: the old per-line form could not see a
  // <button whose className sat two lines below an onClick arrow, and 13
  // sub-floor buttons shipped through it.
  { re: /<button\b(?:[^>]|=>)*?className=\{?(?:cn\()?\s*["'`][^"'`]*\b(h-([6-9]|10)|w-([6-9]|10)|p-1(\.5)?)\b(?!(?:[^>]|=>)*?(?:min-h-11|before:-inset|min-w-11))/, msg: "sub-44 pt raw button — add min-h-11 / a before:-inset hit area or use <Button>", exempt: [UI, "src/components/StatusHeader.tsx"] },
];

/**
 * Whole-file assertions that the RULES walker can't express — it skips
 * src/index.css and matches per-file, so anything about a token's *value*, or
 * about two files agreeing, lives here. Each returns a hit string or null.
 */
const CHECKS = [
  // A ConfirmDialog opened from inside a BottomSheet must land above it, or the
  // confirm is invisible and the destructive action is unreachable — that is
  // how "Remove post" and "Remove member" reach a tribe owner.
  () => {
    const css = readFileSync("src/index.css", "utf8");
    const tok = (name) => Number(css.match(new RegExp(`--${name}:\\s*(\\d+)`))?.[1]);
    const confirm = tok("z-confirm");
    const celebration = tok("z-celebration");
    if (!(confirm > celebration)) {
      return `src/index.css: --z-confirm (${confirm}) must sit above --z-celebration (${celebration}) — a confirm inside a sheet has to be clickable`;
    }
    if (!readFileSync("src/components/ui/alert-dialog.tsx", "utf8").includes("z-[var(--z-confirm)]")) {
      return "src/components/ui/alert-dialog.tsx: lost z-[var(--z-confirm)] — every ConfirmDialog falls back under the sheet";
    }
    return null;
  },
];

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
const isExempt = (rule, rel) => (rule.exempt ?? []).some((e) => (e instanceof RegExp ? e.test(rel) : e === rel));

const hits = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    const rel = norm(p);
    if (!/\.(tsx?|css)$/.test(name) || rel === "src/index.css" || /\.test\.tsx?$/.test(name)) continue;
    const raw = readFileSync(p, "utf8");
    for (const rule of RULES) {
      if (rule.only && !rule.only.test(rel)) continue;
      if (isExempt(rule, rel)) continue;
      const src = rule.stripComments ? stripComments(raw) : raw;
      // Whole-file matching (rules may span lines); the line is derived from
      // the match index so a hit stays one click away.
      for (const m of src.matchAll(new RegExp(rule.re.source, rule.re.flags.replace("g", "") + "g"))) {
        const line = src.slice(0, m.index).split("\n").length;
        hits.push(`${rel}:${line}: ${rule.msg} (found "${m[0].replace(/\s+/g, " ").slice(-60)}")`);
      }
    }
  }
};
walk("src");
for (const check of CHECKS) {
  const hit = check();
  if (hit) hits.push(hit);
}

if (hits.length) {
  console.error(`✗ Style guard: ${hits.length} hit(s):\n` + hits.map((h) => "  " + h).join("\n"));
  process.exit(1);
}
console.log(`✓ Style guard: ${RULES.length + CHECKS.length} rules, no hits. 👍`);
