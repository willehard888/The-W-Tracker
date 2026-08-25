/**
 * Name → library-slug matching for coach-program exercise blocks.
 *
 * AI programs write human names ("Barbell Back Squat", "Seated Calf Raise
 * (Machine)", "RDL") that the auto-generated library's exact-name map misses,
 * so rows lost their detail (photos + instructions). This layer expands a
 * name into candidates (paren-stripping, aliases) and falls back to a
 * token-subset match that is far safer than raw substring inclusion.
 */

export const normalizeExerciseName = (s: string): string =>
  s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

/** Common program-speak → the library's exact entry name. */
export const EXERCISE_ALIASES: Record<string, string> = {
  "back squat": "Barbell Squat",
  "barbell back squat": "Barbell Squat",
  "front squat": "Front Squat (Clean Grip)",
  "romanian deadlift": "Romanian Deadlift",
  "barbell romanian deadlift": "Romanian Deadlift",
  "rdl": "Romanian Deadlift",
  "bent over row": "Bent Over Barbell Row",
  "barbell bent over row": "Bent Over Barbell Row",
  "seated calf raise": "Barbell Seated Calf Raise",
  "seated calf raise machine": "Barbell Seated Calf Raise",
  "overhead press": "Barbell Shoulder Press",
  "military press": "Barbell Shoulder Press",
  "lat pulldown": "Full Range-Of-Motion Lat Pulldown",
  "pulldown": "Full Range-Of-Motion Lat Pulldown",
  "hip thrust": "Barbell Hip Thrust",
  "bench press": "Barbell Bench Press - Medium Grip",
  "barbell bench press": "Barbell Bench Press - Medium Grip",
};

/** Ordered name candidates to try against the exact-name lookup. */
export const candidatesForName = (name?: string | null): string[] => {
  if (!name) return [];
  const out: string[] = [name];
  const noParens = name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (noParens && noParens !== name) out.push(noParens);
  const norm = normalizeExerciseName(name);
  const alias = EXERCISE_ALIASES[norm];
  if (alias) out.push(alias);
  return out;
};

/**
 * Fallback: the library entry whose token set is fully CONTAINED in the query
 * ("barbell back squat" ⊇ "barbell squat") — the most-specific such entry
 * wins. Never matches on extra library tokens the query doesn't have, which
 * is what made naive substring matching pick wrong exercises.
 */
export const bestTokenSubsetSlug = (
  name: string,
  byNormName: Map<string, string>,
): string | null => {
  const queryTokens = new Set(normalizeExerciseName(name).split(" ").filter(Boolean));
  if (queryTokens.size === 0) return null;
  let best: string | null = null;
  let bestCount = 1; // require ≥2 shared tokens — 1 is too weak ("barbell")
  for (const [key, slug] of byNormName) {
    const keyTokens = key.split(" ").filter(Boolean);
    if (keyTokens.length <= bestCount) continue;
    if (keyTokens.every((t) => queryTokens.has(t))) {
      best = slug;
      bestCount = keyTokens.length;
    }
  }
  return best;
};
