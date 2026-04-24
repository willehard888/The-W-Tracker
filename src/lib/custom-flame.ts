/**
 * Custom flame engine — user-built flame composed of stacked layers.
 *
 * Each layer is an independent ellipse rendered in CSS with a radial gradient.
 * Layers are composited via mix-blend-mode, animated with a flicker keyframe,
 * and stacked back-to-front by their order in the array.
 *
 * State persists to localStorage so the user can iterate freely without losing
 * progress on reload. No backend required.
 */
import { useEffect, useState } from "react";

export type FlameBlendMode =
  | "normal"
  | "screen"
  | "lighten"
  | "color-dodge"
  | "plus-lighter"
  | "overlay";

export interface FlameLayer {
  id: string;
  name: string;
  /** HSL color string e.g. "hsl(18 95% 58%)" */
  color: string;
  /** Width in px relative to a 320px stage (auto-scales). */
  width: number;
  /** Height in px relative to a 320px stage (auto-scales). */
  height: number;
  /** Vertical offset from base (px); positive lifts the layer up. */
  offsetY: number;
  /** Horizontal offset from center (px). */
  offsetX: number;
  /** 0..1 layer opacity. */
  opacity: number;
  /** 0..40 px blur. */
  blur: number;
  /** Composite blend mode against layers below. */
  blend: FlameBlendMode;
  /** Flicker animation period in seconds. 0 disables animation. */
  flickerSpeed: number;
  /** 0..1 — how much the layer flickers (scale + opacity wobble). */
  flickerAmount: number;
  /** Whether this layer is currently visible (toggle without delete). */
  visible: boolean;
}

// Bumped to v2 to ship the cinematic preset to existing users on next mount.
const STORAGE_KEY = "custom-flame-layers-v2";
const CHANGE_EVENT = "custom-flame-layers-change";

/**
 * "Cinematic Inferno" — 10-layer multi-color preset.
 *
 * Stack order is back-to-front:
 *   1. Smoke plume       — desaturated drift far above flame
 *   2. Magenta aura      — wide pink halo (back-bloom)
 *   3. Blue base shell   — cool foot, contrasts the warm body
 *   4. Outer ember       — tall orange-red silhouette, soft
 *   5. Body              — main orange body
 *   6. Gold midbody      — saturated gold, pulls eye in
 *   7. Amber inner       — bright yellow-amber inner flame
 *   8. White-hot core    — near-white tongue, fast flicker
 *   9. Cyan tip spark    — cool spark crowning the tip
 *  10. Apex wisp         — tiny white plume at the very top
 */
export const DEFAULT_LAYERS: FlameLayer[] = [
  {
    id: "smoke",
    name: "Smoke Plume",
    color: "hsl(258 8% 55%)",
    width: 200,
    height: 260,
    offsetY: 240,
    offsetX: 6,
    opacity: 0.18,
    blur: 38,
    blend: "screen",
    flickerSpeed: 3.6,
    flickerAmount: 0.25,
    visible: true,
  },
  {
    id: "magenta-aura",
    name: "Magenta Aura",
    color: "hsl(322 90% 55%)",
    width: 320,
    height: 360,
    offsetY: 30,
    offsetX: 0,
    opacity: 0.32,
    blur: 46,
    blend: "screen",
    flickerSpeed: 2.8,
    flickerAmount: 0.3,
    visible: true,
  },
  {
    id: "blue-base",
    name: "Blue Base",
    color: "hsl(210 95% 58%)",
    width: 150,
    height: 90,
    offsetY: -10,
    offsetX: 0,
    opacity: 0.65,
    blur: 14,
    blend: "screen",
    flickerSpeed: 1.9,
    flickerAmount: 0.35,
    visible: true,
  },
  {
    id: "outer-ember",
    name: "Outer Ember",
    color: "hsl(8 95% 50%)",
    width: 230,
    height: 340,
    offsetY: 30,
    offsetX: 0,
    opacity: 0.55,
    blur: 22,
    blend: "screen",
    flickerSpeed: 2.1,
    flickerAmount: 0.45,
    visible: true,
  },
  {
    id: "body",
    name: "Orange Body",
    color: "hsl(20 95% 56%)",
    width: 180,
    height: 290,
    offsetY: 24,
    offsetX: 0,
    opacity: 0.85,
    blur: 12,
    blend: "screen",
    flickerSpeed: 1.7,
    flickerAmount: 0.5,
    visible: true,
  },
  {
    id: "gold-mid",
    name: "Gold Midbody",
    color: "hsl(38 100% 58%)",
    width: 140,
    height: 250,
    offsetY: 20,
    offsetX: 0,
    opacity: 0.9,
    blur: 8,
    blend: "screen",
    flickerSpeed: 1.35,
    flickerAmount: 0.55,
    visible: true,
  },
  {
    id: "amber-inner",
    name: "Amber Inner",
    color: "hsl(48 100% 64%)",
    width: 100,
    height: 210,
    offsetY: 18,
    offsetX: 0,
    opacity: 0.95,
    blur: 5,
    blend: "screen",
    flickerSpeed: 1.05,
    flickerAmount: 0.6,
    visible: true,
  },
  {
    id: "core",
    name: "White-Hot Core",
    color: "hsl(54 100% 92%)",
    width: 55,
    height: 150,
    offsetY: 14,
    offsetX: 0,
    opacity: 1,
    blur: 2,
    blend: "screen",
    flickerSpeed: 0.85,
    flickerAmount: 0.7,
    visible: true,
  },
  {
    id: "cyan-tip",
    name: "Cyan Tip Spark",
    color: "hsl(180 100% 70%)",
    width: 28,
    height: 72,
    offsetY: 170,
    offsetX: 0,
    opacity: 0.7,
    blur: 4,
    blend: "screen",
    flickerSpeed: 0.7,
    flickerAmount: 0.85,
    visible: true,
  },
  {
    id: "apex-wisp",
    name: "Apex Wisp",
    color: "hsl(50 100% 96%)",
    width: 14,
    height: 36,
    offsetY: 232,
    offsetX: 0,
    opacity: 0.9,
    blur: 1,
    blend: "screen",
    flickerSpeed: 0.55,
    flickerAmount: 0.9,
    visible: true,
  },
];

export function readLayers(): FlameLayer[] {
  if (typeof window === "undefined") return DEFAULT_LAYERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYERS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LAYERS;
    return parsed as FlameLayer[];
  } catch {
    return DEFAULT_LAYERS;
  }
}

export function writeLayers(layers: FlameLayer[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layers));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    /* noop — quota or privacy mode */
  }
}

export function useCustomFlameLayers(): {
  layers: FlameLayer[];
  setLayers: (next: FlameLayer[]) => void;
  updateLayer: (id: string, patch: Partial<FlameLayer>) => void;
  addLayer: () => void;
  removeLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  moveLayer: (id: string, dir: -1 | 1) => void;
  reset: () => void;
} {
  const [layers, setLayersState] = useState<FlameLayer[]>(() => readLayers());

  useEffect(() => {
    const sync = () => setLayersState(readLayers());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const commit = (next: FlameLayer[]) => {
    setLayersState(next);
    writeLayers(next);
  };

  return {
    layers,
    setLayers: commit,
    updateLayer: (id, patch) =>
      commit(layers.map((l) => (l.id === id ? { ...l, ...patch } : l))),
    addLayer: () =>
      commit([
        ...layers,
        {
          id: `layer-${Date.now().toString(36)}`,
          name: `Layer ${layers.length + 1}`,
          color: "hsl(28 95% 58%)",
          width: 140,
          height: 220,
          offsetY: 0,
          offsetX: 0,
          opacity: 0.7,
          blur: 8,
          blend: "screen",
          flickerSpeed: 1.5,
          flickerAmount: 0.4,
          visible: true,
        },
      ]),
    removeLayer: (id) => commit(layers.filter((l) => l.id !== id)),
    duplicateLayer: (id) => {
      const idx = layers.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const original = layers[idx];
      const copy: FlameLayer = {
        ...original,
        id: `layer-${Date.now().toString(36)}`,
        name: `${original.name} copy`,
      };
      const next = [...layers];
      next.splice(idx + 1, 0, copy);
      commit(next);
    },
    moveLayer: (id, dir) => {
      const idx = layers.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const target = idx + dir;
      if (target < 0 || target >= layers.length) return;
      const next = [...layers];
      [next[idx], next[target]] = [next[target], next[idx]];
      commit(next);
    },
    reset: () => commit(DEFAULT_LAYERS),
  };
}
