/**
 * MIRROR of src/lib/training/overload.ts — keep byte-identical below this
 * header; src/lib/training/__tests__/overload-parity.test.ts asserts both
 * copies agree. The runner seeds the next load from the client copy; the
 * weekly review and the coach chat quote the same number from this one — a
 * drift would have the coach prescribe a load the set row never shows.
 *
 * Progressive overload, the rule the app applies instead of asking the model
 * nicely: double progression. A movement is prescribed as a rep range at an
 * effort ("4 × 6–10 · RPE 8"). The athlete keeps the weight until every set
 * reaches the top of the range, then the weight goes up one plate and the
 * reps start again from the bottom. A set that falls under the range repeats
 * the weight. Everything here is computed from the most recent session's
 * logged sets; nothing is stored, so a hand-edited range or a swapped
 * movement is judged on its own terms next time.
 */

export const LOAD_STEP_KG = 2.5;

export type LoadMove = "up" | "hold" | "repeat" | "first";

export interface LoadAdvice {
  move: LoadMove;
  /** The weight to load next, on every set; null for a first-ever or a bodyweight movement. */
  weight: number | null;
  /** The reps to aim for: the bottom of the range after a step up, the top otherwise. */
  reps: number | null;
  /** The plate added on an "up"; 0 otherwise. */
  step: number;
  /** One sentence for the athlete: why this weight. */
  reason: string;
  /** What the sentence is built from — last session's loaded sets. */
  last: { weight: number; hit: number; total: number; date: string } | null;
}

interface HistoryRow {
  logged_on: string;
  weight?: number | null;
  reps?: number | null;
  rpe?: number | null;
}

/** "6-10" → {6, 10}; "8" → {8, 8}; "AMRAP" → null. En and em dashes count. */
export const parseRange = (reps: string | number | null | undefined): { lo: number; hi: number } | null => {
  const m = String(reps ?? "").replace(/[–—]/g, "-").match(/^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/);
  if (!m) return null;
  const lo = parseInt(m[1], 10);
  const hi = m[2] ? parseInt(m[2], 10) : lo;
  return hi >= lo ? { lo, hi } : { lo: hi, hi: lo };
};

const fmt = (kg: number) => (Number.isInteger(kg) ? `${kg}` : kg.toFixed(1).replace(/\.0$/, ""));

/**
 * What to load next, from the most recent loaded session (rows newest first,
 * as useExerciseHistory returns them) and the block's prescription.
 */
export function loadAdvice(
  history: HistoryRow[] | undefined,
  prescribedReps: string | number | null | undefined,
  prescribedRpe?: number | null,
): LoadAdvice {
  const lastDay = history?.find((h) => h.weight != null)?.logged_on;
  const sets = lastDay == null ? [] : (history ?? []).filter((h) => h.logged_on === lastDay && h.weight != null);
  if (sets.length === 0) {
    return { move: "first", weight: null, reps: parseRange(prescribedReps)?.lo ?? null, step: 0, reason: "", last: null };
  }
  const weight = Math.max(...sets.map((s) => s.weight as number));
  const range = parseRange(prescribedReps);
  const total = sets.length;
  if (!range) {
    return { move: "hold", weight, reps: sets[0].reps ?? null, step: 0, reason: `Same as last time: ${fmt(weight)} kg.`, last: { weight, hit: 0, total, date: lastDay! } };
  }
  const { lo, hi } = range;
  const hit = sets.filter((s) => (s.reps ?? 0) >= hi).length;
  const under = sets.find((s) => s.reps != null && s.reps < lo);
  // A felt effort above the prescription (the sheet stores it; the runner stores
  // the prescription itself, which never trips this) says the top was a grind.
  const strained = prescribedRpe != null && sets.some((s) => s.rpe != null && s.rpe > prescribedRpe + 0.5);
  const last = { weight, hit, total, date: lastDay! };
  if (hit === total && !strained) {
    const next = Math.round((weight + LOAD_STEP_KG) * 2) / 2;
    return {
      move: "up", weight: next, reps: lo, step: LOAD_STEP_KG, last,
      reason: `${total === 1 ? "The set" : `All ${total} sets`} hit ${hi} at ${fmt(weight)} kg — add ${fmt(LOAD_STEP_KG)} kg, back to ${lo}.`,
    };
  }
  if (under && under.reps != null) {
    return { move: "repeat", weight, reps: lo, step: 0, last, reason: `A set fell to ${under.reps} — repeat ${fmt(weight)} kg and own the ${lo}.` };
  }
  if (hit === total && strained) {
    return { move: "hold", weight, reps: hi, step: 0, last, reason: `Every set hit ${hi} but it was a grind — once more at ${fmt(weight)} kg.` };
  }
  return {
    move: "hold", weight, reps: hi, step: 0, last,
    reason: hit === 0 ? `Same ${fmt(weight)} kg — chase ${hi} on every set.` : `${hit} of ${total} sets hit ${hi} — same weight, finish the range.`,
  };
}
