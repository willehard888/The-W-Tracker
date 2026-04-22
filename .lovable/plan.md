

# Premium & Realistic UI Polish

Goal: make the whole app feel like a crafted, physical product — real materials, real lighting, weighted motion. Calmer where it's noisy, richer where it matters.

## 1. Atmosphere & lighting (`src/index.css`)

- **Film grain**: opacity `0.028 → 0.014`, slow shift `0.5s/4 steps → 0.9s/6 steps` so it stops buzzing.
- **Vignette**: soften `0.5 → 0.32`, push edge stop to 115% — corners feel naturally lit, not crushed.
- **Body background**: cut gold ambient ellipse `0.10 → 0.07`, purple `0.10 → 0.06`. Add one warm directional **key light** from top-left (15% intensity) so the whole app reads as lit from a single source.
- **Glow tokens**: `glow-gold` from `0 0 24px / 0.25` + `0 0 80px / 0.08` → `0 0 18px / 0.15` + `0 0 60px / 0.05`. Same proportional cut for purple/teal/rose. Drop the second shadow layer on `glow-gold-text` so numbers stop smearing.

## 2. Material system (new utilities in `index.css`)

Three reusable surfaces — every card on every page can opt in:

- **`.surface-glass`** — frosted: `backdrop-filter: blur(28px) saturate(1.35)`, white 6% top edge, black 18% bottom edge, faint inner highlight 25% from top (simulated bevel).
- **`.surface-metal`** — brushed gold for tier crests/CTAs: layered linear gradient + 0.6px SVG `feTurbulence` noise overlay at 8%.
- **`.surface-paper`** — matte body cards (Coach, Briefing, Tribes feed): subtle vertical gradient + soft inner shadow, no glow.
- **`.light-rake`** — diagonal specular sweep top-left → mid at `white / 0.05`, auto-applied inside `.surface-glass`.

Replace heavy `.card-3d` hover (`translateZ(8px) rotateX(1.5deg)` — feels like a flipping card) with `translateY(-1px)` + softer shadow swap.

## 3. Motion realism

- **Easing tokens**: `--ease-spring: cubic-bezier(0.16, 1.2, 0.32, 1)` and `--ease-soft: cubic-bezier(0.22, 0.61, 0.36, 1)`. Reuse on cards, buttons, dialogs, sheets.
- **Press feel**: button active scale `0.97 → 0.985` (Apple-spec), duration `200ms → 220ms` with `--ease-spring`. Same for nav items.
- **Slow ambient motion**: `caustic-drift` 12s → 18s, `aura-breathe` 5s → 7s — slower motion reads as more expensive.
- **Conic spins**: keep `badge-conic-rim-legendary` only on actual Legendary surfaces. Strip the conic aura from Epic+ cards where it currently leaks.
- **Page transitions**: add a 220ms fade+lift (8px) on route changes via a wrapper around `<Outlet>` using framer-motion AnimatePresence.

## 4. Typography pass

- Body letter-spacing `-0.005em`, `font-display` `-0.015em` — large headers stop looking loose.
- Small labels (≤11px) currently `font-black` (900) → `font-bold` (700) so they stay crisp at retina.
- Reduce text-shadow on `.glow-gold-text` to one layer.

## 5. Core components inherit it for free

- **`ui/card.tsx`** — default `Card` switches `card-3d inner-light` → `surface-glass light-rake`. Every page using `<Card>` upgrades instantly.
- **`ui/button.tsx`** — new press timing. `gold` variant drops `btn-3d` (cartoon hard offset) for flat metallic gradient + 1px inset highlight + 8px soft shadow; on press, highlight shifts 1px down for real "depressed" feedback.
- **`ui/dialog.tsx` / `sheet.tsx` / `drawer.tsx`** — content gets `surface-glass`, overlay opacity `0.8 → 0.62` with a 4px backdrop-blur so background stays alive.
- **`ui/input.tsx` / `textarea.tsx`** — 1px inset top shadow + soft outer shadow on focus instead of the current ring; feels recessed like real glass.
- **`ui/progress.tsx`** — 3-stop metallic fill + 0.5px highlight line on top.

## 6. Chrome

- **`StatusHeader.tsx`** — collapse double background (gradient + radial spotlight) into one `surface-glass` strip. Progress bar `h-1 → h-[3px]` with metallic fill. Tier pills (Apex/Elite/Trial): drop infinite box-shadow keyframe → static `surface-metal` + 6s breathing opacity (less GPU, looks luxurious not alarming).
- **`BottomNav.tsx`** — `surface-glass` + hairline top divider (1px transparent → border/40 → transparent gradient). Active dot `2px → 3px`, drop-shadow `0 0 6px → 0 0 4px`. Press scale `0.92 → 0.96` paired with existing haptic.

## 7. Home page concrete touches

- **`Index.tsx`** — `pageAura` intensity −40%, widen falloff so top isn't a hot spot.
- **`RankProgressHub.tsx`** — identity strip → `surface-glass`; replace strong tier-tinted radial with a soft 12% tint on top-right corner only. Tier crest: remove `0 0 24px` outer glow, add real specular (1px white inner top, 1px black inner bottom) — looks like enameled metal.
- **`CommandDeck.tsx`** — align surfaces with new tokens, drop competing glows.
- **`RealisticFlame.tsx`** — keep as-is (already shipped realistic).

## Out of scope

- No DB / RLS / edge function changes
- No layout restructuring — only material, motion, light, typography
- Onboarding, Paywall, Splash kept at current cinematic intensity (one-time moments allowed to be loud)

## Files touched

- `src/index.css` — atmosphere, surface utilities, easing tokens, glow & type tuning
- `src/components/ui/{card,button,dialog,sheet,drawer,input,textarea,progress}.tsx`
- `src/components/StatusHeader.tsx`, `src/components/BottomNav.tsx`
- `src/App.tsx` — page transition wrapper
- `src/pages/Index.tsx`, `src/components/home/RankProgressHub.tsx`, `src/components/home/CommandDeck.tsx`

Because `Card`, `Button`, dialogs, inputs, and global tokens are reused everywhere, every other page (Profile, Leaderboard, Tribes, Coach, Feed, Battles, Messages, Paywall) inherits the polish without direct edits.

