import type { ExerciseCoaching } from "@/data/exercise-coaching";

/**
 * Coaching entries — upper body movements the generator can prescribe
 * (src/data/illustration-map.ts). Same schema and house rules as
 * exercise-coaching.ts: plain language, every mistake ships with its fix, no
 * medical claims, "use less weight" when in doubt. Keyed by illustrated slug.
 *
 * Groups in this file, in order: barbell presses, dumbbell presses, machine
 * and Smith presses, bodyweight pushing, cable and specialty presses, the
 * one-arm shoulder press, rows, upright rows, the underhand pulldown, raises
 * and rotation, curls, triceps extensions, pullovers.
 *
 * Two families are written deliberately short-range and light: the neck
 * (guillotine) press and every upright row. Each names the regular bench
 * press or the lateral raise as the easier option. Nothing here claims a
 * movement is safe or unsafe — it says what to do.
 */
export const UPPER_BODY_COACHING: Record<string, ExerciseCoaching> = {
  // ── Barbell presses ───────────────────────────────────────────────────

  "wide-grip-bench-press": {
    setup: [
      "Eyes under the bar, feet flat and planted, shoulder blades squeezed together and down.",
      "Grip about one hand-width wider than your usual bench grip — not out at the collars.",
      "Wrists stacked straight over your elbows. If they bend back, the grip is too wide for you.",
    ],
    cues: [
      "Lower the bar to the lower half of your chest, elbows under the bar the whole way.",
      "Keep your shoulder blades pinned to the bench — the wide grip pulls them apart.",
      "Press up under control. The range is shorter than usual; do not chase a deeper touch.",
    ],
    tempo: "3 seconds down · touch lightly · press up under control",
    breathing: "Breathe in as the bar comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "Your elbows flare straight out to the sides and your shoulders feel pinched at the front.",
        fix: "Bring the grip in by a hand-width and tuck your elbows a little. If the pinch stays, go back to a regular bench press.",
      },
      {
        error: "The bar bounces off your chest.",
        fix: "Touch, pause for a beat, then press. If you need the bounce, the weight is too heavy.",
      },
      {
        error: "Your wrists bend back and the bar sits in your fingers.",
        fix: "Bar low in the palm, over the forearm bone. Narrow the grip until you can keep the wrist straight.",
      },
    ],
    feelIt: "Across your chest, more than a normal bench press. Not at the front of your shoulders — if you feel it there, narrow the grip.",
    easier: "Bench press with a regular grip — the same movement with more room for your shoulders.",
    harder: "Pause two seconds on the chest, or add weight in small steps once every rep looks the same.",
  },

  "close-grip-barbell-bench-press": {
    setup: [
      "Set up as for a bench press: eyes under the bar, feet planted, shoulder blades squeezed together and down.",
      "Hands about shoulder width apart — closer than that, and your wrists pay for it.",
      "Wrists straight, bar low in the palm.",
    ],
    cues: [
      "Elbows tucked along your ribs the whole way down and the whole way up.",
      "Lower the bar to the lower half of your chest, not your throat.",
      "Press up and finish with your arms straight.",
    ],
    tempo: "2–3 seconds down · touch lightly · press up under control",
    breathing: "Breathe in as the bar comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "Your elbows flare out and it turns into a normal bench press.",
        fix: "Think about brushing your ribs with your elbows. Use less weight until they stay tucked for the whole set.",
      },
      {
        error: "Your wrists bend back under the bar.",
        fix: "Widen the grip a little — shoulder width is close enough. Keep the bar stacked over your forearm.",
      },
      {
        error: "The bar drifts toward your face on the way up.",
        fix: "Press up and slightly toward your feet, and lower to the same spot on your chest every rep.",
      },
    ],
    feelIt: "The back of your arms first, then your chest. Not your wrists.",
    easier: "Bench press with a regular grip, or push-ups with your hands close together.",
    harder: "Pause a second on the chest, or slow the lowering to four seconds.",
  },

  "barbell-neck-press": {
    setup: [
      "This is the bench press lowered to the top of your chest with the elbows out. Keep the weight light and the range short.",
      "Set the safety bars at collarbone height so the bar can never reach your throat.",
      "Shoulder blades squeezed together and down, feet planted. Grip a little wider than your shoulders.",
    ],
    cues: [
      "Stop the bar a few centimetres above your collarbones — it never touches.",
      "Elbows out to the sides, wrists straight over them.",
      "Press straight up under control. Nothing here is fast.",
    ],
    tempo: "3 seconds down · stop above the collarbones · press up under control",
    breathing: "Breathe in as the bar comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "You lower the bar all the way to your neck.",
        fix: "Stop higher — a few centimetres above the collarbones is the bottom. Set the safeties so you cannot go further.",
      },
      {
        error: "Your shoulder blades come apart and your shoulders roll forward at the bottom.",
        fix: "Squeeze the shoulder blades harder and shorten the range. If they still slip, go back to a regular bench press.",
      },
      {
        error: "You load it like your bench press.",
        fix: "Start with the empty bar and add weight only in the smallest steps. This is a light, feel-the-chest movement, not a strength lift.",
      },
    ],
    feelIt: "The upper part of your chest. Not the front of your shoulders — the moment you feel it there, stop the set.",
    easier: "The regular bench press — same muscles, more room for your shoulders, and it is the version to build strength on.",
    harder: "Pause for a beat above the collarbones. Add weight only when every rep of the set is identical.",
  },

  "incline-bench-press": {
    setup: [
      "Bench between 30 and 45 degrees. Lower is easier on the shoulders — start there.",
      "Sit back so your hips and upper back are on the pad, feet flat and planted.",
      "Shoulder blades squeezed together and down. Grip a little wider than your shoulders.",
    ],
    cues: [
      "Lower the bar to the top of your chest, just below the collarbones.",
      "Elbows under the bar, tucked to about 45 degrees.",
      "Press up and very slightly back, toward your face.",
    ],
    tempo: "2–3 seconds down · touch lightly · press up under control",
    breathing: "Breathe in as the bar comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "The bar comes down to your throat.",
        fix: "Aim for the top of the chest, not the neck. Set the bench one notch lower and the bar lands where it should.",
      },
      {
        error: "Your hips slide down and your lower back arches off the pad.",
        fix: "Sit higher on the bench and drive your feet into the floor. If you still arch, the weight is too heavy.",
      },
      {
        error: "The bar bounces off your chest.",
        fix: "Touch, pause for a beat, then press. If you need the bounce, the weight is too heavy.",
      },
    ],
    feelIt: "The upper part of your chest and the front of your shoulders, with the back of your arms helping. Not your lower back.",
    easier: "Incline dumbbell press — your shoulders find their own path and there is no bar to aim.",
    harder: "Pause two seconds on the chest, or add weight in small steps once every rep looks the same.",
  },

  "decline-barbell-bench-press": {
    setup: [
      "Hook your legs under the pads before you take the bar — they are what hold you on the bench.",
      "Have someone hand you the bar or help with the lift-off; the rack sits behind your head.",
      "Shoulder blades squeezed together and down. Grip a little wider than your shoulders.",
    ],
    cues: [
      "Lower the bar to your lower chest, elbows tucked to about 45 degrees.",
      "Press straight up. The range is short — do not force the bar higher than straight arms.",
      "Keep your head and upper back on the bench the whole set.",
    ],
    tempo: "2–3 seconds down · touch lightly · press up under control",
    breathing: "Breathe in as the bar comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "The bar lands high on your chest or at your throat.",
        fix: "Aim for the bottom of the breastbone. On a decline the bar sits lower than you expect — let it.",
      },
      {
        error: "The bar bounces off your chest.",
        fix: "Touch, pause for a beat, then press. If you need the bounce, the weight is too heavy.",
      },
      {
        error: "You feel light-headed by the end of the set.",
        fix: "Keep the sets short, breathe every rep, and sit up slowly between them. Fewer reps at a time is fine.",
      },
    ],
    feelIt: "The lower part of your chest and the back of your arms. Your legs will work to hold you in place — that is normal.",
    easier: "Flat bench press, or the decline dumbbell press — dumbbells are easier to get into position without help.",
    harder: "Pause a second on the chest, or add weight in small steps.",
  },

  "wide-grip-decline-bench-press": {
    setup: [
      "Legs hooked under the pads, someone to help with the lift-off.",
      "Grip about one hand-width wider than your usual bench grip, wrists straight over your elbows.",
      "Shoulder blades squeezed together and down before you take the bar.",
    ],
    cues: [
      "Lower the bar to your lower chest, elbows under the bar.",
      "Keep your shoulder blades pinned — the wide grip wants to pull them apart.",
      "Press up under control. The range is short; a shallow, tidy rep is the goal.",
    ],
    tempo: "3 seconds down · touch lightly · press up under control",
    breathing: "Breathe in as the bar comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "Your elbows flare straight out and your shoulders feel pinched at the front.",
        fix: "Bring the grip in by a hand-width. If the pinch stays, do the decline press with a regular grip.",
      },
      {
        error: "The bar bounces off your chest.",
        fix: "Touch, pause for a beat, then press. If you need the bounce, the weight is too heavy.",
      },
      {
        error: "Your wrists bend back and the bar sits in your fingers.",
        fix: "Bar low in the palm, over the forearm bone. Narrow the grip until you can keep the wrist straight.",
      },
    ],
    feelIt: "Across the lower part of your chest. Not the front of your shoulders — if you feel it there, narrow the grip.",
    easier: "Decline barbell bench press with a regular grip, or the flat bench press.",
    harder: "Pause two seconds on the chest, or add weight in small steps.",
  },

  "reverse-triceps-bench-press-with-barbell": {
    setup: [
      "Palms face toward your head — an underhand grip, hands about shoulder width apart.",
      "Wrap your thumbs around the bar. This grip is the awkward part, so start with the empty bar.",
      "Have someone hand you the bar, or press from safety pins set just above your chest. Shoulder blades squeezed together and down.",
    ],
    cues: [
      "Elbows tucked to your ribs, wrists straight, the whole rep.",
      "Lower the bar to the bottom of your chest, just above your stomach.",
      "Press up and slightly toward your feet. Finish with your arms straight.",
    ],
    tempo: "3 seconds down · touch lightly · press up under control",
    breathing: "Breathe in as the bar comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "Your wrists bend back and the bar wants to roll out of your hands.",
        fix: "Thumbs around the bar, bar low in the palm, and less weight. If you still cannot hold the wrist straight, do the close-grip bench press instead.",
      },
      {
        error: "Your elbows drift out to the sides.",
        fix: "Think about brushing your ribs with your elbows. Use a lighter bar until they stay there for the whole set.",
      },
      {
        error: "The bar drifts toward your face on the way up.",
        fix: "Lower to the same low spot every rep and press slightly toward your feet. Set the safeties in case it does.",
      },
    ],
    feelIt: "The back of your arms, with the lower chest helping. Not your wrists.",
    easier: "Close-grip barbell bench press — the same elbow path with a grip your wrists already know.",
    harder: "Pause a second on the chest, or slow the lowering to four seconds. Add weight in the smallest steps.",
  },

  // ── Dumbbell presses ──────────────────────────────────────────────────

  "bench-press-dumbbell": {
    setup: [
      "Sit on the end of the bench with the dumbbells on your thighs, then lie back and use your knees to kick them up to your chest.",
      "Feet flat and planted, shoulder blades squeezed together and down.",
      "Start with the dumbbells above your chest, arms straight, palms facing forward.",
    ],
    cues: [
      "Lower until the dumbbells are level with your chest and you feel a light stretch.",
      "Elbows tucked to about 45 degrees, not straight out to the sides.",
      "Press up and slightly in, so the dumbbells come together above your chest without clanking.",
    ],
    tempo: "2–3 seconds down · brief pause at the bottom · press up under control",
    breathing: "Breathe in as the dumbbells come down. Breathe out as you press.",
    mistakes: [
      {
        error: "Your elbows flare straight out and your shoulders feel pinched.",
        fix: "Tuck them toward your ribs. Turn the dumbbells slightly inward at the bottom — most people's shoulders prefer it.",
      },
      {
        error: "You drop the dumbbells far below your chest for a bigger stretch.",
        fix: "Stop when the dumbbells are level with your chest. Deeper than that is your shoulder joint stretching, not your chest working.",
      },
      {
        error: "The dumbbells wander outward on the way up.",
        fix: "Press to a point above your chest, not straight up from where they are. Less weight until the path is the same every rep.",
      },
    ],
    feelIt: "Your chest, with the back of your arms and front of your shoulders helping. Shoulders should feel set and stable.",
    easier: "Lighter dumbbells, or push-ups with your hands on a bench.",
    harder: "Pause at the bottom, slow the lowering to four seconds, or press one arm at a time.",
  },

  "incline-dumbbell-press": {
    setup: [
      "Bench between 30 and 45 degrees — lower is easier on the shoulders.",
      "Kick the dumbbells up from your thighs as you lie back. Hips and upper back on the pad, feet flat.",
      "Start with the dumbbells at shoulder height, elbows pointing down toward the floor.",
    ],
    cues: [
      "Press up and slightly in, so the dumbbells meet above your upper chest.",
      "Elbows tucked to about 45 degrees, wrists straight.",
      "Lower under control until the dumbbells are level with your chest.",
    ],
    tempo: "2–3 seconds down · brief pause at the bottom · press up under control",
    breathing: "Breathe in as the dumbbells come down. Breathe out as you press.",
    mistakes: [
      {
        error: "Your elbows flare straight out to the sides.",
        fix: "Tuck them a little toward your ribs and turn the dumbbells slightly inward at the bottom.",
      },
      {
        error: "The bench is so steep it feels like a shoulder press.",
        fix: "Drop it a notch. Between 30 and 45 degrees puts the work on the upper chest.",
      },
      {
        error: "Your lower back arches off the pad and your hips slide down.",
        fix: "Sit higher, drive your feet into the floor, and use less weight until your back stays on the pad.",
      },
    ],
    feelIt: "The upper part of your chest and the front of your shoulders. Not your lower back.",
    easier: "Flat dumbbell bench press, or lighter dumbbells on a lower incline.",
    harder: "Pause at the bottom, slow the lowering to four seconds, or add weight in small steps.",
  },

  "hammer-grip-incline-bench-press": {
    setup: [
      "Bench between 30 and 45 degrees. Kick the dumbbells up from your thighs as you lie back.",
      "Palms facing each other, dumbbells at the sides of your chest, elbows pointing down.",
      "Feet flat, hips and upper back on the pad, shoulder blades squeezed together and down.",
    ],
    cues: [
      "Press straight up, elbows close to your ribs — the grip keeps them there for you.",
      "Wrists straight, dumbbells stacked over your elbows.",
      "Lower under control to the sides of your chest.",
    ],
    tempo: "2–3 seconds down · brief pause at the bottom · press up under control",
    breathing: "Breathe in as the dumbbells come down. Breathe out as you press.",
    mistakes: [
      {
        error: "The dumbbells drift apart at the top.",
        fix: "Press to a point above your upper chest, dumbbells almost touching. Less weight until the path is the same every rep.",
      },
      {
        error: "Your elbows swing out and the palms turn forward.",
        fix: "Keep the palms facing each other the whole rep. If they turn on their own, the weight is too heavy.",
      },
      {
        error: "Your lower back arches off the pad.",
        fix: "Sit higher and drive your feet into the floor. Use less weight until your back stays on the pad.",
      },
    ],
    feelIt: "The upper part of your chest and the back of your arms. This grip is often the most comfortable incline press for the shoulders.",
    easier: "The same movement on a flat bench, or lighter dumbbells.",
    harder: "The regular incline dumbbell press with palms forward, or a pause at the bottom.",
  },

  "decline-dumbbell-bench-press": {
    setup: [
      "Hook your legs under the pads first. Then take the dumbbells — ideally handed to you once you are lying back.",
      "Shoulder blades squeezed together and down, head on the bench.",
      "Start with the dumbbells above your lower chest, arms straight.",
    ],
    cues: [
      "Lower the dumbbells to the sides of your lower chest, elbows tucked to about 45 degrees.",
      "Press up and slightly in. Stop at straight arms.",
      "Keep your head and upper back on the bench the whole set.",
    ],
    tempo: "2–3 seconds down · brief pause at the bottom · press up under control",
    breathing: "Breathe in as the dumbbells come down. Breathe out as you press.",
    mistakes: [
      {
        error: "The dumbbells drift out wide at the bottom.",
        fix: "Keep them over your elbows and your elbows tucked. Wide at the bottom is where shoulders complain.",
      },
      {
        error: "You drop far below your chest for a bigger stretch.",
        fix: "Stop when the dumbbells are level with your chest. The stretch you feel deeper is the joint, not the muscle.",
      },
      {
        error: "You feel light-headed by the end of the set.",
        fix: "Keep the sets short, breathe every rep, and sit up slowly between them.",
      },
    ],
    feelIt: "The lower part of your chest and the back of your arms.",
    easier: "Flat dumbbell bench press — easier to get into and out of.",
    harder: "Pause at the bottom, or add weight in small steps.",
  },

  "one-arm-bench-press": {
    setup: [
      "Kick one dumbbell up as you lie back. The free hand holds the edge of the bench or rests on your stomach.",
      "Feet wide and planted — they are what stop you rolling toward the dumbbell.",
      "Both shoulder blades squeezed together and down, even though only one side is working.",
    ],
    cues: [
      "Press without letting your body roll — hips and shoulders stay square to the ceiling.",
      "Elbow tucked to about 45 degrees, dumbbell stacked over the elbow.",
      "Lower to chest level and press up over the same spot every rep.",
    ],
    tempo: "2–3 seconds down · brief pause · press up under control",
    breathing: "Breathe in as the dumbbell comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "Your body tips toward the working arm on the way down.",
        fix: "Brace your stomach and push the opposite foot into the floor. Use less weight until you stay square.",
      },
      {
        error: "The free hand starts helping by shoving the bench.",
        fix: "Rest it on your stomach instead. If you need it, the weight is too heavy.",
      },
      {
        error: "The dumbbell wanders outward at the top.",
        fix: "Press to a point above your chest, not straight up. Same path every rep.",
      },
    ],
    feelIt: "The chest on the working side, plus your stomach working hard to keep you level.",
    easier: "The two-dumbbell bench press — the second dumbbell balances the first.",
    harder: "Pause at the bottom, or slow the lowering to four seconds.",
  },

  "one-arm-barbell-floor-press": {
    setup: [
      "Lie on your back, knees bent, feet flat. Have someone hand you the bar, or start with it on low safety pins beside you.",
      "Grip the bar dead centre — a hand off centre and it tips. Start with an empty bar.",
      "Free arm out to the side on the floor for balance. Brace your stomach.",
    ],
    cues: [
      "Keep the bar level. Balance is the exercise here — the weight is second.",
      "Lower until the back of your upper arm rests lightly on the floor, then pause.",
      "Press straight up, elbow tucked, wrist straight.",
    ],
    tempo: "2 seconds down · rest the arm on the floor for a beat · press up under control",
    breathing: "Breathe in as the bar comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "The bar tips to one side.",
        fix: "Re-find the centre of the bar and use less weight. If it still tips, do this with a dumbbell instead.",
      },
      {
        error: "You bounce your arm off the floor.",
        fix: "Let the arm settle for a beat, then press from a dead stop. The stop is the point of the floor press.",
      },
      {
        error: "Your elbow flares out and the bar drifts over your face.",
        fix: "Tuck the elbow toward your ribs and press toward your feet slightly. Lighter until the path is straight.",
      },
    ],
    feelIt: "Your chest and the back of your arm, with your forearm working hard to keep the bar level.",
    easier: "The same movement with a dumbbell — nothing to balance — or the one-arm bench press.",
    harder: "Pause longer on the floor, or add weight in the smallest steps you have.",
  },

  // ── Machine and Smith presses ─────────────────────────────────────────

  "machine-bench-press": {
    setup: [
      "Set the seat so the handles line up with the middle of your chest.",
      "Sit right back, shoulder blades pinned to the pad, feet on the rests.",
      "Grip the handles with your wrists straight.",
    ],
    cues: [
      "Press the handles away without letting your shoulders roll forward off the pad.",
      "Stop just short of locking your elbows.",
      "Bring the handles back slowly until your hands are level with your chest.",
    ],
    tempo: "1 second to press · brief pause · 3 seconds back",
    breathing: "Breathe out as you press. Breathe in as it returns.",
    mistakes: [
      {
        error: "The handles are up at your shoulders instead of your chest.",
        fix: "Raise the seat. Handles at mid-chest is the setting; it takes ten seconds and changes everything.",
      },
      {
        error: "Your shoulders come off the pad to reach the end of the press.",
        fix: "Keep the shoulder blades pinned and finish a little short. The reach is your shoulder, not your chest.",
      },
      {
        error: "The weight stack slams down between reps.",
        fix: "Take three full seconds on the way back. The slow half is where most of the work is.",
      },
    ],
    feelIt: "Your chest, with the back of your arms helping. Your back should feel flat and supported.",
    easier: "Less weight and a shorter range — a controlled rep beats a full one that yanks your shoulders forward.",
    harder: "Pause at the end of the press, or slow the return to four seconds.",
  },

  "decline-chest-press": {
    setup: [
      "Set the seat so the handles line up with the lower part of your chest.",
      "Sit right back, shoulder blades pinned to the pad, feet flat on the rests.",
      "Wrists straight over the handles.",
    ],
    cues: [
      "Press the handles forward and slightly down, shoulders staying on the pad.",
      "Stop just short of locking your elbows.",
      "Bring the handles back slowly until your hands are level with your chest.",
    ],
    tempo: "1 second to press · brief pause · 3 seconds back",
    breathing: "Breathe out as you press. Breathe in as it returns.",
    mistakes: [
      {
        error: "Your shoulders roll forward off the pad at the end of the press.",
        fix: "Keep the shoulder blades pinned and finish a little short. Less weight if they keep coming off.",
      },
      {
        error: "The handles are too high and it feels like a normal chest press.",
        fix: "Raise the seat so the handles sit at the bottom of your chest. That is the whole difference.",
      },
      {
        error: "The weight stack slams down between reps.",
        fix: "Take three full seconds on the way back. Control the weight; do not let it control you.",
      },
    ],
    feelIt: "The lower part of your chest and the back of your arms.",
    easier: "The machine bench press, or push-ups.",
    harder: "Pause at the end of the press, or slow the return to four seconds.",
  },

  "smith-machine-bench-press": {
    setup: [
      "Set the bench so the bar comes down to the lower half of your chest — the bar path is fixed, so where you put the bench decides where it lands. Test with the empty bar.",
      "Set the safety catches just below chest height.",
      "Feet planted, shoulder blades squeezed together and down. Grip a little wider than your shoulders.",
    ],
    cues: [
      "Lower the bar to the lower half of your chest, elbows tucked to about 45 degrees.",
      "Press up under control. The machine guides the bar; you still do the pressing.",
      "Keep your shoulder blades pinned to the bench the whole set.",
    ],
    tempo: "2–3 seconds down · touch lightly · press up under control",
    breathing: "Breathe in as the bar comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "The bar lands at your throat or your stomach.",
        fix: "Move the bench, not your body. Slide it until the empty bar touches the lower half of your chest.",
      },
      {
        error: "The bar bounces off your chest.",
        fix: "Touch, pause for a beat, then press. If you need the bounce, the weight is too heavy.",
      },
      {
        error: "Your wrists bend back under the bar.",
        fix: "Bar low in the palm, over the forearm bone. Wrists straight over elbows.",
      },
    ],
    feelIt: "Your chest and the back of your arms. Shoulders should feel set, not pinched at the front.",
    easier: "The machine bench press, or less weight with the safeties set high.",
    harder: "Pause two seconds on the chest, or move to the free-bar bench press once the pattern is grooved.",
  },

  "smith-machine-incline-bench-press": {
    setup: [
      "Bench between 30 and 45 degrees, placed so the bar comes down to the top of your chest. Test with the empty bar and move the bench until it does.",
      "Set the safety catches just below where the bar touches.",
      "Hips and upper back on the pad, feet planted, shoulder blades squeezed together and down.",
    ],
    cues: [
      "Lower the bar to the top of your chest, just below the collarbones.",
      "Elbows tucked to about 45 degrees, wrists straight.",
      "Press up under control, shoulder blades pinned.",
    ],
    tempo: "2–3 seconds down · touch lightly · press up under control",
    breathing: "Breathe in as the bar comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "The bar comes down on your throat.",
        fix: "Slide the bench toward your feet until the empty bar lands on the top of your chest. Never adjust by lifting your head.",
      },
      {
        error: "The bar bounces off your chest.",
        fix: "Touch, pause for a beat, then press. If you need the bounce, the weight is too heavy.",
      },
      {
        error: "Your hips slide down and your back arches off the pad.",
        fix: "Sit higher and drive your feet into the floor. Use less weight until your back stays on the pad.",
      },
    ],
    feelIt: "The upper part of your chest and the front of your shoulders.",
    easier: "Incline dumbbell press — no bar path to line up.",
    harder: "Pause two seconds on the chest, or move to the free-bar incline bench press.",
  },

  "smith-machine-close-grip-bench-press": {
    setup: [
      "Flat bench placed so the bar comes down to the lower half of your chest. Test with the empty bar.",
      "Hands about shoulder width apart — the very narrow grip some people use just bends the wrists.",
      "Safety catches set just below chest height. Shoulder blades squeezed together and down.",
    ],
    cues: [
      "Elbows tucked along your ribs, the whole way down and up.",
      "Stop just above your chest, pause, then press.",
      "Finish with your arms straight, wrists stacked over your elbows.",
    ],
    tempo: "2–3 seconds down · pause above the chest · press up under control",
    breathing: "Breathe in as the bar comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "Your wrists bend back and ache.",
        fix: "Widen the grip to shoulder width and keep the bar low in your palm.",
      },
      {
        error: "Your elbows flare out and it becomes a normal press.",
        fix: "Think about brushing your ribs with your elbows. Use less weight until they stay tucked for the whole set.",
      },
      {
        error: "The bar bounces off your chest.",
        fix: "Stop just above the chest, pause for a beat, then press. The pause is part of the exercise.",
      },
    ],
    feelIt: "The back of your arms first, then your chest. Not your wrists.",
    easier: "The machine bench press, or push-ups with your hands close together.",
    harder: "Pause longer above the chest, or move to the free-bar close-grip bench press.",
  },

  // ── Bodyweight pushing ────────────────────────────────────────────────

  "push-up-feet-elevated": {
    setup: [
      "Feet on a bench, hands on the floor under your shoulders or a touch wider.",
      "Body in one straight line from head to heels — it is easy to pike at the hips here.",
      "Squeeze your glutes and stomach before the first rep.",
    ],
    cues: [
      "Lower your whole body as one piece until your chest is near the floor.",
      "Elbows travelling back at about 45 degrees, not straight out to the sides.",
      "Push the floor away and finish with your shoulder blades spread.",
    ],
    tempo: "2 seconds down · brief pause · push up under control",
    breathing: "Breathe in on the way down. Breathe out as you push.",
    mistakes: [
      {
        error: "Your hips rise into a peak and it turns into a shoulder exercise.",
        fix: "Squeeze your glutes and push your hips down into the line. A lower bench makes the line easier to hold.",
      },
      {
        error: "Your head reaches the floor before your chest does.",
        fix: "Keep your chin tucked and lead with your chest. Your head should be the last thing to move.",
      },
      {
        error: "You only go down a few centimetres.",
        fix: "Use a lower bench and do the full range there. Half a rep trains half the muscle.",
      },
    ],
    feelIt: "The upper part of your chest, the front of your shoulders, and your stomach holding the line. Not your lower back.",
    easier: "Regular push-ups with your feet on the floor, or a lower step.",
    harder: "A higher bench, a pause at the bottom, or slow the lowering to four seconds.",
  },

  "bench-dips": {
    setup: [
      "Hands on the edge of a bench behind you, fingers pointing forward, arms straight.",
      "Feet out in front — on the floor with your knees bent to start, on a second bench once that is easy.",
      "Slide forward so your backside just clears the bench. Stay close to it.",
    ],
    cues: [
      "Lower until your upper arms are level with the floor — no deeper.",
      "Elbows pointing straight back, not out to the sides.",
      "Keep your back brushing the bench the whole way down and up.",
    ],
    tempo: "2 seconds down · brief pause · push up under control",
    breathing: "Breathe in as you lower. Breathe out as you push up.",
    mistakes: [
      {
        error: "You go deep and your shoulders feel pinched at the front.",
        fix: "Stop higher — upper arms level with the floor is the bottom. Depth here is not something to chase.",
      },
      {
        error: "Your hips drift forward away from the bench.",
        fix: "Keep your back brushing the bench. Drifting forward moves the work to the front of your shoulders.",
      },
      {
        error: "Your shoulders shrug up toward your ears at the bottom.",
        fix: "Push your shoulders down before you lower, and shorten the range until they stay there.",
      },
    ],
    feelIt: "The back of your arms. Not the front of your shoulders — if you feel it there, stop the rep higher.",
    easier: "Feet flat on the floor with your knees bent, and a shorter range.",
    harder: "Feet up on a second bench, then a weight plate on your lap.",
  },

  // ── Cable and specialty presses ───────────────────────────────────────

  "cable-crossover": {
    setup: [
      "Pulleys at shoulder height or a little above. Take a handle in each hand.",
      "Step forward with one foot until the cables pull your arms back — a light stretch across the chest, no more.",
      "Lean forward slightly and set a small bend in your elbows. That bend does not change during the set.",
    ],
    cues: [
      "Sweep your hands together in front of your lower chest, elbows fixed.",
      "Squeeze your chest for a beat where your hands meet.",
      "Let the arms open slowly until you feel the stretch again — then stop.",
    ],
    tempo: "1 second to bring together · squeeze for a beat · 3 seconds back out",
    breathing: "Breathe out as your hands come together. Breathe in as they open.",
    mistakes: [
      {
        error: "Your elbows bend and straighten, so it becomes a press.",
        fix: "Set the elbow bend at the start and freeze it. Use less weight — if you have to bend, it is too heavy.",
      },
      {
        error: "Your shoulders roll forward as your hands meet.",
        fix: "Keep your chest up and your shoulders back. Bring the hands together a little lower so the chest does the squeezing.",
      },
      {
        error: "Your body rocks back and forth to move the weight.",
        fix: "Stand still with one foot forward and drop the weight. Only your arms move.",
      },
    ],
    feelIt: "Across your chest, especially where your hands meet. Not the front of your shoulders.",
    easier: "Less weight, or push-ups. The stretch at the start is what people overdo — keep it light.",
    harder: "Cross your hands over each other at the front, or hold the squeeze for two seconds.",
  },

  "jm-press": {
    setup: [
      "A mix of a close-grip bench press and a lying triceps extension. It is an advanced movement — start with the empty bar and keep it light.",
      "Lie on a flat bench, shoulder blades squeezed together and down, feet planted.",
      "Grip about shoulder width apart, bar over your upper chest. Set the safeties.",
    ],
    cues: [
      "Lower the bar toward the top of your chest by bending the elbows, which point forward.",
      "Stop a few centimetres above your chest and pause.",
      "Press back up in a straight line to where you started.",
    ],
    tempo: "2 seconds down · pause above the chest · press up under control",
    breathing: "Breathe in as the bar comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "The bar drifts over your face.",
        fix: "Bring it down toward the top of the chest, not the chin. Set the safeties so a drifting bar stops before you do.",
      },
      {
        error: "Your elbows flare out and it turns into a bench press.",
        fix: "Keep the elbows pointing forward, above the bar. Less weight until they stay there for every rep.",
      },
      {
        error: "You load it like your close-grip bench.",
        fix: "It is far lighter than that. Add weight only in the smallest steps and only when every rep looks the same.",
      },
    ],
    feelIt: "The back of your arms, hard. Not your elbows — if you feel it in the joint, the weight is too heavy.",
    easier: "Close-grip barbell bench press — the same elbow path with the bar going to the chest.",
    harder: "Pause longer above the chest. Add weight slowly; this movement rewards patience.",
  },

  // ── Shoulder press ────────────────────────────────────────────────────

  "one-arm-dumbbell-shoulder-press": {
    setup: [
      "Stand with your feet under your hips, one dumbbell at shoulder height, palm facing forward or slightly in.",
      "Free hand on your hip, or holding something solid for balance.",
      "Brace your stomach and squeeze your glutes before the first rep.",
    ],
    cues: [
      "Press straight up until your arm is beside your ear, without leaning away.",
      "Wrist straight over the elbow, elbow under the dumbbell.",
      "Lower under control back to shoulder height.",
    ],
    tempo: "Press up under control · brief pause at the top · 2–3 seconds down",
    breathing: "Breathe out as you press. Breathe in as the dumbbell comes down.",
    mistakes: [
      {
        error: "You lean sideways away from the dumbbell to get it up.",
        fix: "Brace your stomach and keep your ribs down. If you still lean, the weight is too heavy.",
      },
      {
        error: "Your lower back arches as you press.",
        fix: "Squeeze your glutes and think about keeping your ribs over your hips. Sit down on a bench if it keeps happening.",
      },
      {
        error: "Your elbow drifts behind you at the bottom.",
        fix: "Keep the elbow slightly in front of your body, under the dumbbell, so the press goes straight up.",
      },
    ],
    feelIt: "The shoulder on the working side and the back of your arm, plus your stomach working to keep you upright.",
    easier: "The same press seated with your back against a bench, or lighter dumbbells with both arms at once.",
    harder: "Pause a second at the top, or slow the lowering to four seconds.",
  },

  // ── Rows ──────────────────────────────────────────────────────────────

  "t-bar-rows": {
    setup: [
      "Stand over the bar with a foot either side, knees slightly bent and kept that way.",
      "Push your hips back and bend forward until your chest is roughly parallel to the floor. Back flat.",
      "Take the handles with a narrow grip and let your arms hang straight.",
    ],
    cues: [
      "Start the pull with your shoulder blades, before your arms bend.",
      "Drive your elbows past your ribs and bring the bar to your lower chest.",
      "Torso stays still. Lower all the way until your arms are straight.",
    ],
    tempo: "1 second to pull · squeeze for a beat · 3 seconds down",
    breathing: "Breathe out as you pull. Breathe in as you lower.",
    mistakes: [
      {
        error: "Your lower back rounds as the set goes on.",
        fix: "Push your hips back and lift your chest to re-set. Stand a little more upright, and use less weight.",
      },
      {
        error: "You stand up with each rep to heave the bar.",
        fix: "Fix the angle of your body at the start and keep it. If you have to stand up to move the weight, it is too heavy.",
      },
      {
        error: "Your shoulders shrug up toward your ears.",
        fix: "Pull the shoulder blades down and together, not up. Elbows drive back, not shoulders up.",
      },
    ],
    feelIt: "Between and around your shoulder blades, and the sides of your back. Your lower back should feel braced, not strained.",
    easier: "Seated cable rows — the same pull with your back supported by the position.",
    harder: "Pause two seconds at the top, or add weight in small steps.",
  },

  "reverse-grips-bent-over-barbell-rows": {
    setup: [
      "Hold the bar with your palms facing forward, hands about shoulder width apart.",
      "Push your hips back and lean forward to about 45 degrees, knees slightly bent. Back flat.",
      "Let the bar hang with your arms straight, below your chest.",
    ],
    cues: [
      "Pull the bar to your belly button, elbows sliding back along your ribs.",
      "Start with the shoulder blades, finish with the arms.",
      "Torso stays at the same angle. Lower all the way to straight arms.",
    ],
    tempo: "1 second to pull · squeeze for a beat · 3 seconds down",
    breathing: "Breathe out as you pull. Breathe in as you lower.",
    mistakes: [
      {
        error: "You stand up with each rep and the bar swings.",
        fix: "Keep the lean fixed. If you have to stand up to move the weight, it is too heavy.",
      },
      {
        error: "Your arms do all the work and it feels like a curl.",
        fix: "Start the pull with your shoulder blades and drive the elbows back, not the hands up.",
      },
      {
        error: "Your lower back rounds.",
        fix: "Push your hips back and lift your chest. Lean less, and use less weight, until the back stays flat.",
      },
    ],
    feelIt: "Between your shoulder blades and the sides of your back. Some bicep work is normal with this grip.",
    easier: "Seated cable rows, or a body row.",
    harder: "Pause two seconds at the top, or slow the lowering further.",
  },

  "rear-deltoid-row-barbell": {
    setup: [
      "Wide overhand grip on the bar — hands well outside your shoulders.",
      "Push your hips back and lean forward until your chest is close to parallel with the floor. Knees slightly bent, back flat.",
      "Let the bar hang with your arms straight, directly below your chest.",
    ],
    cues: [
      "Pull your elbows out wide and up, toward the ceiling — not back toward your hips.",
      "Bring the bar to the lower part of your chest.",
      "Torso stays still. Lower under control until your arms are straight.",
    ],
    tempo: "1 second to pull · squeeze for a beat · 3 seconds down",
    breathing: "Breathe out as you pull. Breathe in as you lower.",
    mistakes: [
      {
        error: "Your elbows tuck in and the bar goes to your stomach.",
        fix: "Elbows out wide, bar to the chest. That is the whole difference from a normal row — keep the weight light enough to feel it.",
      },
      {
        error: "You heave with your body to get the bar up.",
        fix: "Keep the lean fixed. Use less weight — this is a small-muscle movement and it does not need much.",
      },
      {
        error: "Your shoulders shrug up toward your ears.",
        fix: "Keep your neck long and drive the elbows out, not up. Less weight if the shrug will not go away.",
      },
    ],
    feelIt: "The back of your shoulders and between your shoulder blades. Not your lower back.",
    easier: "The same movement with dumbbells, or a lying rear lateral raise face down on a bench.",
    harder: "Pause two seconds at the top, or slow the lowering to four seconds.",
  },

  // ── Upright rows ──────────────────────────────────────────────────────

  "upright-barbell-rows": {
    setup: [
      "Keep the range short and the weight light. Stand with your feet under your hips, bar hanging in front of your thighs.",
      "Hands a little wider than shoulder width. A narrow grip is what makes the shoulders complain.",
      "Brace your stomach. Shoulders down, away from your ears.",
    ],
    cues: [
      "Lead with your elbows, lifting them out to the sides no higher than your shoulders.",
      "The bar travels close to your body and stops around the bottom of your chest.",
      "Lower under control. Nothing is pulled to the chin.",
    ],
    tempo: "1 second up · brief pause · 3 seconds down",
    breathing: "Breathe out as the bar rises. Breathe in as it lowers.",
    mistakes: [
      {
        error: "You pull the bar to your chin with your elbows above your shoulders.",
        fix: "Stop when the elbows are level with the shoulders — the bar ends around the bottom of your chest. Shorter is the version to do.",
      },
      {
        error: "You rock your body to get the bar moving.",
        fix: "Stand still and use less weight. A light bar lifted smoothly does more here than a heavy one heaved.",
      },
      {
        error: "Your grip is narrow and your wrists bend at the top.",
        fix: "Widen the grip to just outside shoulder width. Wrists stay straight, elbows lead.",
      },
    ],
    feelIt: "The sides and tops of your shoulders, and the muscles between your neck and shoulders. Not the front of your shoulders — if you feel a pinch there, shorten the range or stop the set.",
    easier: "Lateral dumbbell raises — the same shoulder muscles with your arms free to find their own path.",
    harder: "Pause for a beat at the top. Add weight only in the smallest steps and only if the range stays short.",
  },

  "upright-cable-row": {
    setup: [
      "Keep the range short and the weight light. Straight bar on the low pulley, hands a little wider than shoulder width.",
      "Stand back a step so the cable pulls slightly forward and down, not straight up your body.",
      "Brace your stomach, shoulders down, bar hanging at your thighs.",
    ],
    cues: [
      "Lead with your elbows out to the sides, stopping when they are level with your shoulders.",
      "The bar stays close to your body and stops around the bottom of your chest.",
      "Lower under control against the cable.",
    ],
    tempo: "1 second up · brief pause · 3 seconds down",
    breathing: "Breathe out as the bar rises. Breathe in as it lowers.",
    mistakes: [
      {
        error: "You pull the bar to your chin.",
        fix: "Stop when the elbows reach shoulder height. The cable makes going higher feel easy — that is not a reason to.",
      },
      {
        error: "The cable pulls you forward and you lean back to fight it.",
        fix: "Stand a step further from the stack and brace. If you still lean, drop the weight.",
      },
      {
        error: "Your shoulders shrug up before your elbows move.",
        fix: "Shoulders down first, then elbows out. Less weight until the order stays right.",
      },
    ],
    feelIt: "The sides and tops of your shoulders. Not the front of your shoulders — if you feel a pinch there, shorten the range or stop the set.",
    easier: "Lateral dumbbell raises, or front cable raises.",
    harder: "Pause for a beat at the top, or slow the lowering to four seconds. Keep the range short as you add.",
  },

  "smith-machine-upright-row": {
    setup: [
      "Keep the range short and the weight light. The bar path is fixed, so stand where the bar hangs against your thighs.",
      "Hands a little wider than shoulder width. Set the safety catches at thigh height.",
      "Brace your stomach, shoulders down, away from your ears.",
    ],
    cues: [
      "Lead with your elbows out to the sides, no higher than your shoulders.",
      "The bar stops around the bottom of your chest.",
      "Lower under control to the catches.",
    ],
    tempo: "1 second up · brief pause · 3 seconds down",
    breathing: "Breathe out as the bar rises. Breathe in as it lowers.",
    mistakes: [
      {
        error: "You pull the bar up to your chin.",
        fix: "Stop when the elbows are level with the shoulders. Shorter is the version to do.",
      },
      {
        error: "The fixed path forces your wrists to bend at the top.",
        fix: "Widen the grip a little and stop the bar lower. If the wrists still bend, do this with dumbbells instead.",
      },
      {
        error: "You use your legs and hips to start the bar moving.",
        fix: "Stand still. Less weight — the bar should start moving from your elbows alone.",
      },
    ],
    feelIt: "The sides and tops of your shoulders. Not the front of your shoulders or your wrists — if either complains, stop the set.",
    easier: "Lateral dumbbell raises — nothing fixes your hands in place.",
    harder: "Pause for a beat at the top. Add weight only in the smallest steps and only if the range stays short.",
  },

  "one-arm-upright-row": {
    setup: [
      "Keep the range short and the weight light. One dumbbell hanging in front of your thigh, palm facing your body.",
      "Free hand holding a post or rack for balance.",
      "Brace your stomach, shoulder down, away from your ear.",
    ],
    cues: [
      "Lead with your elbow out to the side, stopping when it is level with your shoulder.",
      "The dumbbell stays close to your body and ends around the bottom of your chest.",
      "Lower under control. Do not lean away from the dumbbell.",
    ],
    tempo: "1 second up · brief pause · 3 seconds down",
    breathing: "Breathe out as the dumbbell rises. Breathe in as it lowers.",
    mistakes: [
      {
        error: "You pull the dumbbell to your chin with your elbow high above your shoulder.",
        fix: "Stop at shoulder height. Shorter is the version to do; the last few centimetres add nothing.",
      },
      {
        error: "You lean sideways to get the dumbbell up.",
        fix: "Stand tall and brace. Use less weight until you stay upright for the whole set.",
      },
      {
        error: "Your shoulder shrugs up before your elbow moves.",
        fix: "Shoulder down first, then elbow out. The shrug means the weight is too heavy.",
      },
    ],
    feelIt: "The side and top of the working shoulder. Not the front of it — if you feel a pinch there, shorten the range or stop the set.",
    easier: "A lateral dumbbell raise on one side — the same muscles, arm free.",
    harder: "Pause for a beat at the top. Keep the range short as you add weight.",
  },

  // ── Pulldown ──────────────────────────────────────────────────────────

  "underhand-pull-downs": {
    setup: [
      "Set the thigh pad snug so you stay in the seat when the weight gets heavy.",
      "Palms facing you, hands about shoulder width apart.",
      "Sit tall with a slight lean back, and keep that lean for the whole set.",
    ],
    cues: [
      "Pull your shoulders down away from your ears before your arms bend.",
      "Bring the bar to the top of your chest, elbows close to your body and driving down.",
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
        error: "Your arms do all the work and it feels like a curl.",
        fix: "Shoulders down first, elbows drive down toward your pockets. The arms finish the rep; they should not start it.",
      },
      {
        error: "Your shoulders shrug up at the top of each rep.",
        fix: "Let the arms straighten but keep the shoulders pulled down. Slow the return to three seconds.",
      },
    ],
    feelIt: "The sides of your back, under your armpits, with your biceps helping — more than on the wide grip. That is normal.",
    easier: "Less weight. This is the machine to learn the pull on before you attempt a chin-up.",
    harder: "Pause at your chest for two seconds, or move to chin-ups with the same grip.",
  },

  // ── Raises and rotation ───────────────────────────────────────────────

  "front-dumbbell-raise": {
    setup: [
      "A dumbbell in each hand, resting against the front of your thighs, palms facing your legs.",
      "Feet under your hips, knees soft, stomach braced.",
      "Shoulders down, away from your ears.",
    ],
    cues: [
      "Raise one arm straight in front of you to shoulder height, no higher.",
      "Keep a small bend in the elbow and the arm still — no swing.",
      "Lower slowly, then the other arm. The body does not move.",
    ],
    tempo: "1 second up · brief pause at shoulder height · 3 seconds down",
    breathing: "Breathe out as the arm rises. Breathe in as it lowers.",
    mistakes: [
      {
        error: "You rock backwards to swing the dumbbell up.",
        fix: "Stand still with your stomach braced. Use lighter dumbbells — this needs far less than most people pick.",
      },
      {
        error: "The dumbbell goes above your shoulder.",
        fix: "Stop at shoulder height. Above that your shoulder is shrugging, not lifting.",
      },
      {
        error: "Your shoulders shrug up toward your ears.",
        fix: "Keep your neck long and think about reaching the dumbbell forward, not up.",
      },
    ],
    feelIt: "The front of your shoulders. Not your neck, and not your lower back.",
    easier: "Lighter dumbbells, or sit on a bench so the body cannot help.",
    harder: "Both arms at once, a pause at the top, or slow the lowering to four seconds.",
  },

  "lying-rear-lateral-raise": {
    setup: [
      "Lie face down on a bench raised high enough that your arms can hang straight down without touching the floor.",
      "Toes on the floor for balance. Forehead just past the end of the bench, or resting on it.",
      "Dumbbells hanging below your shoulders, a slight bend in each elbow. Keep that bend.",
    ],
    cues: [
      "Raise your arms out to the sides until they are level with your shoulders.",
      "Lead with the elbows — think about pushing the dumbbells away, not lifting them up.",
      "Lower slowly. The dumbbells never swing.",
    ],
    tempo: "1 second up · squeeze for a beat · 3 seconds down",
    breathing: "Breathe out as the arms rise. Breathe in as they lower.",
    mistakes: [
      {
        error: "Your elbows bend more and more and it becomes a row.",
        fix: "Set a slight bend at the start and keep it. Lighter dumbbells until it holds.",
      },
      {
        error: "The dumbbells swing up and drop back down.",
        fix: "One second up, three seconds down. Swinging means the weight is too heavy — halve it.",
      },
      {
        error: "Your shoulders shrug up toward your ears.",
        fix: "Keep your neck long and drive the elbows out to the sides, not up toward your head.",
      },
    ],
    feelIt: "The back of your shoulders and between your shoulder blades. Not your neck.",
    easier: "Lighter dumbbells — most people need less than five kilos to begin with.",
    harder: "Pause for two seconds at the top, or slow the lowering to four seconds.",
  },

  "lying-one-arm-rear-lateral-raise": {
    setup: [
      "Lie face down on a bench high enough that your working arm can hang straight without touching the floor.",
      "The free hand rests on the floor to keep you steady.",
      "Dumbbell hanging below your shoulder, a slight bend in the elbow. Keep that bend.",
    ],
    cues: [
      "Raise the arm out to the side until it is level with your shoulder.",
      "Lead with the elbow. Your body stays flat on the bench — do not twist to help.",
      "Lower slowly. The dumbbell never swings.",
    ],
    tempo: "1 second up · squeeze for a beat · 3 seconds down",
    breathing: "Breathe out as the arm rises. Breathe in as it lowers.",
    mistakes: [
      {
        error: "You twist your body toward the working side to get the dumbbell up.",
        fix: "Press your chest into the bench and keep both hips down. Lighter dumbbell until you stay flat.",
      },
      {
        error: "The elbow bends more and more and it becomes a row.",
        fix: "Set a slight bend at the start and keep it. Lighter dumbbell until it holds.",
      },
      {
        error: "The dumbbell swings up and drops back down.",
        fix: "One second up, three seconds down. If it swings, the weight is too heavy.",
      },
    ],
    feelIt: "The back of the working shoulder and between your shoulder blades. Not your neck.",
    easier: "The two-arm lying rear lateral raise — the second arm balances the first.",
    harder: "Pause for two seconds at the top, or slow the lowering to four seconds.",
  },

  "internal-cable-rotation": {
    setup: [
      "Sit on the floor side-on to a low pulley, the working arm nearest the stack.",
      "Elbow bent to a right angle and pinned to your side — a rolled towel between your elbow and your ribs keeps it there.",
      "Take the handle with your forearm pointing out toward the stack. Light weight — this is a small movement.",
    ],
    cues: [
      "Rotate your forearm across your stomach, elbow staying glued to your side.",
      "Keep your body still — only the forearm moves.",
      "Let it rotate back out slowly, to where it started.",
    ],
    tempo: "1 second to rotate in · brief pause · 3 seconds back out",
    breathing: "Breathe out as the forearm comes across. Breathe in as it returns.",
    mistakes: [
      {
        error: "Your elbow drifts away from your side.",
        fix: "Put a rolled towel between your elbow and ribs and squeeze it. If it still drifts, the weight is too heavy.",
      },
      {
        error: "You twist your body to move the weight.",
        fix: "Sit tall and still. Only the forearm moves. Drop the weight until that is true.",
      },
      {
        error: "The weight yanks your arm back out.",
        fix: "Take three full seconds on the way out. The slow half is where the work is.",
      },
    ],
    feelIt: "Deep in the front of your shoulder and a little in the chest. Very light — if you need to strain, the weight is wrong.",
    easier: "The same movement with a light band, or no weight at all while you learn the path.",
    harder: "Pause at the end of the rotation, or slow the return to four seconds. Add weight in the smallest steps.",
  },

  // ── Curls ─────────────────────────────────────────────────────────────

  "high-cable-curls": {
    setup: [
      "Flat bench end-on to a cable stack, short bar on the high pulley.",
      "Lie on your back with your head toward the stack and take the bar with palms facing you.",
      "Arms straight, angled up over your head toward the pulley. Feet flat on the floor.",
    ],
    cues: [
      "Curl the bar toward your forehead, keeping your upper arms completely still.",
      "Squeeze at the top for a beat.",
      "Let the bar back up slowly until your arms are straight — do not let the cable yank them.",
    ],
    tempo: "1 second to curl · squeeze for a beat · 3 seconds back",
    breathing: "Breathe out as you curl. Breathe in as it returns.",
    mistakes: [
      {
        error: "Your elbows drop toward the bench as you curl.",
        fix: "Keep the upper arms pointing at the pulley. Only the forearms move. Less weight if they keep dropping.",
      },
      {
        error: "Your shoulders lift off the bench.",
        fix: "Keep your upper back pressed into the bench. If the cable pulls you up, the weight is too heavy.",
      },
      {
        error: "The weight yanks your arms straight at the bottom.",
        fix: "Take three full seconds back. Control the weight; do not let it control you.",
      },
    ],
    feelIt: "The front of your upper arms, especially at the top of the curl. Not your shoulders.",
    easier: "Standing cable curls, or biceps curls with dumbbells.",
    harder: "Pause two seconds at the top, or slow the return to four seconds.",
  },

  "drag-curl-with-barbell": {
    setup: [
      "Stand with the bar against your thighs, palms facing forward, hands about shoulder width apart.",
      "Feet under your hips, knees soft, stomach braced.",
      "Shoulders down and back. Light weight — this is smaller than a normal curl.",
    ],
    cues: [
      "Drag the bar straight up your body, elbows travelling backwards behind you.",
      "The bar stays in contact with your body the whole way — it never swings out.",
      "Stop when the bar reaches your lower chest. Lower it the same way.",
    ],
    tempo: "1 second up · squeeze for a beat · 3 seconds down",
    breathing: "Breathe out as the bar rises. Breathe in as it lowers.",
    mistakes: [
      {
        error: "Your elbows come forward and it turns into a normal curl.",
        fix: "Think about pushing your elbows back behind you as the bar rises. That is the whole movement.",
      },
      {
        error: "The bar drifts away from your body.",
        fix: "Keep it brushing your shirt from thigh to chest. Use less weight — a light bar dragged beats a heavy one swung.",
      },
      {
        error: "You lean back to finish the rep.",
        fix: "Stand still with your stomach braced and stop the bar lower. Leaning back means the weight is too heavy.",
      },
    ],
    feelIt: "The front of your upper arms, strongly at the top. A little in your forearms is normal.",
    easier: "Regular biceps curls with a barbell, or with dumbbells.",
    harder: "Pause two seconds at the top, or slow the lowering to four seconds.",
  },

  // ── Triceps extensions ────────────────────────────────────────────────

  "reverse-grip-triceps-pushdown": {
    setup: [
      "Straight bar on a high pulley, palms facing up, hands about shoulder width apart.",
      "Stand close to the stack, one foot slightly ahead of the other, stomach braced.",
      "Elbows pinned to your sides, forearms up. Lighter than your normal pushdown.",
    ],
    cues: [
      "Push the bar down until your arms are straight, elbows never leaving your sides.",
      "Wrists stay straight — the bar rests in your fingers and palm, not bent back.",
      "Let it back up slowly until your forearms are level with the floor, or a little higher.",
    ],
    tempo: "1 second down · squeeze for a beat · 3 seconds back up",
    breathing: "Breathe out as you push down. Breathe in as it returns.",
    mistakes: [
      {
        error: "Your elbows drift forward and up as you push.",
        fix: "Pin them to your sides and think about only the forearm moving. Less weight until they stay there.",
      },
      {
        error: "Your wrists bend back and your fingers open.",
        fix: "Wrap your thumbs around the bar and use less weight. This grip does not hold much.",
      },
      {
        error: "You lean over the bar and push with your body.",
        fix: "Stand tall and drop the weight. If you have to lean, it is too heavy.",
      },
    ],
    feelIt: "The back of your arms, especially at the bottom of the push. Not your wrists or fingers.",
    easier: "The regular triceps pushdown with palms down — your grip is stronger that way.",
    harder: "Pause two seconds at the bottom, or slow the return to four seconds.",
  },

  "decline-close-grip-bench-to-skull-crusher": {
    setup: [
      "Two movements in one rep: a close-grip bench press, then a lying triceps extension at the top. Start with the empty bar.",
      "Lie back on the bench — decline if you have one, flat works the same way. Legs hooked or feet planted.",
      "Hands about shoulder width apart, shoulder blades squeezed together and down. Have someone spot, or set the safeties.",
    ],
    cues: [
      "Press: elbows tucked, bar to the lower chest, press up to straight arms.",
      "Extend: upper arms stay still, bend the elbows to lower the bar toward your forehead, then straighten.",
      "That is one rep. Both halves are slow.",
    ],
    tempo: "Press: 2 seconds down, press up · Extend: 2 seconds down, straighten under control",
    breathing: "Breathe in as the bar lowers, out as it rises — on both halves of the rep.",
    mistakes: [
      {
        error: "Your elbows flare out during the extension half.",
        fix: "Point the elbows at the ceiling and keep them there. Use less weight — the extension half is far weaker than the press.",
      },
      {
        error: "You load it like a close-grip bench press.",
        fix: "Load it like a skull crusher — the weaker half sets the weight. Start with the empty bar.",
      },
      {
        error: "The bar drifts over your face on the press half.",
        fix: "Lower to the same spot on your chest every rep and press up and slightly toward your feet. Set the safeties.",
      },
    ],
    feelIt: "The back of your arms, hard. Not your elbows — if you feel it in the joint, the weight is too heavy.",
    easier: "The close-grip barbell bench press on its own, then a separate set of lying triceps extensions.",
    harder: "Pause at the bottom of each half. Add weight only in the smallest steps.",
  },

  "standing-overhead-triceps-extension-with-barbell": {
    setup: [
      "Stand with your feet under your hips, stomach braced, knees soft.",
      "Bar or EZ bar overhead, hands close together — a hand-width apart, palms facing forward.",
      "Elbows pointing forward and staying close to your head.",
    ],
    cues: [
      "Bend your elbows to lower the bar behind your head, upper arms staying still.",
      "Stop when you feel a stretch in the back of your arms, then straighten.",
      "Keep your ribs down — do not arch your back to help.",
    ],
    tempo: "2–3 seconds down · brief pause at the bottom · straighten under control",
    breathing: "Breathe in as the bar lowers. Breathe out as you straighten.",
    mistakes: [
      {
        error: "Your elbows flare out to the sides.",
        fix: "Think about squeezing your ears with your upper arms. Less weight until they stay close for the whole set.",
      },
      {
        error: "Your lower back arches as the bar goes behind your head.",
        fix: "Brace your stomach, squeeze your glutes, and sit on a bench if it keeps happening.",
      },
      {
        error: "The elbows themselves ache rather than the muscle.",
        fix: "Shorten the range, slow it down, and use less weight. If it stays, do this one arm at a time with a light dumbbell instead.",
      },
    ],
    feelIt: "The back of your arms, with a stretch at the bottom. Not your lower back, not the elbow joints.",
    easier: "The same movement seated with your back supported, or the one-arm dumbbell version.",
    harder: "Pause two seconds at the bottom, or slow the lowering to four seconds.",
  },

  "one-arm-triceps-extension-with-dumbbell": {
    setup: [
      "Sit tall on a bench, feet flat, stomach braced.",
      "One dumbbell straight overhead, elbow pointing at the ceiling and close to your head.",
      "Free hand across your chest, or supporting the working elbow from the front.",
    ],
    cues: [
      "Lower the dumbbell behind your head by bending the elbow only — the upper arm stays still.",
      "Stop when you feel a stretch in the back of your arm.",
      "Straighten fully without the elbow drifting out.",
    ],
    tempo: "2–3 seconds down · brief pause at the bottom · straighten under control",
    breathing: "Breathe in as the dumbbell lowers. Breathe out as you straighten.",
    mistakes: [
      {
        error: "Your elbow drifts out to the side.",
        fix: "Hold it in place with the free hand. Less weight until it stays on its own.",
      },
      {
        error: "You lean sideways away from the dumbbell.",
        fix: "Sit tall with your stomach braced. If you still lean, the weight is too heavy.",
      },
      {
        error: "Your wrist bends back under the dumbbell.",
        fix: "Keep the wrist straight and the dumbbell stacked over the forearm. Lighter if it keeps bending.",
      },
    ],
    feelIt: "The back of the working arm, with a stretch at the bottom. Not your neck, not your lower back.",
    easier: "Hold one dumbbell overhead with both hands — twice the support, half the balancing.",
    harder: "Pause two seconds at the bottom, or slow the lowering to four seconds.",
  },

  "bent-over-one-arm-triceps-extension-with-dumbbell": {
    setup: [
      "Push your hips back and lean forward until your chest is close to parallel with the floor. Free hand on a bench or your thigh.",
      "Dumbbell in the working hand, upper arm lifted so it is level with your body and pinned there.",
      "Elbow bent, forearm hanging straight down. Light weight.",
    ],
    cues: [
      "Straighten your arm behind you — the upper arm does not move at all.",
      "Squeeze for a beat at the top with the arm fully straight.",
      "Lower slowly. The dumbbell never swings.",
    ],
    tempo: "1 second to straighten · squeeze for a beat · 3 seconds down",
    breathing: "Breathe out as you straighten. Breathe in as it lowers.",
    mistakes: [
      {
        error: "Your upper arm drops toward the floor as the set goes on.",
        fix: "Lift it back level with your body and keep it there. If it will not stay, the weight is too heavy.",
      },
      {
        error: "You swing the dumbbell up with momentum.",
        fix: "Three seconds down, one second up. This needs far less weight than most people pick.",
      },
      {
        error: "Your back rounds as you lean over.",
        fix: "Push your hips back, lift your chest, and rest the free hand on a bench so your back is supported.",
      },
    ],
    feelIt: "The back of the working arm, especially at the top. Not your lower back, not your shoulder.",
    easier: "Lighter dumbbell, or the triceps pushdown on a cable.",
    harder: "Pause two seconds at the top, or slow the lowering to four seconds.",
  },

  "bent-over-two-arm-triceps-extension-with-dumbbell": {
    setup: [
      "Push your hips back and lean forward until your upper body is close to parallel with the floor. Knees soft, back flat.",
      "A dumbbell in each hand, upper arms lifted level with your body and pinned there.",
      "Elbows bent, forearms hanging straight down. Light weights — you have no free hand for support.",
    ],
    cues: [
      "Straighten both arms behind you at once — the upper arms do not move.",
      "Squeeze for a beat at the top.",
      "Lower slowly. Your back stays flat and still.",
    ],
    tempo: "1 second to straighten · squeeze for a beat · 3 seconds down",
    breathing: "Breathe out as you straighten. Breathe in as they lower.",
    mistakes: [
      {
        error: "Your upper arms drop and the dumbbells swing.",
        fix: "Lift the upper arms back level with your body and use lighter dumbbells. Both arms at once needs less than one.",
      },
      {
        error: "Your back rounds as you tire.",
        fix: "Push your hips back and lift your chest between reps. If it keeps rounding, do it one arm at a time with a hand on a bench.",
      },
      {
        error: "You stand up a little with each rep to help.",
        fix: "Fix the lean and keep it. Standing up means the weight is too heavy.",
      },
    ],
    feelIt: "The back of both arms, especially at the top. Your lower back should feel braced, not strained.",
    easier: "The one-arm version with your free hand on a bench — a supported back and half the balancing.",
    harder: "Pause two seconds at the top, or slow the lowering to four seconds.",
  },

  "one-arm-low-pulley-triceps-extension-with-cable": {
    setup: [
      "Handle on a low pulley. Stand with your back to the stack, feet under your hips.",
      "Reach behind you and take the handle, then bring it overhead so the cable runs up your back.",
      "Working elbow pointing at the ceiling, close to your head. Free hand holds that elbow in place.",
    ],
    cues: [
      "Straighten your arm toward the ceiling — the upper arm does not move.",
      "Lower slowly until you feel a stretch in the back of your arm.",
      "Stand tall the whole set; do not lean away from the cable.",
    ],
    tempo: "1 second to straighten · brief pause · 3 seconds down",
    breathing: "Breathe out as you straighten. Breathe in as it lowers.",
    mistakes: [
      {
        error: "Your elbow drifts forward and out.",
        fix: "Hold it with the free hand and use less weight. Only the forearm should move.",
      },
      {
        error: "You lean forward to fight the cable.",
        fix: "Step half a pace back toward the stack and brace your stomach. Lighter if you still lean.",
      },
      {
        error: "The weight yanks your arm back down.",
        fix: "Take three full seconds on the way down. Control the weight; do not let it control you.",
      },
    ],
    feelIt: "The back of the working arm, with a stretch at the bottom. Not your shoulder, not your lower back.",
    easier: "The one-arm triceps extension with a dumbbell, seated.",
    harder: "Pause two seconds at the bottom, or slow the lowering to four seconds.",
  },

  "standing-triceps-extension-with-towel": {
    setup: [
      "Stand with your feet under your hips, stomach braced. A partner stands behind you holding the ends of a towel.",
      "Hold the middle of the towel behind your head with both hands, elbows pointing at the ceiling and close to your head.",
      "Agree the resistance out loud before you start — steady, and the same on every rep.",
    ],
    cues: [
      "Straighten your arms overhead against the towel, upper arms staying still.",
      "Lower slowly as the partner keeps the towel taut, until your hands are near your neck.",
      "Keep your ribs down — do not arch to help.",
    ],
    tempo: "2 seconds up · brief pause at the top · 3 seconds down",
    breathing: "Breathe out as you straighten. Breathe in as you lower.",
    mistakes: [
      {
        error: "The resistance jerks — easy one moment, heavy the next.",
        fix: "The partner keeps a steady pull and follows your pace. Tell them lighter if you cannot move smoothly.",
      },
      {
        error: "Your elbows flare out to the sides.",
        fix: "Squeeze your ears with your upper arms. Ask for less resistance until they stay close.",
      },
      {
        error: "Your lower back arches as you push.",
        fix: "Brace your stomach and squeeze your glutes. Ask the partner to ease off if you still arch.",
      },
    ],
    feelIt: "The back of your arms. Not your lower back, not your neck.",
    easier: "The overhead triceps extension with a light dumbbell — the weight does not change on you.",
    harder: "The partner adds resistance on the way down only, or you slow the lowering to four seconds.",
  },

  // ── Pullovers ─────────────────────────────────────────────────────────

  "bent-arm-pullover": {
    setup: [
      "Lie on a bench with your head near the end and your feet flat on the floor.",
      "Barbell held with a close grip — about shoulder width — arms straight above your chest, then bend the elbows a little. Keep that bend.",
      "Ribs down, lower back gently on the bench. Light weight to start.",
    ],
    cues: [
      "Lower the bar in an arc over and behind your head, elbows staying bent and pointing up.",
      "Stop when you feel a stretch across your chest and under your armpits — no further.",
      "Pull it back over your chest in the same arc.",
    ],
    tempo: "3 seconds down · brief pause at the stretch · pull back up under control",
    breathing: "Breathe in as the bar goes behind your head. Breathe out as you pull it back.",
    mistakes: [
      {
        error: "Your arms straighten as the bar goes back.",
        fix: "Set the elbow bend at the start and keep it. Less weight until it holds — straight arms put the load on the elbows.",
      },
      {
        error: "Your lower back arches high off the bench at the bottom.",
        fix: "Keep your ribs down and stop the bar higher. The arch is your back finding range your shoulders do not have yet.",
      },
      {
        error: "You go as deep as you can for a bigger stretch.",
        fix: "Stop at a comfortable stretch. Range grows over weeks; forcing it is how this movement goes wrong.",
      },
    ],
    feelIt: "Across your chest and under your armpits, with the back of your arms helping. Not your lower back, not your shoulders' front.",
    easier: "The dumbbell bent-arm pullover — one dumbbell held in both hands is easier to control — with a shorter range.",
    harder: "Pause two seconds at the stretch, or add weight in small steps.",
  },

  "dumbbell-bent-arm-pullover": {
    setup: [
      "Lie on a bench with your head near the end and your feet flat on the floor.",
      "Hold one dumbbell by the inside of the top plate with both hands, arms above your chest, elbows bent a little. Keep that bend.",
      "Ribs down, lower back gently on the bench.",
    ],
    cues: [
      "Lower the dumbbell in an arc over and behind your head, elbows staying bent.",
      "Stop when you feel a stretch across your chest and under your armpits.",
      "Pull it back over your chest in the same arc.",
    ],
    tempo: "3 seconds down · brief pause at the stretch · pull back up under control",
    breathing: "Breathe in as the dumbbell goes behind your head. Breathe out as you pull it back.",
    mistakes: [
      {
        error: "Your arms straighten as the dumbbell goes back.",
        fix: "Set the elbow bend at the start and keep it. Lighter until it holds.",
      },
      {
        error: "Your lower back arches high off the bench at the bottom.",
        fix: "Keep your ribs down and stop the dumbbell higher. Put your feet up on the bench if the arch will not go away.",
      },
      {
        error: "The dumbbell drops quickly behind your head.",
        fix: "Three seconds down, every rep. Fast at the bottom is where the shoulders complain.",
      },
    ],
    feelIt: "Across your chest and under your armpits. Not your lower back.",
    easier: "Less weight and a shorter range — stop well before the full stretch while you learn the arc.",
    harder: "Pause two seconds at the stretch, or the straight-arm version.",
  },

  "straight-arm-dumbbell-pullover": {
    setup: [
      "Lie on a bench with your head near the end and your feet flat on the floor.",
      "One dumbbell held by the inside of the top plate with both hands, arms above your chest, nearly straight — a tiny bend at the elbow.",
      "Ribs down, lower back gently on the bench. Lighter than the bent-arm version.",
    ],
    cues: [
      "Lower the dumbbell in an arc behind your head, arms staying nearly straight.",
      "Stop at a comfortable stretch under your armpits — well before the floor.",
      "Pull it back over your chest, arms still nearly straight.",
    ],
    tempo: "3 seconds down · brief pause at the stretch · pull back up under control",
    breathing: "Breathe in as the dumbbell goes behind your head. Breathe out as you pull it back.",
    mistakes: [
      {
        error: "Your elbows bend more and more as the set goes on.",
        fix: "That is the weight telling you it is too heavy. Drop it, and keep the tiny bend the same on every rep.",
      },
      {
        error: "Your lower back arches high off the bench.",
        fix: "Keep your ribs down and stop the dumbbell higher. Feet up on the bench helps.",
      },
      {
        error: "You chase the floor with the dumbbell.",
        fix: "Stop where the stretch is comfortable. The last part of the arc is your shoulders, not your chest.",
      },
    ],
    feelIt: "Under your armpits and across your chest, with the back of your arms holding the position. Not the front of your shoulders, not your lower back.",
    easier: "The dumbbell bent-arm pullover — bent elbows take the load off the shoulders and elbows.",
    harder: "Pause two seconds at the stretch, or slow the lowering to four seconds.",
  },

  "wide-grip-decline-barbell-pullover": {
    setup: [
      "Legs hooked under the pads of a decline bench, head at the low end.",
      "Bar resting on your upper thighs, hands out near the plates — a very wide grip. Start with the empty bar.",
      "Arms straight with a slight bend at the elbows. Ribs down.",
    ],
    cues: [
      "Raise the bar in an arc over your face and behind your head, arms staying nearly straight.",
      "Stop at a comfortable stretch across your chest — well before the floor.",
      "Bring it back over in the same arc to your thighs.",
    ],
    tempo: "2 seconds over · brief pause at the stretch · 2 seconds back",
    breathing: "Breathe in as the bar goes behind your head. Breathe out as it comes back.",
    mistakes: [
      {
        error: "Your elbows bend to get the bar past your face.",
        fix: "Keep the slight bend fixed. If you have to bend more, the bar is too heavy — the empty bar is plenty to begin with.",
      },
      {
        error: "You take the bar as far toward the floor as it will go.",
        fix: "Stop where the stretch is comfortable. The wide grip shortens the range your shoulders have — respect it.",
      },
      {
        error: "Your hips lift off the bench as the bar goes back.",
        fix: "Keep your ribs down and the range shorter. Legs pressing into the pads is what holds you down.",
      },
    ],
    feelIt: "Across your chest, and under your armpits at the stretch. Not the front of your shoulders, not your lower back.",
    easier: "The straight-arm dumbbell pullover on a flat bench — one dumbbell, a normal grip, a shorter arc.",
    harder: "Pause two seconds at the stretch. Add weight only in the smallest steps.",
  },

  "barbell-front-raise-pullover": {
    setup: [
      "Lie on a flat bench, feet flat on the floor, bar resting on your upper thighs.",
      "Hands about shoulder width apart, arms straight with a slight bend at the elbows.",
      "Ribs down, lower back gently on the bench. Light weight — the bar passes over your face.",
    ],
    cues: [
      "Raise the bar in an arc over your face and behind your head, arms nearly straight.",
      "Stop at a comfortable stretch across your chest.",
      "Bring it back in the same arc to your thighs, under control the whole way.",
    ],
    tempo: "2 seconds over · brief pause at the stretch · 2 seconds back",
    breathing: "Breathe in as the bar goes behind your head. Breathe out as it comes back.",
    mistakes: [
      {
        error: "Your elbows bend as the bar passes over your face.",
        fix: "Keep the slight bend fixed. Use a lighter bar — this is a long lever and needs very little.",
      },
      {
        error: "Your lower back arches high off the bench at the stretch.",
        fix: "Keep your ribs down and stop the bar higher. Feet up on the bench if the arch will not go away.",
      },
      {
        error: "The bar speeds up as it goes behind your head.",
        fix: "Same pace the whole arc. If you cannot control it over your face, the weight is too heavy.",
      },
    ],
    feelIt: "The front of your shoulders on the way over, then across your chest and under your armpits at the stretch. Not your lower back.",
    easier: "The straight-arm dumbbell pullover — same arc behind the head, without the part over your face.",
    harder: "Pause two seconds at the stretch, or slow both halves to three seconds.",
  },
};
