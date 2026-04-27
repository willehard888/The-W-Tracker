# Native-Feel Polish Plan
*No new features. Only how the app moves, responds, and breathes.*

The app already has the bones (Capacitor, haptics, route preload, lazy chunks, gold-shimmer fallback). What still leaks "web feel" is the **transition layer**, **per-route skeletons**, **scroll behavior**, and **tap-to-paint latency**. This plan fixes only that.

---

## 1. Why it still feels like a web app — and the exact fix

| Symptom | Why it feels web | Fix |
|---|---|---|
| `RouteFallback` flashes a generic skeleton on every navigation | Suspense boundary wraps **all** routes — even cached ones replay the fallback | Move `Suspense` *inside* each route module so cached chunks render synchronously. Use a **per-route skeleton** that mirrors that screen's layout, never the generic shell |
| Scroll resets to top on back-nav | `el.scrollTo({top:0})` runs on every `pathname` change, including `POP` | Maintain a `Map<path, scrollY>` and restore on `POP`, reset only on `PUSH`/`REPLACE` |
| Header + nav fade in/out with the page | `motion.div` wraps the whole route incl. shared chrome | `StatusHeader` and `BottomNav` are already outside `AnimatePresence` ✅ — but the page-level `<Suspense fallback>` blanks their backdrop. Render fallback **inside** the scroll container only, never replacing the chrome |
| Tap → 100–200 ms of nothing before next screen paints | React lazy chunk + first-paint queries | Keep current `prefetchRoute` on `pointerenter`/`touchstart`, **add** `onPointerDown` for true 0-ms intent detection; navigate on `pointerup` only if still on same target (cancels accidental drags) |
| Inputs feel laggy on iOS | 300 ms tap delay from missing `touch-action`; focus jumps from keyboard resize | Add `touch-action: manipulation` to all interactive elements; already have `Keyboard.resize=none` ✅ — verify `scrollIntoView({block:"center"})` runs on every `<input>` focus inside scroll container |
| Layout jumps when data arrives | Queries return `undefined` → `null` → array → re-layout | Render skeleton blocks at the **exact final dimensions** (fixed `min-height` per card) so swap is invisible |
| `RouteFallback` covers full screen incl. above-the-fold | min-h-[100dvh] inside scroll container double-counts header | Constrain fallback to `min-h-[60dvh]` and align top, never cover the header |
| 220 ms fade+slide on route change | Reads as a "page loaded" cue, not a system transition | iOS-style: drop the y-translate; use `opacity 180ms cubic-bezier(0.32,0.72,0,1)` only. Direction-aware push/pop handled per-stack (see §3) |

---

## 2. Continuity & flow — the transition system

**Three transition tiers**, applied automatically by route:

```text
Tier A — Tab switches (BottomNav)     → Cross-fade 160ms, no translate
Tier B — Push (detail from list)      → Slide-in-from-right 260ms ease-out, exit slides 40% left + dims
Tier C — Modal-style (paywall, chat)  → Slide-up 320ms spring, dims background to 70%
```

Implementation:
- New `src/lib/route-transitions.ts` maps `pathname` → tier.
- `AppRoutes` reads tier from `location.state?.tier ?? inferTier(prev, next)`.
- `framer-motion` variants per tier; `mode="popLayout"` so incoming page paints **on top** of outgoing one — zero blank frame.
- `initial={false}` on first mount so cold-start doesn't animate.

What the user sees during every transition:
- **Tab**: icon press scales 0.92 (60ms), screen cross-fades over current screen — current screen never disappears before new one paints.
- **Push**: incoming screen slides over from right with a 1px gold edge highlight; outgoing parallaxes 30% to the left at 0.85 opacity (iOS standard).
- **Pop**: reverse, with `interactivePop` enabled via swipe-from-edge gesture (`use-horizontal-swipe` already exists).
- **Modal**: backdrop dims to `hsl(var(--background)/0.7)` over 200ms, sheet rises with spring `{stiffness:380, damping:34}`.

No fallback is ever shown for routes whose chunk is already loaded (preload covers all 9 primary routes).

---

## 3. Performance feel (perceived instant)

**Already present** ✅: `preloadAppRoutes`, BottomNav `prefetchRoute`, React Query `staleTime`, `placeholderData: prev`.

**Add**:
1. **Route data prefetch on intent**: on `pointerenter`/`touchstart` of a nav button, also call `queryClient.prefetchQuery` for that route's primary query. New helper `src/lib/route-data-prefetch.ts` exporting `prefetchRouteData(path, queryClient, profile)` with one query per route (leaderboard top-50, feed first-page, profile-self).
2. **Optimistic micro-feedback**: every nav button gets a 60ms scale-down on `pointerdown` *before* navigation fires — eye registers response in <16ms, masking the actual route mount.
3. **Persistent scroll memory** per route: `useRouteScrollMemory()` hook attached to scroll container.
4. **Skeleton hydration**: per-page skeletons live in `src/components/skeletons/` with **identical block heights** to real content. Swap is invisible; no shimmer needed when data arrives within 80ms (use `useDeferredValue` on isLoading flag with 80ms threshold).
5. **Image strategy**: audit `<img>` for `decoding="async"` + `loading="lazy"` + intrinsic `width/height` to lock layout.
6. **Defer non-critical**: `AmbientParticles` already gated; also defer `TierPromotionCelebration` mount until first idle tick after splash.

---

## 4. Touch & interaction rules (system-wide)

```text
Tap target min size:        44×44 CSS px (iOS HIG)
Press visual feedback:      scale(0.94) + 80ms ease-out, on pointerdown
Press haptic:               light impact on pointerdown (not click) for primary actions
Release/cancel:             scale back over 140ms cubic-bezier(0.16,1.2,0.32,1)
Tap-to-action latency:      < 16ms visual, < 100ms navigation start
Long-press threshold:       350ms, then medium haptic
Swipe-back-to-pop:          left 24px edge zone, 60px commit distance
Scroll deceleration:        native momentum (already on)
Disabled state:             50% opacity, no pointer-events, no haptic
```

Apply via:
- New `src/components/ui/tappable.tsx` wrapper (uses `framer-motion` `whileTap`) — wrap existing buttons by replacing `<button>` className pattern; keep `<Button>` shadcn intact, just add base classes (`active:scale-[0.94] transition-transform duration-[140ms]`) to `buttonVariants`.
- Global CSS: `button, a, [role=button] { touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; }` in `index.css` `@layer base`.

---

## 5. Microinteraction motion tokens

Add to `:root` in `index.css`:
```css
--motion-tap: 80ms;
--motion-press-out: 140ms;
--motion-fade: 180ms;
--motion-slide: 260ms;
--motion-modal: 320ms;
--ease-ios: cubic-bezier(0.32, 0.72, 0, 1);   /* iOS standard */
--ease-spring: cubic-bezier(0.16, 1.2, 0.32, 1);
--ease-soft: cubic-bezier(0.22, 0.61, 0.36, 1);
```

Constraint: **no microinteraction over 320ms**. No bounce > 8% overshoot. No color flash on success — replace with single soft scale + haptic notification.

---

## 6. Visual polish (refine, do not redesign)

| Before | After |
|---|---|
| Sticky header gold accent line at full opacity | Fade to `0.35` until scrollY > 8, then `0.7` (signals "scrolled") |
| Skeleton cards have generic rounded boxes | Match real card `border-radius`, `padding`, and inner block layout per route |
| BottomNav active pill renders only on active tab | Animate pill position with `layoutId="nav-pill"` so it slides between tabs (250ms spring) |
| Page padding inconsistent (some `pt-6`, some `pt-4`) | Standardize to `pt-4 px-4 pb-24` via wrapper class `screen-shell` in `index.css` |
| Cards stack with same elevation | Tier elevation: hero card `shadow-lg`, secondary `shadow-md`, list items flat with `border-border/30` |
| Text hierarchy mixes weights freely | Codify: `H1 800/-0.02em`, `H2 700/-0.01em`, `body 500`, `meta 600 uppercase tracking-wide` — apply via `.text-h1 .text-h2 .text-meta` utility classes |

---

## 7. Loading & state handling fix

**Replace** the global `<Suspense fallback={<RouteFallback/>}>` with:
1. **Inner `Suspense` per route** with route-specific skeleton.
2. Persistent `<StatusHeader/>` + `<BottomNav/>` never unmount during route swap.
3. Data-loading skeleton **inside** each page swaps to real content via `useDeferredValue` so flickers <80ms never render.
4. On `native:resume`, queries already invalidate ✅ — **but** wrap in `keepPreviousData` so user sees stale data instantly while refetch runs.

New files:
- `src/components/skeletons/HomeSkeleton.tsx`
- `src/components/skeletons/LeaderboardSkeleton.tsx`
- `src/components/skeletons/ProfileSkeleton.tsx`
- `src/components/skeletons/FeedSkeleton.tsx`
- `src/components/skeletons/CheckinSkeleton.tsx`

Each ≤ 60 lines, mirrors the real screen's first-screen blocks at exact pixel sizes.

---

## 8. The "Premium Standard" checklist

Must always be true:
- [ ] Tap response visible in ≤ 16ms (one frame)
- [ ] Navigation start ≤ 100ms after pointer-up
- [ ] No screen ever shows a generic loader once visited (cached)
- [ ] StatusHeader + BottomNav never unmount, never blink
- [ ] No layout shift > 4px during data load
- [ ] All animations 80–320ms; nothing longer except the splash
- [ ] All easings from the 3 system tokens (`ios`, `spring`, `soft`) — no ad-hoc cubic-beziers
- [ ] Every primary button: visual + haptic feedback on pointerdown, not click
- [ ] No horizontal scroll, ever
- [ ] Scroll position restored on back-nav within the session
- [ ] Modal backdrop dims, never blacks-out
- [ ] No emoji-as-icon in primary nav (use lucide) ✅ already true
- [ ] Skeleton blocks match final layout to the pixel
- [ ] All inputs `touch-action: manipulation`, focused inputs scroll into center on keyboard show
- [ ] No `console.error` during navigation (assert via dev check)

---

## 9. Prioritized fix plan

### High impact (ship first — biggest "web → native" jump)
1. **Per-route skeletons + inner Suspense** → kills the global fallback flash.
2. **Direction-aware route transitions** (`popLayout`, slide for push, fade for tab) — no blank frames.
3. **Scroll position memory** on POP navigation.
4. **`pointerdown` visual + haptic + prefetch** on BottomNav and every primary CTA.
5. **Layout-animated active pill** on BottomNav (`layoutId`).

### Medium (polish layer)
6. Motion tokens centralized in `index.css`; remove ad-hoc transitions.
7. `screen-shell` wrapper class for consistent padding/safe-area.
8. `placeholderData: prev` audit — confirm every list query keeps last data on refetch.
9. `touch-action: manipulation` global; tap-highlight off; user-select tightened.
10. `useDeferredValue(isLoading, 80ms)` to suppress sub-frame skeletons.
11. Defer `TierPromotionCelebration` and other modals to first idle.

### Final 1%
12. Header gold-accent opacity reacts to scrollY.
13. Typography utility classes (`.text-h1`, `.text-meta` …) and replace inline weights on Index/Profile/Leaderboard.
14. Image audit pass: `decoding="async"`, intrinsic dimensions.
15. Edge-swipe-to-pop hook wired into push-tier routes.
16. Replace remaining `transition-all` with explicit property lists for GPU cleanliness.

---

## Technical notes

- No changes to data layer, no schema migrations, no new pages, no new business logic.
- All work in `src/App.tsx`, `src/components/BottomNav.tsx`, `src/index.css`, `src/components/ui/button.tsx`, plus 5 new skeleton files and 2 new lib helpers (`route-transitions.ts`, `route-data-prefetch.ts`, `use-route-scroll-memory.ts`).
- `framer-motion` already installed; no new deps.
- Capacitor haptics already wired; reuse `hapticImpact("light")`.
- `prefers-reduced-motion` honored: all transitions collapse to opacity-only at 120ms.
- Memory updates after ship: `mem://ux/native-experience.md` extended with transition tier table and premium-standard checklist.

---

Ready to implement in this exact order. I'll commit each high-impact item separately so you can verify on iOS between steps.