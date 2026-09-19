// Ready-made recovery: routines you pick by name, and the guided sessions
// (body scan, NSDR, meditation, sleep) that have no body area to answer.
//
// WHY A SEPARATE FILE
//
// `recovery.ts` is what the session builder reads, and the builder rides in
// CoachSession's bundle. The cue scripts below are long text nobody needs
// mid-workout, so they live here and load with the library and the runner.
//
// LANGUAGE
//
// The same rule as the movement library, extended to the mind: say what to do,
// never what it does to you. No "calms the nervous system", no "lowers
// cortisol", no "fixes sleep". The Vault piece linked from a routine is where
// the reasoning and its evidence live; a routine is the practice.
import {
  RECOVERY_MOVEMENTS,
  movementSeconds,
  type RecoveryArea,
  type RecoveryMovement,
} from "./recovery";
import type { RecoverySession } from "@/lib/recovery/build-session";

/** The check-in habit a finished routine ticks. All exist in CHECKIN_HABITS. */
export type RecoveryHabit = "mobility" | "breathwork" | "meditation" | "meditation_pm";

export type Shelf = "mobility" | "body" | "breath" | "sleep" | "mind";

export const SHELF_LABEL: Record<Shelf, string> = {
  mobility: "Mobility and stretching",
  body: "Body care",
  breath: "Breath and stress",
  sleep: "Sleep",
  mind: "Meditation and rest",
};

const guided = (
  id: string,
  name: string,
  holdSec: number,
  steps: string[],
  cues: [number, string][],
): RecoveryMovement => ({
  id,
  name,
  type: "guided",
  areas: [],
  holdSec,
  sides: 1,
  steps,
  contexts: [],
  equipment: "none",
  intensity: "gentle",
  cues,
});

export const GUIDED: RecoveryMovement[] = [
  guided("body-scan", "Body scan", 600, [
    "Lie down or sit back and close the eyes.",
    "Move your attention slowly from the feet to the head.",
    "Notice what is there without trying to change it.",
  ], [
    [0, "Lie down or sit back. Let the eyes close."],
    [20, "Three slow breaths, longer out than in."],
    [50, "Bring your attention to the feet. Warmth, pressure, or nothing at all."],
    [100, "Move up to the calves and the shins."],
    [140, "The knees, then the thighs. Let them be heavy."],
    [190, "The hips and the seat. Let the floor take the weight."],
    [240, "The belly. Feel it rise and fall on its own."],
    [290, "The chest and the upper back."],
    [340, "The hands, the forearms, the upper arms."],
    [390, "The shoulders. Let them drop away from the ears."],
    [430, "The neck, the jaw, the tongue, the space between the eyebrows."],
    [480, "Now the whole body at once, from the feet to the top of the head."],
    [540, "If the mind wandered, that was part of it. Come back to the breath."],
    [575, "Move the fingers and toes. Open the eyes when you are ready."],
  ]),
  guided("nsdr-10", "NSDR, 10 minutes", 600, [
    "Lie on your back, arms by your sides, eyes closed.",
    "Follow the attention around the body, side by side.",
    "Stay awake and still; there is nothing to achieve.",
  ], [
    [0, "Lie on your back, arms by your sides, palms up. Close the eyes."],
    [20, "In through the nose, slowly out through the mouth. Twice more."],
    [50, "Now breathe normally and let the body get heavy."],
    [80, "Tell yourself: I am awake and resting. There is nothing to do."],
    [110, "Right hand. Right arm. Right shoulder. Right side. Right leg. Right foot."],
    [150, "Left hand. Left arm. Left shoulder. Left side. Left leg. Left foot."],
    [190, "The whole back of the body, where it touches the floor."],
    [230, "The whole front of the body."],
    [270, "The whole body together, heavy and still."],
    [320, "The breath at the nostrils: cool coming in, warm going out."],
    [380, "Count ten breaths backwards from ten. Lose the count, start again."],
    [460, "Let the counting go. Just rest."],
    [540, "Notice the room again: the sounds, the floor under you."],
    [575, "Take a deeper breath, move gently, open the eyes."],
  ]),
  guided("nsdr-20", "NSDR, 20 minutes", 1200, [
    "Lie on your back, arms by your sides, eyes closed.",
    "Two slow rounds around the body, then a long rest.",
    "Stay awake and still; there is nothing to achieve.",
  ], [
    [0, "Lie on your back, arms by your sides, palms up. Close the eyes."],
    [25, "In through the nose, slowly out through the mouth. Twice more."],
    [60, "Now breathe normally and let the body get heavy."],
    [100, "Tell yourself: I am awake and resting. There is nothing to do."],
    [140, "Right hand. Right arm. Right shoulder. Right side. Right leg. Right foot."],
    [190, "Left hand. Left arm. Left shoulder. Left side. Left leg. Left foot."],
    [240, "The whole back of the body, where it touches the floor."],
    [290, "The whole front of the body."],
    [340, "Again, slower. The right side, from the hand to the foot."],
    [410, "The left side, from the hand to the foot."],
    [480, "The whole body together, heavy and still."],
    [560, "The breath at the nostrils: cool coming in, warm going out."],
    [650, "Count ten breaths backwards from ten. Lose the count, start again."],
    [760, "Let the counting go. Picture the body sinking a little into the floor."],
    [880, "Just rest. If you drift, that is fine."],
    [1080, "Notice the room again: the sounds, the floor under you."],
    [1150, "Take a deeper breath, move gently, open the eyes."],
  ]),
  guided("breath-focus", "Breath-focus meditation", 600, [
    "Sit upright but not stiff and close the eyes.",
    "Rest the attention on the breath, one breath at a time.",
    "When the mind wanders, notice it and come back.",
  ], [
    [0, "Sit upright but not stiff. Eyes closed, or resting on the floor."],
    [20, "Find where the breath is clearest: the nose, the chest or the belly."],
    [60, "Stay with one breath at a time. In. Out."],
    [120, "When you notice the mind has wandered, name it: thinking. Then come back."],
    [200, "No need to control the breath. Just watch it."],
    [300, "Halfway. Coming back is the practice, not a failure of it."],
    [400, "Notice the small pause at the end of each breath out."],
    [500, "Widen the attention to the whole body sitting here."],
    [570, "Let the breath go. Open the eyes when you are ready."],
  ]),
  guided("open-awareness", "Open awareness", 600, [
    "Sit comfortably and close the eyes.",
    "Let sounds, sensations and thoughts come and go.",
    "Notice without holding on to anything.",
  ], [
    [0, "Sit comfortably and close the eyes."],
    [20, "A few breaths, just to arrive."],
    [60, "Open the attention to sounds. Near, far. Let them come and go."],
    [150, "Include what the body feels, without picking any one thing."],
    [240, "Include thoughts too. Watch them arrive and leave, like sounds."],
    [330, "Rest as the one who notices. Nothing needs holding on to."],
    [430, "Pulled into a thought? Notice, and widen again."],
    [530, "Come back to the breath for a few rounds."],
    [575, "Open the eyes."],
  ]),
  guided("pmr", "Tense and release", 600, [
    "Lie or sit comfortably.",
    "Tense one area for about five seconds, then let it go.",
    "Work from the feet to the face.",
  ], [
    [0, "Lie or sit comfortably. Each area: tense for five seconds, then let go."],
    [20, "Feet: curl the toes hard. Hold. And release."],
    [55, "Calves: pull the toes towards you. Hold. And release."],
    [90, "Thighs: press the knees together. Hold. And release."],
    [125, "Glutes: squeeze. Hold. And release."],
    [160, "Belly: draw it in tight. Hold. And release."],
    [195, "Hands: make fists. Hold. And release."],
    [230, "Arms: bend the elbows and tense them. Hold. And release."],
    [265, "Shoulders: lift them to the ears. Hold. And release."],
    [300, "Face: scrunch everything. Hold. And release."],
    [335, "The whole body at once. Hold. And let it all go."],
    [380, "Look for anything still holding on and let it soften."],
    [450, "Breathe slowly and stay heavy."],
    [560, "Move gently when you are ready."],
  ]),
  guided("five-senses", "Five senses reset", 180, [
    "Stop and put both feet on the floor.",
    "Name what you see, feel, hear and smell.",
    "Finish with one long breath out.",
  ], [
    [0, "Wherever you are, stop and put both feet flat on the floor."],
    [15, "One long breath out, longer than the breath in."],
    [35, "Name five things you can see."],
    [65, "Four things you can feel: the seat, the floor, your clothes, the air."],
    [95, "Three things you can hear."],
    [120, "Two things you can smell, or two you would like to."],
    [140, "One slow breath. Then carry on."],
    [165, "Feet on the floor, once more. Done."],
  ]),
  guided("park-the-day", "Park the day", 300, [
    "In bed, lights off.",
    "Give each unfinished thing a time tomorrow.",
    "Then picture simple, unrelated things, one letter at a time.",
  ], [
    [0, "In bed, lights off, on your back or your side."],
    [15, "Think of today's unfinished things. Give each one a place: tomorrow."],
    [60, "Say what you will do first tomorrow, once, and leave it there."],
    [100, "Pick a word, like garden. For each letter, picture one thing that starts with it."],
    [160, "G: a gate. A: an apple. Take your time with each picture."],
    [220, "When a letter runs dry, move to the next. Lose the word, pick a new one."],
    [280, "Keep going for as long as you are awake."],
  ]),
];

/** Every item the library can show or a routine can run, by id. */
export const LIBRARY_BY_ID = new Map<string, RecoveryMovement>([
  ...RECOVERY_MOVEMENTS.map((m) => [m.id, m] as const),
  ...GUIDED.map((m) => [m.id, m] as const),
]);

export const LIBRARY_ITEMS: RecoveryMovement[] = [...RECOVERY_MOVEMENTS, ...GUIDED];

export interface Routine {
  id: string;
  name: string;
  shelf: Shelf;
  /** One line on the card: what it is, not what it does. */
  blurb: string;
  /** A movement id, or [id, seconds per side] to run it for a set time. */
  steps: (string | [string, number])[];
  habit: RecoveryHabit;
  /** The Vault piece that explains the practice. */
  vault?: string;
}

export const ROUTINES: Routine[] = [
  // ---- mobility ----
  {
    id: "morning-mobility",
    name: "Morning mobility",
    shelf: "mobility",
    blurb: "Spine, hips and shoulders.",
    steps: ["cat-cow", "world-greatest", "down-dog", "deep-squat", "shoulder-circles", "hip-circles", "spine-flow"],
    habit: "mobility",
    vault: "mobility-posture-8-min",
  },
  {
    id: "desk-reset",
    name: "Desk reset",
    shelf: "mobility",
    blurb: "Neck, chest, hips and wrists, all standing.",
    steps: ["chin-tucks", "neck-side", "doorway-chest", "standing-hip-flexor", "wrist-extensor", "side-bend"],
    habit: "mobility",
  },
  {
    id: "hips-lower-back",
    name: "Hips and lower back",
    shelf: "mobility",
    blurb: "Floor work for the hips, glutes and lower back.",
    steps: ["couch-stretch", "pigeon", "figure-four", "happy-baby", "knees-to-chest", "supine-twist", "childs-pose"],
    habit: "mobility",
  },
  {
    id: "neck-shoulders",
    name: "Neck and shoulders",
    shelf: "mobility",
    blurb: "Neck, upper back and shoulders.",
    steps: ["neck-side", "neck-rotation", "chin-tucks", "cross-body-shoulder", "thread-the-needle", "wall-slide", "puppy"],
    habit: "mobility",
  },
  {
    id: "after-a-run",
    name: "After a run",
    shelf: "mobility",
    blurb: "Calves, hamstrings, quads and hips.",
    steps: ["wall-calf", "soleus-wall", "standing-quad", "elevated-hamstring", "standing-hip-flexor", "figure-four", "knees-to-chest"],
    habit: "mobility",
  },
  {
    id: "full-body",
    name: "Full body",
    shelf: "mobility",
    blurb: "Head to toe, one position for every area.",
    steps: [
      "cat-cow", "thread-the-needle", "puppy", "doorway-chest", "overhead-triceps", "forearm-flexor",
      "couch-stretch", "pigeon", "supine-hamstring", "wall-calf", "open-book", "sphinx", "neck-side", ["long-exhale", 66],
    ],
    habit: "mobility",
  },
  // ---- body care ----
  {
    id: "roller-legs",
    name: "Roller: legs",
    shelf: "body",
    blurb: "Calves, quads, thighs and glutes.",
    steps: ["roll-calves", "roll-quads", "roll-outer-thigh", "ball-glutes", "ball-feet"],
    habit: "mobility",
  },
  {
    id: "roller-upper",
    name: "Roller: upper body",
    shelf: "body",
    blurb: "Upper back, lats and chest.",
    steps: ["roll-upper-back", "roller-t-spine", "roll-lats", "ball-chest", "puppy"],
    habit: "mobility",
  },
  // ---- breath and stress ----
  {
    id: "stress-reset",
    name: "Stress reset",
    shelf: "breath",
    blurb: "Double inhales, long exhales.",
    steps: [["physiological-sigh", 180]],
    habit: "breathwork",
    vault: "physiological-sigh",
  },
  {
    id: "box-five",
    name: "Box breathing",
    shelf: "breath",
    blurb: "Four in, hold four, four out, hold four.",
    steps: [["box-breathing", 304]],
    habit: "breathwork",
    vault: "box-breathing",
  },
  {
    id: "even-breathing",
    name: "Even breathing",
    shelf: "breath",
    blurb: "Five and a half in, five and a half out.",
    steps: [["coherent-breathing", 297]],
    habit: "breathwork",
    vault: "coherent-breathing-5-5",
  },
  {
    id: "five-senses-reset",
    name: "Five senses reset",
    shelf: "breath",
    blurb: "Anywhere, eyes open.",
    steps: ["five-senses"],
    habit: "meditation",
  },
  // ---- sleep ----
  {
    id: "pre-sleep",
    name: "Pre-sleep wind-down",
    shelf: "sleep",
    blurb: "Floor stretches, 4-7-8, then park the day.",
    steps: ["reclined-butterfly", "knees-to-chest", "supine-twist", "legs-up-wall", ["four-seven-eight", 114], "park-the-day"],
    habit: "meditation_pm",
    vault: "foundations-recovery-and-sleep",
  },
  {
    id: "four-seven-eight-sleep",
    name: "4-7-8 in bed",
    shelf: "sleep",
    blurb: "Eight slow rounds, lights off.",
    steps: [["four-seven-eight", 152]],
    habit: "meditation_pm",
    vault: "self-hypnosis-sleep",
  },
  {
    id: "tense-release",
    name: "Tense and release",
    shelf: "sleep",
    blurb: "Feet to face, one area at a time.",
    steps: ["pmr"],
    habit: "meditation_pm",
  },
  {
    id: "park-the-day-sleep",
    name: "Park the day",
    shelf: "sleep",
    blurb: "For a busy head at bedtime.",
    steps: ["park-the-day"],
    habit: "meditation_pm",
  },
  // ---- meditation and rest ----
  {
    id: "body-scan-10",
    name: "Body scan",
    shelf: "mind",
    blurb: "Feet to head, lying down.",
    steps: ["body-scan"],
    habit: "meditation",
    vault: "mindfulness-mbsr",
  },
  {
    id: "nsdr-ten",
    name: "NSDR",
    shelf: "mind",
    blurb: "Non-sleep deep rest, lying down.",
    steps: ["nsdr-10"],
    habit: "breathwork",
    vault: "nsdr-yoga-nidra",
  },
  {
    id: "nsdr-twenty",
    name: "NSDR, long",
    shelf: "mind",
    blurb: "Two rounds around the body, then rest.",
    steps: ["nsdr-20"],
    habit: "breathwork",
    vault: "nsdr-yoga-nidra",
  },
  {
    id: "meditation-10",
    name: "Breath-focus meditation",
    shelf: "mind",
    blurb: "Sitting with the breath.",
    steps: ["breath-focus"],
    habit: "meditation",
    vault: "mindfulness-mbsr",
  },
  {
    id: "open-awareness-10",
    name: "Open awareness",
    shelf: "mind",
    blurb: "Noticing without choosing.",
    steps: ["open-awareness"],
    habit: "meditation",
  },
];

export const ROUTINE_BY_ID = new Map(ROUTINES.map((r) => [r.id, r]));

/** The routine's items in order, timed steps applied. */
export const routineMovements = (routine: Routine): RecoveryMovement[] =>
  routine.steps.flatMap((step) => {
    const [id, sec] = typeof step === "string" ? [step, undefined] : step;
    const m = LIBRARY_BY_ID.get(id);
    if (!m) return [];
    return [sec ? { ...m, holdSec: sec } : m];
  });

/**
 * A routine as the session the runner already walks. One block: a routine is
 * chosen by name, so it has no "what you trained" arc to show.
 */
export function routineSession(id: string): RecoverySession | null {
  const routine = ROUTINE_BY_ID.get(id);
  if (!routine) return null;
  const movements = routineMovements(routine);
  const areas = [...new Set(movements.flatMap((m) => m.areas))] as RecoveryArea[];
  return {
    blocks: [{ phase: "relax", label: SHELF_LABEL[routine.shelf], movements }],
    movements,
    totalSec: movements.reduce((sum, m) => sum + movementSeconds(m), 0),
    areas,
    primaryAreas: [],
    length: "standard",
    context: "rest_day",
    general: false,
  };
}

/** Where an item sits in the library, from what it is. */
export const itemShelf = (m: RecoveryMovement): Shelf =>
  m.type === "guided"
    ? "mind"
    : m.type === "breathing"
      ? "breath"
      : m.equipment === "roller" || m.equipment === "ball"
        ? "body"
        : "mobility";

/** The routines an item appears in — what the detail screen offers next. */
export const routinesWith = (itemId: string): Routine[] =>
  ROUTINES.filter((r) => r.steps.some((s) => (typeof s === "string" ? s : s[0]) === itemId));
