// What the athlete actually trained, expressed as body areas.
//
// The input is LOGGED SETS, not the prescription. That distinction is the whole
// point: an exercise the athlete skipped must not steer their recovery, and an
// exercise they swapped in must. `workout_set_logs` carries `exercise_slug` per
// set, so "what happened" is a fact on this device rather than an inference
// from the plan.
//
// Everything here is pure. The caller fetches; this decides.
import { resolveIllustration } from "@/lib/exercise-match";
import type { RecoveryArea } from "@/data/recovery";

/**
 * Upstream muscle words folded onto the fourteen areas recovery speaks in.
 *
 * The left-hand side is not a wish list — every key is a spelling that actually
 * occurs in `ILLUSTRATED_EXERCISES`, typos included. `gluts` appears 13 times
 * against `glutes`' 14, so dropping it would lose half the posterior-chain
 * signal; `forearm` (39) is singular in every single row. The tally that
 * produced this list is reproducible: count `primary`/`secondary` values across
 * the dataset and you get exactly these 32 distinct strings.
 */
const AREA_ALIASES: Record<string, RecoveryArea> = {
  // upper body, pushing
  chest: "chest",
  shoulders: "shoulders",
  should: "shoulders", // upstream typo, 1 row
  "lateral deltoid": "shoulders",
  "posterior deltoid": "shoulders",
  "rear deltoid": "shoulders",
  triceps: "triceps",

  // upper body, pulling
  biceps: "biceps",
  bicpes: "biceps", // upstream typo, 1 row
  forearm: "forearms", // singular in every upstream row that has it, 39 of them
  forearms: "forearms",
  lats: "lats",
  "middle back": "upper back",
  "upper back": "upper back",
  back: "upper back",
  trapezius: "upper back",

  // trunk
  abdominals: "abdominals",
  "lower abdominals": "abdominals",
  obliques: "abdominals",
  core: "abdominals",
  "lower back": "lower back",

  // lower body
  glutes: "glutes",
  gluts: "glutes", // upstream typo, 13 rows — the more common spelling of the two
  "hip abductors": "glutes",
  quadriceps: "quadriceps",
  hamstrings: "hamstrings",
  hamstring: "hamstrings",
  calves: "calves",

  // neck
  neck: "neck",
  "neck extensors": "neck",
  "neck flexors": "neck",
  "neck side flexors": "neck",
};

// Deliberately unmapped: "arms" (1 row). It could mean biceps, triceps or both,
// and guessing would put the wrong stretch in front of someone. One row of lost
// signal is the cheaper mistake.

/** Fold one upstream muscle word onto a recovery area, or null if we don't map it. */
export const toArea = (muscle: string): RecoveryArea | null =>
  AREA_ALIASES[muscle.trim().toLowerCase()] ?? null;

/** A prime mover counts for more than a muscle that just came along. */
const PRIMARY_WEIGHT = 2;
const SECONDARY_WEIGHT = 1;

export interface AreaLoad {
  area: RecoveryArea;
  /** Summed weight across the session. Comparable within one result, not across. */
  weight: number;
}

/**
 * Body areas the given exercises loaded, heaviest first.
 *
 * Ties break alphabetically so the same session always produces the same
 * session — a recovery plan that reshuffles on every render reads as broken
 * even when both orders are defensible.
 *
 * Exercises with no illustration resolve to nothing and are skipped rather than
 * guessed at. That degrades quietly: a session of entirely unrecognised
 * movements returns `[]`, and `buildSession` answers that with general work.
 */
export function areaLoad(
  exercises: { slug?: string | null; name?: string | null }[],
): AreaLoad[] {
  const weights = new Map<RecoveryArea, number>();
  const add = (muscle: string, weight: number) => {
    const area = toArea(muscle);
    if (!area) return;
    weights.set(area, (weights.get(area) ?? 0) + weight);
  };

  for (const exercise of exercises) {
    const illustrated = resolveIllustration(exercise.slug ?? null, exercise.name ?? null);
    if (!illustrated) continue;
    for (const muscle of illustrated.primary) add(muscle, PRIMARY_WEIGHT);
    for (const muscle of illustrated.secondary) add(muscle, SECONDARY_WEIGHT);
  }

  return [...weights.entries()]
    .map(([area, weight]) => ({ area, weight }))
    .sort((a, b) => b.weight - a.weight || a.area.localeCompare(b.area));
}

/**
 * The same, from a day's logged sets as `useDaySets` returns them.
 *
 * Keys are the slugs with at least one logged set — which is exactly the
 * "skipped exercises must not steer recovery" rule, for free: a skipped
 * exercise has no row, so it has no key.
 */
export function areaLoadFromLoggedSets(
  setsBySlug: Record<string, { exercise_name?: string | null }[]>,
): AreaLoad[] {
  return areaLoad(
    Object.entries(setsBySlug)
      .filter(([, sets]) => sets.length > 0)
      .map(([slug, sets]) => ({ slug, name: sets[0]?.exercise_name ?? null })),
  );
}

/**
 * The areas worth addressing, cut to `limit`.
 *
 * Anything under a third of the top area's weight is dropped: the biceps that
 * came along for a row are not what needs attention after a pulling session,
 * and a plan that lists them alongside the lats reads as if nothing was
 * actually measured.
 */
export function topAreas(load: AreaLoad[], limit = 4): RecoveryArea[] {
  if (load.length === 0) return [];
  const floor = load[0].weight / 3;
  return load.filter((l) => l.weight >= floor).slice(0, limit).map((l) => l.area);
}
