/**
 * Sport catalog — the single source of truth for what a workout can be.
 *
 * Was a private const inside DailyCheckin.tsx (10 entries, tennis & most
 * real sports funnelled into "Other"). Now shared by the check-in picker,
 * the athlete profile ("What do you train?"), DailyQuests, and — via the
 * persisted `daily_checkins.sport` column — the AI coach's sport-specific
 * coaching.
 *
 * RULES:
 * - `xp` MUST stay ≤ 35. The server-side ceiling in record_checkin budgets
 *   +35 for the workout habit (+10 safety margin); anything above 45 gets
 *   silently clamped and the UI would lie about earned XP.
 * - `id` strings are persisted in daily_checkins.sport — never rename one,
 *   only add.
 * - `tribeActivity` links a sport to the tribe taxonomy name in
 *   src/lib/tribe-activities.ts (free-text contract, additive-safe).
 */

export interface Sport {
  id: string;
  label: string;
  /** XP for the workout habit when this sport is picked (≤ 35 — see above). */
  xp: number;
  group: SportGroup;
  /** Matching tribe activity name (src/lib/tribe-activities.ts), if any. */
  tribeActivity?: string;
}

export type SportGroup =
  | "Strength & Gym"
  | "Cardio & Endurance"
  | "Sports & Games"
  | "Combat"
  | "Mind & Body"
  | "Winter & Outdoor";

export const SPORT_GROUPS: SportGroup[] = [
  "Strength & Gym",
  "Cardio & Endurance",
  "Sports & Games",
  "Combat",
  "Mind & Body",
  "Winter & Outdoor",
];

/** The "no workout" sentinel — kept separate from the real catalog. */
export const NO_WORKOUT: Sport = { id: "none", label: "No workout", xp: 0, group: "Strength & Gym" };

export const SPORTS: Sport[] = [
  // ── Strength & Gym ─────────────────────────────────────────────────────
  { id: "gym",      label: "Gym / Weights", xp: 30, group: "Strength & Gym", tribeActivity: "Gym" },
  { id: "hiit",     label: "HIIT / CrossFit", xp: 30, group: "Strength & Gym" },
  // ── Cardio & Endurance ────────────────────────────────────────────────
  { id: "run",      label: "Running / Jogging", xp: 20, group: "Cardio & Endurance", tribeActivity: "Run" },
  { id: "cycling",  label: "Cycling", xp: 20, group: "Cardio & Endurance", tribeActivity: "Ride" },
  { id: "swim",     label: "Swimming", xp: 25, group: "Cardio & Endurance", tribeActivity: "Swim" },
  { id: "rowing",   label: "Rowing", xp: 25, group: "Cardio & Endurance" },
  { id: "walk",     label: "Walking / Light Cardio", xp: 10, group: "Cardio & Endurance", tribeActivity: "Walk" },
  // ── Sports & Games ────────────────────────────────────────────────────
  { id: "tennis",     label: "Tennis", xp: 25, group: "Sports & Games", tribeActivity: "Tennis" },
  { id: "padel",      label: "Padel", xp: 25, group: "Sports & Games", tribeActivity: "Padel" },
  { id: "football",   label: "Football", xp: 25, group: "Sports & Games" },
  { id: "basketball", label: "Basketball", xp: 25, group: "Sports & Games" },
  { id: "icehockey",  label: "Ice Hockey", xp: 30, group: "Sports & Games" },
  { id: "floorball",  label: "Floorball", xp: 25, group: "Sports & Games" },
  { id: "golf",       label: "Golf", xp: 15, group: "Sports & Games", tribeActivity: "Golf" },
  { id: "team",       label: "Team Sports", xp: 25, group: "Sports & Games" },
  // ── Combat ────────────────────────────────────────────────────────────
  { id: "combat",   label: "Thai Boxing / MMA", xp: 35, group: "Combat", tribeActivity: "Combat" },
  // ── Mind & Body ───────────────────────────────────────────────────────
  { id: "yoga",     label: "Yoga / Stretching", xp: 15, group: "Mind & Body", tribeActivity: "Yoga" },
  { id: "dance",    label: "Dance", xp: 20, group: "Mind & Body" },
  { id: "skate",    label: "Skating", xp: 20, group: "Mind & Body" },
  // ── Winter & Outdoor ──────────────────────────────────────────────────
  { id: "climbing", label: "Climbing", xp: 30, group: "Winter & Outdoor", tribeActivity: "Climbing" },
  { id: "hike",     label: "Hiking", xp: 15, group: "Winter & Outdoor", tribeActivity: "Hike" },
  { id: "ski",      label: "Downhill Skiing", xp: 30, group: "Winter & Outdoor", tribeActivity: "Ski" },
  { id: "xcski",    label: "Cross-Country Skiing", xp: 30, group: "Winter & Outdoor", tribeActivity: "Ski" },
  // ── Catch-all ─────────────────────────────────────────────────────────
  { id: "other",    label: "Other Sport", xp: 20, group: "Sports & Games" },
];

/** Catalog including the "none" sentinel first — the check-in picker's list. */
export const SPORT_CATALOG: Sport[] = [NO_WORKOUT, ...SPORTS];

export const sportById = (id: string | null | undefined): Sport =>
  SPORT_CATALOG.find((s) => s.id === id) ?? NO_WORKOUT;

/** Display label for a persisted sport id ("tennis" → "Tennis 🎾"). */
export const sportLabel = (id: string | null | undefined): string | null => {
  const s = sportById(id);
  return s.id === "none" ? null : s.label;
};

/** Sports grouped for the picker, in SPORT_GROUPS order. */
export const sportsByGroup = (): Array<{ group: SportGroup; sports: Sport[] }> =>
  SPORT_GROUPS.map((group) => ({ group, sports: SPORTS.filter((s) => s.group === group) }))
    .filter((g) => g.sports.length > 0);

/**
 * The "For you" shortlist for the check-in picker: dedup union of the
 * HealthKit-detected sport (today), the athlete's profile sports and their
 * recent check-in sports — in that priority order, max 5. In practice this
 * covers ~all real picks, so the 24-sport catalog can stay collapsed.
 */
export const buildForYou = (
  detected: string | null | undefined,
  profileSports: string[] | null | undefined,
  recent: string[] | null | undefined,
): Sport[] => {
  const seen = new Set<string>();
  const out: Sport[] = [];
  for (const id of [detected, ...(profileSports ?? []), ...(recent ?? [])]) {
    if (!id || seen.has(id)) continue;
    const sport = SPORTS.find((s) => s.id === id);
    if (!sport) continue; // unknown/legacy ids never render a broken row
    seen.add(id);
    out.push(sport);
    if (out.length >= 5) break;
  }
  return out;
};

// ── HealthKit → sport id ─────────────────────────────────────────────────────
// HealthNight.swift returns HKWorkoutActivityType as camelCase strings (its
// workoutTypeName table). Map them to our catalog so Apple-detected workouts
// pre-fill the check-in picker with the RIGHT sport. Conservative:
// ambiguous racket/misc types land on "other" rather than the wrong label.
const HEALTHKIT_SPORT: Record<string, string> = {
  tennis: "tennis",
  pickleball: "padel", // closest cousin in the catalog
  golf: "golf",
  soccer: "football",
  basketball: "basketball",
  hockey: "icehockey",
  running: "run", trackAndField: "run",
  walking: "walk", wheelchairWalkPace: "walk", wheelchairRunPace: "walk",
  hiking: "hike",
  cycling: "cycling", handCycling: "cycling",
  swimming: "swim", waterFitness: "swim",
  rowing: "rowing", paddleSports: "rowing",
  yoga: "yoga", pilates: "yoga", flexibility: "yoga", barre: "yoga",
  mindAndBody: "yoga", taiChi: "yoga",
  dance: "dance", cardioDance: "dance", socialDance: "dance", danceInspiredTraining: "dance",
  boxing: "combat", kickboxing: "combat", martialArts: "combat", wrestling: "combat", fencing: "combat",
  traditionalStrengthTraining: "gym", functionalStrengthTraining: "gym", coreTraining: "gym",
  highIntensityIntervalTraining: "hiit", crossTraining: "hiit",
  mixedMetabolicCardioTraining: "hiit", mixedCardio: "hiit", jumpRope: "hiit",
  stairClimbing: "hiit", stairs: "hiit", stepTraining: "hiit", elliptical: "hiit",
  climbing: "climbing",
  crossCountrySkiing: "xcski",
  downhillSkiing: "ski", snowboarding: "ski", snowSports: "ski",
  skatingSports: "skate",
  americanFootball: "team", australianFootball: "team", rugby: "team",
  volleyball: "team", handball: "team", lacrosse: "team", cricket: "team",
  baseball: "team", softball: "team", floorball: "floorball",
};

/**
 * Sport id for a HealthKit workoutType string, or null when the type isn't a
 * real trainable workout (cooldown, transition, play, …) or is unknown.
 */
export const sportFromHealthKit = (workoutType: string | null | undefined): string | null => {
  if (!workoutType) return null;
  const mapped = HEALTHKIT_SPORT[workoutType];
  if (mapped) return mapped;
  const NON_WORKOUT = new Set(["cooldown", "preparationAndRecovery", "transition", "play", "fitnessGaming"]);
  return NON_WORKOUT.has(workoutType) ? null : "other";
};
