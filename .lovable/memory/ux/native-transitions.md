---
name: Native-feel transition system
description: Three-tier route transitions (tab/push/modal), scroll memory on POP, instant pointerdown nav, layoutId nav pill, per-route skeletons
type: design
---

App-wide motion + navigation feel system, applied via `src/App.tsx` + `src/components/BottomNav.tsx` + `src/lib/route-transitions.ts` + `src/hooks/use-route-scroll-memory.ts`.

## Transition tiers (auto-inferred from path)
- **tab** — BottomNav peers (`/`, `/checkin`, `/feed`, `/tribes`, `/messages`, `/leaderboard`, `/battles`, `/profile`): cross-fade 160ms, no translate.
- **push** — detail screens: slide-in-from-right 24px, 260ms iOS easing `cubic-bezier(0.32,0.72,0,1)`. POP reverses direction (slide-from-left, "pop" variant).
- **modal** — `/paywall`, `/chat/`, `/briefing/`, `/onboarding`, `/apple-username`: slide-up 16px, 280ms.

`AnimatePresence mode="popLayout"` so incoming page paints over outgoing — no blank frame.

## Scroll memory
`useRouteScrollMemory(scrollRef)` keeps a `Map<path, scrollY>`. On POP it restores after 2 rAF (waits for content mount). On PUSH/REPLACE it scrolls to top instantly. No more "lose your place" on back-nav.

## Instant tap response (BottomNav)
- `onPointerDown` fires haptic + prefetch + records press. Nav happens on `onPointerUp` only if same target — cancels accidental drags.
- Active pill animates between tabs via `layoutId="bottom-nav-pill"` (spring stiffness 380, damping 34).

## Route fallback
`RouteFallback` is now route-aware (Home/Checkin/Leaderboard/Profile/Feed/List skeletons in `src/components/skeletons/PageSkeleton.tsx`). Each block uses fixed pixel heights mirroring the real screen — zero layout shift on data swap.

## Motion tokens (in :root)
`--motion-tap: 80ms`, `--motion-press-out: 140ms`, `--motion-fade: 180ms`, `--motion-slide: 260ms`, `--motion-modal: 320ms`, `--ease-ios: cubic-bezier(0.32,0.72,0,1)`.

## Global touch defaults
`button, a, [role="button"], [role="tab"], label, summary { touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none }`. Inputs override to keep text selection.

## Premium standard checklist
Tap visual ≤ 16ms · nav start ≤ 100ms · cached routes never show fallback · header+nav never unmount · no layout shift > 4px · all transitions 80–320ms · 3 system easings only · no horizontal scroll · scroll restored on back-nav.
