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
  emoji: string;
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
export const NO_WORKOUT: Sport = { id: "none", label: "No workout", emoji: "—", xp: 0, group: "Strength & Gym" };

export const SPORTS: Sport[] = [
  // ── Strength & Gym ─────────────────────────────────────────────────────
  { id: "gym",      label: "Gym / Weights",          emoji: "🏋️", xp: 30, group: "Strength & Gym", tribeActivity: "Gym" },
  { id: "hiit",     label: "HIIT / CrossFit",        emoji: "⚡", xp: 30, group: "Strength & Gym" },
  // ── Cardio & Endurance ────────────────────────────────────────────────
  { id: "run",      label: "Running / Jogging",      emoji: "🏃", xp: 20, group: "Cardio & Endurance", tribeActivity: "Run" },
  { id: "cycling",  label: "Cycling",                emoji: "🚴", xp: 20, group: "Cardio & Endurance", tribeActivity: "Ride" },
  { id: "swim",     label: "Swimming",               emoji: "🏊", xp: 25, group: "Cardio & Endurance", tribeActivity: "Swim" },
  { id: "rowing",   label: "Rowing",                 emoji: "🚣", xp: 25, group: "Cardio & Endurance" },
  { id: "walk",     label: "Walking / Light Cardio", emoji: "🚶", xp: 10, group: "Cardio & Endurance", tribeActivity: "Walk" },
  // ── Sports & Games ────────────────────────────────────────────────────
  { id: "tennis",     label: "Tennis",         emoji: "🎾", xp: 25, group: "Sports & Games", tribeActivity: "Tennis" },
  { id: "padel",      label: "Padel",          emoji: "🎾", xp: 25, group: "Sports & Games", tribeActivity: "Padel" },
  { id: "football",   label: "Football",       emoji: "⚽", xp: 25, group: "Sports & Games" },
  { id: "basketball", label: "Basketball",     emoji: "🏀", xp: 25, group: "Sports & Games" },
  { id: "icehockey",  label: "Ice Hockey",     emoji: "🏒", xp: 30, group: "Sports & Games" },
  { id: "floorball",  label: "Floorball",      emoji: "🏑", xp: 25, group: "Sports & Games" },
  { id: "golf",       label: "Golf",           emoji: "⛳", xp: 15, group: "Sports & Games", tribeActivity: "Golf" },
  { id: "team",       label: "Team Sports",    emoji: "🥅", xp: 25, group: "Sports & Games" },
  // ── Combat ────────────────────────────────────────────────────────────
  { id: "combat",   label: "Thai Boxing / MMA",      emoji: "🥊", xp: 35, group: "Combat", tribeActivity: "Combat" },
  // ── Mind & Body ───────────────────────────────────────────────────────
  { id: "yoga",     label: "Yoga / Stretching",      emoji: "🧘", xp: 15, group: "Mind & Body", tribeActivity: "Yoga" },
  { id: "dance",    label: "Dance",                  emoji: "💃", xp: 20, group: "Mind & Body" },
  { id: "skate",    label: "Skating",                emoji: "⛸️", xp: 20, group: "Mind & Body" },
  // ── Winter & Outdoor ──────────────────────────────────────────────────
  { id: "climbing", label: "Climbing",               emoji: "🧗", xp: 30, group: "Winter & Outdoor", tribeActivity: "Climbing" },
  { id: "hike",     label: "Hiking",                 emoji: "🥾", xp: 15, group: "Winter & Outdoor", tribeActivity: "Hike" },
  { id: "ski",      label: "Downhill Skiing",        emoji: "⛷️", xp: 30, group: "Winter & Outdoor", tribeActivity: "Ski" },
  { id: "xcski",    label: "Cross-Country Skiing",   emoji: "🎿", xp: 30, group: "Winter & Outdoor", tribeActivity: "Ski" },
  // ── Catch-all ─────────────────────────────────────────────────────────
  { id: "other",    label: "Other Sport",            emoji: "🏅", xp: 20, group: "Sports & Games" },
];

/** Catalog including the "none" sentinel first — the check-in picker's list. */
export const SPORT_CATALOG: Sport[] = [NO_WORKOUT, ...SPORTS];

export const sportById = (id: string | null | undefined): Sport =>
  SPORT_CATALOG.find((s) => s.id === id) ?? NO_WORKOUT;

/** Display label for a persisted sport id ("tennis" → "Tennis 🎾"). */
export const sportLabel = (id: string | null | undefined): string | null => {
  const s = sportById(id);
  return s.id === "none" ? null : `${s.emoji} ${s.label}`;
};

/** Sports grouped for the picker, in SPORT_GROUPS order. */
export const sportsByGroup = (): Array<{ group: SportGroup; sports: Sport[] }> =>
  SPORT_GROUPS.map((group) => ({ group, sports: SPORTS.filter((s) => s.group === group) }))
    .filter((g) => g.sports.length > 0);
