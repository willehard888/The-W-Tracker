// Curated check-in habit library — the source of truth for the personalized
// daily check-in. Users pick which of these appear in THEIR check-in.
//
// - `column`  → maps to an existing daily_checkins boolean column (backward
//               compatible; record_checkin writes it). Habits WITHOUT a column
//               are stored in daily_checkins.habits (jsonb).
// - `verify`  → which HealthKit signal can confirm it (badge + bonus, never
//               required). undefined = self-report only.
// - `core`    → always shown, can't be removed (sleep + workout).
//
// XP values mirror the previous fixed check-in where habits overlap, so nobody's
// point economy shifts; new habits use evidence-weighted values.

export type CheckinPillar = "sleep" | "movement" | "nutrition" | "mind" | "recovery" | "connection";
export type VerifySignal = "workout" | "steps" | "sleep" | "mindfulness";

export interface CheckinHabit {
  key: string;
  label: string;
  emoji: string;
  pillar: CheckinPillar;
  xp: number;
  /** Existing daily_checkins boolean column, if this is a legacy habit. */
  column?: string;
  /** HealthKit signal that can auto-verify it (badge + bonus). */
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
  { key: "sleep", label: "Sleep 7–9h", emoji: "🌙", pillar: "sleep", xp: 25, verify: "sleep", core: true, note: "The #1 driver of recovery, mood and performance." },
  { key: "workout", label: "Workout", emoji: "🏋️", pillar: "movement", xp: 30, verify: "workout", core: true, note: "Auto-verified from Apple Health when you train." },
  { key: "hydration", label: "3L+ water", emoji: "💧", pillar: "nutrition", xp: 20, core: true, note: "Even mild dehydration tanks focus + output." },
  { key: "meditation", label: "Meditation", emoji: "🧘", pillar: "mind", xp: 15, column: "meditation_morning", verify: "mindfulness", core: true, note: "Auto-verified from Apple Health mindful minutes." },

  // ── Movement (new) ────────────────────────────────────────────────────────
  { key: "steps_8k", label: "8,000+ steps", emoji: "🚶", pillar: "movement", xp: 20, verify: "steps", note: "Daily steps strongly predict longevity." },
  { key: "extra_workout", label: "Second session", emoji: "⚡", pillar: "movement", xp: 25, column: "extra_workout", cadence: "bonus" },
  { key: "zone2", label: "Zone-2 cardio", emoji: "🫀", pillar: "movement", xp: 20, verify: "workout", note: "Builds your aerobic base + mitochondria." },
  { key: "mobility", label: "Mobility / stretch", emoji: "🤸", pillar: "movement", xp: 15 },
  { key: "sunlight", label: "Morning sunlight", emoji: "☀️", pillar: "movement", xp: 15, note: "Anchors your circadian rhythm within 30 min of waking." },

  // ── Nutrition ─────────────────────────────────────────────────────────────
  { key: "healthy_food", label: "Whole-food meals", emoji: "🥗", pillar: "nutrition", xp: 20, column: "healthy_food" },
  { key: "protein", label: "Protein target", emoji: "🥩", pillar: "nutrition", xp: 15, column: "protein_intake" },
  { key: "no_alcohol", label: "No alcohol", emoji: "🚫🍺", pillar: "nutrition", xp: 20, note: "Wrecks deep sleep + recovery — Health confirms it in your heart rate." },
  { key: "no_sugar", label: "No added sugar", emoji: "🍭", pillar: "nutrition", xp: 15 },
  { key: "caffeine_cutoff", label: "Caffeine before 2pm", emoji: "☕", pillar: "nutrition", xp: 10, note: "Protects tonight's deep sleep." },
  { key: "creatine", label: "Creatine", emoji: "💊", pillar: "nutrition", xp: 5 },

  // ── Mind ──────────────────────────────────────────────────────────────────
  { key: "meditation_pm", label: "Evening meditation", emoji: "🌆", pillar: "mind", xp: 15, column: "meditation_evening", verify: "mindfulness" },
  { key: "breathwork", label: "Breathwork / NSDR", emoji: "🌬️", pillar: "mind", xp: 15, verify: "mindfulness" },
  { key: "no_phone_am", label: "No phone (morning)", emoji: "📵", pillar: "mind", xp: 20, column: "no_phone_morning" },
  { key: "no_phone_pm", label: "No phone (evening)", emoji: "🌃", pillar: "mind", xp: 20, column: "no_phone_evening" },
  { key: "reading", label: "Read", emoji: "📖", pillar: "mind", xp: 20, column: "reading" },
  { key: "journaling", label: "Journal", emoji: "📓", pillar: "mind", xp: 15 },
  { key: "gratitude", label: "Gratitude", emoji: "🙏", pillar: "mind", xp: 10 },

  // ── Recovery ──────────────────────────────────────────────────────────────
  { key: "cold_shower", label: "Cold exposure", emoji: "🧊", pillar: "recovery", xp: 30, column: "cold_shower" },
  { key: "sauna", label: "Sauna / heat", emoji: "🔥", pillar: "recovery", xp: 20, cadence: "bonus" },
  { key: "early_bed", label: "In bed on time", emoji: "🛌", pillar: "recovery", xp: 15 },

  // ── Connection ────────────────────────────────────────────────────────────
  { key: "connection", label: "Real connection", emoji: "🤝", pillar: "connection", xp: 15, note: "A meaningful in-person interaction." },
];

export const CHECKIN_HABIT_BY_KEY: Record<string, CheckinHabit> = Object.fromEntries(
  CHECKIN_HABITS.map((h) => [h.key, h]),
);

/**
 * Default OPTIONAL habits for users who haven't customized (core is always added
 * on top). Mirrors the classic check-in minus the four core habits.
 */
export const DEFAULT_CHECKIN_KEYS = [
  "extra_workout", "cold_shower", "healthy_food", "protein",
  "meditation_pm", "no_phone_am", "no_phone_pm", "reading",
];

export const PILLAR_LABEL: Record<CheckinPillar, string> = {
  sleep: "Sleep", movement: "Movement", nutrition: "Nutrition",
  mind: "Mind", recovery: "Recovery", connection: "Connection",
};

/** Resolve the user's configured keys (or the default), preserving library order. */
export const resolveCheckinHabits = (keys: string[] | null | undefined): CheckinHabit[] => {
  const set = new Set(keys && keys.length ? keys : DEFAULT_CHECKIN_KEYS);
  // Core is always included.
  const chosen = CHECKIN_HABITS.filter((h) => h.core || set.has(h.key));
  return chosen;
};
