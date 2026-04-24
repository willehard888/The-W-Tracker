/**
 * Flame dev settings — persisted in localStorage, hot-reloaded across tabs.
 *
 * Visibility: panel auto-shows on dev/preview hosts, persists user choice.
 *
 * Settings drive layer count, opacity, dense-core boost, contrast modes, the
 * new "Razor Sharp" preset, edge clipping, and an auto-degrade pass that
 * watches realtime FPS and dials back filter cost when frames drop.
 */
import { useEffect, useRef, useState } from "react";

export type FlameContrastMode = "normal" | "high-contrast" | "razor-sharp";

export interface FlameDevSettings {
  /** 0..1 multiplier on visible layer count. 1 = all layers, 0.3 = ~30% kept. */
  layerDensity: number;
  /** Opacity scaling: 0.4..1.4 multiplier on each layer's opacity. */
  opacityMultiplier: number;
  /** Dense-core boost: 0..1 — pushes core/hero/inner-amber opacity toward 1. */
  denseCore: number;
  /** Contrast preset — drives sharpening filter strength + shadow boost. */
  contrastMode: FlameContrastMode;
  /** Clip the sharpening filter to the flame's interior to kill edge halos. */
  edgeClipping: boolean;
  /** Edge softness 0..1 — 0 = hard cut, 1 = wide feather. */
  edgeSoftness: number;
  /** Auto-degrade renderer when FPS drops below threshold. */
  autoDegrade: boolean;
}

const STORAGE_KEY = "flame-dev-settings-v2";
const VISIBILITY_KEY = "flameDevPanel";

export const DEFAULT_FLAME_SETTINGS: FlameDevSettings = {
  layerDensity: 1,
  opacityMultiplier: 1,
  denseCore: 0.55,
  contrastMode: "normal",
  edgeClipping: false,
  edgeSoftness: 0.35,
  autoDegrade: true,
};

export function readFlameSettings(): FlameDevSettings {
  if (typeof window === "undefined") return DEFAULT_FLAME_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FLAME_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_FLAME_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_FLAME_SETTINGS;
  }
}

export function writeFlameSettings(s: FlameDevSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("flame-dev-settings-change"));
  } catch {
    // ignore quota / privacy mode errors
  }
}

/** True when the dev panel should be visible.
 *  Auto-on in dev/preview environments (localhost + lovable preview hosts),
 *  unless explicitly dismissed via `?devflame=0` or removing the storage key.
 */
export function isFlameDevPanelEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("devflame") === "1") {
      localStorage.setItem(VISIBILITY_KEY, "1");
      return true;
    }
    if (params.get("devflame") === "0") {
      localStorage.setItem(VISIBILITY_KEY, "0");
      return false;
    }

    const stored = localStorage.getItem(VISIBILITY_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;

    const host = window.location.hostname;
    const isDevHost =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".lovableproject.com") ||
      host.endsWith(".lovable.app") ||
      host.endsWith(".lovable.dev");
    return isDevHost;
  } catch {
    return false;
  }
}

/** React hook — re-renders on settings or visibility changes. */
export function useFlameDevSettings(): FlameDevSettings {
  const [settings, setSettings] = useState<FlameDevSettings>(() => readFlameSettings());

  useEffect(() => {
    const onChange = () => setSettings(readFlameSettings());
    window.addEventListener("flame-dev-settings-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("flame-dev-settings-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return settings;
}

/* ─── Live FPS meter (rAF-driven, EMA-smoothed) ─────────────────────────
 *  Singleton broadcaster — one rAF loop per page powers all subscribers.
 *  Subscribers get smoothed FPS roughly twice a second.
 */
type FpsListener = (fps: number) => void;
const fpsListeners = new Set<FpsListener>();
let fpsRaf = 0;
let fpsLastT = 0;
let fpsEma = 60;
let fpsLastEmit = 0;

function fpsLoop(now: number) {
  if (fpsLastT) {
    const dt = now - fpsLastT;
    if (dt > 0) {
      const inst = 1000 / dt;
      // EMA smoothing — prevents jitter readout while still reacting fast
      fpsEma = fpsEma * 0.9 + inst * 0.1;
    }
  }
  fpsLastT = now;
  if (now - fpsLastEmit > 500) {
    fpsLastEmit = now;
    const rounded = Math.round(fpsEma);
    fpsListeners.forEach((cb) => cb(rounded));
  }
  fpsRaf = requestAnimationFrame(fpsLoop);
}

function ensureFpsLoop() {
  if (fpsRaf || typeof window === "undefined") return;
  fpsRaf = requestAnimationFrame(fpsLoop);
}

function stopFpsLoopIfIdle() {
  if (!fpsListeners.size && fpsRaf) {
    cancelAnimationFrame(fpsRaf);
    fpsRaf = 0;
    fpsLastT = 0;
  }
}

/** Subscribe to live FPS readings (EMA-smoothed, ~2 Hz updates). */
export function useFps(): number {
  const [fps, setFps] = useState(60);
  useEffect(() => {
    const cb: FpsListener = (v) => setFps(v);
    fpsListeners.add(cb);
    ensureFpsLoop();
    return () => {
      fpsListeners.delete(cb);
      stopFpsLoopIfIdle();
    };
  }, []);
  return fps;
}

/** Performance tier based on live FPS — drives auto-degrade. */
export type PerfTier = "smooth" | "ok" | "struggling";

export function classifyPerf(fps: number): PerfTier {
  if (fps >= 50) return "smooth";
  if (fps >= 35) return "ok";
  return "struggling";
}

/** Hook that returns the *effective* settings after auto-degrade.
 *  Watches FPS for ~1.5s of sustained low frames before dropping quality
 *  to avoid flapping during one-off jank. */
export function useEffectiveFlameSettings(): {
  effective: FlameDevSettings;
  fps: number;
  degraded: boolean;
  tier: PerfTier;
} {
  const raw = useFlameDevSettings();
  const fps = useFps();
  const tier = classifyPerf(fps);
  const lowSinceRef = useRef<number | null>(null);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    if (!raw.autoDegrade) {
      setDegraded(false);
      lowSinceRef.current = null;
      return;
    }
    const now = performance.now();
    if (tier === "struggling") {
      if (lowSinceRef.current == null) lowSinceRef.current = now;
      if (now - lowSinceRef.current > 1500) setDegraded(true);
    } else if (tier === "smooth") {
      lowSinceRef.current = null;
      // small hysteresis — don't flap back instantly
      const t = setTimeout(() => setDegraded(false), 800);
      return () => clearTimeout(t);
    } else {
      // "ok" — hold current state
      lowSinceRef.current = null;
    }
  }, [tier, raw.autoDegrade]);

  const effective: FlameDevSettings = degraded
    ? {
        ...raw,
        // Drop layer count + ease the filter pipeline
        layerDensity: Math.min(raw.layerDensity, 0.55),
        contrastMode: raw.contrastMode === "razor-sharp" ? "high-contrast" : raw.contrastMode,
        edgeClipping: raw.edgeClipping, // keep user choice
      }
    : raw;

  return { effective, fps, degraded, tier };
}

/**
 * Apply per-layer opacity transformation:
 *   - opacityMultiplier scales the base opacity.
 *   - denseCore lerps "core-ish" layers (z >= 4) toward 1.
 *   - high-contrast bumps everything ~+0.08 and clamps min to 0.5.
 *   - razor-sharp slams core layers to ≥0.95 and outers to ≥0.6 so silhouettes
 *     read as hard edges instead of soft volumetric clouds.
 *
 * Returns clamped [0.05, 1] opacity.
 */
export function applyFlameOpacity(
  baseOpacity: number,
  z: number,
  s: FlameDevSettings,
): number {
  const isCoreLayer = z >= 4;
  let o = baseOpacity * s.opacityMultiplier;

  if (isCoreLayer) {
    o = o + (1 - o) * s.denseCore;
  }

  if (s.contrastMode === "high-contrast") {
    o = Math.max(o + 0.08, isCoreLayer ? 0.85 : 0.5);
  } else if (s.contrastMode === "razor-sharp") {
    o = Math.max(o + 0.14, isCoreLayer ? 0.95 : 0.62);
  }

  return Math.max(0.05, Math.min(1, o));
}

/** CSS `filter` string for the flame stack, per contrast mode. */
export function flameSharpenFilter(s: FlameDevSettings): string {
  switch (s.contrastMode) {
    case "razor-sharp":
      // Punchy contrast + saturation, plus a light unsharp-like brightness pop.
      return "contrast(1.85) saturate(1.7) brightness(1.06)";
    case "high-contrast":
      return "contrast(1.6) saturate(1.55) brightness(1.05)";
    case "normal":
    default:
      return "contrast(1.4) saturate(1.4) brightness(1.02)";
  }
}

/** Shadow-strength multiplier per contrast mode. */
export function flameShadowMultiplier(s: FlameDevSettings): number {
  if (s.contrastMode === "razor-sharp") return 1.9;
  if (s.contrastMode === "high-contrast") return 1.6;
  return 1;
}

/**
 * Build a CSS `mask-image` value that confines the sharpening filter to the
 * flame's interior — kills the bright fringe that contrast filters spawn
 * along the silhouette edge. `softness` 0..1 drives feather width.
 */
export function flameEdgeMaskImage(softness: number): string {
  // Inner stop fully opaque (filter applied), outer stop transparent (filter
  // ignored). Width follows softness slider.
  const inner = 38 + softness * 22; // 38..60%
  const outer = 72 + softness * 20; // 72..92%
  return `radial-gradient(ellipse 70% 88% at 50% 60%, black ${inner}%, transparent ${outer}%)`;
}

/**
 * Layer-count cap based on density:
 *   density 1 → keep all layers
 *   density 0.3 → keep only the densest ~30% (highest z values).
 *
 * Returns the indices to KEEP from a sorted-by-z array. We keep the highest-z
 * layers first (core stays, outer aura drops first) so the silhouette stays
 * coherent even at low density.
 */
export function selectKeptLayerIndices<T extends { z: number }>(
  layers: T[],
  density: number,
): Set<number> {
  const total = layers.length;
  const keep = Math.max(3, Math.round(total * density));
  const indices = layers
    .map((l, i) => ({ i, z: l.z }))
    .sort((a, b) => b.z - a.z)
    .slice(0, keep)
    .map((x) => x.i);
  return new Set(indices);
}
