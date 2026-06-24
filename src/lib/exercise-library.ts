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
