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
 * Areas that move together, so one is not dropped while its partners rank top.
 *
 * This is not a physiological claim and it never reorders anything — it only
 * stops the floor below from discarding an area the session plainly loaded.
 *
 * It exists because of a measured failure. Run a posterior-chain day through
 * the model — Romanian deadlift, leg curl, deadlift — and it returns
 * hamstrings 5, calves 2, lower back 2, glutes 1. The glutes fall under the
 * floor and drop out, so the athlete finishes a hip-hinge session and is
 * offered nothing for their hips. The cause is upstream: of the three, only
 * the RDL names glutes at all, and only as a secondary. The data is thin, not
 * the training.
 *
 * So: an area sharing a chain with the top-ranked area survives the floor. It
 * still has to have been loaded at all — an area with no weight is not here.
 */
const CHAINS: RecoveryArea[][] = [
  ["hamstrings", "glutes", "lower back", "calves"], // hinge
  ["quadriceps", "glutes", "calves"], // squat
  ["chest", "shoulders", "triceps"], // press
  ["lats", "upper back", "biceps", "forearms"], // pull
  ["abdominals", "lower back"], // trunk
];

const chainPartners = (area: RecoveryArea): Set<RecoveryArea> => {
  const partners = new Set<RecoveryArea>();
  for (const chain of CHAINS) {
    if (!chain.includes(area)) continue;
    for (const member of chain) partners.add(member);
  }
  return partners;
};

/**
 * The areas worth addressing, ordered by load and cut to `limit`.
 *
 * Anything under a third of the top area's weight is dropped unless it shares
 * a chain with the top area: the biceps that came along for one row are not
 * what needs attention after a pulling session, and listing them beside the
 * lats reads as if nothing had been measured.
 */
export function topAreas(load: AreaLoad[], limit = 4): RecoveryArea[] {
  if (load.length === 0) return [];
  const floor = load[0].weight / 3;
  const partners = chainPartners(load[0].area);
  return load
    .filter((l) => l.weight >= floor || partners.has(l.area))
    .slice(0, limit)
    .map((l) => l.area);
}

/**
 * How many of the ranked areas count as "what you trained" rather than "what
 * came along".
 *
 * By WEIGHT, not by rank. Taking the top two was arbitrary and it showed: a
 * pressing session measures chest 6, shoulders 5, triceps 4 — three areas that
 * were all genuinely worked — and a rank cut put the triceps in the supporting
 * group, where a full primary block spent the budget before reaching them. The
 * athlete finished five pressing exercises and was offered nothing for their
 * triceps.
 *
 * Half of the top area's load is the line, capped at three so the phase stays
 * a phase, and at least one so there is always something to open with.
 */
export function primaryAreaCount(load: AreaLoad[], max = 3): number {
  if (load.length === 0) return 0;
  const line = load[0].weight / 2;
  const n = load.filter((l) => l.weight >= line).length;
  return Math.max(1, Math.min(max, n));
}
