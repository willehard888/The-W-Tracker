# DESIGN — whealthfactory.com

This covers only the public website. It uses the app's own design system:
tokens from `src/index.css`, fonts from `public/fonts`, icons from lucide. So
the site should look like the app, and nothing here overrides the app.

It was rebuilt on 2026-09-18 (round 2). Round 1, a black-and-gold luxury page,
was rejected: "typografia ei täsmää, tee apin mukainen". The approved comp is
`.impeccable/mocks/r2-comp-3-lockin.png`.

## World

This is the app at page scale. The one spectacle is the app's LOCK IN control,
and it is playable. Everything else is the app's calm chrome: plum-black
ground, gold for numbers and labels, ember orange only for things that are
live, and Space Grotesk capitals.

## Tokens (`site.css` `:root`, copied from the app)

| Token | Value |
|---|---|
| `--bg` | `hsl(258 20% 1.8%)` |
| `--card` / `--border` | `hsl(258 16% 8%)` / `hsl(258 13% 21%)` |
| `--fg` / `--muted` | `hsl(40 8% 94%)` / `hsl(40 6% 72%)` |
| `--gold` (+ light, dark) | `hsl(42 78% 54%)` |
| `--ember` (+ light) | `hsl(18 95% 58%)` |

## Type

- **Space Grotesk 700:** all headlines, labels and the control. Uppercase, with
  tracking from −0.025em to 0.08em depending on size.
- **Inter:** body text.
- Both fonts come from `/fonts/` (`public/fonts`), shared with the app.

## The control (`.lockin`)

- **Recipe:** it uses the app's layers from `CommandDeck.tsx`, scaled in em
  from one custom property (`--bw`, width; `--u` = `--bw` / 10).
  - The face: a gold→ember gradient with inner highlights, plus the idle gloss.
  - A molten rim and an ember slab beneath it, which make three plates.
  - The melt: the lava slab, crest, magma layers and white-hot line. It runs
    only while held.
  - The hover specular: a blob moved by transform.
- **Press and hold** (900 ms, the melt's rise time):
  - It melts, then shows LOCKED IN with a check and a spark burst.
  - The line under it updates. The lava cools after 1.4 s.
  - Keyboard: hold Enter or Space. Assistive-tech click commits directly.
  - `aria-describedby` points at the visible "Press and hold" hint.
- **Forge:** one canvas around the control only (`.forge`), at DPR ≤ 1.5,
  stopped off-screen and when the tab is hidden.
  - Spark streaks come off its sides.
  - Five drips hang from the slab's lower edge with a wide root, a thin neck
    and a heavy bead, and land in small splashes.
  - Nothing is drawn over the gold face, where it would read as dust.

## Sections

Every section opens eyebrow → display → lede (`.eyebrow`, `.display`, `.lede`
on the `--t-*` scale), left-aligned; the hero and the arrival are centred.
Two-column sections alternate the copy's side on wide screens and stack on
narrow. The app's surface (`.surface`) is the one material: plum on a gold
wash, hairline, inner light, soft drop; radius 24 for surfaces, 16 for tiles,
999 for pills. Hairline gold dividers between sections.

- **Masthead:** sticky, solid plum (never a backdrop blur), the section links
  on wide screens (Day · Streak · Rank · Coach · Inside · Get it).
- **The day (`#day`):** the app's check-in summary at page scale — seven
  lines (Training 50 · Sleep 24 · Steps 9 · Mind 15 · Water 15 · Habits 25 ·
  Perfect day 10 = 148 / 150) with the Apple Health shield on the four lines
  Health scored, bars that fill left → right as the section arrives. The
  numbers are XP v3's (`src/lib/checkin-xp.ts`) and the only numbers the
  page may state.
- **Streak (`#streak`):** the flame grows and the count runs 1 → 30 over two
  seconds once the section arrives; a CSS flicker runs only while it is on
  screen. It was pinned and scrubbed to the scroll before, which trailed the
  thumb on phones.
- **The board (`#rank`):** 28 squares (25 lit, 3 missed) light in sequence,
  then "Rating 92 · of 150 · the 28-day average"; then the tiers, lighting one
  by one on arrival.
- **The coach (`#coach`):** a morning brief in the surface — Yesterday /
  Tonight / Tomorrow, three lines that rise in sequence. No typing effect.
- **Inside (`#inside`):** the six rows, each a fact line from PRODUCT.md. A
  list, not doors: no chevrons, no hover.
- **Arrival (`#arrival`):** 14 days free, then 8,99 € / month or 89,99 € /
  year through Apple; the App Store badge; six `<details>` questions (also as
  FAQPage JSON-LD).
- **Company footer:** legal name, business ID, address and email, plus Terms,
  Privacy and Support.

Not done, on purpose: pictures of the app (founder, 2026-09-25), a founder
note, testimonials, member counts, glass panels, gradient text, floating
shapes, three-icon-card grids, counters that tick for their own sake.

## Performance rules

The site shipped once with a lag the founder saw, and again with a streak
that trailed the scroll.

- No `mix-blend-mode`, no `backdrop-filter`, no libraries: site.js is the
  forge, the hold, the tilt (a settling lerp) and one IntersectionObserver.
- The entrance is CSS from the first paint; nothing waits for a script.
- Reveals are one verb — rise 12 px and fade, 0.9 s ease-out, staggered
  60–130 ms — as CSS transitions on `.in`, which the observer adds once per
  group (`[data-reveal-group]`, the streak, the tiers). Without `.motion`
  (reduced motion) the final state is the only state; if site.js never
  arrives, the inline script reveals everything at 4 s.
- Nothing is scrubbed to the scroll and nothing is pinned.
- Animated elements that carry blur or shadow get `will-change: transform`
  and move by transform only. Off-screen sections are
  `content-visibility: auto`.
- No per-frame gradients or layout reads in the canvas loop. Geometry is
  measured on resize.
- Infinite loops pause off-screen: the forge via IntersectionObserver, the
  flame's flicker via `.live`, the parked lava via `visibility: hidden`.
- Measure before shipping: `npx lighthouse@12` (mobile) ≥ 95 and the
  puppeteer probe (16.7 ms frames idle and scrolling at CPU ×4).

## Copy

It hooks and stays true. Every claim is on PRODUCT.md's capability list.
- The action line is "Coming to the App Store". There is no email capture.
- The founder chose the headline "Join the movement.".
- "Never buy" was struck by the founder.

## Hosting

`scripts/build-site.mjs` copies `site/` to the Vercel root, skipping `.md`
files and dot-folders. The React shell becomes `app.html` and serves only
`/privacy`, `/terms` and `/reset-password`.
