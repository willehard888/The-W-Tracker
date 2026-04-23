

# Realtime "Feed the Fire" — flame reacts to every check-in

Two things in one pass: **(A) fix the build error in `Tribes.tsx`** and **(B) make the collective flame react in realtime to every member check-in**, with cinematic, non-cartoon ember-rise feedback.

---

## 1. Fix build error (blocker)

In `src/pages/Tribes.tsx` (lines 462–553) the tribe card's `<button>` opens, then renders the flame tile + text + Join button as siblings — but they're **not** wrapped in the flex row container, leaving an unmatched `</div>` at line 552.

**Fix**: insert an opening `<div className="flex items-start gap-3 relative">` just after the absolute decorations (after line 490) and let the existing `</div>` at line 552 close it. Also re-indent the three children (flame tile, text block, Join button) to sit inside that wrapper.

---

## 2. Realtime check-in reactor (the new feel)

Today, when a member checks in, nothing visible happens until you reload. We make the flame **literally jump** the moment any member's `profiles.streak` ticks up.

### A. New hook: `useTribeFireReactor(tribeId, memberIds)`

Subscribes to `postgres_changes` on `public.profiles` filtered to `user_id IN memberIds`. When a row's `streak` increases (`new.streak > old.streak`):

1. Push an event into a small in-memory queue: `{ id, delta, username, ts }`.
2. Bumps a `pulseToken` counter so the flame can react.
3. Auto-prunes events older than 2.5s.

Returns `{ events, pulseToken, totalDelta }` for consumers.

Why `profiles` realtime works: the daily-checkin RPC updates `profiles.streak` server-side, so a single subscription catches *all* member check-ins without us touching the backend.

### B. New component: `<EmberRiseLayer events accent />`

Absolutely-positioned overlay rendered **inside** the `TribeCollectiveFlame` (hero variant). For each event:

- A floating `+1` chip rises from the flame base (uses existing `@keyframes ember-rise` at index.css:1836 — already shipped).
- A **burst of 6–8 real glowing embers** spawns at the candle root and rises with randomized x-drift, scale, and blur — reusing the existing `ember-drift` keyframe with per-particle delays.
- Subtle username caption ("@alex +1") fades in under the chip, fades out after 1.6s.
- Cap: max 4 concurrent events on screen; older ones drop.
- All embers render in a single `<div>` with CSS-only animations (no JS rAF) → zero layout cost, GPU-only.

Performance: when `prefers-reduced-motion` is on, only the `+1` chip appears (no particles, no scale pulse).

### C. Flame "intake breath" reaction

When `pulseToken` changes, the flame momentarily:

- Scales 1.0 → **1.06 → 1.0** over 380ms with a custom `cubic-bezier(.2,.8,.2,1)` (a quick inhale, like a real fire being fed oxygen).
- Brightness/contrast filter swells `1.0 → 1.18 → 1.0`.
- The aurora rim opacity pops to 1 then settles.

Implemented as a new keyframe `flame-intake` in `index.css`, applied via a key-changing `<div>` wrapper around `<RealisticFlame>` so each event re-triggers the animation cleanly.

### D. Wiring

- `TribeCollectiveFlame` accepts a new optional prop `reactor?: { events, pulseToken }`. When present, it renders `<EmberRiseLayer>` + applies `flame-intake` to the flame container.
- `TribeDetail.tsx`:
  - Calls `useTribeFireReactor(id, members.map(m => m.user_id))`.
  - On each new event: optimistically increments local `collectiveStreak` by `delta` (so the big number ticks up instantly without waiting for the next `load()` call).
  - Triggers a brief haptic `Haptics.impact({ style: "Light" })` (only on native) for the *user's own* check-in, not for others.
  - Adds a tiny realtime-status dot under the hero: "🔴 LIVE" green pulse meaning the channel is connected.
- `Tribes.tsx` (list view): subscribes to the union of all member IDs across the user's joined tribes. When an event fires for a tribe in the list, that row's mini-flame plays a one-shot `flame-intake` and bumps its `cStreak` locally.

### E. Self check-in toast (extra polish)

In the existing `DailyCheckin` success flow, after the streak update succeeds, if the user belongs to ≥1 tribe, show a custom toast: *"+1 day → your tribes felt it 🔥"* with the new tier name if it just crossed a threshold. Pure cosmetic — uses already-loaded data.

---

## 3. Memory / cleanup

- Remove the duplicate `@keyframes ember-rise` definition (one at index.css:1350, another at 1836). Keep the newer one (1836) and delete the older.
- Update `mem://features/tribes` to record: *"Tribe flame reacts in realtime to member check-ins via `profiles` postgres_changes; ember-rise '+1' overlay + flame-intake pulse on each event."*

---

## Files

| File | Change |
|---|---|
| `src/pages/Tribes.tsx` | Fix unmatched `<div>` (insert flex wrapper at L491, re-indent). Subscribe to all-tribe member updates; bump per-row `cStreak` and trigger one-shot intake pulse. |
| `src/pages/TribeDetail.tsx` | Use `useTribeFireReactor`, pass to `TribeCollectiveFlame`, optimistic streak bump, haptic on self event. |
| `src/components/TribeCollectiveFlame.tsx` | Accept optional `reactor`; mount `<EmberRiseLayer>`; wrap `<RealisticFlame>` in animated container that retriggers `flame-intake` per `pulseToken`. |
| `src/components/EmberRiseLayer.tsx` *(new)* | Renders `+1` chips + ember bursts for each event. |
| `src/hooks/use-tribe-fire-reactor.ts` *(new)* | Realtime subscription + event queue. |
| `src/index.css` | Add `@keyframes flame-intake` + `@keyframes flame-intake-glow`. Remove duplicate `ember-rise` keyframe. Add `prefers-reduced-motion` guard. |
| `src/pages/DailyCheckin.tsx` | Add post-success "tribes felt it" toast if user has tribes. |

## Out of scope

- No DB schema changes. No new RPCs. No new tables. Realtime works against existing `profiles` row updates that the check-in flow already triggers.
- Tier-up push notifications stay deferred (mentioned in earlier plan, not requested here).

