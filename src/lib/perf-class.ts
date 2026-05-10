/**
 * Device performance class — single source of truth for FX gating.
 *
 *  - "low":  reduced-motion preference, low-core CPUs, low-RAM devices, or tiny
 *            screens.   Decorative FX should be skipped entirely.
 *  - "mid":  default mainstream phones / tablets.   Element counts halved.
 *  - "high": desktops or high-end tablets (8+ cores, DPR>=2, 6+ GB RAM).
 *            Full inferno.
 *
 * Detected once per page load and cached, so calling it from many components
 * does not re-run navigator queries.
 *
 * Mirrors the legacy `detectPerfClass` from StylizedStreakFlame.tsx so both
 * use exactly the same heuristic.
 */
export type PerfClass = "low" | "mid" | "high";

const detect = (): PerfClass => {
  if (typeof window === "undefined") return "mid";
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "low";
  const cores = navigator.hardwareConcurrency ?? 4;
  const dpr = window.devicePixelRatio ?? 1;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  if (cores <= 4 || mem <= 3) return "low";
  if (cores >= 8 && dpr >= 2 && mem >= 6) return "high";
  return "mid";
};

let _cache: PerfClass | null = null;
export const getPerfClass = (): PerfClass => (_cache ??= detect());
