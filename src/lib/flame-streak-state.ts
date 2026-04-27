/**
 * Streak → Fire Emotion mapping.
 *
 * The fire is the user's status mirror. Each state has a *personality*, not
 * just a size. Low streaks are ERRATIC; high streaks are CALM POWER.
 *
 * Single source of truth for:
 *   - which discrete state the flame is in (8 states)
 *   - mood: healthy / at-risk / broken
 *   - the CSS-var amplitudes the engine writes on its container
 *   - milestone detection (7 / 30 / 100 / 200)
 *
 * Pure functions only. No React, no DOM access. Safe for SSR + tests.
 */

export type FlameState =
  | "ember"     // 0
  | "kindling"  // 1–3
  | "lit"       // 4–6
  | "steady"    // 7–13
  | "strong"    // 14–29
  | "roaring"   // 30–59
  | "elite"     // 60–99
  | "legend";   // 100+

export type FlameMood = "healthy" | "at-risk" | "broken";

export interface FlameProfile {
  state: FlameState;
  mood: FlameMood;
  /** 0..1 — flicker amplitude (low streaks = high, elite = low). */
  flicker: number;
  /** 0..1 — sway amplitude. */
  sway: number;
  /** 0..1 — breath amplitude (slow expand/contract of whole flame). */
  breath: number;
  /** 0..1 — global body opacity multiplier. */
  bodyAlpha: number;
  /** Sparks per second (continuous emission rate). 0 = none. */
  sparkRate: number;
  /** True for elite/legend — render ambient halo behind container. */
  ambient: boolean;
  /** True for legend — slowest, heaviest motion (extra "weight"). */
  heavy: boolean;
}

const STATE_THRESHOLDS: Array<{ min: number; state: FlameState }> = [
  { min: 100, state: "legend" },
  { min: 60,  state: "elite" },
  { min: 30,  state: "roaring" },
  { min: 14,  state: "strong" },
  { min: 7,   state: "steady" },
  { min: 4,   state: "lit" },
  { min: 1,   state: "kindling" },
  { min: 0,   state: "ember" },
];

export const stateForStreak = (streak: number): FlameState => {
  const s = Math.max(0, Math.floor(streak || 0));
  for (const t of STATE_THRESHOLDS) {
    if (s >= t.min) return t.state;
  }
  return "ember";
};

const STATE_PROFILES: Record<FlameState, Omit<FlameProfile, "state" | "mood">> = {
  ember:    { flicker: 0.95, sway: 0.20, breath: 0.35, bodyAlpha: 0.35, sparkRate: 0,    ambient: false, heavy: false },
  kindling: { flicker: 0.85, sway: 0.55, breath: 0.55, bodyAlpha: 0.62, sparkRate: 0,    ambient: false, heavy: false },
  lit:      { flicker: 0.55, sway: 0.40, breath: 0.50, bodyAlpha: 0.78, sparkRate: 0,    ambient: false, heavy: false },
  steady:   { flicker: 0.40, sway: 0.35, breath: 0.55, bodyAlpha: 0.88, sparkRate: 0.13, ambient: false, heavy: false }, // ~1/8s
  strong:   { flicker: 0.30, sway: 0.30, breath: 0.65, bodyAlpha: 0.94, sparkRate: 0.20, ambient: false, heavy: false }, // ~1/5s
  roaring:  { flicker: 0.25, sway: 0.32, breath: 0.75, bodyAlpha: 1.00, sparkRate: 0.33, ambient: false, heavy: false }, // ~1/3s
  elite:    { flicker: 0.18, sway: 0.22, breath: 0.85, bodyAlpha: 1.00, sparkRate: 0.50, ambient: true,  heavy: false }, // ~1/2s
  legend:   { flicker: 0.14, sway: 0.18, breath: 1.00, bodyAlpha: 1.00, sparkRate: 1.00, ambient: true,  heavy: true  }, // ~2/2s
};

const MS_HOUR = 3_600_000;
/** Window after which the flame becomes "anxious" (>18h since last checkin). */
export const AT_RISK_AFTER_MS = 18 * MS_HOUR;
/** Hard deadline — beyond this the streak is considered broken. */
export const BROKEN_AFTER_MS = 24 * MS_HOUR;

export interface ComputeFlameInput {
  streak: number;
  /** ISO string or epoch ms of the user's last successful checkin. */
  lastCheckinAt?: string | number | null;
  /** Override "now" for tests. */
  now?: number;
}

export const moodForStreak = (input: ComputeFlameInput): FlameMood => {
  const streak = Math.max(0, Math.floor(input.streak || 0));
  if (streak <= 0) return "healthy"; // ember = neutral, not broken
  const last = input.lastCheckinAt
    ? typeof input.lastCheckinAt === "number"
      ? input.lastCheckinAt
      : Date.parse(input.lastCheckinAt)
    : null;
  if (!last || Number.isNaN(last)) return "healthy";
  const now = input.now ?? Date.now();
  const elapsed = now - last;
  if (elapsed >= BROKEN_AFTER_MS) return "broken";
  if (elapsed >= AT_RISK_AFTER_MS) return "at-risk";
  return "healthy";
};

/**
 * Apply mood modifiers to the base personality. At-risk = inverted
 * personality (smaller, more erratic), broken = collapsed.
 */
export const computeFlameProfile = (input: ComputeFlameInput): FlameProfile => {
  const state = stateForStreak(input.streak);
  const mood = moodForStreak(input);
  const base = STATE_PROFILES[state];

  if (mood === "at-risk") {
    return {
      state,
      mood,
      // More erratic, but smaller envelope — sickly fire
      flicker: Math.min(1, base.flicker * 1.6),
      sway: base.sway * 0.6,
      breath: base.breath * 0.5,
      bodyAlpha: base.bodyAlpha * 0.78,
      sparkRate: 0,
      ambient: false,
      heavy: false,
    };
  }

  if (mood === "broken") {
    return {
      state: "ember",
      mood,
      flicker: 0.95,
      sway: 0.10,
      breath: 0.20,
      bodyAlpha: 0.18,
      sparkRate: 0,
      ambient: false,
      heavy: false,
    };
  }

  return { state, mood, ...base };
};

/** Streak counts that trigger a full milestone burst the moment they're hit. */
export const MILESTONES = [7, 30, 100, 200] as const;
export type Milestone = (typeof MILESTONES)[number];

export const milestoneCrossed = (
  prev: number,
  next: number,
): Milestone | null => {
  if (next <= prev) return null;
  for (const m of MILESTONES) {
    if (prev < m && next >= m) return m;
  }
  return null;
};

/** Minor surge: streak incremented but not a milestone. */
export const isDailySurge = (prev: number, next: number): boolean => {
  if (next <= prev) return false;
  return milestoneCrossed(prev, next) === null;
};

/** Streak collapsed: had positive streak, now zero. */
export const isStreakLost = (prev: number, next: number): boolean => {
  return prev > 0 && next === 0;
};
