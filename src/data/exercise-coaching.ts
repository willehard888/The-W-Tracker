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

  "leg-press": {
    setup: [
      "Set the seat so your knees bend to about a right angle at the bottom, no deeper to start.",
      "Feet flat on the middle of the platform, about shoulder width.",
      "Sit right back — your lower back and hips stay against the pad the whole set.",
    ],
    cues: [
      "Lower until your knees are bent about 90°, under control.",
      "Push through your whole foot, not just the toes.",
      "Stop just short of locking your knees at the top.",
    ],
    tempo: "3 seconds down · brief pause · press back up under control",
    breathing: "Breathe in as the platform comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "Your hips curl up off the seat at the bottom.",
        fix: "You are going too deep for now. Stop the rep higher — the moment your hips start to lift is past your range.",
      },
      {
        error: "You snap your knees straight at the top.",
        fix: "Stop just short of locked. The muscles should hold the weight at the top, not the joint.",
      },
      {
        error: "You put your hands on your knees to help.",
        fix: "Hold the handles at the side instead. If you need to push your knees, the weight is too heavy.",
      },
    ],
    feelIt: "Thighs and glutes. Your lower back should feel supported by the pad and do nothing at all.",
    easier: "Less weight and a smaller range — a shorter, controlled rep beats a deep, wobbly one.",
    harder: "Slow the lowering to 4 seconds, or add weight in small steps.",
  },

  "seated-leg-curl": {
    setup: [
      "Line your knees up with the machine's pivot — the point the lever rotates around.",
      "Pad sits just above your heels, not on your calves.",
      "Back flat against the seat, thigh pad snug so your legs stay put.",
    ],
    cues: [
      "Curl your heels down and under, toward the back of the seat.",
      "Squeeze for a beat at the bottom of the curl.",
      "Let the weight back up slowly until your legs are almost straight.",
    ],
    tempo: "1 second to curl · squeeze for a beat · 3 seconds back",
    breathing: "Breathe out as you curl. Breathe in as it returns.",
    mistakes: [
      {
        error: "Your hips lift off the seat as you curl.",
        fix: "Tighten the thigh pad and use less weight. If your hips move, your legs are getting help.",
      },
      {
        error: "The weight stack slams down between reps.",
        fix: "Take three full seconds on the way back. The slow half is where most of the work is.",
      },
      {
        error: "Your range gets shorter as the set goes on.",
        fix: "Drop the weight. Half a curl trains half the muscle, and the last reps are the ones that count.",
      },
    ],
    feelIt: "The back of your thighs, above the knee. Cramping there is common at first and eases as you get used to it.",
    easier: "Less weight and a shorter range while you learn where the squeeze is.",
    harder: "Slow the return to 4 seconds, or work one leg at a time.",
  },

  "seated-military-press": {
    setup: [
      "Bench upright, feet flat on the floor, back against the pad.",
      "Bar starts at collarbone height, hands just outside your shoulders.",
      "Wrists stacked straight above your elbows, not bent back.",
    ],
    cues: [
      "Brace your stomach before the first rep — that's what stops you arching.",
      "Press straight up, moving your head back slightly out of the way.",
      "Finish with your arms straight and your upper arms beside your ears.",
    ],
    tempo: "2 seconds down · brief pause at the collarbone · press up under control",
    breathing: "Breathe in at the bottom. Breathe out as you press up.",
    mistakes: [
      {
        error: "You lean back until it turns into an incline bench press.",
        fix: "Squeeze your glutes and brace your stomach. If you still lean back, the weight is too heavy.",
      },
      {
        error: "You press around your face in a curve to avoid hitting it.",
        fix: "Tuck your chin as the bar passes, then press straight. The bar travels in a line, your head moves.",
      },
      {
        error: "Your wrists bend back under the bar.",
        fix: "Keep the bar low in your palm, stacked over the forearm bone. A bent wrist is where the ache comes from.",
      },
    ],
    feelIt: "Shoulders and the back of your arms. Your stomach should feel braced and working.",
    easier: "Dumbbells instead of a bar — your shoulders find their own path and your head is never in the way.",
    harder: "Pause a second at the collarbone, or add weight once every rep travels the same line.",
  },

  "seated-cable-rows": {
    setup: [
      "Feet flat on the platform, knees slightly bent and kept that way.",
      "Sit tall — sit on your sit bones, not slumped back behind them.",
      "Start with your arms straight and let your shoulders reach forward.",
    ],
    cues: [
      "Start the pull with your shoulder blades, before your arms bend.",
      "Pull the handle to your belly button, elbows sliding past your ribs.",
      "Let your arms straighten and your shoulders reach forward again at the end.",
    ],
    tempo: "1 second to pull · squeeze for a beat · 3 seconds back out",
    breathing: "Breathe out as you pull. Breathe in as it returns.",
    mistakes: [
      {
        error: "Your body rocks backwards and forwards with every rep.",
        fix: "Keep your torso still and let only your arms and shoulder blades move. Rocking means the weight is too heavy.",
      },
      {
        error: "Your shoulders shrug up toward your ears.",
        fix: "Think about pulling your shoulder blades down and together, not up.",
      },
      {
        error: "You stop before your arms are straight.",
        fix: "Let it stretch all the way out every rep. The reach at the end is part of the movement, not the rest between reps.",
      },
    ],
    feelIt: "Between and around your shoulder blades. Some forearm and bicep work is normal.",
    easier: "Less weight, and focus on keeping your torso completely still.",
    harder: "Hold the squeeze for two seconds, or slow the return to four.",
  },

  "v-bar-pull-down": {
    setup: [
      "Set the thigh pad snug so you stay in the seat when the weight gets heavy.",
      "Take the V handle, sit tall, and lean back just slightly.",
      "Pick a lean and keep it — the lean should not change during the set.",
    ],
    cues: [
      "Start by pulling your shoulders down, away from your ears.",
      "Bring the handle to the top of your chest.",
      "Drive your elbows down toward your pockets, not backwards.",
      "Control the weight all the way back up until your arms are straight.",
    ],
    tempo: "1 second to pull · squeeze for a beat · 3 seconds back up",
    breathing: "Breathe out as you pull down. Breathe in as it goes up.",
    mistakes: [
      {
        error: "You lean further and further back until it becomes a row.",
        fix: "Fix the lean at the start and hold it. If you have to lean to move the weight, it is too heavy.",
      },
      {
        error: "You pull the bar behind your neck.",
        fix: "Always to the front, to the top of the chest. There is nothing to gain behind the neck and a lot of shoulder to lose.",
      },
      {
        error: "The weight yanks your arms straight at the top.",
        fix: "Take three seconds up. If it pulls you out of the seat, drop the weight.",
      },
    ],
    feelIt: "The sides of your back, under your armpits. Your arms will work too — that is fine, they should not do all of it.",
    easier: "Less weight. This is also the machine to learn the pulling motion on before you attempt a pull-up.",
    harder: "Pause at your chest for two seconds, or slow the return further.",
  },

  "pull-ups": {
    setup: [
      "Grip the bar a little wider than your shoulders, palms facing away.",
      "Hang with your arms completely straight.",
      "Squeeze your glutes and stomach so you hang still instead of swinging.",
    ],
    cues: [
      "Pull your shoulders down away from your ears before your arms bend.",
      "Lead with your chest toward the bar.",
      "Lower all the way back to a straight-arm hang.",
    ],
    tempo: "Pull under control · brief pause at the top · 3 seconds down",
    breathing: "Breathe out as you pull up. Breathe in on the way down.",
    mistakes: [
      {
        error: "You swing and kick your legs to get up.",
        fix: "Start from a still hang. If you cannot get up without swinging, use the easier version below — that is what it is for.",
      },
      {
        error: "You get your chin over the bar with your shoulders rolled forward.",
        fix: "Lead with the chest and keep your shoulders down. A slightly lower rep done properly is worth more.",
      },
      {
        error: "You stop halfway down and go again.",
        fix: "Straighten your arms fully every rep. The bottom of the movement is where most of the strength is built.",
      },
    ],
    feelIt: "The sides of your back and your arms. Your stomach works to keep you from swinging.",
    easier: "Use the assisted machine or a band, or jump to the top and lower yourself as slowly as you can. Lowering slowly is how nearly everyone earns their first pull-up — it is the normal route, not a lesser one.",
    harder: "Pause at the top, slow the lowering further, or add weight with a belt.",
  },

  "dumbbell-lunges": {
    setup: [
      "A dumbbell in each hand, arms relaxed at your sides.",
      "Stand tall with your feet under your hips.",
      "Step about one long stride — too short is what makes the knee ache.",
    ],
    cues: [
      "Step forward and drop your back knee straight down toward the floor.",
      "Front shin close to vertical, chest up.",
      "Push through your front heel to stand back up.",
    ],
    tempo: "2 seconds down · light touch at the bottom · drive up under control",
    breathing: "Breathe in as you step down. Breathe out as you come back up.",
    mistakes: [
      {
        error: "Your front knee drifts inward as you stand up.",
        fix: "Push the knee out so it tracks over your middle toes. Slow down and use lighter dumbbells until it stays there.",
      },
      {
        error: "You lean forward over your front leg.",
        fix: "Chest up, eyes ahead. Leaning forward moves the work into your lower back.",
      },
      {
        error: "You wobble and cannot find your balance.",
        fix: "Do them stationary first — stay in one split stance and just go up and down, holding a rack with one hand if you need to.",
      },
    ],
    feelIt: "The front leg's thigh and glute. The back leg is mostly there for balance.",
    easier: "No weight at all, and stationary rather than stepping. Hold something for balance — that is a legitimate way to train this.",
    harder: "Heavier dumbbells, walking lunges, or a pause at the bottom.",
  },

  "step-ups-with-dumbbells": {
    setup: [
      "A box or bench around knee height. Lower is fine — start lower than you think.",
      "A dumbbell in each hand, arms at your sides.",
      "Place your whole foot on the box, not just the front half.",
    ],
    cues: [
      "Drive up through the foot that is on the box.",
      "Stand all the way up before you come back down.",
      "Lower yourself under control — do not just drop.",
    ],
    tempo: "Drive up · stand tall for a beat · 3 seconds down",
    breathing: "Breathe out as you step up. Breathe in as you lower.",
    mistakes: [
      {
        error: "You bounce off your back foot to get up.",
        fix: "The leg on the box does the work. Try touching your back toe down lightly between reps instead of pushing off it.",
      },
      {
        error: "Your hips shoot up and you lurch onto the box.",
        fix: "The box is too high. Drop to a lower one — a step you can control beats a tall one you cannot.",
      },
      {
        error: "You drop back down and land hard.",
        fix: "Take three seconds to lower. Landing hard is where knees get sore.",
      },
    ],
    feelIt: "The leg on the box — thigh and glute. Both should be working by the end of the set.",
    easier: "A lower box and no dumbbells at all.",
    harder: "A higher box, heavier dumbbells, or a pause at the top of each rep.",
  },

  "crunches": {
    setup: [
      "On your back, knees bent, feet flat on the floor.",
      "Hands crossed over your chest — easier than behind your head, and safer for your neck.",
      "Look at a point on the ceiling and keep looking there.",
    ],
    cues: [
      "Curl your ribs toward your hips.",
      "Lift only your shoulder blades off the floor.",
      "Lower back down slowly instead of dropping.",
    ],
    tempo: "2 seconds up · squeeze for a beat · 2 seconds down",
    breathing: "Breathe out as you curl up. Breathe in as you lower.",
    mistakes: [
      {
        error: "You pull on your neck with your hands.",
        fix: "Cross your hands over your chest instead. If your neck aches, that is where the problem is.",
      },
      {
        error: "You sit all the way up.",
        fix: "Only the shoulder blades come off the floor. Sitting further uses your hips, not your stomach.",
      },
      {
        error: "You go fast and bounce off the floor.",
        fix: "Two seconds up, two seconds down. Twelve slow reps beat forty fast ones.",
      },
    ],
    feelIt: "Your stomach, right through the middle. If you feel it mostly in the front of your hips, you are coming up too far.",
    easier: "A smaller range — even lifting just your shoulders an inch counts while you find the movement.",
    harder: "Slow it down further, pause at the top, or hold a light weight on your chest.",
  },
};

/** Coaching for an exercise, or undefined where none has been written yet. */
export const coachingFor = (slug?: string | null): ExerciseCoaching | undefined =>
  slug ? EXERCISE_COACHING[slug] : undefined;
