

# Plan: Wind-driven flames, tribe firestorm, and "Inferno" next-level streak

Take the flame system to its next stage: real environmental wind, a tribe **firestorm** mode, and a brand-new **Inferno** streak tier (200d+) that breaks the visual ceiling of Legendary.

## 1. Wind dynamics — flames react to a virtual breeze

Right now every flame sways the same. Upgrade it so the entire app shares a slow, evolving "wind state" that flames lean into.

- **New module** `src/lib/wind.ts`: a tiny store that emits a wind vector `{x, gust, ts}` that drifts via a sine + noise function and occasionally produces a "gust" spike (every 8–14s). Pure JS, no dependency, single `requestAnimationFrame` driver shared across all flames via a context.
- **New hook** `useWind()` returns the current wind value (throttled to ~12fps for cheap re-renders) — but most of the work is a CSS variable broadcast on `<html>` (`--wind-x`, `--wind-gust`) so flames can react via CSS only, no React re-renders.
- **`RealisticFlame.tsx`**: replaces the fixed `flame-wind-sway` with a transform that reads `--wind-x` for lean and `--wind-gust` for momentary stretch. Outer haze layer also drifts with the wind direction (more drift = more drag on the silhouette).
- **`StreakFlameInline.tsx`**: cheap version — only picks up `--wind-gust` to add a tiny flicker burst. Still CSS-only.
- **Gust trigger**: optional API `triggerGust(strength)` callable on key moments — check-in success, badge unlock, tribe battle won — every flame on screen visibly bends and recovers. Hooked into `DailyCheckin` success and `BadgeUnlockModal` open.

## 2. Inferno — the new top tier (200+ days)

Open daylight above Legendary. Right now Legendary (100d) is the ceiling and feels final. New tier:

- **Inferno** (≥ 200 days) — a sixth flame index `tier = 6`.
- Visual identity: deep magenta-to-cyan core ("plasma"), a second counter-rotating flame body (so the flame visibly *spirals*), continuous spark rain, and a slow lightning arc that crackles inside the flame every 6–9s.
- Files updated:
  - `src/lib/streak.ts` — add `Inferno` tier classification.
  - `src/components/StreakDisplay.tsx` — new tier card style + "Inferno" title + plasma palette.
  - `src/components/StreakFlameInline.tsx` — inline plasma palette + arcing animation.
  - `src/components/home/RealisticFlame.tsx` — new tier-6 branch: plasma colors, second mirrored flame body with reverse turbulence, internal lightning SVG `<path>` animated via `pathLength` strokeDashoffset.
  - `src/index.css` — new keyframes `flame-plasma-spiral`, `flame-lightning-crack`, `flame-plasma-hue`.

## 3. Tribe Firestorm — collective ceiling expansion

Tribes have been waiting for the same expansion. The collective flame currently caps at "Legendary" (3000 combined days). Add a **Firestorm** tier above it.

- `src/lib/tribe-streak.ts`: add `Firestorm` (≥ 6000 combined days), tier 6, accent `hsl(195 90% 60%)` → `hsl(310 80% 60%)` gradient.
- `src/components/TribeCollectiveFlame.tsx`:
  - Bump max size to **190px**.
  - Firestorm wraps the flame in a **dual-flame composite**: a primary plasma flame plus a smaller satellite flame circling around the base via a slow orbital animation (visualises "many flames feeding one").
  - Replaces the static aurora rim with an **animated lightning border** that arcs around the card every ~5s.
  - "Firestorm" tier label gets its own pill style with hue-shifting plasma gradient.
- `src/pages/TribeDetail.tsx`: when a tribe is in Firestorm, the page background tint dials up (heavier accent radial), and a thin top-of-screen lightning rim line appears (using the existing `flame-rim-pulse` keyframe at higher intensity).

## 4. Tribe — "Live members" feeding the flame

Make the tribe flame react to *who is online right now* — concrete wind-and-feed mechanic.

- New realtime presence channel `tribe-presence:{tribeId}` (Supabase Realtime, no DB writes) — already part of the project's stack.
- `TribeCollectiveFlame` listens and shows **per-active-member ember sprites** rising into the flame from below at a rate proportional to live member count. When a member checks in (`tribe_checkin_today` event broadcast from `DailyCheckin`), their ember briefly intensifies and the flame fires a gust.
- Cap visible embers at 12 to keep performance safe.

## 5. Performance & accessibility

- All wind work is CSS-variable driven; one shared rAF loop, no per-flame timers.
- Inferno + Firestorm extras (lightning, second body, orbital satellite) only render when `prefers-reduced-motion: no-preference` and only inside hero instances (RealisticFlame ≥ 64px).
- StreakFlameInline stays CSS-only — Inferno just gets a static plasma gradient + slow hue shift, no SVG.
- Single `tribe-presence` channel per route mount, cleaned up on unmount.

## Files touched

- `src/lib/wind.ts` (new)
- `src/contexts/WindProvider.tsx` (new — mounts the rAF loop, sets CSS vars on `<html>`)
- `src/App.tsx` (wrap tree in `WindProvider`)
- `src/lib/streak.ts` (Inferno tier classifier)
- `src/lib/tribe-streak.ts` (Firestorm tier + accent)
- `src/components/home/RealisticFlame.tsx` (wind reactivity, tier 6 branch, lightning, mirrored body)
- `src/components/StreakFlameInline.tsx` (wind gust pickup, plasma tier 6)
- `src/components/StreakDisplay.tsx` (Inferno tier styles)
- `src/components/TribeCollectiveFlame.tsx` (Firestorm visuals, presence embers, gust on tribe check-in)
- `src/pages/TribeDetail.tsx` (Firestorm page tint + lightning rim)
- `src/pages/DailyCheckin.tsx` (call `triggerGust()` on success)
- `src/components/BadgeUnlockModal.tsx` (call `triggerGust()` on open)
- `src/index.css` (new keyframes: plasma spiral, lightning crack, plasma hue, orbital satellite)
- `.lovable/memory/features/streak-system.md` (note Inferno tier)
- `.lovable/memory/style/visual-effects.md` (note wind system + Firestorm)

## Notes

- No DB migration needed: tier classification is pure client-side derived from `streak` and `collective_streak`.
- Existing badges (`personal_streak ≥ 100`, `tribe_collective_streak ≥ 180`) are unaffected — Inferno/Firestorm are visual-only ceilings; we can later add `streak ≥ 200` and `collective ≥ 6000` badges in a follow-up.
- Wind module exposes a simple `triggerGust(strength)` so future features (level-up, tribe battle win) can trigger the same effect.

