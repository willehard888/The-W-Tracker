// Curated movement library used to ground the AI program designer.
// Each movement carries the equipment it needs and the injuries it should be
// avoided with. The generator filters this list to the athlete's actual
// equipment and contraindications, then injects the allowed names into the
// prompt so the model can only choose realistic, safe movements.

export type Pattern =
  | "squat" | "hinge"
  | "horizontal_push" | "vertical_push"
  | "horizontal_pull" | "vertical_pull"
  | "lunge" | "carry" | "rotation" | "core_anti"
  | "conditioning" | "mobility";

export type EquipmentTag =
  | "bodyweight" | "dumbbells" | "barbell" | "kettlebell"
  | "bands" | "machines" | "cable" | "pullup_bar"
  | "bench" | "rower" | "bike" | "treadmill" | "outdoor";

export type InjuryTag =
  | "lower_back" | "knee" | "shoulder" | "elbow" | "wrist" | "hip" | "neck" | "ankle";

export interface Movement {
  name: string;
  pattern: Pattern;
  equipment: EquipmentTag[];     // any of these unlocks it
  contra: InjuryTag[];           // skip if athlete has any of these
  difficulty: 1 | 2 | 3;         // 1 beginner, 3 advanced
  rep_hint: string;              // typical working rep range
  rest_hint_sec: number;
  tempo_hint?: string;           // empty for non-tempo movements
}

const M = (
  name: string,
  pattern: Pattern,
  equipment: EquipmentTag[],
  contra: InjuryTag[],
  difficulty: 1 | 2 | 3,
  rep_hint: string,
  rest_hint_sec: number,
  tempo_hint = "",
): Movement => ({ name, pattern, equipment, contra, difficulty, rep_hint, rest_hint_sec, tempo_hint });

export const MOVEMENTS: Movement[] = [
  // SQUAT
  M("Back Squat", "squat", ["barbell"], ["lower_back", "knee"], 3, "5–8", 180, "3-1-1-0"),
  M("Front Squat", "squat", ["barbell"], ["wrist", "knee"], 3, "5–8", 180, "3-1-1-0"),
  M("Goblet Squat", "squat", ["dumbbells", "kettlebell"], [], 1, "8–12", 90),
  M("DB Bulgarian Split Squat", "squat", ["dumbbells"], [], 2, "8–10/leg", 90, "2-1-1-0"),
  M("Heel-Elevated Goblet Squat", "squat", ["dumbbells", "kettlebell"], [], 1, "10–12", 90),
  M("Box Squat", "squat", ["barbell"], ["knee"], 2, "5–8", 150),
  M("Bodyweight Squat (3-sec eccentric)", "squat", ["bodyweight"], [], 1, "12–20", 60, "3-1-1-0"),
  M("Leg Press", "squat", ["machines"], [], 1, "8–12", 120),
  M("KB Front Squat", "squat", ["kettlebell"], [], 2, "8–10", 90),

  // HINGE
  M("Conventional Deadlift", "hinge", ["barbell"], ["lower_back"], 3, "3–6", 210, "1-1-1-1"),
  M("Romanian Deadlift", "hinge", ["barbell", "dumbbells"], [], 2, "6–10", 150, "3-1-1-0"),
  M("DB RDL", "hinge", ["dumbbells"], [], 1, "8–12", 90, "3-1-1-0"),
  M("Single-Leg DB RDL", "hinge", ["dumbbells"], [], 2, "8–10/leg", 90),
  M("Hip Thrust (BB)", "hinge", ["barbell", "bench"], [], 2, "8–12", 120, "2-2-1-0"),
  M("DB Hip Thrust", "hinge", ["dumbbells", "bench"], [], 1, "10–15", 90),
  M("Kettlebell Swing", "hinge", ["kettlebell"], ["lower_back"], 2, "12–20", 60),
  M("Good Morning", "hinge", ["barbell"], ["lower_back"], 3, "8–10", 120, "3-1-1-0"),
  M("Glute Bridge", "hinge", ["bodyweight"], [], 1, "15–20", 60, "2-2-1-0"),

  // HORIZONTAL PUSH
  M("Bench Press", "horizontal_push", ["barbell", "bench"], ["shoulder"], 3, "5–8", 180, "2-1-1-0"),
  M("DB Bench Press", "horizontal_push", ["dumbbells", "bench"], ["shoulder"], 2, "8–12", 120, "2-1-1-0"),
  M("DB Floor Press", "horizontal_push", ["dumbbells"], [], 1, "8–12", 90),
  M("Push-Up", "horizontal_push", ["bodyweight"], ["wrist"], 1, "AMRAP", 60),
  M("Deficit Push-Up", "horizontal_push", ["bodyweight"], ["wrist", "shoulder"], 2, "8–15", 75, "3-1-1-0"),
  M("Cable Chest Press", "horizontal_push", ["cable"], [], 1, "10–15", 75),
  M("Machine Chest Press", "horizontal_push", ["machines"], [], 1, "10–12", 90),

  // VERTICAL PUSH
  M("Standing OHP", "vertical_push", ["barbell"], ["lower_back", "shoulder"], 3, "5–8", 150, "2-1-1-0"),
  M("Seated DB Press", "vertical_push", ["dumbbells", "bench"], ["shoulder"], 2, "6–10", 120, "2-1-1-0"),
  M("Z-Press (KB)", "vertical_push", ["kettlebell"], [], 2, "6–10", 90),
  M("Pike Push-Up", "vertical_push", ["bodyweight"], ["shoulder", "wrist"], 2, "6–12", 75),
  M("Landmine Press", "vertical_push", ["barbell"], [], 2, "8–10/side", 90),
  M("Machine Shoulder Press", "vertical_push", ["machines"], [], 1, "8–12", 90),

  // HORIZONTAL PULL
  M("Barbell Row", "horizontal_pull", ["barbell"], ["lower_back"], 3, "6–10", 120, "2-1-1-0"),
  M("Chest-Supported DB Row", "horizontal_pull", ["dumbbells", "bench"], [], 1, "8–12", 90, "2-1-2-0"),
  M("Single-Arm DB Row", "horizontal_pull", ["dumbbells", "bench"], [], 1, "8–12/side", 75),
  M("Inverted Row", "horizontal_pull", ["bodyweight", "pullup_bar"], [], 2, "8–15", 75),
  M("Cable Row", "horizontal_pull", ["cable", "machines"], [], 1, "10–12", 75, "1-1-2-0"),
  M("Band Row", "horizontal_pull", ["bands"], [], 1, "12–20", 45),

  // VERTICAL PULL
  M("Pull-Up", "vertical_pull", ["bodyweight", "pullup_bar"], ["elbow", "shoulder"], 3, "AMRAP", 120),
  M("Chin-Up", "vertical_pull", ["bodyweight", "pullup_bar"], ["elbow"], 3, "AMRAP", 120),
  M("Lat Pulldown", "vertical_pull", ["cable", "machines"], [], 1, "8–12", 75),
  M("Band Pulldown (kneeling)", "vertical_pull", ["bands"], [], 1, "12–15", 60),
  M("Negative Pull-Up", "vertical_pull", ["bodyweight", "pullup_bar"], [], 2, "5–8", 90, "5-0-0-0"),

  // LUNGE / UNILATERAL
  M("DB Reverse Lunge", "lunge", ["dumbbells"], ["knee"], 1, "8–10/leg", 75),
  M("DB Walking Lunge", "lunge", ["dumbbells"], ["knee"], 2, "10–12/leg", 90),
  M("Step-Up (Bench)", "lunge", ["dumbbells", "bench"], ["knee"], 1, "10/leg", 75),
  M("Lateral Lunge", "lunge", ["dumbbells", "bodyweight"], ["hip", "knee"], 2, "8/leg", 60),

  // CARRY
  M("Farmer Carry", "carry", ["dumbbells", "kettlebell"], [], 1, "30–45 m", 60),
  M("Suitcase Carry", "carry", ["dumbbells", "kettlebell"], [], 1, "30 m/side", 60),
  M("Overhead Carry", "carry", ["dumbbells", "kettlebell"], ["shoulder"], 2, "20 m", 75),

  // ROTATION
  M("Pallof Press (cable/band)", "rotation", ["cable", "bands"], [], 1, "10/side", 45),
  M("Half-Kneeling Cable Chop", "rotation", ["cable"], [], 2, "10/side", 45),
  M("Russian Twist (light)", "rotation", ["dumbbells", "bodyweight"], ["lower_back"], 2, "12/side", 45),

  // CORE / ANTI
  M("Plank", "core_anti", ["bodyweight"], [], 1, "30–60 s", 45),
  M("Side Plank", "core_anti", ["bodyweight"], [], 2, "20–45 s/side", 45),
  M("Dead Bug", "core_anti", ["bodyweight"], [], 1, "8/side slow", 45),
  M("Bird Dog", "core_anti", ["bodyweight"], [], 1, "8/side slow", 45),
  M("Hollow Hold", "core_anti", ["bodyweight"], [], 2, "20–40 s", 45),
  M("Ab Wheel Rollout", "core_anti", ["bodyweight"], ["lower_back"], 3, "6–10", 60, "3-0-1-0"),

  // CONDITIONING
  M("Zone 2 (Bike/Row/Run)", "conditioning", ["bike", "rower", "treadmill", "outdoor"], [], 1, "20–40 min @ Z2", 0),
  M("Tempo Intervals", "conditioning", ["bike", "rower", "treadmill", "outdoor"], [], 2, "5×3 min @ threshold, 2 min easy", 120),
  M("VO2 Intervals", "conditioning", ["bike", "rower", "treadmill", "outdoor"], [], 3, "6×1 min hard / 2 min easy", 120),
  M("KB Complex", "conditioning", ["kettlebell"], [], 2, "5 rounds: 8 swings + 6 cleans + 4 presses", 90),
  M("Sled Push", "conditioning", ["outdoor"], [], 2, "6×20 m", 90),
  M("Jump Rope", "conditioning", ["bodyweight"], [], 1, "10×30 s on / 30 s off", 30),
  M("Burpee Finisher", "conditioning", ["bodyweight"], ["knee", "shoulder"], 2, "EMOM 8: 8 burpees", 0),

  // MOBILITY (used for cooldown menus, not main work)
  M("90/90 Hip Switch", "mobility", ["bodyweight"], [], 1, "8/side", 0),
  M("World's Greatest Stretch", "mobility", ["bodyweight"], [], 1, "5/side", 0),
  M("Cat-Cow + Thread Needle", "mobility", ["bodyweight"], [], 1, "8 each", 0),
  M("Couch Stretch", "mobility", ["bodyweight"], [], 1, "60 s/side", 0),
];

const EQUIPMENT_SYNONYMS: Record<string, EquipmentTag[]> = {
  bodyweight: ["bodyweight"],
  none: ["bodyweight"],
  dumbbell: ["dumbbells"],
  dumbbells: ["dumbbells"],
  barbell: ["barbell", "bench"],
  kettlebell: ["kettlebell"],
  kettlebells: ["kettlebell"],
  bands: ["bands"],
  band: ["bands"],
  machines: ["machines", "cable"],
  machine: ["machines"],
  cable: ["cable"],
  "cable-machine": ["cable"],
  "pullup-bar": ["pullup_bar"],
  pullup: ["pullup_bar"],
  "pull-up bar": ["pullup_bar"],
  bench: ["bench"],
  rower: ["rower"],
  bike: ["bike"],
  treadmill: ["treadmill"],
  outdoor: ["outdoor"],
  gym: ["barbell", "dumbbells", "kettlebell", "machines", "cable", "bench", "pullup_bar", "rower", "bike"],
  "full-gym": ["barbell", "dumbbells", "kettlebell", "machines", "cable", "bench", "pullup_bar", "rower", "bike"],
  // ── New onboarding presets (2026-05-21 simplification) ─────────────────
  // These match the 4-preset chip UI in AthleteProfileOnboarding.tsx.
  full_gym:     ["barbell", "dumbbells", "kettlebell", "machines", "cable", "bench", "pullup_bar", "rower", "bike"],
  home_minimal: ["dumbbells", "bands", "pullup_bar"],
  outdoor:      ["outdoor", "pullup_bar"],
  combat_sport: ["bodyweight"], // bag/mat work — closest existing tag
};

const INJURY_SYNONYMS: Record<string, InjuryTag[]> = {
  back: ["lower_back"],
  "lower back": ["lower_back"],
  "low back": ["lower_back"],
  lumbar: ["lower_back"],
  knee: ["knee"],
  knees: ["knee"],
  shoulder: ["shoulder"],
  shoulders: ["shoulder"],
  rotator: ["shoulder"],
  elbow: ["elbow"],
  wrist: ["wrist"],
  hip: ["hip"],
  hips: ["hip"],
  neck: ["neck"],
  ankle: ["ankle"],
};

export const normalizeEquipment = (raw: string[] | null | undefined): Set<EquipmentTag> => {
  const set = new Set<EquipmentTag>(["bodyweight"]); // bodyweight is always available
  for (const r of raw ?? []) {
    const key = String(r).trim().toLowerCase();
    const mapped = EQUIPMENT_SYNONYMS[key];
    if (mapped) mapped.forEach((t) => set.add(t));
  }
  return set;
};

export const normalizeInjuries = (raw: string[] | null | undefined): Set<InjuryTag> => {
  const set = new Set<InjuryTag>();
  for (const r of raw ?? []) {
    const key = String(r).trim().toLowerCase();
    const mapped = INJURY_SYNONYMS[key];
    if (mapped) mapped.forEach((t) => set.add(t));
    // also try direct match if user typed e.g. "knee"
    if (!mapped && (INJURY_SYNONYMS as any)[key.replace(/s$/, "")]) {
      (INJURY_SYNONYMS as any)[key.replace(/s$/, "")].forEach((t: InjuryTag) => set.add(t));
    }
  }
  return set;
};

export const filterMovements = (
  equipment: Set<EquipmentTag>,
  injuries: Set<InjuryTag>,
): Movement[] => {
  return MOVEMENTS.filter((m) => {
    const eqOk = m.equipment.some((e) => equipment.has(e));
    if (!eqOk) return false;
    if (m.contra.some((c) => injuries.has(c))) return false;
    return true;
  });
};

/**
 * Compact, model-friendly representation of allowed movements grouped by pattern.
 */
export const buildAllowedMovementCatalog = (allowed: Movement[]): string => {
  const byPattern = new Map<Pattern, Movement[]>();
  for (const m of allowed) {
    if (!byPattern.has(m.pattern)) byPattern.set(m.pattern, []);
    byPattern.get(m.pattern)!.push(m);
  }
  const order: Pattern[] = [
    "squat", "hinge",
    "horizontal_push", "vertical_push",
    "horizontal_pull", "vertical_pull",
    "lunge", "carry", "rotation", "core_anti",
    "conditioning", "mobility",
  ];
  return order
    .filter((p) => byPattern.has(p))
    .map((p) => {
      const list = byPattern.get(p)!
        .map((m) => `${m.name} (${m.rep_hint}, rest ${m.rest_hint_sec}s${m.tempo_hint ? `, tempo ${m.tempo_hint}` : ""})`)
        .join("; ");
      return `[${p}] ${list}`;
    })
    .join("\n");
};

/**
 * Validate the AI's program against hard rules. Returns array of violations
 * (empty if valid).
 */
export const validateProgram = (
  plan: any,
  opts: {
    trainDayNames: string[];
    sessionMinCap: number;
    allowedNames: Set<string>;
  },
): string[] => {
  const v: string[] = [];
  const weeks = plan?.weeks;
  if (!Array.isArray(weeks) || weeks.length !== 4) {
    v.push("Plan must contain exactly 4 weeks.");
    return v;
  }
  const allowedTrain = new Set(opts.trainDayNames.map((d) => d.toLowerCase()));

  for (const wk of weeks) {
    if (!Array.isArray(wk.days) || wk.days.length !== 7) {
      v.push(`Week ${wk.week}: must contain 7 days.`);
      continue;
    }
    // Track main lifts per day for no-repeat rule.
    const mainPerDay: string[] = [];
    for (const day of wk.days) {
      const isRest = String(day.focus ?? "").toLowerCase() === "rest";
      const dayLower = String(day.day ?? "").toLowerCase();
      if (isRest) {
        if (Array.isArray(day.blocks) && day.blocks.length > 0) {
          v.push(`Week ${wk.week} ${day.day}: rest days must have empty blocks.`);
        }
        mainPerDay.push("");
        continue;
      }
      if (!allowedTrain.has(dayLower)) {
        v.push(`Week ${wk.week} ${day.day}: trained on a non-preferred day. Allowed: ${opts.trainDayNames.join(", ")}.`);
      }
      if (Number(day.duration_min ?? 0) > opts.sessionMinCap) {
        v.push(`Week ${wk.week} ${day.day}: duration ${day.duration_min} > cap ${opts.sessionMinCap} min.`);
      }
      const blocks = Array.isArray(day.blocks) ? day.blocks : [];
      if (blocks.length === 0) {
        v.push(`Week ${wk.week} ${day.day}: training day must have blocks.`);
      }
      for (const b of blocks) {
        if (!b?.name || !opts.allowedNames.has(String(b.name))) {
          v.push(`Week ${wk.week} ${day.day}: "${b?.name ?? "?"}" is not in the allowed movement list.`);
        }
        if (typeof b?.sets !== "number" || typeof b?.rest_sec !== "number" || !b?.reps) {
          v.push(`Week ${wk.week} ${day.day} "${b?.name}": missing sets/reps/rest_sec.`);
        }
      }
      mainPerDay.push(blocks[0]?.name ? String(blocks[0].name) : "");
    }
    // No-repeat rule: same primary movement on consecutive training days
    for (let i = 1; i < mainPerDay.length; i++) {
      if (mainPerDay[i] && mainPerDay[i] === mainPerDay[i - 1]) {
        v.push(`Week ${wk.week}: primary movement "${mainPerDay[i]}" repeated on back-to-back days.`);
      }
    }
  }
  return v;
};
