/**
 * Device performance class — single source of truth for FX gating.
 *
 *  - "low":  reduced-motion preference, ANY touch device (mobile/tablet),
 *            low-core CPUs, low-RAM devices, or tiny screens. Decorative
 *            FX should be skipped entirely.
 *  - "mid":  desktop/laptop with average specs.
 *  - "high": desktops with 8+ cores AND DPR>=2 AND 6+ GB RAM. Full inferno.
 *
 * IMPORTANT — touch device = low.
 *
 * iPhones report 6+ `hardwareConcurrency` and do NOT expose `deviceMemory`
 * (it defaults to 4) — under the old core/RAM-only heuristic they classified
 * as "mid" and got the full FX layer despite users complaining about lag.
 * Treating any `(pointer: coarse)` device as "low" by default makes the
 * gating actually kick in for the people who feel the lag.
 *
 * Every navigator/window access is defensively guarded — this function is
 * called at module-load time from several files, and any thrown error here
 * would prevent the entire React tree from rendering.
 *
 * Cached after first call so calling from many components is free.
 */
export type PerfClass = "low" | "mid" | "high";

const detect = (): PerfClass => {
  // Server / very early — assume mid. Caller code MUST also handle "mid".
  if (typeof window === "undefined") return "mid";
  try {
    const mm = (q: string): boolean => {
      try {
        return Boolean(window.matchMedia && window.matchMedia(q).matches);
      } catch {
        return false;
      }
    };
    // Hard signals → low.
    if (mm("(prefers-reduced-motion: reduce)")) return "low";
    // Touch device → low. Catches every phone & most tablets regardless of
    // what hardwareConcurrency claims. THIS is the fix that makes prior
    // perf gating actually trigger on iPhones.
    if (mm("(pointer: coarse)")) return "low";
    // Small viewport = phone-ish → low.
    if (typeof window.innerWidth === "number" && window.innerWidth < 768) return "low";

    // Desktop heuristic from here down.
    const nav = (typeof navigator !== "undefined" ? navigator : undefined) as
      | (Navigator & { deviceMemory?: number })
      | undefined;
    const cores = nav?.hardwareConcurrency ?? 4;
    const dpr = window.devicePixelRatio ?? 1;
    const mem = nav?.deviceMemory ?? 4;
    if (cores <= 4 || mem <= 3) return "low";
    if (cores >= 8 && dpr >= 2 && mem >= 6) return "high";
    return "mid";
  } catch {
    // ANY unexpected exception → assume mid. Never throw from this module.
    return "mid";
  }
};

let _cache: PerfClass | null = null;
export const getPerfClass = (): PerfClass => (_cache ??= detect());
