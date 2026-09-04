---
name: release-qa
description: The W Tracker shipping standard — run this before EVERY push to main, and whenever the user says "shippaa", "pushaa", "aja portit", or asks whether a change is ready to ship. Encodes the hard gate chain, visual verification, the accessibility floor, and the TestFlight build-number handoff. Also consult it when writing any new UI so the change passes QA on the first try.
---

# Release QA — the shipping standard

Every push to main triggers a Codemagic iOS build that lands on the founder's
phone. A broken or half-verified push wastes a build slot and the founder's
trust. This skill exists because each rule below was learned the hard way.

## 1. Gates — one `&&` chain, push is impossible if anything fails

Run from the repo root as ONE command (never `;`-separated — a `;` once let a
broken build reach CI):

```bash
npx tsc -p tsconfig.app.json --noEmit && node scripts/type-debt.mjs && node scripts/style-guard.mjs && npx vitest run && npm run build
```

Only after every gate is green: commit → push → wait for GitHub CI
(`gh run list --json headSha,status,conclusion` loop on the pushed SHA).

Gate notes:
- **type-debt** is a ratchet (strict errors / asAny counts must not rise).
  Deletions may lower it — update the baseline with `--update` only then.
- **style-guard** bans specific literal colors; use new hsl values that don't
  match its regexes.
- **Coverage ratchet**: any NEW file in `src/lib/` or `src/data/` needs tests
  in the same push or vitest coverage fails.
- A strictError count that suddenly collapses (e.g. 41 → 1) means the strict
  sweep crashed mid-compile, not that debt vanished — treat it as a failure.

## 2. Known build traps

- **JSX comments inside ternary parens** (`{cond ? ( {/* … */} <div` ) break
  esbuild even when `tsc` passes. Prefer `//` comments outside JSX, and when
  a ternary is edited, confirm `npm run build` — tsc alone is not proof.
- Tailwind arbitrary values sometimes fail to compile silently
  (`duration-[460ms]`, `ease-[cubic-bezier(...)]`). If a timing or one-off
  value matters, put it in an inline `style` or a named class in
  `src/index.css`, and verify the computed style in the preview.

## 3. Visual verification — before the push, not after

Any change the browser can render must be seen before it ships:
1. Preview at `http://localhost:8080` (dev server; QA account, never the
   founder's). Verify the changed state AND the idle state.
2. For press/animation states the screenshot can't catch, force the state
   (clone `:active` rules onto a class, or set styles via JS) or sample
   computed styles on a timeline.
3. Never ask the founder to check something you could verify yourself.

## 4. Accessibility floor (from the 2026-08-26 audit — don't regress it)

New or edited UI must hold the line the audit established:
- Tap targets ≥ 44 pt. The global CSS floor covers unsized `<button>`s;
  anything with an explicit `h-*`/`size-*` class escapes it — give small
  visuals an expanded hit area (`before:absolute before:-inset-2
  before:content-['']`).
- Icon-only controls carry `aria-label`; decorative icons next to text carry
  `aria-hidden`; toggles carry `aria-pressed`; meaningful state is never
  color-only (pair with an icon, text, or aria state).
- Muted text: `text-muted-foreground/75` is the floor — never `/40–/65`.
- Every new infinite animation gets a `prefers-reduced-motion` guard
  (named class in the guard blocks of `src/index.css`; framer-motion loops
  need `useReducedMotion()` — CSS media queries don't reach JS animations).
- Never nest interactive elements. For a chip inside a tappable strip, use
  the overlay-button pattern (strip-wide `<button className="absolute
  inset-0">` under `pointer-events-none` content, chip as a sibling button)
  — see `src/pages/Index.tsx` rank strip for the reference implementation.

## 5. Process rules (founder-set, non-negotiable)

- Targeted fixes to what the founder pointed at. Sweeping multi-page
  rewrites need per-page approval BEFORE coding.
- Batch related fixes into ONE push — every push burns a Codemagic build.
- Brand is locked: dark plum ground, gold/ember accents, font-display black
  uppercase. Design-tool output never overrides it.
- QA hygiene: test only with QA accounts, never submit check-ins or post
  content that lands on founder-visible surfaces; sign out before deleting
  a QA account.

## 6. Commit and handoff

- Commit message: what changed and WHY (the founder's ask), then trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- After CI is green, give the founder the TestFlight build threshold:
  the build number is minutes since 2026-01-01 UTC —
  `echo $(( ($(date -u +%s) - $(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "2026-01-01T00:00:00Z" +%s)) / 60 ))`
  — "uusin buildi kun numero ≥ N". iOS pipeline is Codemagic ONLY; if a
  build error mentions Xcode Cloud step names, it's the wrong pipeline.
