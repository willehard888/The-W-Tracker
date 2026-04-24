## Stylized Progressive Streak Flame

A new clean, stylized flame component for the home page streak panel. It grows progressively through 5 visual stages tied to streak days, with smooth scaling, brightening core, expanding aura, and a level-up burst when the user crosses a stage.

### Visual stages (mapped to existing streak tiers)

| Stage | Streak days | Look |
|---|---|---|
| 1 — Tiny flicker | 1–2d | small candle flicker, soft orange |
| 2 — Small steady | 3–6d (Ignited) | small steady flame, warm orange |
| 3 — Medium active | 7–13d (Heating Up) | medium flame, brighter yellow tip, embers appear |
| 4 — Large energetic | 14–29d (On Fire) | tall energetic flame, sparks rising, aura ring visible |
| 5 — Champion blaze | 30–59d (Champion) | large roaring flame, pulsing aura, more particles |
| 6 — Diamond | 60–99d | cool blue edges blend in, brighter white-hot core |
| 7 — Legendary | 100–199d | aurora hue shift, dense particle field |
| 8 — Inferno | 200d+ | plasma core, blinding white-cyan center |

Smooth interpolation: flame size, core brightness, ember count, and aura radius scale **continuously** between stages (not stepped) so a 5d streak looks slightly bigger than a 3d streak — no sudden jumps inside a tier.

### Polish (per the brief)

- **Stage-up burst**: when streak crosses a tier threshold, fire a short burst — circular shockwave ring + 8 ember rays + brief brightness pulse (~700ms).
- **Energy aura**: soft circular gradient halo behind the flame; radius and opacity grow with stage.
- **Glowing core**: gradient from soft orange (stage 1) → yellow-white (stage 4) → white-cyan (stage 8). Subtle blue at the base from stage 4 onward.
- **Particles**: 0 (stage 1) → 14 (stage 8). Rise with slight horizontal drift.
- **Gentle pulse**: subtle brightness pulse at all stages; faster at higher stages.
- **Idle motion**: smooth flicker via SVG turbulence + per-instance seed so it never visibly loops.
- **Reduced motion**: respect `prefers-reduced-motion` — keep silhouette + glow, drop ember/burst animations.

### Where it goes

- Replaces the flame inside `src/components/home/CompactStreakPanel.tsx` (the streak panel rendered by the home page `CommandDeck`). The panel chrome (label, number, tier badge, progress) is kept; only the central flame visual is swapped.
- Other places that use `RealisticFlame` (TribeFireHero, StreakDisplay, etc.) are **not touched**.

### Files

- **New**: `src/components/home/StylizedStreakFlame.tsx` — the new component.
- **New**: keyframes added to `src/index.css` (`stylized-flame-flicker`, `stylized-aura-pulse`, `stylized-stage-burst`, `stylized-ember-rise`).
- **Edit**: `src/components/home/CompactStreakPanel.tsx` — swap the central `RealisticFlame` for `StylizedStreakFlame`, wire the streak number through, keep stage-up detection so the burst fires when crossing a tier.

### Technical notes

- Single SVG with three layered paths (outer body, mid body, white-hot core) plus an `<feTurbulence>` + `<feDisplacementMap>` filter for organic edge motion. Per-instance random seed avoids sync.
- Continuous scaling helpers:
  - `flameHeight = lerp(40, 120, normalizedStage)`
  - `coreBrightness = lerp(0.5, 1, normalizedStage)`
  - `auraRadius = lerp(60, 220, normalizedStage)`
  - `emberCount = round(lerp(0, 14, normalizedStage))`
- Stage-up detection: a `useEffect` watching `streak` derives the current stage; when it increases, sets `burst = true` for ~700ms which adds a one-shot ring + ember-ray group.
- Props: `{ streak: number; size?: number; className?: string }`. Internally derives stage from streak using the existing tier thresholds (kept in sync with `src/lib/streak.ts`).
- GPU-only animations (transform/opacity); SVG filter is small (160% bbox) and only mounted when `size >= 56` to keep list/grid use cheap.

### Out of scope

- No backend changes.
- No changes to streak logic itself — just the visual.
- No new dependencies.
