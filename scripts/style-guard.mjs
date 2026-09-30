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
  // NOT a rule: `uppercase` + `tracking-wide(r)`. It was tried, and 8 of its 9
  // hits were badges and chips (ApexBadge, the "Reviewing…" pills, the habit
  // picker's "Core") where .eyebrow is the wrong class — a bordered pill is not
  // a micro-label. Only one was the real anti-pattern (an <h2> dressed as a
  // kicker) and it is fixed. A rule that needs an exemption for 8 of 9 hits
  // teaches people to add exemptions, not to stop.
  // The a11y floor from the 2026-08-26 audit: muted text never goes below /75.
  // 118 values had drifted to /40–/70 before this rule existed, including two
  // that render on every screen in the app.
  { re: /text-(?:muted-foreground|white|foreground)\/(?:[1-6]\d|70|[1-9])\b/, msg: "below the /75 muted-text floor (a11y)",
    exempt: [UI, "src/components/StoryShareModal.tsx", "src/components/AmbientParticles.tsx", "src/pages/ButtonGallery.tsx"] },
  // Gold is the hero's colour; at /30–/60 it is a wash on sparkles, kickers
  // and share-card ornaments — the accent glut the redesign playbook names.
  { re: /text-gold\/(?:[1-6]\d|[1-9])\b/, msg: "gold below /70 — gold is scarce, not a wash", exempt: ["src/components/StoryShareModal.tsx"] },
  { re: /\.toLocaleString\(\)/, msg: "locale grouping — use fmtInt/fmtUnit from @/lib/format", stripComments: true, exempt: ["src/lib/format.ts"] },
  { re: /\.\.\.(?=["'`<]|\s*<\/)/, msg: "three dots — use the … glyph", stripComments: true, exempt: ["src/main.tsx"] },
  { re: /(?<![\w.])(?:window\.)?(?:confirm|prompt|alert)\(/, msg: "window.confirm/prompt/alert — a grey system alert over the app; use ConfirmDialog or an inline field", stripComments: true, exempt: [/__tests__/] },
  // A system toast states what happened; the celebration lives in the UI that changed.
  { re: /toast(?:\.\w+)?\(\s*(["'`])(?:(?!\1)[^\n])*(?:!\s*\1|!\s|\p{Extended_Pictographic})/u, msg: "toast with ! or emoji — state what happened (\"Posted\", \"Couldn't post. Try again.\")", stripComments: true },
  // Layout: the shell scrolls, pages do not
  { re: /min-h-screen|h-screen|\[100dvh\]/, msg: "page owns the viewport — pages are min-h-full (the shell scrolls)", only: PAGES, exempt: ["src/pages/TribeLeaderboard.tsx", "src/pages/ButtonGallery.tsx", "src/pages/Landing.tsx", "src/pages/Auth.tsx", "src/pages/Onboarding.tsx", "src/pages/OAuthCallback.tsx", "src/pages/ChooseUsername.tsx", "src/pages/NotFound.tsx"] },
  { re: /\bpb-(24|28|32)\b/, msg: "nav clearance padding — the shell already clears the tab bar", only: PAGES, exempt: ["src/pages/TribeLeaderboard.tsx", "src/pages/ButtonGallery.tsx"] },
  { re: /(flex-1|h-full)[^"'`]*overflow-y-auto|overflow-y-auto[^"'`]*(flex-1|h-full)/, msg: "page-level scroller — only the shell scrolls", only: PAGES, exempt: ["src/pages/Chat.tsx"] },
  // Motion
  { re: /(?<!group-)active:scale-/, msg: "per-element press scale — press depth is global (.press for non-buttons)", exempt: ["src/components/ui/button.tsx"] },
  // A full-width text-left row is a row: it highlights (.press-row), it does
  // not shrink. `press` on one reads as a chip the size of the screen.
  { re: /<button\b(?:[^>]|=>)*?className=\{?(?:cn\()?\s*["'`](?=[^"'`]*\bw-full\b)(?=[^"'`]*\btext-left\b)(?:[^"'`]*\s)?press(?=\s|["'`])/, msg: "full-width row with `press` — rows use .press-row (highlight, no scale)" },
  // A segmented control opts out of the global press scale through
  // SEGMENT_BUTTON; a hand-written one shrinks inside its track.
  { re: /^(?![\s\S]*SEGMENT_BUTTON)[\s\S]*?SEGMENT_(?:ACTIVE|IDLE)/, msg: "segment without SEGMENT_BUTTON — the prefix carries the size and the press opt-out", exempt: ["src/components/ui/segment.ts"] },
  // One field: a raw <input>/<textarea> that re-declares the inset surface or
  // its own focus ring is a copy of src/components/ui/input.tsx.
  { re: /<(?:input|textarea)\b(?:[^>]|=>)*?className=(?:[^>]|=>)*?(?:surface-inset|focus(?:-visible)?:ring-|focus(?:-visible)?:border-gold)/, msg: "raw field with its own surface or focus — use <Input>/<Textarea> (one field, one focus)",
    // The two editors' title line is a transparent underline field by design.
    exempt: [UI, "src/pages/nutrition/NutritionRecipeEditor.tsx", "src/pages/nutrition/UserFoodEditor.tsx"] },
  // One card: a container that re-declares the card shell (a radius, a
  // border and the card ground in one class list) is a copy of .surface-card.
  { re: /["'`][^"'`]*\brounded-(?:xl|2xl)\b[^"'`]*\bborder\b[^"'`]*\bbg-card(?:\/\d+)?\b[^"'`]*["'`]|["'`][^"'`]*\bbg-card(?:\/\d+)?\b[^"'`]*\bborder\b[^"'`]*\brounded-(?:xl|2xl)\b[^"'`]*["'`]/, msg: "hand-rolled card shell — use surface-card (surface-card-quiet for nested, surface-panel inside a card, surface-tint-* for an accent)", exempt: [UI, "src/components/skeletons/PageSkeleton.tsx"] },
  // One list: rows divide at /35 everywhere.
  { re: /\bdivide-border\/(?!35\b)\d+/, msg: "list divider off the scale — divide-border/35" },
  // One type scale: the named ladder (label…beat) is the vocabulary; the stock
  // steps are the same pixels under another name. LOCK IN's deck is locked.
  { re: /(?<![\w:-])text-(?:xs|sm|base|lg|xl|2xl)\b/, msg: "stock text size — use the named ladder (meta·note·copy·subhead·head·major)", exempt: ["src/components/home/CommandDeck.tsx"] },
  { re: /\bleading-\[/, msg: "arbitrary leading — leading-display (titles) or tight / snug / relaxed / none", exempt: ["src/components/home/CommandDeck.tsx"] },
  { re: /\bfont-(?:medium|extrabold|light|thin)\b/, msg: "off-scale weight — the app speaks in semibold / bold / black", exempt: ["src/components/home/CommandDeck.tsx"] },
  { re: /["'`](?=[^"'`]*\bfont-display\b)(?=[^"'`]*\btext-beat\b)(?=[^"'`]*\btracking-tight\b)(?=[^"'`]*\bleading-(?:display|tight)\b)[^"'`]*["'`]/, msg: "hand-written page title — .h-page", exempt: ["src/components/home/CommandDeck.tsx"] },
  // One icon scale: 12 · 14 · 16 · 18 · 20 · 24 (10 and below for dots), one
  // stroke: 2 (the default), 2.5 or 3 (0 for a filled mark).
  { re: /\bsize=\{?(?:11|13|15|17|19|21|23)\}?/, msg: "icon size between the steps — 12 · 14 · 16 · 18 · 20 · 24", exempt: ["src/components/home/CommandDeck.tsx"] },
  { re: /\bstrokeWidth=\{?(?:1\.[0-9]|2\.[1-46-9]|3\.[1-9])\b/, msg: "off-scale stroke — 2.5 or 3 (2 is the default: drop the prop; 0 fills)", exempt: ["src/components/home/CommandDeck.tsx"] },
  // One clock. transition-* rides the default (140 ms, iOS curve); the ladder
  // above it is 200 · 300 · 500 · 700. A curve is ease-soft / ease-spring or
  // nothing; Tailwind's ease-out/in/in-out are weaker than the default.
  { re: /\bduration-(?:75|100|150|1000|\[[^\]]+\])/, msg: "duration off the ladder — 200 · 300 · 500 · 700 (or none: 140 ms is the default)", exempt: ["src/components/home/CommandDeck.tsx"] },
  { re: /\[transition-timing-function:[^\]]+\]|\bease-\[cubic-bezier[^\]]*\]/, msg: "arbitrary curve — ease-soft, ease-spring, or nothing (the iOS curve is the default)", exempt: ["src/components/home/CommandDeck.tsx"] },
  { re: /["'`][^"'`]*\btransition(?:-[\w\[\],-]+)?\b[^"'`]*\bease-(?:in|out|in-out|linear)\b[^"'`]*["'`]/, msg: "Tailwind's ease-* on a transition — drop it (the default curve) or ease-soft", exempt: ["src/components/home/CommandDeck.tsx"] },
  // Framer utility moves come from src/lib/motion.ts; a literal duration is a fourth fade.
  { re: /transition=\{\{\s*duration:\s*0\.(?:1[0-9]|2[0-9]|3[0-9])\b[^}]*\}\}/, msg: "literal framer duration — MOTION.fade / .slide / .reveal (src/lib/motion.ts)", exempt: ["src/components/home/CommandDeck.tsx"] },
  // One palette: the tokens (gold · ember · amber · rose · teal · purple ·
  // xp-green · destructive). Tailwind's own swatches bypass them. The share
  // cards rasterise to a canvas and keep literal colour on purpose.
  { re: /\b(?:text|bg|border|from|via|to|ring|fill|stroke|divide|outline|shadow)-(?:red|green|blue|amber|yellow|emerald|purple|violet|pink|rose|orange|zinc|slate|gray|neutral|stone|sky|cyan|indigo|lime|fuchsia)-[0-9]{2,3}\b/, msg: "Tailwind swatch — use the tokens (amber, rose, xp-green, destructive, gold, ember…)", exempt: ["src/components/StoryShareModal.tsx", "src/components/BriefingShareCard.tsx"] },
  // Three text tones per colour: foreground · foreground/85 · muted-foreground
  // (/75 is the floor) · gold (/70 for the quiet gold). Anything else is a
  // fourth grey.
  { re: /\btext-foreground\/(?!85\b)\d+/, msg: "off-ladder foreground alpha — text-foreground or text-foreground/85", exempt: ["src/components/StoryShareModal.tsx", "src/components/BriefingShareCard.tsx", "src/components/home/CommandDeck.tsx"] },
  { re: /\btext-muted-foreground\/(?!75\b)\d+/, msg: "off-ladder muted alpha — text-muted-foreground or /75 (the floor)", exempt: ["src/components/StoryShareModal.tsx", "src/components/BriefingShareCard.tsx", "src/components/home/CommandDeck.tsx"] },
  { re: /\btext-gold\/(?!70\b)\d+/, msg: "off-ladder gold alpha — text-gold or text-gold/70", exempt: ["src/components/StoryShareModal.tsx", "src/components/BriefingShareCard.tsx", "src/components/home/CommandDeck.tsx"] },
  // One empty, one loading: "No … yet" copy is an <EmptyState>, a placeholder is .skeleton-block.
  { re: /<p className="[^"]*text-muted-foreground[^"]*">\s*(?:No |Nothing |None |No one )[^<]{0,60}(?:yet|found|match)/, msg: "hand-rolled empty — <EmptyState size=\"compact\" title=… />", exempt: ["src/pages/IosDebug.tsx"] },
  { re: /\b(?:skeleton-shimmer|shimmer-bg)\b|animate-pulse"[^>]*\/>\s*(?:<div[^>]*animate-pulse)/, msg: "another shimmer — .skeleton-block is the loading placeholder" },
  // One haptic vocabulary. The document delegate taps for every button
  // (src/lib/tap-haptics.ts); the app's toast carries the outcome haptic
  // (src/lib/toast.ts); a destructive ConfirmDialog warns as it opens.
  { re: /onClick=\{[^}]{0,160}haptic(?:Impact\("light"\)|Selection\(\))/, msg: "a light tap in onClick — the document delegate taps for every button", exempt: ["src/components/home/CommandDeck.tsx", "src/components/BottomNav.tsx"] },
  { re: /import \{[^}]*\btoast\b[^}]*\} from "sonner"/, msg: "toast from sonner — import { toast } from \"@/lib/toast\" (it carries the outcome haptic)", exempt: ["src/lib/toast.ts", "src/components/ui/sonner.tsx"] },
  { re: /hapticNotification\("(success|error)"\);?[^\n]*\n[^\n]*toast\.\1\(|toast\.(success|error)\([^\n]*\n[^\n]*hapticNotification\("\2"\)/, msg: "outcome haptic next to its toast — the toast already carries it" },
  { re: /animate-reveal|animate-stagger-/, msg: "v1 entrance — use home-rise(-N)" },
  { re: /\btransition-all\b/, msg: "transition-all animates 11 properties and overrides .press — name the ones that move (transition-colors, transition-[width], …)" },
  { re: /document\.body\.style\.overflow/, msg: "body scroll lock is a no-op — use useScrollLock", exempt: ["src/contexts/ScrollContainerContext.tsx"] },
  // Hit areas: a raw small button without a hit-area expansion
  // Newline- and `=>`-tolerant: the old per-line form could not see a
  // <button whose className sat two lines below an onClick arrow, and 13
  // sub-floor buttons shipped through it.
  { re: /<button\b(?:[^>]|=>)*?className=\{?(?:cn\()?\s*["'`][^"'`]*\b(h-([6-9]|10)|w-([6-9]|10)|p-1(\.5)?)\b(?!(?:[^>]|=>)*?(?:min-h-11|before:-inset|min-w-11))/, msg: "sub-44 pt raw button — add min-h-11 / a before:-inset hit area or use <Button>", exempt: [UI, "src/components/StatusHeader.tsx"] },
  // <Button> was invisible to the rule above, and an explicit h-7/h-8 beats the
  // variant's own min-h-9 (cn is twMerge), so these land under even 36 pt.
  { re: /<Button\b(?:[^>]|=>)*?className=\{?(?:cn\()?\s*["'`][^"'`]*\b(h-[3-8]|w-[3-8])\b(?!(?:[^>]|=>)*?(?:min-h-11|before:-inset|min-w-11))/, msg: "sub-44 pt <Button> — an explicit h-7/h-8 beats the variant's min-h-9 (cn is twMerge) and outgrows its before:-inset-1; add min-h-11 or a wider before:-inset",
    exempt: [UI, "src/pages/ButtonGallery.tsx"] },
  // Type scale: 0–27px belongs to the named ladder in tailwind.config.ts.
  // 28px and up is display territory — hero, celebration and share-image
  // sizes are one-offs and stay arbitrary, so the rule stops at 27. The two
  // exemptions render their text into an image that is then scaled down,
  // which is why they may sit below the ladder's floor.
  { re: /text-\[(?:\d|1\d|2[0-7])(?:\.\d+)?px\]/, msg: "hand-written text size — use a rung (text-label/meta/dense/note/read/copy/lead/subhead/head/title/major/beat)",
    exempt: ["src/components/StoryShareModal.tsx", "src/components/feed/DayStatsSticker.tsx"] },
  // Health claims. The app prescribes stretches; it is not licensed to say what
  // they do to tissue, and "flushes lactic acid" is folklore besides. This is
  // the line recovery copy will drift across first: describe the movement and
  // where it is felt, never the physiological outcome.
  //
  // Narrow on purpose. A first draft banned the bare words "flush" and "detox"
  // and hit three innocents — two layout comments where flush means aligned,
  // and the "Digital Detox" quest — which is exactly the rule shape that
  // teaches people to add exemptions instead of to stop. So every pattern here
  // names a claim, not a word. stripComments is on because the rule governs
  // copy, and a comment explaining the ban has to be able to quote it. The two
  // exempt files are auto-generated upstream prose nobody here writes.
  { re: /\blactic acid\b|(?:speeds?|speeding|accelerates?|boosts?)\s+(?:up\s+)?(?:your\s+|muscle\s+)?recovery|repairs?\s+(?:your\s+)?(?:muscle|tissue)|muscle repair|prevents?\s+injur|injury prevention|heals?\s+(?:your\s+)?(?:muscle|tissue)|reduces?\s+(?:muscle\s+)?soreness|flush(?:es|ing)?\s+(?:out\s+)?(?:the\s+)?(?:toxin|lactic|waste)/i,
    msg: "health claim — describe the movement and where it is felt, not what it does to tissue",
    stripComments: true, exempt: ["src/data/exercises-illustrated.ts", "src/data/exercises.ts"] },
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
