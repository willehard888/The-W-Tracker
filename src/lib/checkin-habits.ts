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
// No XP per habit: the chosen habits share 25 points a day (src/lib/checkin-xp.ts),
// so a habit's value is the same whichever it is and adding habits cannot farm.
// Steps and training effort are scored straight from Apple Health, which is why
// "8 000+ steps" and "Zone-2 cardio" are no longer habits.

export type CheckinPillar = "sleep" | "movement" | "nutrition" | "mind" | "recovery" | "connection";
export type VerifySignal = "workout" | "steps" | "sleep" | "mindfulness" | "nutrition";

export interface CheckinHabit {
  key: string;
  label: string;
  emoji: string;
  pillar: CheckinPillar;
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

/**
 * Always-present core habits: sleep, workout, water, meditation. These drive the
 * primary, mostly HealthKit-verifiable score and cannot be removed.
 */
export const CORE_KEYS = ["sleep", "workout", "hydration", "meditation"];

export const CHECKIN_HABITS: CheckinHabit[] = [
  // ── Core (always present, not removable) — sleep, workout, water, meditation ─
  { key: "sleep", label: "Sleep 7–9h", emoji: "🌙", pillar: "sleep", verify: "sleep", core: true, note: "The #1 driver of recovery, mood and performance." },
  { key: "workout", label: "Workout", emoji: "🏋️", pillar: "movement", verify: "workout", core: true, note: "Auto-verified from Apple Health when you train." },
  { key: "hydration", label: "3L+ water", emoji: "💧", pillar: "nutrition", core: true, note: "Even mild dehydration tanks focus + output." },
  { key: "meditation", label: "Meditation", emoji: "🧘", pillar: "mind", column: "meditation_morning", verify: "mindfulness", core: true, note: "Auto-verified from Apple Health mindful minutes." },

  // ── Movement (new) ────────────────────────────────────────────────────────
  { key: "extra_workout", label: "Second session", emoji: "⚡", pillar: "movement", column: "extra_workout", cadence: "bonus" },
  { key: "mobility", label: "Mobility / stretch", emoji: "🤸", pillar: "movement" },
  { key: "sunlight", label: "Morning sunlight", emoji: "☀️", pillar: "movement", note: "Anchors your circadian rhythm within 30 min of waking." },

  // ── Nutrition ─────────────────────────────────────────────────────────────
  { key: "healthy_food", label: "Whole-food meals", emoji: "🥗", pillar: "nutrition", column: "healthy_food" },
  { key: "protein", label: "Protein target", emoji: "🥩", pillar: "nutrition", column: "protein_intake", verify: "nutrition", note: "Auto-confirmed when your food diary hits ≥90 % of your protein target." },
  // One glyph: the emoji renders in a fixed h-11 w-11 / 22px tile, and "🚫🍺"
  // put 44px of glyph in it — the 🚫 spilled outside the tile on device. The
  // label already carries the "no".
  { key: "no_alcohol", label: "No alcohol", emoji: "🍺", pillar: "nutrition", note: "Wrecks deep sleep and recovery — you will see it in tomorrow's Recovery card." },
  { key: "no_sugar", label: "No added sugar", emoji: "🍭", pillar: "nutrition" },
  { key: "caffeine_cutoff", label: "Caffeine before 2pm", emoji: "☕", pillar: "nutrition", note: "Protects tonight's deep sleep." },
  { key: "creatine", label: "Creatine", emoji: "💊", pillar: "nutrition" },

  // ── Mind ──────────────────────────────────────────────────────────────────
  { key: "meditation_pm", label: "Evening meditation", emoji: "🌆", pillar: "mind", column: "meditation_evening", verify: "mindfulness" },
  { key: "breathwork", label: "Breathwork / NSDR", emoji: "🌬️", pillar: "mind", verify: "mindfulness" },
  { key: "no_phone_am", label: "No phone (morning)", emoji: "📵", pillar: "mind", column: "no_phone_morning" },
  { key: "no_phone_pm", label: "No phone (evening)", emoji: "🌃", pillar: "mind", column: "no_phone_evening" },
  { key: "reading", label: "Read", emoji: "📖", pillar: "mind", column: "reading" },
  { key: "journaling", label: "Journal", emoji: "📓", pillar: "mind" },
  { key: "gratitude", label: "Gratitude", emoji: "🙏", pillar: "mind" },

  // ── Recovery ──────────────────────────────────────────────────────────────
  { key: "cold_shower", label: "Cold exposure", emoji: "🧊", pillar: "recovery", column: "cold_shower" },
  { key: "sauna", label: "Sauna / heat", emoji: "🔥", pillar: "recovery", cadence: "bonus" },
  { key: "early_bed", label: "In bed on time", emoji: "🛌", pillar: "recovery" },

  // ── Connection ────────────────────────────────────────────────────────────
  { key: "connection", label: "Real connection", emoji: "🤝", pillar: "connection", note: "A meaningful in-person interaction." },
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

/** Every chooseable (non-core) key, in library order — the set the day score
 *  shares 25 points across. Mirrors `checkin_habit_keys()` in SQL. */
export const CHOSEN_HABIT_KEYS: string[] = CHECKIN_HABITS.filter((h) => !h.core).map((h) => h.key);

/** Sleep in the window the day score pays in full (`sleepCurve` = 25). */
export const SLEEP_FULL_MIN_H = 7;
export const SLEEP_FULL_MAX_H = 9;

/**
 * Did this habit happen on a check-in row? Mirrors `habitDoneOnRow` in
 * supabase/functions/_shared/checkin-habits.ts and `checkin_habit_done` in SQL:
 * sleep is the 7–9 h window the score pays in full, hydration ≥ 3 L, column
 * habits are booleans, the rest read the habits jsonb (completion-only writes —
 * a miss is an absent key).
 */
export const habitDoneOnRow = (row: Record<string, unknown>, key: string): boolean => {
  if (key === "sleep") {
    const h = Number(row.sleep_hours);
    return h >= SLEEP_FULL_MIN_H && h <= SLEEP_FULL_MAX_H;
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
