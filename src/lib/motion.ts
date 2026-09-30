import type { Transition } from "framer-motion";

/**
 * The motion vocabulary for framer-motion sites — the same ladder the CSS
 * tokens carry (--motion-fade 180 · --motion-slide 260 · --ease-soft ·
 * --ease-ios), so a fade in a sheet and a fade in a card are one fade.
 * Celebrations keep their own choreography; this is for the utility moves.
 */
export const EASE_IOS = [0.32, 0.72, 0, 1] as const;
export const EASE_SOFT = [0.22, 0.61, 0.36, 1] as const;

export const MOTION = {
  /** A crossfade — a backdrop, a swapped line of text. */
  fade: { duration: 0.18, ease: EASE_SOFT } satisfies Transition,
  /** A short move on screen — a banner rising, a card settling. */
  slide: { duration: 0.26, ease: EASE_IOS } satisfies Transition,
  /** A reveal worth a beat — a nameplate, a hero number. */
  reveal: { duration: 0.55, ease: EASE_SOFT } satisfies Transition,
  /** The drawer: the bottom sheet's rise and its return after a pull. */
  drawer: { type: "spring", stiffness: 380, damping: 38 } satisfies Transition,
  /** The default spring for anything springy (MotionConfig). */
  spring: { type: "spring", stiffness: 320, damping: 30 } satisfies Transition,
} as const;
