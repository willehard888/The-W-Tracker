/**
 * Muscle-group resolution for the branded exercise tiles.
 *
 * The program list stopped showing library PHOTOS (mixed amateur styles,
 * slow to load, missing for unmatched names — founder: "halpa vaikutelma").
 * Every row now gets a consistent gold-on-dark glyph tile keyed by muscle
 * group, resolved from the library's primary muscles when the exercise
 * matches, or from the exercise NAME when it doesn't — so no row ever
 * falls back to a generic placeholder.
 */

export type ExerciseGroup =
  | "legs" | "chest" | "back" | "shoulders" | "arms" | "core" | "conditioning" | "full";

const MUSCLE_TO_GROUP: Record<string, ExerciseGroup> = {
  quadriceps: "legs", hamstrings: "legs", glutes: "legs", calves: "legs",
  abductors: "legs", adductors: "legs",
  chest: "chest",
  lats: "back", "middle back": "back", "lower back": "back", traps: "back", neck: "back",
  shoulders: "shoulders",
  biceps: "arms", triceps: "arms", forearms: "arms",
  abdominals: "core",
};

export const groupFromMuscles = (primary?: string[] | null): ExerciseGroup | null => {
  for (const m of primary ?? []) {
    const g = MUSCLE_TO_GROUP[m.toLowerCase()];
    if (g) return g;
  }
  return null;
};

// Ordered: first hit wins — more specific words before generic ones.
const NAME_RULES: Array<[RegExp, ExerciseGroup]> = [
  [/zone ?2|run|jog|bike|cycl|row(er|ing)? machine|swim|sprint|cardio|conditioning|jump rope|burpee/i, "conditioning"],
  [/plank|crunch|sit.?up|leg raise|ab |abs\b|core|hollow|dead bug|russian twist/i, "core"],
  [/squat|deadlift|rdl\b|lunge|leg (press|curl|extension)|calf|hip thrust|glute|hamstring|step.?up|good morning/i, "legs"],
  [/bench|chest|push.?up|fly|dip\b|dips\b/i, "chest"],
  [/\brow\b|pull.?(up|down)|chin.?up|lat |pulldown|face pull|shrug|back extension/i, "back"],
  [/overhead|shoulder|lateral raise|front raise|rear delt|arnold|military/i, "shoulders"],
  [/curl|tricep|bicep|extension|skull ?crusher|pushdown|hammer/i, "arms"],
];

export const groupFromName = (name?: string | null): ExerciseGroup => {
  const n = (name ?? "").toLowerCase();
  for (const [re, g] of NAME_RULES) if (re.test(n)) return g;
  return "full";
};

/** Library muscles win (precise); the name is the fallback. */
export const resolveGroup = (name?: string | null, primary?: string[] | null): ExerciseGroup =>
  groupFromMuscles(primary) ?? groupFromName(name);
