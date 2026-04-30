/**
 * Route preloading for instant navigation.
 *
 * After the splash screen is dismissed and the app is idle, we preload the
 * most-used screens in the background so route transitions feel instant
 * (no Suspense fallback flicker).
 *
 * Uses requestIdleCallback when available (with setTimeout fallback) so
 * preloading never competes with user interaction or above-the-fold paint.
 *
 * Strategy:
 *   - Skip entirely on Save-Data / 2g connections.
 *   - Stage 1 priority routes preload via dynamic import().
 *   - Stage 2 secondary routes follow once the network is calm.
 */

type ImportFn = () => Promise<unknown>;

const PRIORITY_ROUTES: ImportFn[] = [
  () => import("@/pages/DailyCheckin"),
  () => import("@/pages/Leaderboard"),
  () => import("@/pages/Profile"),
  () => import("@/pages/EliteFeed"),
];

const SECONDARY_ROUTES: ImportFn[] = [
  () => import("@/pages/Battles"),
  () => import("@/pages/Tribes"),
  () => import("@/pages/Coach"),
  () => import("@/pages/Messages"),
  () => import("@/pages/Paywall"),
];

const ric =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (cb: () => void, timeout = 2000) =>
        (window as any).requestIdleCallback(cb, { timeout })
    : (cb: () => void, timeout = 2000) => window.setTimeout(cb, timeout);

let preloadStarted = false;

const isSlowNetwork = () => {
  const conn = (typeof navigator !== "undefined" ? (navigator as any).connection : null) || null;
  if (!conn) return false;
  if (conn.saveData) return true;
  const t = conn.effectiveType;
  return t === "slow-2g" || t === "2g";
};

export const preloadAppRoutes = () => {
  if (preloadStarted) return;
  preloadStarted = true;

  const slow = isSlowNetwork();

  // Stage 1 — priority routes (likely first navigation targets) after 500ms.
  ric(() => {
    PRIORITY_ROUTES.forEach((fn) => {
      try {
        fn().catch(() => {});
      } catch {}
    });
  }, 500);

  // Stage 2 — secondary routes a bit later so we don't saturate the network.
  // Skip entirely on Save-Data / 2g.
  if (!slow) {
    ric(() => {
      SECONDARY_ROUTES.forEach((fn) => {
        try {
          fn().catch(() => {});
        } catch {}
      });
    }, 2500);
  }
};
