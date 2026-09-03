---
name: wf-screen-redesign
description: Take one Whealth Factory screen from "assembled" to designer-grade using the exact playbook that shipped the Home, Feed and Tribes redesigns (audit → thesis → recompose → motion grammar → native verify → gates → ship). Use this whenever the founder asks to redesign, uplift, polish, "viimeistele" or "tee sama asia" for any page, screen, view or tab; asks for premium / huipputaso / miljardiluokka / designer-taso / "pois vibecodingista tai AI-slobista"; or names emil kowalski, impeccable or taste for a UI round — in Finnish or English, even when the word "redesign" never appears. Not for adding a feature, fixing a bug, or non-UI work.
---

# WF screen redesign

The founder's bar is "oikea huippu ammattilais designer", not "nicer cards". A screen
reaches it when it has one job, one hero, real type hierarchy, and support that
recedes. Most WF screens started as a stack of same-shaped cards; the work is
diagnosing that and rebuilding the screen around its job while keeping the brand
locked and every feature, data wire and onboarding ref intact.

Work in Finnish with the founder (terse imperatives are his style), in English in
code and copy. Never ask more than one question, and only when the thesis genuinely
forks; otherwise pick and say so.

## 1. Load the three lenses

Invoke `impeccable`, `taste-skill` and `emil-design-eng` first (Skill tool). Then read
`.claude/skills/impeccable/reference/craft-floor.md` right before editing UI. Run
`node .claude/skills/impeccable/scripts/context.mjs --target <file>` once. The lenses
divide the labour: impeccable owns structure and the craft floor, taste owns
anti-slop, Emil owns motion. Do not substitute your own taste for a lens you skipped.

## 2. Capture the incumbent on native, not only in the browser

Boot the app on the iPhone simulator (see §7) and screenshot the target screen in
its real state before touching code. The browser preview lies about proportion (402pt
vs 800px) and about touch (hover states stick, `<Reveal>` is dead on iOS). Save the
"before" mentally as anti-reference: after the redesign, the old look must be evidence
of what not to do, not a thing to polish.

## 3. Audit against the six WF tells

Name each one that applies, with the element:

1. **Card-soup** — three or more sections wearing the same `icon-left → text → chevron`
   surface. The screen has no silhouette variety, so nothing is a hero.
2. **Inverted type hierarchy** — the largest text is a button label; the flagship
   number is an 11px chip.
3. **Accent glut** — gold on more than two elements. Gold is the hero's colour, and it
   only reads as premium when it is scarce.
4. **Redundant chrome** — a title that repeats what the chrome above already says (a
   segment that reads "Feed" above an `<h1>Elite Feed</h1>`), an eyebrow that repeats the
   active tab, identity re-rendered under `StatusHeader` (it already owns avatar, name,
   tier, percentile, streak, Premium pill).
5. **No opening beat, no air** — the first viewport starts with a crammed strip or an
   empty compose box instead of a type moment and a framed hero.
6. **Dead motion** — stagger delays wired to no keyframe, entrances that never play on
   touch, press feedback killed by a finished entrance (see §5).

## 4. Direction contract, then recompose

Write four lines before editing — the founder approves the thesis by default, so state
it, don't ask:

- **Thesis** — the screen's one job in a sentence. Home: *today's ritual*. Feed:
  *proof, the photo is the content*. Tribes: *your fire*.
- **Hero** — the one spectacle. It already exists somewhere (lava CTA, tribe flame,
  proof photo); the job is framing it with air, not inventing a new one.
- **Opening beat** — the type moment above the hero. A `font-display font-black
  text-[27px] leading-[1.04] tracking-tight` line that changes with state (day-0 vs
  returning, 0 vs N locked in). A number inside a sentence is fine; the hero-metric
  template (big number, small label, supporting stats) is not.
- **What recedes** — every support section gets a distinct, quieter silhouette:
  inline standing line, coach whisper, editorial pull-quote, hairline-separated feed
  entries, `surface-card-quiet` rows. Same content, different bodies.

House vocabulary (all in `src/index.css`; do not invent parallel classes):

| Role | Use |
|---|---|
| Hero surface | `surface-card` (only the hero and rare urgent cards keep full weight) |
| Quiet row | `surface-card surface-card-quiet` (quiet must follow in the class list) |
| Feed entry | no box — `py-5` entries inside a `divide-y divide-border/35` list; media frames itself |
| Editorial beat | type-only: hairline rule + display quote + `eyebrow` link line |
| Micro-label | `.eyebrow` is committed brand — at most once per screen, for a date or a status, never as a kicker above a heading |
| Gold | hero + one felt number (`text-gold glow-gold-text tabular-nums`) |
| Ember | anything live: fire, pulse, "lit today", tribe actions |
| Purple / teal / xp-green | kudos / rank delta & verified / approve — leave them |

Preserve on every pass: onboarding spotlight refs (`useSpotlightTarget`), every data
wire and mutation, `role="button"` + `tabIndex` + key handlers on div-cards (real
`<Button>`s inside mean a `<button>` wrapper is invalid DOM), admin tooling, empty and
loading states (rewrite the skeleton to the new silhouette — a stale skeleton is a
layout shift), `contentVisibility` on long lists.

Copy: the product's own voice — "locked in", "proof", "embers waiting". New copy
prefers a period to an em-dash; do not rewrite existing copy just to strip dashes.

## 5. Motion grammar (Emil)

One authored entrance per screen, shared across screens so the app settles the same way
everywhere: `home-rise` on the opening beat, `home-rise home-rise-1..5` on the next
zones (70ms steps), then list stagger with `animate-fade-in-up` and
`animationDelay: base + min(i, cap) * 40–45ms` for the first screenful only.

Rules that were learned the hard way:

- **Entrance goes on a wrapper `<div>`, never on the pressable element.** Both
  keyframes use `fill-mode: both`, so a finished entrance pins `transform` and silently
  kills the element's own `:active` scale (the tribe rows shipped that way for months).
- `.animate-reveal` and `home-rise` play on touch; the `<Reveal>` scroll system is
  disabled on `pointer: coarse`. First-viewport entrance on iOS must not depend on
  `<Reveal>`.
- `commit-pop` on the element the user just committed (a reaction, a tick, a join) —
  it is the app's one "your choice landed" spring; reusing it is what makes the screens
  feel like one product.
- Blur ≤ 5px, entrance ≤ 620ms, transform + opacity + filter only, custom curves from
  `--ease-spring` / `--ease-soft` / `--ease-ios`, reduced-motion falls back to a fade.
- A living ambient (`page-aura-live`, breathing 11s) is allowed once, behind everything,
  and never competes with the hero.

## 6. Verify in bounded passes

1. Gates: `npx tsc --noEmit && node scripts/type-debt.mjs && node scripts/style-guard.mjs && npx vitest run && npm run build`
   (baselines strict 0 / asAny 33 / asNever 3 live in `.type-debt-baseline.json`;
   style-guard bans literal gold/ember hsl triples — use `hsl(var(--gold))`).
2. Detector once, after the UI is written:
   `node .claude/skills/impeccable/scripts/detect.mjs --json <changed files>`.
3. Browser pass on the dev server for runtime errors only (stale-Vite `useAuth must be
   used within AuthProvider` lines are a known artifact; `rm -rf node_modules/.vite`
   and restart clears them).
4. Native: `npx cap copy ios`, then the simulator build tool with workspace
   `ios/App/App.xcworkspace`, scheme `App`, device `iPhone 17 Pro`; launch; walk the
   full scroll and press the hero. Coordinates are points (402×874), roughly screenshot
   px ÷ 2.245. Check both states the opening beat can take.
5. Fix everything one batch shows, confirm with at most one more round, stop polishing.

## 7. Ship and hand off

Commit per screen with an intent-first title (`Feed + Tribes: from card-soup to
proof-led and fire-led screens`), the trailer
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`, and push to
`main` — the TestFlight train runs from the push. Hand off in Finnish, terse: what the
screen now does zone by zone, the one spectacle, gates, and that it is live in the
simulator panel.
