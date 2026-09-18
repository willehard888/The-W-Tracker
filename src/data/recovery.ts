// The recovery movement library.
//
// WHY THIS IS A NEW FILE AND NOT A ROW IN THE CATALOG
//
// `_shared/exercise-catalog.ts` says "AUTO-GENERATED … Do not hand-edit —
// regenerate", and both it and the illustrated set are strength libraries: a
// search across all 542 catalog entries and all 268 drawings finds zero
// stretches, zero mobility drills, zero breathing work. Recovery has no content
// anywhere in the product, so it gets its own authored dataset.
//
// WHY THERE ARE NO ILLUSTRATIONS
//
// Everkinetic is exhausted — 293 upstream entries, 268 imported, all of them
// strength. Nothing here can be drawn without commissioning it, and mapping a
// stretch onto a strength drawing would show the wrong movement, which is the
// one thing the illustration rules forbid. So the app shows a branded frame and
// the text carries the movement. That is the standard the founder set when the
// same choice came up for exercise media: no image beats an inconsistent one.
//
// It works better here than it would for strength: "stand in a doorway,
// forearms on the frame at shoulder height, step through" is unambiguous in a
// way that a barbell path is not.
//
// LANGUAGE
//
// No claim about what a stretch does to tissue. Not "flushes", not "repairs",
// not "speeds recovery", not "prevents injury" — style-guard rule 21 fails the
// build on that vocabulary, because a rule written in a comment is a rule that
// erodes. What is left is what is true: where you should feel it, and how to
// hold it.
//
// CONTEXTS ARE NOT DECORATION
//
// The first version of this file gave all 23 movements both contexts, so the
// filter in build-session was a no-op and a rest day produced a byte-identical
// session to a post-workout one. Contexts here now discriminate, and the rule
// is about what the body has just done:
//
//   post_workout  holds and gentle range. Nobody wants to be walked through
//                 leg swings with a barbell still on the rack.
//   rest_day      that, plus the movement that only makes sense on a day with
//                 nothing else in it — easy flows, dynamic range, walking.
//
// So static work is shared and `light`/dynamic work is rest-day only. That is
// what makes the two sessions different in kind rather than in label.

export type RecoveryType =
  | "stretch" // held, static
  | "mobility" // controlled range, repeated
  | "flow" // several positions in sequence
  | "light" // easy movement for its own sake
  | "breathing";

export type RecoveryContext = "post_workout" | "rest_day";
export type RecoveryEquipment = "none" | "wall" | "mat";

/**
 * How hard the movement asks the body to work.
 *
 * `gentle` is what a session drops to when the athlete says they are sore.
 * There is no claim here about soreness — only that somebody who says they
 * hurt should not be handed the deepest version of a stretch.
 */
export type RecoveryIntensity = "gentle" | "moderate";

/**
 * The body map recovery speaks in.
 *
 * It is deliberately NOT the illustrated set's `primary` / `secondary`
 * vocabulary, because that vocabulary is not one. Across 269 upstream entries
 * the same muscle arrives as `glutes` and `gluts`, `forearm` and `forearms`,
 * `trapezius` and `middle back` and `upper back`, plus `bicpes` and `should`
 * where a finger slipped. Tagging a stretch `gluts` to match would carry a
 * typo into new code and still miss the thirteen rows spelled the other way.
 *
 * So the dataset commits to these fourteen and `lib/recovery/exposure.ts`
 * folds the upstream spellings onto them. A union rather than `string[]` means
 * a typo here fails the build instead of quietly matching nothing.
 */
export type RecoveryArea =
  | "chest"
  | "shoulders"
  | "triceps"
  | "biceps"
  | "forearms"
  | "lats"
  | "upper back"
  | "lower back"
  | "abdominals"
  | "glutes"
  | "quadriceps"
  | "hamstrings"
  | "calves"
  | "neck";

export interface RecoveryMovement {
  id: string;
  name: string;
  type: RecoveryType;
  /** Empty for breathing: it answers no body area, so it is never area-matched. */
  areas: RecoveryArea[];
  /** Seconds per side. No sets, no reps, no RPE — this is not strength work. */
  holdSec: number;
  /** 2 = timed on each side, so the session budget counts it twice. */
  sides: 1 | 2;
  steps: string[];
  /** Shown when the movement has a common way to get it wrong or to overreach. */
  caution?: string;
  contexts: RecoveryContext[];
  equipment: RecoveryEquipment;
  /** Defaults to "moderate"; `gentle` movements are what a sore session is built from. */
  intensity?: RecoveryIntensity;
  /** Lying or kneeling work — the wrong thing to hand somebody standing in a gym. */
  floor?: boolean;
}

/**
 * The library. Every area in `RecoveryArea` has at least one movement — a
 * session for a trained area can never come back empty — and a test holds that.
 */
export const RECOVERY_MOVEMENTS: RecoveryMovement[] = [
  // ---- chest / anterior shoulder ----
  {
    id: "doorway-chest",
    name: "Doorway chest stretch",
    type: "stretch",
    areas: ["chest", "shoulders"],
    holdSec: 30,
    sides: 1,
    steps: [
      "Stand in a doorway with your forearms on the frame, elbows at shoulder height.",
      "Step one foot through until you feel a gentle stretch across the chest.",
      "Keep your ribs down and your shoulders away from your ears.",
    ],
    caution: "Ease off if you feel it in the front of the shoulder joint rather than across the chest.",
    contexts: ["post_workout", "rest_day"],
    equipment: "wall",
  },
  {
    id: "floor-chest-opener",
    name: "Floor chest opener",
    type: "stretch",
    areas: ["chest", "shoulders"],
    holdSec: 40,
    sides: 2,
    steps: [
      "Lie face down with one arm straight out to the side at shoulder height.",
      "Roll gently onto that shoulder, using the opposite hand on the floor for control.",
      "Breathe out and let the chest open a little further.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "mat",
  },

  // ---- shoulders / rear delt ----
  {
    id: "cross-body-shoulder",
    name: "Cross-body shoulder stretch",
    type: "stretch",
    areas: ["shoulders"],
    holdSec: 30,
    sides: 2,
    steps: [
      "Bring one arm straight across your chest.",
      "Hook the other forearm under it and draw it in.",
      "Keep the shoulder down — it should not ride up towards your ear.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "none",
  },
  {
    id: "wall-slide",
    name: "Wall slide",
    type: "mobility",
    areas: ["shoulders", "upper back"],
    holdSec: 45,
    sides: 1,
    steps: [
      "Stand with your back to a wall, forearms on it, elbows at shoulder height.",
      "Slide the forearms up until they want to leave the wall, then lower.",
      "Move slowly — this is a controlled range, not a stretch to push into.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "wall",
  },

  // ---- triceps ----
  {
    id: "overhead-triceps",
    name: "Overhead triceps stretch",
    type: "stretch",
    areas: ["triceps"],
    holdSec: 30,
    sides: 2,
    steps: [
      "Reach one hand down your spine, elbow pointing up.",
      "Use the other hand to guide the elbow gently back.",
      "Stand tall — do not let your lower back arch to make room.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "none",
  },

  // ---- lats / upper back ----
  {
    id: "kneeling-lat",
    name: "Kneeling lat stretch",
    type: "stretch",
    areas: ["lats", "upper back"],
    holdSec: 40,
    sides: 1,
    steps: [
      "Kneel and place both hands on a bench or chair in front of you.",
      "Sit your hips back and let your chest sink towards the floor.",
      "You should feel it down the sides of your back.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "mat",
  },
  {
    id: "thread-the-needle",
    name: "Thread the needle",
    type: "mobility",
    areas: ["upper back", "shoulders"],
    holdSec: 30,
    sides: 2,
    steps: [
      "On all fours, slide one arm under your body, palm up.",
      "Let that shoulder and the side of your head rest towards the floor.",
      "Keep your hips stacked over your knees.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "mat",
  },
  {
    id: "cat-cow",
    name: "Cat-cow",
    type: "mobility",
    areas: ["lower back", "upper back", "abdominals"],
    holdSec: 45,
    sides: 1,
    steps: [
      "On all fours, round your back and let your head drop.",
      "Then reverse: chest forward, tailbone up, eyes ahead.",
      "Move with your breath, one position per breath.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "mat",
  },

  // ---- biceps / forearms ----
  {
    id: "wall-biceps",
    name: "Wall biceps stretch",
    type: "stretch",
    areas: ["biceps", "forearms", "chest"],
    holdSec: 30,
    sides: 2,
    steps: [
      "Place one palm flat on a wall behind you, arm straight, thumb down.",
      "Turn your body slowly away from that hand.",
      "Stop where the stretch is gentle along the front of the arm.",
    ],
    caution: "Back off at once if you feel tingling into the hand.",
    contexts: ["post_workout", "rest_day"],
    equipment: "wall",
  },
  {
    id: "forearm-flexor",
    name: "Forearm stretch",
    type: "stretch",
    areas: ["forearms"],
    holdSec: 25,
    sides: 2,
    steps: [
      "Straighten one arm, palm up.",
      "With the other hand, draw the fingers gently down towards the floor.",
      "Then turn the palm down and repeat the other direction.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "none",
  },

  // ---- quads ----
  {
    id: "standing-quad",
    name: "Standing quad stretch",
    type: "stretch",
    areas: ["quadriceps"],
    holdSec: 30,
    sides: 2,
    steps: [
      "Hold a wall for balance and take one ankle behind you.",
      "Keep the knees side by side and the hips square.",
      "Tuck the tailbone slightly to feel it down the front of the thigh.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "wall",
  },
  {
    id: "couch-stretch",
    name: "Kneeling hip flexor stretch",
    type: "stretch",
    areas: ["quadriceps", "glutes"],
    holdSec: 40,
    sides: 2,
    steps: [
      "Half-kneel with the back knee on something soft.",
      "Squeeze the back glute and tuck the tailbone under.",
      "Shift your weight forward only until the front of the hip is stretched.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "mat",
  },

  // ---- hamstrings ----
  {
    id: "supine-hamstring",
    name: "Lying hamstring stretch",
    type: "stretch",
    areas: ["hamstrings", "calves"],
    holdSec: 40,
    sides: 2,
    steps: [
      "Lie on your back, one leg bent with the foot flat.",
      "Raise the other leg, holding behind the thigh.",
      "Keep the raised knee softly bent rather than locked straight.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "mat",
  },
  {
    id: "hinge-hamstring",
    name: "Standing hamstring hinge",
    type: "mobility",
    areas: ["hamstrings", "lower back"],
    holdSec: 30,
    sides: 1,
    steps: [
      "Stand with feet hip width, one heel slightly forward.",
      "Hinge at the hips with a flat back until you feel the back of the leg.",
      "Rise and repeat slowly rather than holding at the bottom.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "none",
  },

  // ---- glutes / hips ----
  {
    id: "figure-four",
    name: "Figure-four glute stretch",
    type: "stretch",
    areas: ["glutes"],
    holdSec: 40,
    sides: 2,
    steps: [
      "Lie on your back and cross one ankle over the opposite knee.",
      "Reach through and draw the supporting thigh towards you.",
      "Let the crossed knee stay open rather than pressing it down.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "mat",
  },
  {
    id: "ninety-ninety",
    name: "90/90 hip rotation",
    type: "mobility",
    areas: ["glutes", "quadriceps"],
    holdSec: 45,
    sides: 2,
    steps: [
      "Sit with both knees bent at right angles, one leg in front, one to the side.",
      "Keep the chest tall and rotate slowly to the other side.",
      "Move through the range you own — no forcing at the end.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "mat",
  },
  {
    id: "adductor-rock",
    name: "Adductor rock-back",
    type: "mobility",
    areas: ["glutes", "hamstrings"],
    holdSec: 40,
    sides: 2,
    steps: [
      "On all fours, take one leg straight out to the side, foot flat.",
      "Rock your hips back slowly, then return.",
      "Keep both hands on the floor and the back long.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "mat",
  },

  // ---- calves ----
  {
    id: "wall-calf",
    name: "Wall calf stretch",
    type: "stretch",
    areas: ["calves"],
    holdSec: 30,
    sides: 2,
    steps: [
      "Hands on a wall, one leg back with the heel down.",
      "Keep the back knee straight and the toes pointing forward.",
      "Then bend that knee slightly to move the stretch lower.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "wall",
  },

  // ---- lower back / trunk ----
  {
    id: "supine-twist",
    name: "Lying spinal twist",
    type: "stretch",
    areas: ["lower back", "glutes", "abdominals"],
    holdSec: 40,
    sides: 2,
    steps: [
      "Lie on your back and bring one knee across your body.",
      "Let the opposite arm stay wide and heavy on the floor.",
      "Turn your head away from the knee if that feels comfortable.",
    ],
    caution: "Keep this gentle — it is a rotation to settle into, not to force.",
    contexts: ["post_workout", "rest_day"],
    equipment: "mat",
  },
  {
    id: "childs-pose",
    name: "Child's pose",
    type: "stretch",
    areas: ["lower back", "lats", "glutes"],
    holdSec: 45,
    sides: 1,
    steps: [
      "Kneel, sit your hips back towards your heels and reach the arms forward.",
      "Let the chest sink and the forehead rest down.",
      "Widen the knees if that gives your hips more room.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "mat",
  },

  // ---- neck / traps ----
  {
    id: "neck-side",
    name: "Neck side stretch",
    type: "stretch",
    areas: ["neck", "upper back"],
    holdSec: 25,
    sides: 2,
    steps: [
      "Sit or stand tall and let one ear drop towards that shoulder.",
      "Rest the same-side hand lightly on your head — no pulling.",
      "Keep the other shoulder down.",
    ],
    caution: "No pressure into the neck, and stop if anything travels down the arm.",
    contexts: ["post_workout", "rest_day"],
    equipment: "none",
  },

  // ---- depth: a second and third answer per area, so "Deep" can be deep ----
  //
  // The first version had exactly one triceps movement and one for the neck,
  // which is why a 12-minute session came back the same length as a 6-minute
  // one: the builder ran out of things to offer and quietly stopped. Depth is
  // not padding — each of these is a different position on the same area.
  {
    id: "triceps-wall",
    name: "Wall triceps stretch",
    type: "stretch",
    areas: ["triceps", "lats"],
    holdSec: 30,
    sides: 2,
    steps: [
      "Stand side-on to a wall and place the elbow of the near arm on it, above shoulder height.",
      "Let the forearm fall behind your head.",
      "Lean gently in until the back of the arm lengthens.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "wall",
    intensity: "gentle",
  },
  {
    id: "triceps-reach",
    name: "Seated triceps reach",
    type: "mobility",
    areas: ["triceps", "shoulders"],
    holdSec: 40,
    sides: 1,
    steps: [
      "Sit tall and lace your fingers together above your head, palms up.",
      "Press upward, then let the hands drift slightly back.",
      "Hold for a breath at the top of each press.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "none",
    intensity: "gentle",
  },
  {
    id: "prayer-stretch",
    name: "Kneeling wrist stretch",
    type: "stretch",
    areas: ["forearms", "biceps"],
    holdSec: 30,
    sides: 1,
    steps: [
      "Kneel and place your palms on the floor, fingers pointing back towards your knees.",
      "Rock your weight back a little at a time.",
      "Keep the palms down only as long as it stays comfortable.",
    ],
    caution: "Come off it at once if the wrists complain rather than the forearms.",
    contexts: ["post_workout", "rest_day"],
    equipment: "mat",
    intensity: "gentle",
    floor: true,
  },
  {
    id: "chest-corner",
    name: "Corner chest stretch",
    type: "stretch",
    areas: ["chest", "shoulders", "biceps"],
    holdSec: 40,
    sides: 1,
    steps: [
      "Face a corner with a forearm on each wall, elbows just below shoulder height.",
      "Step one foot in and let your chest sink forward.",
      "Both sides at once — keep the ribs down.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "wall",
    intensity: "gentle",
  },
  {
    id: "neck-rotation",
    name: "Neck rotation",
    type: "mobility",
    areas: ["neck", "upper back"],
    holdSec: 30,
    sides: 1,
    steps: [
      "Sit or stand tall and turn your head slowly to one side.",
      "Pause where the turn ends, then come back through centre to the other side.",
      "Keep the chin level the whole way.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "none",
    intensity: "gentle",
  },
  {
    id: "seated-calf-reach",
    name: "Seated calf reach",
    type: "stretch",
    areas: ["calves", "hamstrings"],
    holdSec: 35,
    sides: 2,
    steps: [
      "Sit with one leg straight out in front of you.",
      "Reach for the ball of that foot and draw the toes towards you.",
      "A towel or belt around the foot works if the reach is long.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "mat",
    intensity: "gentle",
    floor: true,
  },
  {
    id: "side-bend",
    name: "Standing side bend",
    type: "stretch",
    areas: ["abdominals", "lats", "lower back"],
    holdSec: 30,
    sides: 2,
    steps: [
      "Stand tall, reach one arm overhead and lean away from it.",
      "Keep both feet planted and the hips level.",
      "Breathe into the side that is lengthening.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "none",
    intensity: "gentle",
  },
  {
    id: "seated-lat-reach",
    name: "Seated lat reach",
    type: "stretch",
    areas: ["lats", "upper back", "triceps"],
    holdSec: 35,
    sides: 2,
    steps: [
      "Sit and hold the edge of a chair or bench beside you with one hand.",
      "Reach the other arm up and over, leaning away from the held side.",
      "You should feel it from the ribs to the armpit.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "none",
    intensity: "gentle",
  },
  {
    id: "seated-forward-fold",
    name: "Seated forward fold",
    type: "stretch",
    areas: ["hamstrings", "lower back", "calves"],
    holdSec: 45,
    sides: 1,
    steps: [
      "Sit with both legs out in front, knees softly bent.",
      "Hinge from the hips and let your head hang heavy.",
      "Do not chase your toes — let the fold be where it is.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "mat",
    intensity: "gentle",
    floor: true,
  },
  {
    id: "glute-bridge-hold",
    name: "Glute bridge hold",
    type: "mobility",
    areas: ["glutes", "quadriceps", "abdominals"],
    holdSec: 35,
    sides: 1,
    steps: [
      "Lie on your back, knees bent, feet flat and hip width.",
      "Press through your heels and lift the hips until the body is one line.",
      "Hold, then lower one vertebra at a time.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "mat",
    floor: true,
  },

  // ---- rest day only: the movement that needs a day with room in it ----
  //
  // These are why a rest day is a different session and not the same one with a
  // different heading. None of them belong in the ten minutes after a heavy
  // set — nobody wants to be walked through leg swings with the bar still
  // loaded — and all of them belong on a day whose whole job is to move well.
  {
    id: "easy-walk",
    name: "Easy walk",
    type: "light",
    areas: [],
    holdSec: 120,
    sides: 1,
    steps: [
      "Walk at a pace where you could hold a conversation.",
      "Indoors, outdoors or on the spot — it all counts.",
      "Let the arms swing.",
    ],
    contexts: ["rest_day"],
    equipment: "none",
    intensity: "gentle",
  },
  {
    id: "shoulder-circles",
    name: "Shoulder circles",
    type: "mobility",
    areas: ["shoulders", "upper back", "neck"],
    holdSec: 40,
    sides: 1,
    steps: [
      "Stand tall and roll both shoulders slowly backwards.",
      "Make the circles as large as they will go without forcing.",
      "Halfway through, reverse the direction.",
    ],
    contexts: ["rest_day"],
    equipment: "none",
    intensity: "gentle",
  },
  {
    id: "hip-circles",
    name: "Standing hip circles",
    type: "mobility",
    areas: ["glutes", "lower back", "quadriceps"],
    holdSec: 40,
    sides: 2,
    steps: [
      "Hold something for balance and lift one knee to hip height.",
      "Draw slow circles with the knee, out and around.",
      "Reverse the direction halfway.",
    ],
    contexts: ["rest_day"],
    equipment: "wall",
  },
  {
    id: "leg-swings",
    name: "Leg swings",
    type: "mobility",
    areas: ["hamstrings", "quadriceps", "glutes"],
    holdSec: 35,
    sides: 2,
    steps: [
      "Hold a wall and swing one leg forward and back, loose and unforced.",
      "Let the range grow over the first few swings rather than starting big.",
      "Keep your torso still.",
    ],
    contexts: ["rest_day"],
    equipment: "wall",
  },
  {
    id: "spine-flow",
    name: "Standing spine flow",
    type: "flow",
    areas: ["lower back", "upper back", "hamstrings"],
    holdSec: 60,
    sides: 1,
    steps: [
      "Stand tall, then roll down one vertebra at a time towards the floor.",
      "Let the knees bend as much as they want.",
      "Roll back up just as slowly, head last.",
    ],
    contexts: ["rest_day"],
    equipment: "none",
    intensity: "gentle",
  },
  {
    id: "world-greatest",
    name: "Lunge with a reach",
    type: "flow",
    areas: ["quadriceps", "glutes", "upper back", "hamstrings"],
    holdSec: 45,
    sides: 2,
    steps: [
      "Step into a long lunge and put both hands inside the front foot.",
      "Turn your chest towards the front knee and reach that arm to the ceiling.",
      "Come back down, then step through to the other side.",
    ],
    contexts: ["rest_day"],
    equipment: "mat",
  },
  {
    id: "dead-bug",
    name: "Slow dead bug",
    type: "mobility",
    areas: ["abdominals", "lower back"],
    holdSec: 45,
    sides: 1,
    steps: [
      "Lie on your back with knees and arms up over you.",
      "Lower one arm and the opposite leg slowly, then return.",
      "Keep the lower back in contact with the floor the whole time.",
    ],
    contexts: ["rest_day"],
    equipment: "mat",
    floor: true,
  },

  // ---- downshift ----
  {
    id: "box-breathing",
    name: "Box breathing",
    type: "breathing",
    areas: [],
    holdSec: 60,
    sides: 1,
    steps: [
      "In through the nose for four counts.",
      "Hold for four, out for four, hold for four.",
      "Keep it quiet and unforced — shorten the count if four is a strain.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "none",
  },
  {
    id: "long-exhale",
    name: "Long exhale",
    type: "breathing",
    areas: [],
    holdSec: 60,
    sides: 1,
    steps: [
      "Breathe in through the nose for four counts.",
      "Breathe out slowly for six to eight.",
      "Let the shoulders drop on every exhale.",
    ],
    contexts: ["post_workout", "rest_day"],
    equipment: "none",
  },
];

/** Seconds one movement occupies in a session budget — both sides if timed per side. */
export const movementSeconds = (m: RecoveryMovement): number => m.holdSec * m.sides;

export const RECOVERY_BY_ID = new Map(RECOVERY_MOVEMENTS.map((m) => [m.id, m]));
