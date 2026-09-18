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

- **Example day:** three cards (SLEEP, TRAINING, FUEL) with a visible "An
  example day" caption. The numbers count up on entrance.
- **Streak:** a filled gold→ember flame with a white-hot core. The count
  scrubs 1 → 30 while the section is pinned at centre on wide screens.
  Reduced-motion visitors see 30.
- **Tiers:** app-coloured pills climb as a stair, Recruit up to Legend. They
  light one by one as you scroll past.
- **Inside:** one grouped list with hairline rows, like the app's Library card.
- **Arrival:** 14 days, no card, and the App Store badge.
- **Company footer:** legal name, business ID, address and email, plus Terms,
  Privacy and Support.

## Performance rules

The site shipped once with a lag the founder saw.

- No `mix-blend-mode` and no `backdrop-filter`.
- Animated elements that carry blur or shadow get `will-change: transform`,
  and move by transform only.
- No per-frame gradients or layout reads in the canvas loop. Geometry is
  measured on resize.
- Infinite loops pause off-screen: the forge via IntersectionObserver, the
  flame via ScrollTrigger `toggleActions`.

## Copy

It hooks and stays true. Every claim is on PRODUCT.md's capability list.
- The action line is "Coming to the App Store". There is no email capture.
- The founder chose the headline "Join the movement.".
- "Never buy" was struck by the founder.

## Hosting

`scripts/build-site.mjs` copies `site/` to the Vercel root, skipping `.md`
files and dot-folders. The React shell becomes `app.html` and serves only
`/privacy`, `/terms` and `/reset-password`.
