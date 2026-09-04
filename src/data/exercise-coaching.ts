/**
 * Coaching layer for the illustrated exercise library.
 *
 * WHY THIS FILE EXISTS
 *
 * The library ships 269 exercises with 1,455 instruction steps between them,
 * and across all of it there are zero mentions of tempo, zero of common
 * mistakes, zero of progression, and two of breathing. The steps describe
 * POSITIONS — where to put your limbs, then "return to starting position."
 * They never answer the only question a beginner actually has, which is
 * "am I doing this right?"
 *
 * That content is not in the upstream Everkinetic data, and it is not in the
 * 542-entry photo set either. It has to be written.
 *
 * WHY IT IS STATIC AND HAND-WRITTEN
 *
 * Bad technique cues injure people. Everything here is authored, reviewed
 * before shipping, versioned in git and covered by a test — never generated
 * at runtime, where nobody would read it before it reached an athlete mid-set.
 *
 * WHY IT IS KEYED BY SLUG
 *
 * This repo has three separate exercise vocabularies: the coach's 69
 * prescribable movements, the 542-photo set, and these 269 illustrations.
 * Only 3 names match across the first and last, and only 40 across the last
 * two — name joins are exactly what has failed here repeatedly. Slugs are
 * unique and stable, so the coaching attaches to the slug.
 *
 * COVERAGE IS DELIBERATELY PARTIAL
 *
 * The core movements a beginner actually meets, where technique decides the
 * outcome and a mistake hurts. Everything else keeps its existing steps —
 * `coachingFor` returns undefined and the UI simply omits the block. Adding
 * an entry is additive and safe.
 *
 * HOUSE RULES FOR WRITING THESE
 *  - Plain language. No anatomy the reader has to look up.
 *  - Every mistake ships with its fix. "Your knees cave in" on its own is
 *    just anxiety.
 *  - No medical or physiotherapy claims, no promises about pain. The screen
 *    carries "Educational guidance — not medical advice", matching the rest
 *    of the app.
 *  - Conservative by default: when in doubt, tell them to use less weight.
 */

export interface CoachingMistake {
  /** What goes wrong, described as the athlete would notice it. */
  error: string;
  /** What to do about it. Never ship an error without one. */
  fix: string;
}

export interface ExerciseCoaching {
  /** Getting into position before the first rep. */
  setup: string[];
  /** What to think about while the rep happens. Most important first. */
  cues: string[];
  /** How the rep should move through time. */
  tempo: string;
  /** When to breathe in, when to breathe out. */
  breathing: string;
  /** The two or three things that actually go wrong, each with its fix. */
  mistakes: CoachingMistake[];
  /** Where this should be felt — and where it shouldn't. */
  feelIt: string;
  /** A genuinely easier version, for someone who cannot do this one yet. */
  easier: string;
  /** The next step once this feels controlled. */
  harder: string;
}

/** Keyed by `IllustratedExercise.slug`. */
export const EXERCISE_COACHING: Record<string, ExerciseCoaching> = {
  "barbell-squat": {
    setup: [
      "Set the bar just below shoulder height, so you lift it out rather than tiptoe under it.",
      "Bar rests on the muscle across the top of your back, not on the bone at the base of your neck.",
      "Step back two steps. Feet a little wider than your shoulders, toes turned slightly out.",
    ],
    cues: [
      "Take a breath and brace like someone is about to poke your stomach.",
      "Sit down and back at the same time, letting your knees travel forward over your toes.",
      "Push the floor away to stand up. Hips and chest rise together.",
    ],
    tempo: "3 seconds down · pause at the bottom · stand up under control",
    breathing: "Breathe in at the top and hold it down and up. Breathe out once you're standing.",
    mistakes: [
      {
        error: "Your knees drift toward each other as you stand up.",
        fix: "Push your knees out toward your little toes on the way up. If they still cave, the weight is too heavy.",
      },
      {
        error: "Your lower back rounds at the bottom.",
        fix: "Stop the rep higher — go only as deep as you can keep your back flat. Depth comes back as your hips loosen.",
      },
      {
        error: "Your heels lift and you tip onto your toes.",
        fix: "Keep your whole foot planted and think about pushing through the middle of it. Widening your stance slightly often fixes it.",
      },
    ],
    feelIt: "Thighs and glutes doing the work. Your lower back should feel braced and steady, never strained.",
    easier: "Goblet squat — hold one dumbbell at your chest. The front load makes staying upright much easier.",
    harder: "Front squat, or add weight in small steps once you can hold the bottom position calmly.",
  },

  "romanian-dead-lift": {
    setup: [
      "Stand holding the bar against the front of your thighs, feet about hip width.",
      "Soften your knees slightly and keep them there — this is a hip movement, not a squat.",
      "Pull your shoulders back so the bar stays close to your body.",
    ],
    cues: [
      "Push your hips backwards, as if closing a car door behind you.",
      "Let the bar slide down your thighs, staying in contact the whole way.",
      "Stop when your hamstrings feel tight — that's your depth, wherever it is.",
      "Drive your hips forward to stand up.",
    ],
    tempo: "3 seconds down · no bounce at the bottom · hips forward to stand",
    breathing: "Breathe in as you lower. Breathe out at the top.",
    mistakes: [
      {
        error: "The bar drifts away from your legs.",
        fix: "Keep it brushing your thighs the whole way down. A bar out in front is what makes backs sore.",
      },
      {
        error: "You bend your knees more and more, so it turns into a squat.",
        fix: "Fix the knee angle at the start and don't change it. Only the hips move.",
      },
      {
        error: "You go for the floor because that's what a deadlift looks like.",
        fix: "Depth is decided by your hamstrings, not the floor. Most people stop around mid-shin.",
      },
    ],
    feelIt: "A strong stretch down the back of your thighs. If you feel it mostly in your lower back, you're rounding — reduce the range and the weight.",
    easier: "Do it with two dumbbells, or with no weight at all, until the hip hinge feels automatic.",
    harder: "Slow the lowering to 4 seconds, or move to one leg at a time.",
  },

  "bench-press": {
    setup: [
      "Eyes roughly under the bar. Feet flat on the floor, planted.",
      "Squeeze your shoulder blades together and down, as if tucking them into your back pockets.",
      "Grip a little wider than your shoulders, wrists stacked straight over your elbows.",
    ],
    cues: [
      "Lower the bar to the lower half of your chest, not to your throat.",
      "Elbows tucked to roughly 45° from your body, not flared straight out.",
      "Press up and very slightly back, toward your face.",
    ],
    tempo: "2–3 seconds down · touch the chest lightly · press up under control",
    breathing: "Breathe in as the bar comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "The bar bounces off your chest.",
        fix: "Touch, pause for a beat, then press. If you need the bounce, the weight is too heavy.",
      },
      {
        error: "Your elbows flare straight out to the sides.",
        fix: "Think about bending the bar in half. That tucks the elbows without you having to aim.",
      },
      {
        error: "Your backside lifts off the bench.",
        fix: "Keep it down and drive through your feet instead. Lifting the hips is a sign the load is too much.",
      },
    ],
    feelIt: "Chest and the back of your arms. Shoulders should feel stable and set, not pinched at the front.",
    easier: "Dumbbell bench press or push-ups — both let your shoulders find a natural path.",
    harder: "Pause two seconds on the chest, or add weight once every rep looks the same as the first.",
  },

  "push-ups": {
    setup: [
      "Hands under your shoulders, or a touch wider.",
      "Body in one straight line from your head to your heels.",
      "Squeeze your glutes and stomach before the first rep — that's what keeps the line.",
    ],
    cues: [
      "Lower your whole body as one piece.",
      "Elbows travelling back at roughly 45°, not straight out to the sides.",
      "Push the floor away and finish with your shoulder blades spread.",
    ],
    tempo: "2 seconds down · brief pause · push up under control",
    breathing: "Breathe in on the way down. Breathe out as you push.",
    mistakes: [
      {
        error: "Your hips sag toward the floor.",
        fix: "Squeeze your glutes harder. If they still sag, move to an incline until you can hold the line.",
      },
      {
        error: "Your head reaches the floor before your chest does.",
        fix: "Keep your chin tucked and lead with your chest. Your head should be the last thing to move.",
      },
      {
        error: "You only go down a few centimetres.",
        fix: "Raise your hands onto a bench or a step and do the full range there. Half a rep trains half the muscle.",
      },
    ],
    feelIt: "Chest, the back of your arms, and your stomach working to hold the line. Not your lower back.",
    easier: "Hands on a bench, a table or a wall. The higher your hands, the easier it gets — and it is a real push-up.",
    harder: "Feet raised, a pause at the bottom, or slow the lowering to 4 seconds.",
  },

  "body-row": {
    setup: [
      "Set a bar at about hip height. Hang underneath it with your hands a little wider than your shoulders.",
      "Body in one straight line, heels on the floor.",
      "The more upright you are, the easier this is — start higher than you think you need to.",
    ],
    cues: [
      "Start by pulling your shoulder blades together, before your arms bend.",
      "Pull your chest to the bar, not your chin.",
      "Lower all the way until your arms are straight.",
    ],
    tempo: "1 second up · squeeze for a beat · 2–3 seconds down",
    breathing: "Breathe out as you pull. Breathe in as you lower.",
    mistakes: [
      {
        error: "Your hips drop and you pull in a banana shape.",
        fix: "Squeeze your glutes and keep the line. Raising the bar makes this much easier to hold.",
      },
      {
        error: "You pull with your arms and your shoulders roll forward.",
        fix: "Lead with the shoulder blades. Arms are what finish the rep, not what starts it.",
      },
      {
        error: "You stop short at the bottom.",
        fix: "Straighten your arms fully every rep. The stretch at the bottom is where the back work happens.",
      },
    ],
    feelIt: "Between and around your shoulder blades, and in your upper back. Some forearm work is normal.",
    easier: "Raise the bar higher, or bend your knees and put your feet flat.",
    harder: "Lower the bar toward the floor, or put your feet up on a bench.",
  },
};

/** Coaching for an exercise, or undefined where none has been written yet. */
export const coachingFor = (slug?: string | null): ExerciseCoaching | undefined =>
  slug ? EXERCISE_COACHING[slug] : undefined;
