// Curated check-in habit library — the source of truth for the personalized
// daily check-in. Users pick which of these appear in THEIR check-in.
//
// - `column`  → maps to an existing daily_checkins boolean column (backward
//               compatible; record_checkin writes it). Habits WITHOUT a column
//               are stored in daily_checkins.habits (jsonb).
// - `verify`  → which HealthKit signal (or the food diary, "nutrition") can
//               confirm it (badge + bonus, never required). undefined =
//               self-report only.
// - `core`    → always shown, can't be removed (sleep + workout).
//
// XP values mirror the previous fixed check-in where habits overlap, so nobody's
// point economy shifts; new habits use evidence-weighted values.

export type CheckinPillar = "sleep" | "movement" | "nutrition" | "mind" | "recovery" | "connection";
export type VerifySignal = "workout" | "steps" | "sleep" | "mindfulness" | "nutrition";

export interface CheckinHabit {
  key: string;
  label: string;
  pillar: CheckinPillar;
  xp: number;
  /** Existing daily_checkins boolean column, if this is a legacy habit. */
  column?: string;
  /** HealthKit (or food-diary) signal that can auto-verify it (badge + bonus). */
  verify?: VerifySignal;
  /** Always present, not removable (handled specially in the UI: sleep slider / sport picker). */
  core?: boolean;
  /** Short "why it matters" for the picker. */
  note?: string;
  /** "bonus" = occasional extra, never expected daily (coach praises, never pushes).
   *  KEEP IN SYNC with supabase/functions/_shared/checkin-habits.ts. */
  cadence?: "bonus";
}

/** Bonus XP granted when a habit is HealthKit-verified. */
export const VERIFIED_BONUS_XP = 10;

/**
 * Always-present core habits: sleep, workout, water, meditation. These drive the
 * primary, mostly HealthKit-verifiable score and cannot be removed.
 */
export const CORE_KEYS = ["sleep", "workout", "hydration", "meditation"];

/**
 * Anti-cheat cap: the maximum XP a user's *self-chosen* (non-core) habits can add
 * to a single check-in. Stacking many optional habits can't inflate the score —
 * the total optional contribution is bounded, and the server enforces a matching
 * ceiling (see record_checkin). Core habits are unaffected.
 */
export const OPTIONAL_XP_CAP = 40;

export const CHECKIN_HABITS: CheckinHabit[] = [
  // ── Core (always present, not removable) — sleep, workout, water, meditation ─
  { key: "sleep", label: "Sleep 7–9h", pillar: "sleep", xp: 25, verify: "sleep", core: true, note: "The #1 driver of recovery, mood and performance." },
  { key: "workout", label: "Workout", pillar: "movement", xp: 30, verify: "workout", core: true, note: "Auto-verified from Apple Health when you train." },
  { key: "hydration", label: "3L+ water", pillar: "nutrition", xp: 20, core: true, note: "Even mild dehydration tanks focus + output." },
  { key: "meditation", label: "Meditation", pillar: "mind", xp: 15, column: "meditation_morning", verify: "mindfulness", core: true, note: "Auto-verified from Apple Health mindful minutes." },

  // ── Movement (new) ────────────────────────────────────────────────────────
  { key: "steps_8k", label: "8 000+ steps", pillar: "movement", xp: 20, verify: "steps", note: "Daily steps strongly predict longevity." },
  { key: "extra_workout", label: "Second session", pillar: "movement", xp: 25, column: "extra_workout", cadence: "bonus" },
  { key: "zone2", label: "Zone-2 cardio", pillar: "movement", xp: 20, verify: "workout", note: "Builds your aerobic base + mitochondria." },
  { key: "mobility", label: "Mobility / stretch", pillar: "movement", xp: 15 },
  { key: "sunlight", label: "Morning sunlight", pillar: "movement", xp: 15, note: "Anchors your circadian rhythm within 30 min of waking." },

  // ── Nutrition ─────────────────────────────────────────────────────────────
  { key: "healthy_food", label: "Whole-food meals", pillar: "nutrition", xp: 20, column: "healthy_food" },
  { key: "protein", label: "Protein target", pillar: "nutrition", xp: 15, column: "protein_intake", verify: "nutrition", note: "Auto-confirmed when your food diary hits ≥90 % of your protein target." },
  { key: "no_alcohol", label: "No alcohol", pillar: "nutrition", xp: 20, note: "Wrecks deep sleep and recovery — you will see it in tomorrow's Recovery card." },
  { key: "no_sugar", label: "No added sugar", pillar: "nutrition", xp: 15 },
  { key: "caffeine_cutoff", label: "Caffeine before 2pm", pillar: "nutrition", xp: 10, note: "Protects tonight's deep sleep." },
  { key: "creatine", label: "Creatine", pillar: "nutrition", xp: 5 },

  // ── Mind ──────────────────────────────────────────────────────────────────
  { key: "meditation_pm", label: "Evening meditation", pillar: "mind", xp: 15, column: "meditation_evening", verify: "mindfulness" },
  { key: "breathwork", label: "Breathwork / NSDR", pillar: "mind", xp: 15, verify: "mindfulness" },
  { key: "no_phone_am", label: "No phone (morning)", pillar: "mind", xp: 20, column: "no_phone_morning" },
  { key: "no_phone_pm", label: "No phone (evening)", pillar: "mind", xp: 20, column: "no_phone_evening" },
  { key: "reading", label: "Read", pillar: "mind", xp: 20, column: "reading" },
  { key: "journaling", label: "Journal", pillar: "mind", xp: 15 },
  { key: "gratitude", label: "Gratitude", pillar: "mind", xp: 10 },

  // ── Recovery ──────────────────────────────────────────────────────────────
  { key: "cold_shower", label: "Cold exposure", pillar: "recovery", xp: 30, column: "cold_shower" },
  { key: "sauna", label: "Sauna / heat", pillar: "recovery", xp: 20, cadence: "bonus" },
  { key: "early_bed", label: "In bed on time", pillar: "recovery", xp: 15 },

  // ── Connection ────────────────────────────────────────────────────────────
  { key: "connection", label: "Real connection", pillar: "connection", xp: 15, note: "A meaningful in-person interaction." },
];

/**
 * Default OPTIONAL habits for users who haven't customized (core is always added
 * on top). Mirrors the classic check-in minus the four core habits.
 */
export const DEFAULT_CHECKIN_KEYS = [
  "extra_workout", "cold_shower", "healthy_food", "protein",
  "meditation_pm", "no_phone_am", "no_phone_pm", "reading",
];

const HABIT_BY_KEY: Record<string, CheckinHabit> = Object.fromEntries(CHECKIN_HABITS.map((h) => [h.key, h]));

/**
 * Did this habit happen on a check-in row? Mirrors `habitDoneOnRow` in
 * supabase/functions/_shared/checkin-habits.ts: sleep is the optimal window,
 * hydration ≥ 3 L, column habits are booleans, the rest read the habits jsonb
 * (completion-only writes — a miss is an absent key).
 */
export const habitDoneOnRow = (row: Record<string, unknown>, key: string): boolean => {
  if (key === "sleep") {
    const h = Number(row.sleep_hours);
    return h >= 7.5 && h <= 9;
  }
  if (key === "hydration") return Number(row.hydration_liters) >= 3;
  // The client catalog never maps workout to its column (the sport picker
  // renders it); the row still has one. See checkin-habits-parity.test.ts.
  if (key === "workout") return row.workout === true;
  const habit = HABIT_BY_KEY[key];
  if (habit?.column) return row[habit.column] === true;
  const jsonb = (row.habits ?? {}) as Record<string, unknown>;
  return jsonb[key] === true;
};

export const PILLAR_LABEL: Record<CheckinPillar, string> = {
  sleep: "Sleep", movement: "Movement", nutrition: "Nutrition",
  mind: "Mind", recovery: "Recovery", connection: "Connection",
};

/**
 * Resolve the user's configured keys (or the default), preserving library order.
 *
 * `earned` names habits the app has its own evidence of today which the athlete
 * never chose — a finished recovery session puts "Mobility / stretch" on the
 * card for that one day. It is not an edit to their selection: it shows credit
 * for something the app watched them do, on the day they did it, and it is gone
 * tomorrow unless they do it again. Library order holds either way, so an
 * earned habit lands in its own pillar rather than at the bottom.
 */
export const resolveCheckinHabits = (
  keys: string[] | null | undefined,
  earned: readonly string[] = [],
): CheckinHabit[] => {
  const set = new Set(keys && keys.length ? keys : DEFAULT_CHECKIN_KEYS);
  for (const key of earned) set.add(key);
  // Core is always included.
  const chosen = CHECKIN_HABITS.filter((h) => h.core || set.has(h.key));
  return chosen;
};
