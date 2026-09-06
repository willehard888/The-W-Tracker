/**
 * Catalog movement → the illustration that shows the SAME movement.
 *
 * The generator prescribes from the 542-item catalog (free-exercise-db slugs);
 * the rep player and the coaching layer key on the 269 illustrated movements
 * (Everkinetic slugs). Titles agree for 13 of the 200 the model is offered, so
 * the runner was text-only for almost every AI program. Name joins are what
 * failed here repeatedly (three vocabularies, three spellings of "dead lift"),
 * so this is an explicit table: a row exists only when the drawing demonstrates
 * the prescribed movement — a seated press is not a standing press, a
 * reverse-grip row is not a pronated row, a wide-grip pulldown is not a V-bar.
 *
 * `PRIORITY_SLUGS` (the keys) is what the generator is told to prefer, and
 * what the coaching layer must cover — one contract for "the athlete sees the
 * movement and a coach's cue for every lift the coach can prescribe".
 */
export const ILLUSTRATION_BY_CATALOG: Record<string, string> = {
  // ── squat / lunge / step
  Barbell_Squat: "barbell-squat",
  Barbell_Full_Squat: "barbell-squat",
  Front_Squat_Clean_Grip: "front-squat-with-barbell",
  Wide_Stance_Barbell_Squat: "wide-stance-squat-with-barbell",
  Narrow_Stance_Squats: "narrow-stance-squat-with-barbell",
  Barbell_Hack_Squat: "hack-squat-with-barbell",
  Hack_Squat: "hack-squat-machine",
  Narrow_Stance_Hack_Squats: "narrow-stance-hack-squats",
  Smith_Machine_Squat: "smith-machine-squats",
  Dumbbell_Squat: "squats-using-dumbbells",
  Dumbbell_Squat_To_A_Bench: "squat-to-bench-with-dumbbells",
  Plie_Dumbbell_Squat: "pile-squat-with-dumbbell",
  Jefferson_Squats: "jefferson-squats-with-barbell",
  "Squats_-_With_Bands": "squats-with-exercise-bands",
  Leg_Press: "leg-press",
  Narrow_Stance_Leg_Press: "narrow-stance-leg-press",
  Leg_Extensions: "leg-extensions",
  Lying_Leg_Curls: "lying-leg-curl-machine",
  Seated_Leg_Curl: "seated-leg-curl",
  Dumbbell_Lunges: "dumbbell-lunges",
  Dumbbell_Rear_Lunge: "rear-lunges-with-dumbbell",
  Barbell_Lunge: "barbell-lunges",
  Barbell_Step_Ups: "step-ups-with-barbell",
  Dumbbell_Step_Ups: "step-ups-with-dumbbells",
  // ── hinge
  Barbell_Deadlift: "barbell-dead-lifts",
  Romanian_Deadlift: "romanian-dead-lift",
  Good_Morning: "barbell-good-mornings",
  // ── horizontal push
  "Barbell_Bench_Press_-_Medium_Grip": "bench-press",
  "Bench_Press_-_Powerlifting": "bench-press",
  "Wide-Grip_Barbell_Bench_Press": "wide-grip-bench-press",
  "Close-Grip_Barbell_Bench_Press": "close-grip-barbell-bench-press",
  Barbell_Guillotine_Bench_Press: "barbell-neck-press",
  Neck_Press: "barbell-neck-press",
  "Barbell_Incline_Bench_Press_-_Medium_Grip": "incline-bench-press",
  Decline_Barbell_Bench_Press: "decline-barbell-bench-press",
  "Wide-Grip_Decline_Barbell_Bench_Press": "wide-grip-decline-bench-press",
  Reverse_Triceps_Bench_Press: "reverse-triceps-bench-press-with-barbell",
  Dumbbell_Bench_Press: "bench-press-dumbbell",
  Incline_Dumbbell_Press: "incline-dumbbell-press",
  Hammer_Grip_Incline_DB_Bench_Press: "hammer-grip-incline-bench-press",
  Decline_Dumbbell_Bench_Press: "decline-dumbbell-bench-press",
  One_Arm_Dumbbell_Bench_Press: "one-arm-bench-press",
  One_Arm_Floor_Press: "one-arm-barbell-floor-press",
  Machine_Bench_Press: "machine-bench-press",
  Leverage_Decline_Chest_Press: "decline-chest-press",
  Smith_Machine_Bench_Press: "smith-machine-bench-press",
  Smith_Machine_Incline_Bench_Press: "smith-machine-incline-bench-press",
  "Smith_Machine_Close-Grip_Bench_Press": "smith-machine-close-grip-bench-press",
  Pushups: "push-ups",
  "Push-Ups_With_Feet_Elevated": "push-up-feet-elevated",
  Bench_Dips: "bench-dips",
  Cable_Crossover: "cable-crossover",
  JM_Press: "jm-press",
  // ── vertical push
  Seated_Barbell_Military_Press: "seated-military-press",
  "Dumbbell_One-Arm_Shoulder_Press": "one-arm-dumbbell-shoulder-press",
  // ── horizontal pull
  Seated_Cable_Rows: "seated-cable-rows",
  "T-Bar_Row_with_Handle": "t-bar-rows",
  "Reverse_Grip_Bent-Over_Rows": "reverse-grips-bent-over-barbell-rows",
  Barbell_Rear_Delt_Row: "rear-deltoid-row-barbell",
  Upright_Barbell_Row: "upright-barbell-rows",
  Upright_Cable_Row: "upright-cable-row",
  Smith_Machine_Upright_Row: "smith-machine-upright-row",
  "Dumbbell_One-Arm_Upright_Row": "one-arm-upright-row",
  // ── vertical pull
  Pullups: "pull-ups",
  "Full_Range-Of-Motion_Lat_Pulldown": "v-bar-pull-down",
  "V-Bar_Pulldown": "v-bar-pull-down",
  Underhand_Cable_Pulldowns: "underhand-pull-downs",
  // ── arms / shoulders (accessories the generator fills sessions with)
  Front_Dumbbell_Raise: "front-dumbbell-raise",
  "Front_Two-Dumbbell_Raise": "front-dumbbell-raise",
  "Dumbbell_Lying_Rear_Lateral_Raise": "lying-rear-lateral-raise",
  "Dumbbell_Lying_One-Arm_Rear_Lateral_Raise": "lying-one-arm-rear-lateral-raise",
  Cable_Internal_Rotation: "internal-cable-rotation",
  High_Cable_Curls: "high-cable-curls",
  Drag_Curl: "drag-curl-with-barbell",
  Reverse_Grip_Triceps_Pushdown: "reverse-grip-triceps-pushdown",
  "Decline_Close-Grip_Bench_To_Skull_Crusher": "decline-close-grip-bench-to-skull-crusher",
  Standing_Overhead_Barbell_Triceps_Extension: "standing-overhead-triceps-extension-with-barbell",
  "Standing_One-Arm_Dumbbell_Triceps_Extension": "one-arm-triceps-extension-with-dumbbell",
  "Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension": "bent-over-one-arm-triceps-extension-with-dumbbell",
  "Standing_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension": "bent-over-two-arm-triceps-extension-with-dumbbell",
  "Standing_Low-Pulley_One-Arm_Triceps_Extension": "one-arm-low-pulley-triceps-extension-with-cable",
  Standing_Towel_Triceps_Extension: "standing-triceps-extension-with-towel",
  "Bent-Arm_Barbell_Pullover": "bent-arm-pullover",
  "Bent-Arm_Dumbbell_Pullover": "dumbbell-bent-arm-pullover",
  "Straight-Arm_Dumbbell_Pullover": "straight-arm-dumbbell-pullover",
  "Wide-Grip_Decline_Barbell_Pullover": "wide-grip-decline-barbell-pullover",
  Front_Raise_And_Pullover: "barbell-front-raise-pullover",
  // ── calves / hips
  Standing_Barbell_Calf_Raise: "standing-barbell-calf-raise",
  Smith_Machine_Reverse_Calf_Raises: "smith-machine-reverse-calf-raises",
  "One-Legged_Cable_Kickback": "one-legged-cable-kickback",
  Thigh_Abductor: "thigh-abductor",
  Thigh_Adductor: "thigh-adductor",
  // ── core
  Crunches: "crunches",
  "Cross-Body_Crunch": "cross-body-crunch",
  Decline_Crunch: "decline-crunch",
  Decline_Oblique_Crunch: "decline-oblique-crunch",
  "Bent-Knee_Hip_Raise": "bent-knee-hip-raise",
  Flutter_Kicks: "flutter-kicks",
  Air_Bike: "air-bike",
  Barbell_Ab_Rollout: "ab-rollout-with-barbell",
};

/** Catalog slugs the generator should prefer: every one has a demonstrable illustration. */
export const PRIORITY_SLUGS: string[] = Object.keys(ILLUSTRATION_BY_CATALOG);
