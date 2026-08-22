// Check-in habit catalog — Deno-side slim copy.
//
// KEEP IN SYNC with src/lib/checkin-habits.ts (the client is the source of
// truth for labels/keys; edge functions can't import across the src/ ↔
// supabase/functions/ boundary). Only the fields the coach context needs.
//
// Storage semantics (daily_checkins):
// - `column` habits live in legacy boolean/numeric columns.
// - everything else lives in the `habits` jsonb — and ONLY completions are
//   written (habits[key] = true); a miss is an ABSENT key, so "skipped" can
//   only be inferred against the user's chosen set (profiles.checkin_habits).

export interface SharedCheckinHabit {
  key: string;
  label: string;
  pillar: "sleep" | "movement" | "nutrition" | "mind" | "recovery" | "connection";
  /** Legacy daily_checkins column holding this habit (absent → habits jsonb). */
  column?: string;
  /** "bonus" = an occasional extra, NEVER expected daily. The coach praises
   *  it when done and must never frame it as a gap or "falling behind"
   *  (founder: a second training session is a nice add-on, not a duty). */
  cadence?: "bonus";
}

export const CORE_KEYS = ["sleep", "workout", "hydration", "meditation"];

export const SHARED_CHECKIN_HABITS: SharedCheckinHabit[] = [
  { key: "sleep", label: "Sleep 7–9h", pillar: "sleep" },
  { key: "workout", label: "Workout", pillar: "movement", column: "workout" },
  { key: "hydration", label: "3L+ water", pillar: "nutrition" },
  { key: "meditation", label: "Meditation", pillar: "mind", column: "meditation_morning" },
  { key: "steps_8k", label: "8,000+ steps", pillar: "movement" },
  { key: "extra_workout", label: "Second session", pillar: "movement", column: "extra_workout", cadence: "bonus" },
  { key: "zone2", label: "Zone-2 cardio", pillar: "movement" },
  { key: "mobility", label: "Mobility / stretch", pillar: "movement" },
  { key: "sunlight", label: "Morning sunlight", pillar: "movement" },
  { key: "healthy_food", label: "Whole-food meals", pillar: "nutrition", column: "healthy_food" },
  { key: "protein", label: "Protein target", pillar: "nutrition", column: "protein_intake" },
  { key: "no_alcohol", label: "No alcohol", pillar: "nutrition" },
  { key: "no_sugar", label: "No added sugar", pillar: "nutrition" },
  { key: "caffeine_cutoff", label: "Caffeine before 2pm", pillar: "nutrition" },
  { key: "creatine", label: "Creatine", pillar: "nutrition" },
  { key: "meditation_pm", label: "Evening meditation", pillar: "mind", column: "meditation_evening" },
  { key: "breathwork", label: "Breathwork / NSDR", pillar: "mind" },
  { key: "no_phone_am", label: "No phone (morning)", pillar: "mind", column: "no_phone_morning" },
  { key: "no_phone_pm", label: "No phone (evening)", pillar: "mind", column: "no_phone_evening" },
  { key: "reading", label: "Read", pillar: "mind", column: "reading" },
  { key: "journaling", label: "Journal", pillar: "mind" },
  { key: "gratitude", label: "Gratitude", pillar: "mind" },
  { key: "cold_shower", label: "Cold exposure", pillar: "recovery", column: "cold_shower" },
  { key: "sauna", label: "Sauna / heat", pillar: "recovery", cadence: "bonus" },
  { key: "early_bed", label: "In bed on time", pillar: "recovery" },
  { key: "connection", label: "Real connection", pillar: "connection" },
];

export const SHARED_HABIT_BY_KEY: Record<string, SharedCheckinHabit> =
  Object.fromEntries(SHARED_CHECKIN_HABITS.map((h) => [h.key, h]));

export const isBonusHabit = (key: string): boolean =>
  SHARED_HABIT_BY_KEY[key]?.cadence === "bonus";

/** Mirrors DEFAULT_CHECKIN_KEYS on the client (users who never customized). */
export const DEFAULT_CHECKIN_KEYS = [
  "extra_workout", "cold_shower", "healthy_food", "protein",
  "meditation_pm", "no_phone_am", "no_phone_pm", "reading",
];

/** Resolve the user's chosen habits (core always included), catalog order. */
export const resolveChosen = (keys: string[] | null | undefined): SharedCheckinHabit[] => {
  const set = new Set(keys && keys.length ? keys : DEFAULT_CHECKIN_KEYS);
  return SHARED_CHECKIN_HABITS.filter((h) => CORE_KEYS.includes(h.key) || set.has(h.key));
};

/**
 * Did the user complete this habit on a given check-in row?
 * sleep = optimal window 7.5–9h (mirrors assessSleep), hydration = >=3L;
 * other column habits are booleans; the rest read the habits jsonb
 * (completion-only writes).
 */
export const habitDoneOnRow = (row: Record<string, unknown>, key: string): boolean => {
  if (key === "sleep") {
    const h = Number(row.sleep_hours);
    return h >= 7.5 && h <= 9;
  }
  if (key === "hydration") return Number(row.hydration_liters) >= 3;
  const habit = SHARED_HABIT_BY_KEY[key];
  if (habit?.column) return row[habit.column] === true;
  const jsonb = (row.habits ?? {}) as Record<string, unknown>;
  return jsonb[key] === true;
};
