

# Plan: Flame as the Soul of the App — Cinematic Upgrade + Theme Cohesion

Make the flame the unifying visual signature of the app. Deepen realism dramatically, and let the flame's energy bleed into surfaces, headers, navigation, and tribe identity.

## 1. RealisticFlame v2 — true depth & life

Rewrite `src/components/home/RealisticFlame.tsx` and the supporting keyframes in `src/index.css` to add real volumetric depth instead of flat stacked silhouettes:

- **8 layers instead of 5**: deep haze → outer aura → outer flame → mid body → inner body → core → white-hot tip → spark crown. Each with its own rhythm, hue rotation, and skew so the silhouette never looks symmetric.
- **Per-layer turbulence**: 3 different `feTurbulence` filters (slow drift / mid licking / fast tip whip) so layers warp independently — the flame visibly *breathes* and *snaps*.
- **Dynamic side lick**: a horizontal sway driven by a slow sine animation on the wrapper, so the whole flame leans like wind is on it.
- **Hot wick base**: a bright wick line + glowing ember plate at the bottom — gives the flame a believable origin point.
- **Volumetric backlight**: a tier-tinted radial bloom *behind* the flame (mix-blend screen) so it actually lights its surroundings.
- **Improved sparks**: arc trajectories (curved, not linear) using two-stage `--spark-x`/`--spark-y` keyframes; sparks fade with a tail (box-shadow trail).
- **Smoke**: from Blazing+ — slow ribboning wisps, drifting sideways with `rotate` + `blur` ramp, dissolving high above the flame.
- **Tier-driven cinematic palette**: deeper blue base for Diamond, magenta-violet aura for Legendary, with subtle hue-rotate animation across the spectrum so Legendary flames shimmer like an aurora.
- Keeps the lightweight `StreakFlameInline` for lists (no SVG turbulence in long lists — performance preserved).

## 2. StreakFlameInline polish (lists, kept fast)

In `src/components/StreakFlameInline.tsx` add (CSS only, still 60fps):
- Subtle rim-light gradient on the outer body.
- A second tiny inner-tip element for "fork" feel.
- Per-tier hue-shift keyframe (very slow) so Diamond/Legendary inline flames glimmer.
- Shadow trail under the count number for hot tiers.

## 3. Flame-themed app surfaces (the "theme" upgrade)

In `src/index.css`:
- Add `.surface-ember` and `.surface-aurora` utility classes — opaque (no backdrop blur) but with multi-layered ember-glow gradients suitable for hero/empty states.
- Add ambient `body::after` ember radial that very slowly drifts — gives every page a subtle "fire in the distance" warmth without animation cost.
- New keyframes: `ember-drift`, `aurora-shift`, `flame-rim-pulse`.

Apply to:
- `src/pages/Index.tsx` home hero strip (top of feed) — ember glow band behind the W logo.
- `src/components/StatusHeader.tsx` — adds a thin `flame-rim-pulse` line under the header when user has streak ≥ 7.
- `src/components/BottomNav.tsx` — active tab gets a small ember underline that pulses with user's tier color.

## 4. Tribe flame: dramatically stronger

`src/components/TribeCollectiveFlame.tsx`:
- Bump max size from 120 → **160px**, scale curve more aggressive (Legendary tribes feel monumental).
- Wrap in a true "fireplace" frame: stacked radial bloom behind, ember-drift particles on the sides, and a thin aurora rim border that pulses at the tribe's tier accent.
- Add a small live "+X today" delta chip (members who checked in today) sitting beside the flame.
- Add a stat row underneath with mini segmented bars showing the collective streak's progress to the next tier.

`src/pages/TribeDetail.tsx`:
- Promote the collective flame to a full hero card at the very top, replacing the small header strip.
- Background of the page subtly tints toward the tribe tier color (uses `collectiveAccent`).

`src/pages/Tribes.tsx` browse list:
- Each tribe row gets a subtle left edge "ember bar" sized to its collective streak (visible heat ladder when scanning the list).
- Featured tribe card gets a real hero `RealisticFlame` (size 64) instead of the inline version.

`src/components/TribeBattleCard.tsx`:
- Replace inline flames with proper `RealisticFlame` (size ~40) per side, on opaque ember mini-cards. The "Bigger flame" badge becomes an animated aurora pill.

## 5. Splash screen — extend the ignite story

`src/components/SplashScreen.tsx`:
- Replace the hand-rolled clip-path flame with a real `RealisticFlame` (tier 5, size 96) that fades + scales in *behind* the logo from ember → blazing.
- Logo wordmark gets a one-time gold→ember sweep gradient on settle.

## 6. Performance guardrails

- Hero `RealisticFlame` continues to use SVG turbulence — but only one instance is ever mounted at a time per route (home hero, tribe hero, splash, battle card).
- Lists keep `StreakFlameInline` (CSS only).
- Add `prefers-reduced-motion` overrides so all new keyframes resolve to a static state.
- All new gradients are opaque — no `backdrop-filter`.

## Technical files touched

- `src/components/home/RealisticFlame.tsx` (rewrite)
- `src/components/StreakFlameInline.tsx` (polish)
- `src/components/TribeCollectiveFlame.tsx` (rewrite hero)
- `src/components/TribeBattleCard.tsx` (use RealisticFlame)
- `src/components/SplashScreen.tsx` (use RealisticFlame)
- `src/components/StatusHeader.tsx` (rim pulse)
- `src/components/BottomNav.tsx` (ember underline)
- `src/pages/Index.tsx` (hero ember band)
- `src/pages/Tribes.tsx` (left edge ember bars + featured hero flame)
- `src/pages/TribeDetail.tsx` (promote hero flame, page accent tint)
- `src/index.css` (8-layer keyframes, ember/aurora utilities, new ambient)
- `.lovable/memory/style/visual-effects.md` (note flame as theme signature)

