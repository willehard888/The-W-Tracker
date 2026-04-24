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

const STORAGE_KEY = "custom-flame-layers-v1";
const CHANGE_EVENT = "custom-flame-layers-change";

/** A sensible 4-layer starter flame so the user has something to tweak. */
export const DEFAULT_LAYERS: FlameLayer[] = [
  {
    id: "outer-glow",
    name: "Outer Glow",
    color: "hsl(18 90% 50%)",
    width: 240,
    height: 320,
    offsetY: 20,
    offsetX: 0,
    opacity: 0.45,
    blur: 28,
    blend: "screen",
    flickerSpeed: 2.4,
    flickerAmount: 0.35,
    visible: true,
  },
  {
    id: "body",
    name: "Body",
    color: "hsl(28 95% 58%)",
    width: 170,
    height: 260,
    offsetY: 10,
    offsetX: 0,
    opacity: 0.85,
    blur: 10,
    blend: "screen",
    flickerSpeed: 1.6,
    flickerAmount: 0.5,
    visible: true,
  },
  {
    id: "inner",
    name: "Inner",
    color: "hsl(45 100% 65%)",
    width: 110,
    height: 200,
    offsetY: 0,
    offsetX: 0,
    opacity: 0.95,
    blur: 4,
    blend: "screen",
    flickerSpeed: 1.1,
    flickerAmount: 0.6,
    visible: true,
  },
  {
    id: "core",
    name: "White Core",
    color: "hsl(50 100% 92%)",
    width: 60,
    height: 130,
    offsetY: -10,
    offsetX: 0,
    opacity: 1,
    blur: 2,
    blend: "screen",
    flickerSpeed: 0.8,
    flickerAmount: 0.7,
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
