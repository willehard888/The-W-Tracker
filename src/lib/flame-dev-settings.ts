/**
 * Flame dev settings — persisted in localStorage, hot-reloaded across tabs.
 *
 * Visibility: panel only mounts when `localStorage.flameDevPanel === "1"` OR
 * the URL has `?devflame=1`. The query param sets the flag automatically so
 * the panel sticks across reloads.
 *
 * Settings are read by CompactStreakPanel to scale layer count, opacity and
 * "dense core" intensity, and to switch between Normal / High-Contrast modes.
 */
import { useEffect, useState } from "react";

export type FlameContrastMode = "normal" | "high-contrast";

export interface FlameDevSettings {
  /** 0..1 multiplier on visible layer count. 1 = all layers, 0.3 = ~30% kept. */
  layerDensity: number;
  /** Opacity scaling: 0.4..1.4 multiplier on each layer's opacity. */
  opacityMultiplier: number;
  /** Dense-core boost: 0..1 — pushes core/hero/inner-amber opacity toward 1. */
  denseCore: number;
  /** Contrast mode — drives default opacity bias and shadow strength. */
  contrastMode: FlameContrastMode;
}

const STORAGE_KEY = "flame-dev-settings-v1";
const VISIBILITY_KEY = "flameDevPanel";

export const DEFAULT_FLAME_SETTINGS: FlameDevSettings = {
  layerDensity: 1,
  opacityMultiplier: 1,
  denseCore: 0.55,
  contrastMode: "normal",
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

/** True when the dev panel should be visible. */
export function isFlameDevPanelEnabled(): boolean {
  if (typeof window === "undefined") return false;
  // URL param activates persistently
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("devflame") === "1") {
      localStorage.setItem(VISIBILITY_KEY, "1");
      return true;
    }
    if (params.get("devflame") === "0") {
      localStorage.removeItem(VISIBILITY_KEY);
      return false;
    }
    return localStorage.getItem(VISIBILITY_KEY) === "1";
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

/**
 * Apply per-layer opacity transformation:
 *   - opacityMultiplier scales the base opacity.
 *   - denseCore lerps "core-ish" layers (z >= 4) toward 1.
 *   - high-contrast mode bumps everything ~+0.08 and clamps minimum to 0.5.
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
    // Lerp toward 1 by denseCore strength
    o = o + (1 - o) * s.denseCore;
  }

  if (s.contrastMode === "high-contrast") {
    o = Math.max(o + 0.08, isCoreLayer ? 0.85 : 0.5);
  }

  return Math.max(0.05, Math.min(1, o));
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
  // Sort indices by z desc, keep top `keep`
  const indices = layers
    .map((l, i) => ({ i, z: l.z }))
    .sort((a, b) => b.z - a.z)
    .slice(0, keep)
    .map((x) => x.i);
  return new Set(indices);
}
