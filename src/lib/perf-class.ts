/**
 * Device performance class — single source of truth for FX gating.
 *
 *  - "low":  reduced-motion preference, ANY touch device (mobile/tablet),
 *            low-core CPUs, low-RAM devices, or tiny screens. Decorative
 *            FX should be skipped entirely.
 *  - "mid":  desktop/laptop with average specs.
 *  - "high": desktops with 8+ cores AND DPR >= 2 AND 6+ GB RAM. Full inferno.
 *
 * IMPORTANT — touch device = low.
 *
 * iPhones (and most Android phones) report 6+ `hardwareConcurrency` but their
 * GPUs throttle aggressively under battery, their browsers (mobile Safari
 * especially) have a fraction of desktop Chrome's compositor budget, and
 * users notice scroll-jank way more than they notice missing decorative
 * sparks. Treating any `(pointer: coarse)` device as "low" by default makes
 * the gating actually kick in for the people who feel the lag.
 *
 * Cached after first call so calling from many components is free.
 */
export type PerfClass = "low" | "mid" | "high";

const detect = (): PerfClass => {
  if (typeof window === "undefined") return "mid";
  // Hard signals: user-requested reduced motion → low.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "low";
  // Touch device → low. Catches every phone and most tablets, regardless of
  // what `hardwareConcurrency` claims. iOS doesn't expose `deviceMemory`, so
  // the old core/RAM heuristic was useless on iPhones — they classified as
  // "mid" and got the full FX layer despite users complaining about lag.
  if (window.matchMedia?.("(pointer: coarse)").matches) return "low";
  if (window.innerWidth < 768) return "low";
  // Desktop heuristic from here down.
  const cores = navigator.hardwareConcurrency ?? 4;
  const dpr = window.devicePixelRatio ?? 1;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  if (cores <= 4 || mem <= 3) return "low";
  if (cores >= 8 && dpr >= 2 && mem >= 6) return "high";
  return "mid";
};

let _cache: PerfClass | null = null;
export const getPerfClass = (): PerfClass => (_cache ??= detect());
