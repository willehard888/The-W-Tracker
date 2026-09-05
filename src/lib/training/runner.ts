/**
 * The state behind an active workout — kept pure, so it can be reasoned about
 * and tested without a database, a screen, or a logged-in user.
 *
 * WHY THIS SHAPE
 *
 * A session is a list of exercises, each prescribing a number of working sets.
 * What the athlete has actually done arrives separately, as rows keyed by
 * exercise slug and set number. Everything the runner needs to show — which
 * exercise is on stage, which set is next, how far through they are, whether
 * they are finished — is a function of those two things and nothing else.
 *
 * Deriving rather than storing matters here. A workout is the one place in this
 * app where the phone gets put down mid-task, the screen locks, the connection
 * drops and the app gets killed by iOS while the athlete is under a bar. Any
 * progress held only in component state is lost by then. Because position is
 * derived from logged sets, reopening the session puts them back exactly where
 * they were, on any device, with no session-restore code at all.
 */

/** A prescribed exercise within a session, as plan_json describes it. */
export interface SessionBlockShape {
  slug?: string | null;
  name?: string | null;
  sets?: number | null;
  reps?: string | number | null;
  rpe?: number | null;
  rest_sec?: number | null;
}

/** One exercise on the runner's stage. */
export interface SessionExercise {
  /** Catalog slug — the logging identity. */
  slug: string;
  name: string;
  /** How many working sets are prescribed. Always at least 1. */
  sets: number;
  /** Rep target as prescribed, e.g. "8-12". Kept as text: it is a range. */
  reps: string;
  rpe: number | null;
  restSec: number;
}

/** A set the athlete has already logged. */
export interface LoggedSet {
  set_index: number;
  weight?: number | null;
  reps?: number | null;
}

/** Default rest when the plan does not prescribe one. */
export const DEFAULT_REST_SEC = 120;

/**
 * Turn a plan day's blocks into the runner's exercise list.
 *
 * Blocks without a slug are dropped: the slug is the logging identity, and an
 * exercise whose sets cannot be recorded would silently lose the athlete's work.
 * Better to not offer it than to take input and discard it.
 */
export const buildSessionPlan = (blocks?: unknown): SessionExercise[] => {
  if (!Array.isArray(blocks)) return [];
  const out: SessionExercise[] = [];
  for (const raw of blocks as SessionBlockShape[]) {
    const slug = typeof raw?.slug === "string" ? raw.slug.trim() : "";
    if (!slug) continue;
    const name = (typeof raw?.name === "string" ? raw.name.trim() : "") || slug;
    const sets = Number.isFinite(raw?.sets) ? Math.max(1, Math.min(Math.trunc(raw!.sets as number), 20)) : 1;
    const reps = raw?.reps == null ? "" : String(raw.reps).trim();
    const rpe = Number.isFinite(raw?.rpe) ? (raw!.rpe as number) : null;
    const restSec = Number.isFinite(raw?.rest_sec) && (raw!.rest_sec as number) > 0
      ? Math.min(Math.trunc(raw!.rest_sec as number), 900)
      : DEFAULT_REST_SEC;
    out.push({ slug, name, sets, reps, rpe, restSec });
  }
  return out;
};

/** How many of an exercise's prescribed sets are logged. Never over-counts. */
export const setsDoneFor = (ex: SessionExercise, logged?: LoggedSet[]): number => {
  if (!logged?.length) return 0;
  // Count DISTINCT set numbers within the prescription. A re-logged set 2 must
  // not read as two sets done, and a stray set 7 on a 3-set exercise (from an
  // earlier, longer prescription) must not push it past 100 %.
  const seen = new Set<number>();
  for (const l of logged) {
    if (l.set_index >= 1 && l.set_index <= ex.sets) seen.add(l.set_index);
  }
  return seen.size;
};

export interface SessionProgress {
  /** Total prescribed sets across the session. */
  totalSets: number;
  doneSets: number;
  /** Exercises with every prescribed set logged. */
  exercisesDone: number;
  totalExercises: number;
  /** 0–1. Zero-safe for an empty session. */
  fraction: number;
  /** Index of the exercise to work on now, or -1 when the session is done. */
  currentExerciseIndex: number;
  /** 1-based set to do next within that exercise, or 0 when done. */
  currentSetIndex: number;
  isComplete: boolean;
}

/**
 * Where the athlete is.
 *
 * The current exercise is the FIRST with unlogged sets, not the furthest they
 * have reached. Someone who skips ahead and comes back should be returned to
 * the gap, not past it.
 */
export const sessionProgress = (
  plan: SessionExercise[],
  logged: Record<string, LoggedSet[]>,
): SessionProgress => {
  let totalSets = 0;
  let doneSets = 0;
  let exercisesDone = 0;
  let currentExerciseIndex = -1;
  let currentSetIndex = 0;

  plan.forEach((ex, i) => {
    const done = setsDoneFor(ex, logged[ex.slug]);
    totalSets += ex.sets;
    doneSets += done;
    if (done >= ex.sets) {
      exercisesDone += 1;
    } else if (currentExerciseIndex === -1) {
      currentExerciseIndex = i;
      // The next set is the lowest prescribed number not yet logged, so a gap
      // left by an interrupted session gets filled rather than skipped.
      const seen = new Set((logged[ex.slug] ?? []).map((l) => l.set_index));
      let next = 1;
      while (next <= ex.sets && seen.has(next)) next += 1;
      currentSetIndex = next;
    }
  });

  return {
    totalSets,
    doneSets,
    exercisesDone,
    totalExercises: plan.length,
    fraction: totalSets > 0 ? doneSets / totalSets : 0,
    currentExerciseIndex,
    currentSetIndex,
    isComplete: plan.length > 0 && exercisesDone === plan.length,
  };
};

/**
 * The set to prefill from: the same set number last time, falling back to the
 * previous set in this session. Beginners have no idea what to load; the number
 * they used last week is the single most useful hint available.
 */
export const suggestedLoad = (
  history: LoggedSet[] | undefined,
  setIndex: number,
  currentSession: LoggedSet[] | undefined,
): { weight: number | null; reps: number | null } => {
  const sameSetLastTime = history?.find((h) => h.set_index === setIndex && h.weight != null);
  if (sameSetLastTime) {
    return { weight: sameSetLastTime.weight ?? null, reps: sameSetLastTime.reps ?? null };
  }
  // Nothing from last time — carry this session's previous set forward, which
  // is what someone doing straight sets would type anyway.
  const prevThisSession = [...(currentSession ?? [])]
    .filter((s) => s.set_index < setIndex && s.weight != null)
    .sort((a, b) => b.set_index - a.set_index)[0];
  if (prevThisSession) {
    return { weight: prevThisSession.weight ?? null, reps: prevThisSession.reps ?? null };
  }
  return { weight: null, reps: null };
};

/** mm:ss for the rest timer. Clamps at zero — never shows a negative clock. */
export const formatRest = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};

/** Total volume (kg × reps) across logged sets — the session summary's headline. */
export const sessionVolume = (logged: Record<string, LoggedSet[]>): number => {
  let total = 0;
  for (const sets of Object.values(logged ?? {})) {
    for (const s of sets ?? []) {
      if (s.weight != null && s.reps != null) total += s.weight * s.reps;
    }
  }
  return Math.round(total);
};
