/**
 * The first 8 weeks — a written starter path, not an AI generation.
 *
 * WHY THIS EXISTS
 *
 * The AI program generator is genuinely personalised: it reads the athlete
 * profile, 30 days of check-ins, 14 days of reflections, active goals and the
 * athlete's own logged lifts. What it does not know is whether the person has
 * ever set foot in a gym. There is no experience field anywhere in the profile,
 * onboarding never asks, and `coach_programs.experience` is written as the
 * hardcoded string "auto" and read by nothing.
 *
 * Meanwhile its system prompt demands 4–6 loaded exercises on every training
 * day and explicitly forbids building a program out of bodyweight movements,
 * choosing from a 542-entry auto-generated catalog that carries no difficulty
 * rating and no injury contraindications. A complete beginner was being handed
 * four to six barbell lifts, four days a week, with a stock photo and "return
 * to starting position" as the instruction.
 *
 * So the first 8 weeks are written by hand instead. Few movements, repeated
 * often enough to actually learn them, loads that start deliberately light, and
 * one progression rule rather than RPE guesswork. The AI takes over afterwards,
 * once the movements are known — and by then it has real logged numbers to
 * progress from, which is the situation it was designed for.
 *
 * THE THREE-VOCABULARY PROBLEM, AND WHY EVERY MOVEMENT CARRIES THREE KEYS
 *
 * This repo holds three separate exercise vocabularies:
 *   1. the 542-entry catalog the coach prescribes from (`_shared/exercise-catalog.ts`)
 *   2. the 269 hand-drawn illustrations the library shows (`exercises-illustrated.ts`)
 *   3. the coaching written for beginners (`exercise-coaching.ts`)
 *
 * Their names do not agree — the catalog says "Romanian Deadlift", the
 * illustrations say "Romanian Dead Lift", and only 32 of 542 titles match
 * exactly. Every previous attempt to join them on a name has failed, most
 * visibly when 229 exercises rendered a beautiful illustration and no
 * instructions at all, mid-workout.
 *
 * So nothing here is joined by guessing. Each movement carries all three keys
 * explicitly, and a test asserts every one of them resolves. A beginner never
 * meets a movement without a picture and real instruction, by construction.
 */

/** One movement, pinned to all three vocabularies at once. */
export interface PathMovement {
  /**
   * Catalog slug. `resolveExercise` checks the slug before the name, so this
   * is what fetches the photo, the instructions and the set-logging identity.
   */
  catalogSlug: string;
  /**
   * The ILLUSTRATED set's title, verbatim — deliberately not the catalog's
   * name. `ExerciseRow` matches the block's `name` against the illustrations,
   * so this is what draws the picture and the rep animation.
   */
  name: string;
  /** The illustrated slug — the key the coaching layer is written against. */
  illustratedSlug: string;
}

/**
 * The 13 movements the path is built from.
 *
 * Chosen from what is ACTUALLY illustrated, which is a real constraint: the
 * illustrated set has no lat pulldown as such, no glute bridge, no plank (only
 * a side plank), no hip thrust, no goblet squat, no dumbbell row and no split
 * squat. Prescribing any of those would put a beginner in front of a movement
 * with no picture — the exact failure this file exists to prevent.
 */
export const PATH_MOVEMENTS = {
  squat:    { catalogSlug: "Barbell_Squat",                     name: "Barbell Squat",           illustratedSlug: "barbell-squat" },
  legPress: { catalogSlug: "Leg_Press",                         name: "Leg Press",               illustratedSlug: "leg-press" },
  hinge:    { catalogSlug: "Romanian_Deadlift",                 name: "Romanian Dead Lift",      illustratedSlug: "romanian-dead-lift" },
  legCurl:  { catalogSlug: "Seated_Leg_Curl",                   name: "Seated Leg Curl",         illustratedSlug: "seated-leg-curl" },
  bench:    { catalogSlug: "Barbell_Bench_Press_-_Medium_Grip", name: "Bench Press",             illustratedSlug: "bench-press" },
  pushUp:   { catalogSlug: "Pushups",                           name: "Push Ups",                illustratedSlug: "push-ups" },
  overhead: { catalogSlug: "Seated_Barbell_Military_Press",     name: "Seated Military Press",   illustratedSlug: "seated-military-press" },
  cableRow: { catalogSlug: "Seated_Cable_Rows",                 name: "Seated Cable Rows",       illustratedSlug: "seated-cable-rows" },
  pulldown: { catalogSlug: "Full_Range-Of-Motion_Lat_Pulldown", name: "V Bar Pull Down",         illustratedSlug: "v-bar-pull-down" },
  pullUp:   { catalogSlug: "Pullups",                           name: "Pull Ups",                illustratedSlug: "pull-ups" },
  lunge:    { catalogSlug: "Dumbbell_Lunges",                   name: "Dumbbell Lunges",         illustratedSlug: "dumbbell-lunges" },
  stepUp:   { catalogSlug: "Dumbbell_Step_Ups",                 name: "Step Ups with Dumbbells", illustratedSlug: "step-ups-with-dumbbells" },
  crunch:   { catalogSlug: "Crunches",                          name: "Crunches",                illustratedSlug: "crunches" },
} as const satisfies Record<string, PathMovement>;

export type PathMovementKey = keyof typeof PATH_MOVEMENTS;

/** One training day's movement order. Rest days are simply absent. */
export interface PathSession {
  /** Shown as the session focus, e.g. "Full body A". */
  focus: string;
  movements: PathMovementKey[];
}

/**
 * Three full-body sessions a week, the SAME three every week.
 *
 * Repetition is the point. A beginner who meets a squat once a fortnight never
 * stops being a beginner at it; meeting it weekly for eight weeks is what turns
 * the movement into something they own. Block 1 runs four movements a session
 * so nobody spends ninety minutes in the gym on week one.
 */
export const BLOCK_1_SESSIONS: PathSession[] = [
  { focus: "Full body A", movements: ["squat", "bench", "cableRow", "crunch"] },
  { focus: "Full body B", movements: ["hinge", "overhead", "pulldown", "lunge"] },
  { focus: "Full body C", movements: ["legPress", "pushUp", "cableRow", "stepUp"] },
];

/** Block 2 keeps the same shape and adds a fifth movement per session. */
export const BLOCK_2_SESSIONS: PathSession[] = [
  { focus: "Full body A", movements: ["squat", "bench", "cableRow", "legCurl", "crunch"] },
  { focus: "Full body B", movements: ["hinge", "overhead", "pulldown", "lunge", "crunch"] },
  { focus: "Full body C", movements: ["legPress", "pushUp", "pullUp", "stepUp", "crunch"] },
];

/** How one week is prescribed. Applies to every movement in that week. */
export interface PathWeek {
  week: number;
  theme: string;
  progression_note: string;
  sets: number;
  reps: string;
  rpe: number;
  rest_sec: number;
}

/**
 * Load goes up on one rule, stated in plain words, rather than by asking a
 * beginner to rate an effort they have no reference for yet. RPE is still
 * recorded because the coach reads it later — but the instruction is the note.
 */
export const BLOCK_1_WEEKS: PathWeek[] = [
  {
    week: 1,
    theme: "Learn the movements",
    progression_note:
      "This week is technique, not weight. Pick a load you could lift about five more times than asked, on everything. Finishing every set feeling like you had plenty left is exactly right.",
    sets: 2, reps: "8", rpe: 5, rest_sec: 120,
  },
  {
    week: 2,
    theme: "Add a set",
    progression_note:
      "Same weights, one more set on each movement. If a movement still feels awkward, keep the weight where it is — another week of practice is worth more than another 5 kg.",
    sets: 3, reps: "8", rpe: 6, rest_sec: 120,
  },
  {
    week: 3,
    theme: "Start adding weight",
    progression_note:
      "The rule from here: if you finished all sets last week with clean technique, add the smallest available increment — usually 2.5 kg on a barbell, one plate or one notch on a machine. If you did not, repeat the same weight.",
    sets: 3, reps: "8", rpe: 7, rest_sec: 120,
  },
  {
    week: 4,
    theme: "More reps at the same weight",
    progression_note:
      "Same weights as last week, two more reps per set. This is how you find out the load actually got easier rather than just heavier.",
    sets: 3, reps: "10", rpe: 7, rest_sec: 120,
  },
];

export const BLOCK_2_WEEKS: PathWeek[] = [
  {
    week: 1,
    theme: "Five movements now",
    progression_note:
      "A fifth movement joins each session. Drop back to eight reps and keep last block's weights — the extra work is the new stimulus, not extra load on top of it.",
    sets: 3, reps: "8", rpe: 7, rest_sec: 120,
  },
  {
    week: 2,
    theme: "Build the reps back",
    progression_note:
      "Same weights, back up to ten reps. Same rule as before: all sets completed cleanly means you add the smallest increment next week.",
    sets: 3, reps: "10", rpe: 7, rest_sec: 120,
  },
  {
    week: 3,
    theme: "Add weight",
    progression_note:
      "Add the smallest increment to everything you completed cleanly last week, and drop back to eight reps to absorb it.",
    sets: 3, reps: "8", rpe: 8, rest_sec: 150,
  },
  {
    week: 4,
    theme: "Finish the block",
    progression_note:
      "Same weights, ten reps, last week of the written path. Log every set — your coach reads these numbers to build what comes next, and it can only be as good as what you record.",
    sets: 3, reps: "10", rpe: 8, rest_sec: 150,
  },
];

/** Which weekdays the path trains on. Mon / Wed / Fri, a day off between. */
