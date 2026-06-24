// Lazy access to the bundled exercise library (~540 exercises with photos +
// instructions). The data module is ~650KB, so it is dynamic-imported on demand
// (first time an exercise card renders) and cached module-wide — it never ships
// in the main bundle.
import { useEffect, useState } from "react";
import type { LibraryExercise } from "@/data/exercises";

type LibModule = typeof import("@/data/exercises");

let cache: LibModule | null = null;
let loading: Promise<LibModule> | null = null;

export const loadExerciseLibrary = (): Promise<LibModule> => {
  if (cache) return Promise.resolve(cache);
  if (!loading) loading = import("@/data/exercises").then((m) => (cache = m));
  return loading;
};

/** Resolve a block (slug preferred, name fallback) to a library entry, or null. */
export const resolveExercise = (
  slug?: string | null,
  name?: string | null,
): LibraryExercise | null => {
  if (!cache) return null;
  const s = slug && cache.EXERCISES[slug] ? slug : cache.findSlugByName(name);
  return s ? cache.getExercise(s) : null;
};

export interface ExerciseEntry extends LibraryExercise {
  slug: string;
}

/** All library exercises as an array (empty until the module is loaded). */
export const getAllExercises = (): ExerciseEntry[] =>
  cache ? Object.entries(cache.EXERCISES).map(([slug, ex]) => ({ slug, ...ex })) : [];

/**
 * Fast, resized WebP for an exercise image. The source images are full-size
 * JPGs on a public CDN — loading 4–6 of them per session is the main reason the
 * program felt slow. We route them through the weserv image proxy to get a
 * small WebP at the exact display width (a ~96px thumb drops from ~100KB to a
 * few KB). Falls back to the original URL on <img onError>.
 */
export const exerciseImg = (url?: string | null, width = 96): string | undefined => {
  if (!url) return undefined;
  const stripped = url.replace(/^https?:\/\//, "");
  return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}&w=${width}&output=webp&q=72`;
};

/** React hook: ensures the library is loaded; re-renders when ready. */
export const useExerciseLibrary = () => {
  const [ready, setReady] = useState(!!cache);
  useEffect(() => {
    let alive = true;
    if (!ready) loadExerciseLibrary().then(() => alive && setReady(true));
    return () => { alive = false; };
  }, [ready]);
  return ready;
};
