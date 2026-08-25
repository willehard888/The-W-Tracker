// Lazy access to the bundled exercise library (~540 exercises with photos +
// instructions). The data module is ~650KB, so it is dynamic-imported on demand
// (first time an exercise card renders) and cached module-wide — it never ships
// in the main bundle.
import { useEffect, useState } from "react";
import type { LibraryExercise } from "@/data/exercises";
import { candidatesForName, bestTokenSubsetSlug, normalizeExerciseName } from "@/lib/exercise-match";

type LibModule = typeof import("@/data/exercises");

let cache: LibModule | null = null;
let loading: Promise<LibModule> | null = null;

export const loadExerciseLibrary = (): Promise<LibModule> => {
  if (cache) return Promise.resolve(cache);
  if (!loading) loading = import("@/data/exercises").then((m) => (cache = m));
  return loading;
};

let byNormName: Map<string, string> | null = null;
const normNameMap = (lib: LibModule): Map<string, string> => {
  if (!byNormName) {
    byNormName = new Map();
    for (const [slug, ex] of Object.entries(lib.EXERCISES)) {
      byNormName.set(normalizeExerciseName(ex.name), slug);
    }
  }
  return byNormName;
};

/** Resolve a block (slug preferred, name fallback) to a library entry, or null.
 *  AI programs write human names ("Barbell Back Squat", "RDL") — candidates
 *  (paren-strip + aliases) run first, then a token-subset fallback, so far
 *  fewer rows lose their technique photos + instructions. */
export const resolveExercise = (
  slug?: string | null,
  name?: string | null,
): LibraryExercise | null => {
  if (!cache) return null;
  if (slug && cache.EXERCISES[slug]) return cache.getExercise(slug);
  for (const cand of candidatesForName(name)) {
    const s = cache.findSlugByName(cand);
    if (s) return cache.getExercise(s);
  }
  const fallback = name ? bestTokenSubsetSlug(name, normNameMap(cache)) : null;
  return fallback ? cache.getExercise(fallback) : null;
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

/** Brand treatment: a TRUE server-side duotone at the proxy (dark plum →
 *  gold, slight contrast). The source photos come from hundreds of different
 *  gyms (red walls, harsh flash) and read cheap in color — the duotone puts
 *  every one of the 542 photos in the same Whealth Factory tone, as a tiny
 *  cached WebP. Verified visually against multiple source gyms. */
export const exerciseImgBranded = (url?: string | null, width = 96): string | undefined => {
  const base = exerciseImg(url, width);
  return base ? `${base}&filt=duotone&start=0d0a14&stop=d9b25c&con=8` : undefined;
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
