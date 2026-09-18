# DESIGN — whealthfactory.com

The public website only. The iPhone app has its own system in `src/index.css`
and `tailwind.config.ts`; nothing here applies to it. Written from the built
site on 2026-09-18 (impeccable comp-led build, approved comp
`.impeccable/mocks/comp-1-object.png`, finish review: fix, applied).

## World

A luxury manufacture. Black is the room, one gold is the only metal, and the
polished W is the one object on the page. Everything else is type and gold
hairlines. No cards, no gradients as decoration, no grain, no glass, no icons.

## Tokens (`site.css` `:root`)

| Token | Value | Use |
|---|---|---|
| `--ground` | `#080808` | every surface; the plate's darker black blends into it |
| `--ivory` | `#ede8df` | headings, labels, primary text |
| `--stone` | `#a19c93` | body and ledes (≥ 7:1 on ground) |
| `--dust` | `#8c877e` | fine print only (≥ 5:1) |
| `--gold` | `#e1ac3e` | the action line, times, Legend, focus ring, selection |
| `--gold-deep` | `#af7718` | hairlines under gold text, dial rings |
| `--line` / `--line-soft` | gold-deep at 0.55 / 0.28 | section rules, row dividers |
| `--gutter` | `clamp(20px, 2.6vw, 40px)` | the only side inset |

## Type

- **Cormorant Garamond 300** (`--serif`, `fonts/cormorant-garamond-300-latin.woff2`):
  every heading, the hero, the tier stair and the rows. Always uppercase,
  tracking 0.04–0.06em. The founder chose it over the comp's hairline sans.
- **Archivo variable** (`--display`, `fonts/archivo-var-latin.woff2`):
  small labels only. Uppercase, weight 400–500, stretch 100–112%, tracking
  0.24–0.34em. This one voice covers the masthead, the action line, the fold
  line, the dial times and the footer links.
- **Inter** (`/fonts/inter-var-latin.woff2`, shared with the app's public
  folder): body copy, 16–19px, measure ≤ 58ch.

## Raster

- `media/w-object.jpg` is the W on its mirror floor, 1024². It is placed with
  `mix-blend-mode: lighten` on its group, so the plate's black gives way to the
  ground. A mask fades the reflection from 56% to 88% so it passes behind the
  headline.
- `media/w-mark.png` is the W body cut from that plate (160×104). It is used for
  the masthead mark and the dial medallion.
- Both carry their generation prompt (`embed-prompt.mjs --read`).

## Composition

- **Hero:** the W is centred at 46vw. `JOIN THE MOVEMENT.` sits on one line
  over the lower reflection. Below it come one sentence of body, then
  `COMING TO THE APP STORE` in gold over a gold hairline (not a button until
  launch day), then the fold line.
- **The day:** the copy and four marks sit left and a gold hairline dial sits
  right, with 24 hours of ticks and the four times inside the ring. On wide
  screens the stage pins at centre and fits a 768px-tall screen. On narrow
  screens and upright tablets the dial is sticky above the list.
- **Status:** the seven tiers as a rising stair. `column-reverse` draws the
  climb while the DOM reads from Recruit up to Legend, which is gold.
- **The house:** hairline rows, the name left and what it does right.
- **Arrival:** a centred heading, one line, and the action line again.
- **Company:** the legal name, business ID, address and email, plus Terms,
  Privacy and Support. Apple's organization check depends on this footer.

## Motion (`site.js`, GSAP 3.13 + ScrollTrigger)

There is one authored entrance, one light and one scroll signature. Nothing
else moves.

- **Entrance:** the W rises (2.2s, expo.out), then the words lift out of their
  clip (1.5s, 0.14s stagger), then the rest fades in. `html.motion` hides the
  start state only when the script will run, and a 2.5s fallback in `<head>`
  shows the page if it never does.
- **Light:** `.w-beam` crosses the gold by transform, with `color-dodge` on
  black, every 9s.
- **Signature:** the dial hand travels 06:30 → 21:00 with the scroll, resting
  at each mark, and the mark it points at is the one at full opacity.
- **Reduced motion:** everything is static, with all four marks at full
  opacity.

## Rules

- Gold appears only on the W and on hairlines, plus five text roles: the action
  line, times, Legend, focus and selection.
- There are no eyebrows above headings and no section numbers.
- Only the company footer states facts. Every product claim comes from
  PRODUCT.md's confirmed list.
- `site/` is copied to the root of the Vercel build by `scripts/build-site.mjs`,
  and `.md` files are skipped. The React shell serves only `/privacy`,
  `/terms` and `/reset-password` as `app.html`.
