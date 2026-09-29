import { formatRest } from "@/lib/training/runner";

// The dose as one line, everywhere a movement names it. It used to be
// inlined three times (row, sheet, runner) with three spacings.
interface DoseLike {
  sets: number;
  reps: string | number;
  rpe?: number | null;
  rest_sec?: number | null;
}

/** "5–8": a range gets the en dash, a single number stays as typed. */
export const repsLabel = (reps: string | number): string => String(reps).trim().replace(/\s*-\s*/, "–");

/** "4 × 5–8 · RPE 8", with " · 2:30 rest" when asked. */
export const prescriptionLabel = (b: DoseLike, opts: { rest?: boolean } = {}): string => {
  const parts = [`${b.sets} × ${repsLabel(b.reps)}`];
  if (b.rpe) parts.push(`RPE ${b.rpe}`);
  if (opts.rest && b.rest_sec) parts.push(`${formatRest(b.rest_sec)} rest`);
  return parts.join(" · ");
};

/** "2 reps", "1 rep", or "1–2 reps" for a half-point RPE. */
const rirLabel = (rir: number): string => {
  const n = Math.max(0, rir);
  if (Number.isInteger(n)) return `${n} rep${n === 1 ? "" : "s"}`;
  return `${Math.floor(n)}–${Math.ceil(n)} reps`;
};

/** The same dose in a sentence: "4 sets of 5–8 reps, leaving about 2 reps in reserve." */
export const prescriptionGloss = (b: DoseLike): string => {
  const reps = String(b.reps).trim() ? `${repsLabel(b.reps)} reps` : "your target reps";
  const rir = b.rpe ? `, leaving about ${rirLabel(10 - b.rpe)} in reserve` : "";
  return `${b.sets} set${b.sets === 1 ? "" : "s"} of ${reps}${rir}.`;
};
