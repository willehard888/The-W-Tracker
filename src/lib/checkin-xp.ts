// The day score — the client mirror of `score_checkin` (migration
// 20260925100000_xp_v3_effort.sql). The server is the scorer; this file is the
// preview the check-in shows before the RPC answers and the explainer after.
// If you change ANY constant or branch here, change the SQL in the same
// commit and run `node scripts/xp-parity.mjs` against the local PG — the
// fixtures in src/lib/__fixtures__/day-score-cases.json must agree.
//
// Apple Health scores what it can measure; a claim without data earns the
// floor. Every member can reach 100; a day Health recorded can reach 150.
//
//   training   0–50  Health workouts: minutes × zone factor (Z1 0.5 · Z2 1 ·
//                    Z3 1.5 · Z4–5 2), zone = avg HR / (220 − age), no HR = 1.
//                    Cap 50. App-logged session 35 · a tick (or a workout typed
//                    into Health by hand) 25.
//   sleep      0–25  Health night: 7–9 h = 25, linear down to 4 h = 0,
//                    9–10 h = 20, over 10 h = 15. A claim: the same curve × 0.6.
//   steps      0–10  Health only, 1 per 1 000.
//   mind        15   Health mindful ≥ 10 min · a tick 10.
//   hydration   15   ≥ 3 L · 8 at ≥ 2 L.
//   habits     0–25  25 × done / max(chosen, 4).
//   perfect     10   trained + 7–9 h + 3 L + mind + every chosen habit.

import { CHOSEN_HABIT_KEYS, DEFAULT_CHECKIN_KEYS } from "@/lib/checkin-habits";

/** XP per level. `level_for_xp()` in SQL (20260926100100) is the same rule. */
export const XP_PER_LEVEL = 500;
export const levelForXp = (xp: number): number => Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
/** Progress inside the current level: XP into it, XP to the next, percent. */
export const levelProgress = (xp: number, level = levelForXp(xp)) => {
  const into = Math.max(0, xp - (level - 1) * XP_PER_LEVEL);
  return { into, toNext: XP_PER_LEVEL - into, pct: Math.round((into / XP_PER_LEVEL) * 100) };
};

export const DAY_MAX = 100;
export const DAY_MAX_HEALTH = 150;
export const TRAINING_CAP = 50;
export const TRAINING_APP_SESSION = 35;
export const TRAINING_CLAIM = 25;

export type ScoreSource = "health" | "app" | "claim";

export interface DayScoreWorkout {
  duration_min: number;
  avg_hr: number | null;
  manual: boolean;
}

export interface DayScoreInput {
  /** Hours on the slider; null when the member left it blank. */
  sleepHours: number | null;
  /** The Trained tick (or a sport chosen). */
  workout: boolean;
  hydrationLiters: number;
  meditationMorning: boolean;
  meditationEvening: boolean;
  /** The member's chosen habit keys (profiles.checkin_habits); empty → defaults. */
  chosenKeys: string[];
  /** Chosen-habit keys ticked today (column and jsonb habits alike). */
  doneKeys: string[];
  /** A completed program session logged in the app today. */
  appSessionToday: boolean;
  /** Age for the HR zones; null → 30. */
  age: number | null;
  /** Today's Apple Health snapshot; null when Health has nothing for the day. */
  health: {
    workouts: DayScoreWorkout[];
    /** Minutes from a snapshot written before the workouts list existed. */
    workout_minutes: number | null;
    sleep_hours: number | null;
    steps: number | null;
    mindful_minutes: number | null;
  } | null;
}

export interface DayScoreLine {
  k: "training" | "sleep" | "steps" | "mind" | "hydration" | "habits" | "perfect";
  pts: number;
  max: number;
  src?: ScoreSource;
  /** training: Health minutes that scored; mind: Health mindful minutes. */
  minutes?: number;
  /** training: a hand-entered Health workout was seen. */
  manual?: boolean;
  hours?: number;
  count?: number;
  liters?: number;
  done?: number;
  of?: number;
}

export interface DayScore {
  total: number;
  /** 150 with a Health snapshot, 100 without. */
  max: number;
  verified: boolean;
  lines: DayScoreLine[];
}

/** Half-up rounding that survives float noise: 25 × 2.1 / 3 lands on
 *  17.499999999999996 here and on 17.5 in Postgres' numeric arithmetic. */
const round = (n: number): number => Math.round(n + 1e-9);

/** 7–9 h = 25, linear down to 4 h = 0, 9–10 h = 20, over 10 h = 15. */
export const sleepCurve = (h: number | null): number => {
  if (h == null || h < 4) return 0;
  if (h <= 7) return (25 * (h - 4)) / 3;
  if (h <= 9) return 25;
  if (h <= 10) return 20;
  return 15;
};

/** The claimed night: the curve at 60 %, in its own integers so the half-way
 *  cases (6.5 h → 12.5 → 13) round the same here and in Postgres. */
export const sleepClaim = (h: number | null): number => {
  if (h == null || h < 4) return 0;
  if (h <= 7) return 5 * (h - 4);
  if (h <= 9) return 15;
  if (h <= 10) return 12;
  return 9;
};

export const hydrationScore = (liters: number): number => (liters >= 3 ? 15 : liters >= 2 ? 8 : 0);

/** Points per minute for a session at this average heart rate. */
export const effortPerMinute = (avgHr: number | null, hrMax: number): number => {
  if (avgHr == null || avgHr <= 0) return 1;
  const r = avgHr / hrMax;
  return r < 0.6 ? 0.5 : r < 0.7 ? 1 : r < 0.8 ? 1.5 : 2;
};

export const hrMaxFor = (age: number | null): number => 220 - (age ?? 30);

/** The most a day can score for this member: 100, 150 with Health, less
 *  when fewer than four habits are chosen (they share 25 with a floor of 4). */
export const maxDayScore = (chosenKeys: string[], healthConnected: boolean): number => {
  const n = resolveKeys(chosenKeys, []).length;
  const habits = n >= 4 ? 25 : round((25 * n) / 4);
  return (healthConnected ? DAY_MAX_HEALTH : DAY_MAX) - 25 + habits;
};

const resolveKeys = (chosen: string[], done: string[]): string[] => {
  const base = chosen.length ? chosen : DEFAULT_CHECKIN_KEYS;
  const set = new Set<string>();
  for (const k of CHOSEN_HABIT_KEYS) if (base.includes(k) || done.includes(k)) set.add(k);
  return [...set];
};

export function scoreDay(input: DayScoreInput): DayScore {
  const hs = input.health;
  const hrMax = hrMaxFor(input.age);
  // Evening meditation is one column (meditation_evening) read twice in SQL:
  // the mind line and the `meditation_pm` habit. Keep the two inputs in step
  // whichever way the caller filled them.
  const doneSet = new Set(input.doneKeys);
  if (input.meditationEvening) doneSet.add("meditation_pm");
  const doneKeys = [...doneSet];
  const meditationEvening = input.meditationEvening || doneSet.has("meditation_pm");

  // Training — the best evidence wins; Health on a tie.
  let effort = 0;
  let effortMin = 0;
  let manual = false;
  if (hs) {
    for (const w of hs.workouts) {
      if (w.manual) { manual = true; continue; }
      if (w.duration_min <= 0) continue;
      effort += w.duration_min * effortPerMinute(w.avg_hr, hrMax);
      effortMin += w.duration_min;
    }
    if (effort === 0 && !manual && hs.workouts.length === 0 && (hs.workout_minutes ?? 0) >= 10) {
      effort = hs.workout_minutes as number;
      effortMin = hs.workout_minutes as number;
    }
  }
  effort = Math.min(TRAINING_CAP, round(effort));
  // The best evidence wins. A recorded session never scores under the tick
  // (a slow 20-minute walk is still a session Health saw); the app's own
  // logged session beats a small one; a bare tick is the floor.
  let training = 0;
  let trainSrc: ScoreSource | undefined;
  if (effort > 0) { training = Math.max(effort, TRAINING_CLAIM); trainSrc = "health"; }
  if (input.appSessionToday && TRAINING_APP_SESSION > training) { training = TRAINING_APP_SESSION; trainSrc = "app"; }
  if (!trainSrc && (input.workout || manual)) { training = TRAINING_CLAIM; trainSrc = "claim"; }

  // Sleep — the recorded night when Health has one, else the claim at 60 %.
  let sleepH: number | null = null;
  let sleepSrc: ScoreSource | undefined;
  let sleep = 0;
  if (hs?.sleep_hours != null && hs.sleep_hours >= 3) {
    sleepH = hs.sleep_hours; sleepSrc = "health"; sleep = round(sleepCurve(sleepH));
  } else if (input.sleepHours != null) {
    sleepH = input.sleepHours; sleepSrc = "claim"; sleep = round(sleepClaim(sleepH));
  }

  const steps = hs?.steps != null ? Math.min(10, Math.floor(hs.steps / 1000)) : 0;

  let mind = 0;
  let mindSrc: ScoreSource | undefined;
  if ((hs?.mindful_minutes ?? 0) >= 10) { mind = 15; mindSrc = "health"; }
  else if (input.meditationMorning || meditationEvening || (hs?.mindful_minutes ?? 0) > 0) { mind = 10; mindSrc = "claim"; }

  const hydration = hydrationScore(input.hydrationLiters);

  const keys = resolveKeys(input.chosenKeys, doneKeys);
  const done = keys.filter((k) => doneSet.has(k)).length;
  const habits = round((25 * done) / Math.max(keys.length, 4));

  const perfect =
    training > 0 && sleepH != null && sleepH >= 7 && sleepH <= 9 && hydration === 15 && mind > 0
    && keys.length > 0 && done === keys.length ? 10 : 0;

  const total = training + sleep + steps + mind + hydration + habits + perfect;
  const matches =
    (effort > 0 ? 1 : 0) + (sleepSrc === "health" ? 1 : 0) + ((hs?.steps ?? 0) >= 5000 ? 1 : 0) + (mindSrc === "health" ? 1 : 0);

  const lines: DayScoreLine[] = [
    { k: "training", pts: training, max: TRAINING_CAP, src: trainSrc, ...(trainSrc === "health" ? { minutes: effortMin } : {}), ...(manual ? { manual: true } : {}) },
    { k: "sleep", pts: sleep, max: 25, src: sleepSrc, ...(sleepH != null ? { hours: sleepH } : {}) },
    { k: "steps", pts: steps, max: 10, ...(hs?.steps != null ? { src: "health" as const, count: hs.steps } : {}) },
    { k: "mind", pts: mind, max: 15, src: mindSrc, ...(hs?.mindful_minutes != null ? { minutes: hs.mindful_minutes } : {}) },
    { k: "hydration", pts: hydration, max: 15, ...(hydration > 0 ? { src: "claim" as const } : {}), liters: input.hydrationLiters },
    { k: "habits", pts: habits, max: 25, done, of: keys.length },
    { k: "perfect", pts: perfect, max: 10 },
  ];
  return { total, max: hs ? DAY_MAX_HEALTH : DAY_MAX, verified: matches >= 2, lines };
}

/** The server's breakdown (`daily_checkins.score_breakdown`) as a DayScore,
 *  or null for a row scored before v3. */
export const dayScoreFromRow = (raw: unknown): DayScore | null => {
  const b = raw as { v?: number; total?: number; max?: number; verified?: boolean; lines?: DayScoreLine[] } | null;
  if (!b || b.v !== 3 || !Array.isArray(b.lines)) return null;
  return { total: Number(b.total) || 0, max: Number(b.max) || DAY_MAX, verified: !!b.verified, lines: b.lines };
};

export const LINE_LABEL: Record<DayScoreLine["k"], string> = {
  training: "Training", sleep: "Sleep", steps: "Steps", mind: "Mind",
  hydration: "Water", habits: "Habits", perfect: "Perfect day",
};
