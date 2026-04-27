# Streak → Fire Emotion System

The flame engine (`StylizedStreakFlame.tsx`) is already cinematic: 14-layer parallax, 3 turbulence filters, idle breath, pointer/gust/scroll/tilt reactivity, hero core, ember bed, floor pool, heat haze, snap-back release. **We do not rewrite it.** We add the missing emotional layer: a strict **streak → state machine** that makes the fire instantly readable as a status mirror, plus three "wow moment" sequences and a decay state that makes losing the streak feel like loss.

## What's missing today

- Stages exist (`STAGE_THRESHOLDS = [1,3,7,14,30,60,100,200]`) but each stage is *more of the same* — there's no qualitative shift between them.
- No "streak maintained today" daily-pulse animation.
- No milestone burst (7/30/100/200).
- No "streak at risk" or "streak lost" state — the fire just shrinks.
- Idle behavior is uniform; doesn't communicate streak strength when no one is touching.

## 1. Streak state machine (single source of truth)

New file `src/lib/flame-streak-state.ts` exports:

```text
type FlameState =
  | "ember"        // 0 days   — fragile, almost dead
  | "kindling"     // 1–3      — unstable, irregular
  | "lit"          // 4–6      — small steady
  | "steady"       // 7–13     — confident
  | "strong"       // 14–29    — large, smooth
  | "roaring"      // 30–59    — dense, sparks active
  | "elite"        // 60–99    — controlled power, ambient light
  | "legend"       // 100+     — heavy, slow, environment-affecting

type FlameMood = "healthy" | "at-risk" | "broken"
  // at-risk: streak alive but >18h since last check-in (deadline 24h)
  // broken : streak ended (transient state, ~3s after detection, then ember)
```

Each state has a **personality profile** (not just size):

```text
ember      flicker=0.95 sway=0.20 breath=0.35 bodyOpacity=0.35 sparks=0   tier=cold
kindling   flicker=0.85 sway=0.55 breath=0.55 bodyOpacity=0.62 sparks=0   tier=warm
lit        flicker=0.55 sway=0.40 breath=0.50 bodyOpacity=0.78 sparks=0   tier=warm
steady     flicker=0.40 sway=0.35 breath=0.55 bodyOpacity=0.88 sparks=1/8s
strong     flicker=0.30 sway=0.30 breath=0.65 bodyOpacity=0.94 sparks=1/5s
roaring    flicker=0.25 sway=0.32 breath=0.75 bodyOpacity=1.00 sparks=1/3s
elite      flicker=0.18 sway=0.22 breath=0.85 bodyOpacity=1.00 sparks=1/2s + ambient pool
legend     flicker=0.14 sway=0.18 breath=1.00 bodyOpacity=1.00 sparks=2/2s + slow embers + env light
```

Read: low streaks are **erratic**, high streaks are **calm power**. This is the core readability — you can tell within 200ms.

## 2. State-driven CSS variables (zero rerenders)

`StylizedStreakFlame` writes 4 new vars on the container:

```text
--ssf-flicker     0..1   amplitude of flicker keyframes
--ssf-sway        0..1   amplitude of sway keyframes
--ssf-breath      0..1   amplitude of breath keyframes
--ssf-body-alpha  0..1   global flame opacity multiplier
```

Existing keyframes (`stylized-flame-flicker-1/2/3`, `-sway-1/2/3`, `-bob`) get refactored to multiply their delta by these vars (e.g. `transform: scale(calc(1 + 0.06 * var(--ssf-flicker, 1)))`). One change, all 14 layers respond. No rerender.

## 3. Decay / risk / loss states

- **`at-risk`** (>18h since checkin):
  - `flicker` × 1.6, `sway` × 0.6 (unstable but smaller)
  - sub-100ms erratic micro-dimming via new keyframe `stylized-flame-anxious` (opacity 1 → 0.78 → 1 → 0.85 random-feel)
  - hero hue shifts −6° toward red (cooler, sicker)
- **`broken`** (transient ~2.4s when streak resets):
  - 0–600ms: rapid inward collapse (height → 30%, opacity → 0.4)
  - 600–1400ms: 6 dim cinder sparks fall outward, no upward flame
  - 1400–2400ms: fade to bare ember bed glow
  - then settles into `ember` state
  - one-shot, driven by `prevStreakRef` going N→0

## 4. Wow moments

### A. Daily streak maintained (220ms surge)
- Trigger: streak count increments while component is mounted.
- Sequence:
  - 0ms     hero scaleY 1.00 → 1.18
  - 90ms    brightness +35%, saturate +20%
  - 150ms   2 gold sparks emit upward from bed
  - 220ms   ease back to baseline
- Reuses existing `triggerFlameShockwave` infra + `setBlastSparks`.
- Single haptic `Haptics.impact({style: ImpactStyle.Light})` (already in `src/lib/haptics.ts`).

### B. Milestone (7/30/100/200) — full celebration (1.4s)
- 0–200ms: flame compresses (scaleY 0.85), brightness drops to 0.7 → wind-up.
- 200–500ms: explosive expand to 1.35×, bloom +60%, hero pathIndex shifts to a wider variant for 1 cycle.
- 500–900ms: 14 radial sparks (existing `blastSparks` with stronger dist + larger size).
- 900–1400ms: gentle settle back, hue cycles +12° gold for 1 breath.
- Two haptics: `Light` at 200ms, `Heavy` at 500ms.
- Optional (cheap): one-shot `<ConfettiBurst>` only on 30/100/200 — already exists.

### C. Streak loss (already detailed above as `broken` state)
- Crucially **silent** — no haptic, no sound. Loss feels like absence.

## 5. Tap / pointer rules (refine existing)

Already wired. Refinements only:
- Tap on `ember` state has no flare (it's "almost dead" — tapping doesn't revive it visually; only checking in does).
- Tap on `at-risk` adds extra flicker to spike rather than calm.
- Tap on `legend` has the lowest blast amplitude (the fire is *unbothered* — communicates mastery).

## 6. Ambient / environment light (elite + legend only)

- New optional prop `emitAmbient` (default true).
- When state ∈ {elite, legend}, the container renders a fixed `pointer-events:none` `radial-gradient` halo behind it (z-index 0, no blur, mix-blend screen). 60–80px radius, opacity 0.10–0.18.
- This is what makes the streak feel like it *occupies space in the UI*. Other components don't need changes — the halo is local to the flame container.

## 7. Performance guardrails

- All new logic is CSS-var writes + state machine — zero added React rerenders during animation.
- Spark emission for `roaring/elite/legend` runs on the existing rAF loop (`tick`), not `setInterval` — gated by `perfClass` (low: ÷2, high: ×1.2).
- Decay/milestone sequences use `setState` once at trigger and rely on CSS keyframes — no per-frame React work.
- Off-screen + tab-hidden throttling already in place; no change needed.
- Reduced-motion: state machine still applies (size/colour difference remains), but flicker/sway vars clamp to ≤0.15 — fire still readable, no wobble.

## 8. Files touched

```text
new   src/lib/flame-streak-state.ts        ~120 lines, pure functions + types
edit  src/components/home/StylizedStreakFlame.tsx
        - import + use computeFlameState(streak, lastCheckinAt)
        - write --ssf-flicker/sway/breath/body-alpha
        - prevStreakRef detects increment → daily-surge
        - milestone detection (7/30/100/200) → full burst
        - broken-state detection (prev>0 && next===0) → collapse sequence
        - at-risk visual overlay
        - emitAmbient halo for elite/legend
        ~200 lines added, no rewrites
edit  src/index.css
        - add @keyframes stylized-flame-anxious
        - add @keyframes stylized-flame-collapse
        - add @keyframes stylized-flame-surge
        - retrofit flicker-1/2/3, sway-1/2/3, bob to multiply by --ssf-*
        ~80 lines
edit  src/components/Flame.tsx              wrapper accepts optional lastCheckinAt
edit  src/components/StreakDisplay.tsx      pass lastCheckinAt through
edit  src/components/StreakFlameInline.tsx  pass lastCheckinAt through
```

No DB migration. `lastCheckinAt` already exists in `profiles` (used by `use-tier-risk.ts`) — we read it from the same query.

## 9. Acceptance bar

- A user glancing for <0.5s at any flame in the app can tell:
  - Is the streak alive?
  - Is it at risk?
  - Is it small / mid / huge?
- Without reading any number.
- A user who maintained their streak today sees a 220ms surge on the very next flame they look at (because state flows through React Query cache → all instances animate once on first render after checkin).
- A user who hits day 7/30/100/200 sees a full milestone burst exactly once.
- A user who breaks their streak sees the flame *die*, not just shrink.

## Out of scope

- No new pages, no new DB columns, no audio, no 3D/WebGL — pure 2D SVG/CSS additions on top of the current engine.
- Tribe collective flame (`TribeCollectiveFlame.tsx`) is unchanged in this pass.
