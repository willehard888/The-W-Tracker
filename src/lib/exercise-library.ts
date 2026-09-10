// Lazy access to the bundled PHOTO exercise DB. Since the illustrated
// Everkinetic set became the primary visual layer, this serves as the
// program rows' fallback + detail source. (~540 exercises with photos +
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
