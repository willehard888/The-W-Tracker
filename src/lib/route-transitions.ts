/**
 * Three-tier route transition system.
 *
 * - Tab tier: cross-fade only (BottomNav routes — they're peers).
 * - Push tier: incoming slides over from the right (detail screens).
 * - Modal tier: rises from the bottom (paywall, chat, briefing).
 *
 * The tier is inferred from the destination path. Push detection (vs pop) is
 * tracked separately by listening to history navigation type.
 */

export type TransitionTier = "tab" | "push" | "modal";

const TAB_PATHS = new Set<string>([
  "/",
  "/checkin",
  "/feed",
  "/tribes",
  "/messages",
  "/leaderboard",
  "/battles",
  "/profile",
]);

const MODAL_PREFIXES = ["/paywall", "/chat/", "/briefing/", "/onboarding", "/apple-username"];

export const inferTransitionTier = (path: string): TransitionTier => {
  if (TAB_PATHS.has(path)) return "tab";
  if (MODAL_PREFIXES.some((p) => path.startsWith(p))) return "modal";
  return "push";
};

export const transitionVariants = {
  tab: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.16, ease: [0.32, 0.72, 0, 1] as const },
  },
  push: {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -12 },
    transition: { duration: 0.26, ease: [0.32, 0.72, 0, 1] as const },
  },
  pop: {
    initial: { opacity: 0, x: -24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 12 },
    transition: { duration: 0.24, ease: [0.32, 0.72, 0, 1] as const },
  },
  modal: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 8 },
    transition: { duration: 0.28, ease: [0.32, 0.72, 0, 1] as const },
  },
} as const;
