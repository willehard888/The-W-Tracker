/**
 * Whealth Index — the deterministic scoring core of Whealth OS.
 *
 * Turns the user's raw data (check-ins, HealthKit nights/days, reflections,
 * habits, lessons, lifts, social) into six pillar scores (0-100) + an overall
 * index + honestly-labeled behavioral patterns. PURE functions only — no
 * imports, no Date.now(), no I/O — so the exact same code runs in the
 * coach-insights edge function (Deno) and the client dashboard, and every
 * branch is unit-testable.
 *
 * Honesty rules:
 * - A pillar with no data returns null (never a fake 50).
 * - Sub-signals that are missing REDISTRIBUTE their weight to present ones.
 * - Patterns require n ≥ 5 on both sides and a material delta, and always
 *   carry their sample sizes.
 */

// ── Input shapes (plain data, snake-free, pre-fetched by the caller) ────────

export interface CheckinDay {
  /** YYYY-MM-DD */
  day: string;
  sleepHours: number | null;
  hydration: number | null;
  workout: boolean;
  meditation: boolean;
  protein: boolean;
  healthyFood: boolean;
  noPhone: boolean;
  journal: boolean;
  verified: boolean;
}

export interface NightRow {
  day: string;
  restingHr: number | null;
  hrvSdnn: number | null;
  respRate: number | null;
  sleepTotalMin: number | null;
  deepMin: number | null;
  remMin: number | null;
  /** ISO timestamp of sleep start (bedtime consistency). */
  sleepStart: string | null;
}

export interface DayRow {
  day: string;
  steps: number | null;
  activeKcal: number | null;
  workoutMinutes: number | null;
  mindfulMinutes: number | null;
}

export interface ReflectionRow {
  day: string;
  energy: number | null; // 1-5
  mood: number | null;   // 1-5
  hasWin: boolean;
  hasFriction: boolean;
}

export interface WhealthInputs {
  checkins: CheckinDay[];
  nights: NightRow[];
  days: DayRow[];
  reflections: ReflectionRow[];
  habitStreaks: number[];          // current_streak per active user habit
  lessonsCompleted: number;
  lessonsTotal: number;
  avgQuizScore: number | null;     // 0-100
  liftPrs: number;
  liftStalls: number;
  liftCount: number;
  tribeCount: number;
  friendCount: number;
  iAmSet: boolean;
}

export interface PillarScores {
  sleep: number | null;
  recovery: number | null;
  movement: number | null;
  nutrition: number | null;
  mind: number | null;
  inner: number | null;
}

export interface WhealthPattern {
  key: string;
  /** Human framing of the two groups, e.g. "nights under 7h" vs "7h+ nights". */
  aLabel: string;
  bLabel: string;
  nA: number;
  nB: number;
  avgA: number;
  avgB: number;
  /** avgA - avgB, in `unit`. */
  delta: number;
  unit: string;
  metric: string;
}

export interface WhealthResult {
  overall: number | null;
  pillars: PillarScores;
  patterns: WhealthPattern[];
}

// ── Small pure helpers ──────────────────────────────────────────────────────

const avg = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const round = (v: number): number => Math.round(v);
const round1 = (v: number): number => Math.round(v * 10) / 10;

/** Weighted mean over sub-signals; missing (null) signals redistribute weight. */
const composite = (parts: Array<{ score: number | null; weight: number }>): number | null => {
  const present = parts.filter((p) => p.score != null) as Array<{ score: number; weight: number }>;
  if (!present.length) return null;
  const totalW = present.reduce((s, p) => s + p.weight, 0);
  return round(present.reduce((s, p) => s + p.score * p.weight, 0) / totalW);
};

/** Linear ramp: 0 at `zero`, 1 at `full` (direction inferred). */
const ramp = (v: number, zero: number, full: number): number =>
  full > zero ? clamp01((v - zero) / (full - zero)) : clamp01((zero - v) / (zero - full));

// ── Pillar scores ───────────────────────────────────────────────────────────

/** A night row only counts as sleep DATA when it actually recorded sleep —
 *  the Watch often logs RHR/resp without sleep, leaving sleep_total_min = 0,
 *  and treating that as "slept 0h" poisoned the average (real prod case). */
const hasSleepData = (n: NightRow): boolean => (n.sleepTotalMin ?? 0) >= 60;

/** Sleep: duration in the 7.5-9h band + stage quality + bedtime consistency. */
export function scoreSleep(checkins: CheckinDay[], nights: NightRow[]): number | null {
  // Duration: prefer HealthKit totals, fall back to self-reported.
  const hkHours = nights.filter(hasSleepData).map((n) => n.sleepTotalMin! / 60);
  const selfHours = checkins.map((c) => c.sleepHours).filter((v): v is number => v != null);
  const hours = hkHours.length >= 3 ? hkHours : selfHours;
  const avgHours = avg(hours);
  const durationScore = avgHours == null ? null
    : avgHours >= 7.5 && avgHours <= 9 ? 100
    : avgHours < 7.5 ? round(ramp(avgHours, 5, 7.5) * 100)
    : round(ramp(avgHours, 11, 9) * 100);

  // Stage quality: deep+REM share of total (healthy adults ~35-50%).
  const shares = nights
    .filter((n) => hasSleepData(n) && (n.deepMin != null || n.remMin != null))
    .map((n) => ((n.deepMin ?? 0) + (n.remMin ?? 0)) / n.sleepTotalMin!);
  const stageScore = shares.length >= 3 ? round(ramp(avg(shares)!, 0.15, 0.4) * 100) : null;

  // Bedtime consistency: std-dev of sleep-start minute-of-day under ~45min = great.
  const startMins = nights
    .map((n) => (n.sleepStart ? new Date(n.sleepStart) : null))
    .filter((d): d is Date => d != null && !Number.isNaN(d.getTime()))
    .map((d) => {
      // Normalize around midnight: 22:00 → -120, 01:30 → +90
      const m = d.getHours() * 60 + d.getMinutes();
      return m > 12 * 60 ? m - 24 * 60 : m;
    });
  let consistencyScore: number | null = null;
  if (startMins.length >= 4) {
    const m = avg(startMins)!;
    const sd = Math.sqrt(avg(startMins.map((x) => (x - m) ** 2))!);
    consistencyScore = round(ramp(sd, 120, 30) * 100);
  }

  return composite([
    { score: durationScore, weight: 50 },
    { score: stageScore, weight: 25 },
    { score: consistencyScore, weight: 25 },
  ]);
}

/** Recovery: RHR vs personal baseline, HRV presence/trend, rest-day compliance. */
export function scoreRecovery(checkins: CheckinDay[], nights: NightRow[]): number | null {
  const rhrs = nights.map((n) => n.restingHr).filter((v): v is number => v != null);
  let rhrScore: number | null = null;
  if (rhrs.length >= 7) {
    // Last 7 vs the rest — a rising RHR means accumulating strain.
    const recent = avg(rhrs.slice(-7))!;
    const baseline = avg(rhrs.slice(0, -7)) ?? recent;
    const delta = recent - baseline; // + = worse
    rhrScore = round(ramp(delta, 5, -3) * 100);
  }

  const hrvs = nights.map((n) => n.hrvSdnn).filter((v): v is number => v != null);
  let hrvScore: number | null = null;
  if (hrvs.length >= 7) {
    const recent = avg(hrvs.slice(-7))!;
    const baseline = avg(hrvs.slice(0, -7)) ?? recent;
    hrvScore = round(ramp(recent - baseline, -10, 8) * 100); // higher HRV = better
  }

  // Rest compliance: at least 1 full rest day per rolling week.
  let restScore: number | null = null;
  if (checkins.length >= 7) {
    const weeks = Math.max(1, Math.floor(checkins.length / 7));
    const workoutDays = checkins.filter((c) => c.workout).length;
    const restDays = checkins.length - workoutDays;
    restScore = round(ramp(restDays / weeks, 0, 1.5) * 100);
  }

  return composite([
    { score: rhrScore, weight: 40 },
    { score: hrvScore, weight: 30 },
    { score: restScore, weight: 30 },
  ]);
}

/** Movement: training frequency, daily steps, strength progression. */
export function scoreMovement(
  checkins: CheckinDay[],
  days: DayRow[],
  lifts: { prs: number; stalls: number; count: number },
): number | null {
  let freqScore: number | null = null;
  if (checkins.length >= 7) {
    const perWeek = (checkins.filter((c) => c.workout).length / checkins.length) * 7;
    freqScore = round(ramp(perWeek, 0.5, 4) * 100);
  }

  const steps = days.map((d) => d.steps).filter((v): v is number => v != null && v > 0);
  const stepScore = steps.length >= 5 ? round(ramp(avg(steps)!, 2000, 9000) * 100) : null;

  let progressionScore: number | null = null;
  if (lifts.count >= 2) {
    const total = lifts.prs + lifts.stalls;
    progressionScore = total === 0 ? 60 : round((lifts.prs / total) * 100);
  }

  return composite([
    { score: freqScore, weight: 40 },
    { score: stepScore, weight: 30 },
    { score: progressionScore, weight: 30 },
  ]);
}

/** Nutrition: protein + whole-food hit-rates, hydration. */
export function scoreNutrition(checkins: CheckinDay[]): number | null {
  if (checkins.length < 5) return null;
  const rate = (pick: (c: CheckinDay) => boolean) =>
    checkins.filter(pick).length / checkins.length;
  const proteinScore = round(ramp(rate((c) => c.protein), 0.1, 0.85) * 100);
  const foodScore = round(ramp(rate((c) => c.healthyFood), 0.1, 0.85) * 100);
  const hyds = checkins.map((c) => c.hydration).filter((v): v is number => v != null && v > 0);
  const hydScore = hyds.length >= 5 ? round(ramp(avg(hyds)!, 1, 2.8) * 100) : null;

  return composite([
    { score: proteinScore, weight: 40 },
    { score: foodScore, weight: 30 },
    { score: hydScore, weight: 30 },
  ]);
}

/** Mind: meditation practice, mindful minutes, mood & energy levels. */
export function scoreMind(
  checkins: CheckinDay[],
  days: DayRow[],
  reflections: ReflectionRow[],
): number | null {
  let medScore: number | null = null;
  if (checkins.length >= 7) {
    const perWeek = (checkins.filter((c) => c.meditation).length / checkins.length) * 7;
    medScore = round(ramp(perWeek, 0, 5) * 100);
  }

  const mindful = days.map((d) => d.mindfulMinutes).filter((v): v is number => v != null && v > 0);
  const mindfulScore = mindful.length >= 3 ? round(ramp(avg(mindful)!, 0, 12) * 100) : null;

  const moods = reflections.map((r) => r.mood).filter((v): v is number => v != null);
  const moodScore = moods.length >= 5 ? round(ramp(avg(moods)!, 1.5, 4.2) * 100) : null;
  const energies = reflections.map((r) => r.energy).filter((v): v is number => v != null);
  const energyScore = energies.length >= 5 ? round(ramp(avg(energies)!, 1.5, 4.2) * 100) : null;

  return composite([
    { score: medScore, weight: 30 },
    { score: mindfulScore, weight: 20 },
    { score: moodScore, weight: 25 },
    { score: energyScore, weight: 25 },
  ]);
}

/** Inner: learning (Vault), self-reflection depth, identity, connection. */
export function scoreInner(inputs: {
  lessonsCompleted: number;
  lessonsTotal: number;
  avgQuizScore: number | null;
  reflections: ReflectionRow[];
  habitStreaks: number[];
  tribeCount: number;
  friendCount: number;
  iAmSet: boolean;
}): number | null {
  const { lessonsCompleted, lessonsTotal, avgQuizScore, reflections, habitStreaks, tribeCount, friendCount, iAmSet } = inputs;

  const lessonScore = lessonsTotal > 0
    ? round(ramp(lessonsCompleted / lessonsTotal, 0, 0.6) * 100)
    : null;

  const journalScore = reflections.length >= 5
    ? round((reflections.filter((r) => r.hasWin || r.hasFriction).length / reflections.length) * 100)
    : null;

  const habitScore = habitStreaks.length
    ? round(ramp(Math.max(...habitStreaks), 0, 21) * 100)
    : null;

  const connectionScore = round(
    (clamp01(tribeCount / 1) * 0.4 + clamp01(friendCount / 3) * 0.6) * 100,
  );

  const identityScore = iAmSet ? 100 : 0;
  const quizBonus = avgQuizScore != null ? round(avgQuizScore) : null;

  return composite([
    { score: lessonScore, weight: 25 },
    { score: quizBonus, weight: 10 },
    { score: journalScore, weight: 20 },
    { score: habitScore, weight: 15 },
    { score: connectionScore, weight: 20 },
    { score: identityScore, weight: 10 },
  ]);
}

// ── Pattern detection (paired comparisons, honest n) ───────────────────────

const MIN_N = 5;

/** Generic paired comparison: split days into A/B, compare a next-metric. */
function pairedPattern(args: {
  key: string;
  metric: string;
  unit: string;
  aLabel: string;
  bLabel: string;
  aVals: number[];
  bVals: number[];
  minDelta: number;
}): WhealthPattern | null {
  const { aVals, bVals, minDelta } = args;
  if (aVals.length < MIN_N || bVals.length < MIN_N) return null;
  const avgA = avg(aVals)!;
  const avgB = avg(bVals)!;
  const delta = avgA - avgB;
  if (Math.abs(delta) < minDelta) return null;
  return {
    key: args.key,
    metric: args.metric,
    unit: args.unit,
    aLabel: args.aLabel,
    bLabel: args.bLabel,
    nA: aVals.length,
    nB: bVals.length,
    avgA: round1(avgA),
    avgB: round1(avgB),
    delta: round1(delta),
  };
}

export function detectPatterns(
  checkins: CheckinDay[],
  reflections: ReflectionRow[],
  nights: NightRow[],
): WhealthPattern[] {
  const out: WhealthPattern[] = [];
  const reflByDay = new Map(reflections.map((r) => [r.day, r]));

  // 1. Short sleep → next-day energy
  const nextDayEnergy = (pick: (c: CheckinDay) => boolean): number[] =>
    checkins
      .filter((c) => c.sleepHours != null && pick(c))
      .map((c) => {
        const next = new Date(c.day + "T12:00:00");
        next.setDate(next.getDate() + 1);
        const key = next.toISOString().slice(0, 10);
        return reflByDay.get(key)?.energy ?? null;
      })
      .filter((v): v is number => v != null);
  const p1 = pairedPattern({
    key: "short_sleep_energy",
    metric: "next-day energy",
    unit: "/5",
    aLabel: "after nights under 7h",
    bLabel: "after 7h+ nights",
    aVals: nextDayEnergy((c) => (c.sleepHours ?? 9) < 7),
    bVals: nextDayEnergy((c) => (c.sleepHours ?? 0) >= 7),
    minDelta: 0.4,
  });
  if (p1) out.push(p1);

  // 2. Workout day → same-day mood
  const dayMood = (pick: (c: CheckinDay) => boolean): number[] =>
    checkins
      .filter(pick)
      .map((c) => reflByDay.get(c.day)?.mood ?? null)
      .filter((v): v is number => v != null);
  const p2 = pairedPattern({
    key: "workout_mood",
    metric: "same-day mood",
    unit: "/5",
    aLabel: "on training days",
    bLabel: "on rest days",
    aVals: dayMood((c) => c.workout),
    bVals: dayMood((c) => !c.workout),
    minDelta: 0.3,
  });
  if (p2) out.push(p2);

  // 3. Meditation day → same-day mood
  const p3 = pairedPattern({
    key: "meditation_mood",
    metric: "same-day mood",
    unit: "/5",
    aLabel: "on meditation days",
    bLabel: "on non-meditation days",
    aVals: dayMood((c) => c.meditation),
    bVals: dayMood((c) => !c.meditation),
    minDelta: 0.3,
  });
  if (p3) out.push(p3);

  // 4. Short sleep → resting HR (only nights that actually recorded sleep)
  const sleepNights = nights.filter(hasSleepData);
  const nightRhr = (pick: (n: NightRow) => boolean): number[] =>
    sleepNights.filter((n) => n.restingHr != null && pick(n)).map((n) => n.restingHr!);
  const p4 = pairedPattern({
    key: "short_sleep_rhr",
    metric: "resting heart rate",
    unit: "bpm",
    aLabel: "on nights under 6.5h",
    bLabel: "on 6.5h+ nights",
    aVals: nightRhr((n) => n.sleepTotalMin! < 390),
    bVals: nightRhr((n) => n.sleepTotalMin! >= 390),
    minDelta: 2,
  });
  if (p4) out.push(p4);

  return out;
}

// ── Top-level ───────────────────────────────────────────────────────────────

export const PILLAR_WEIGHTS: Record<keyof PillarScores, number> = {
  sleep: 20,
  recovery: 18,
  movement: 20,
  nutrition: 14,
  mind: 14,
  inner: 14,
};

export function computeWhealthIndex(inputs: WhealthInputs): WhealthResult {
  const pillars: PillarScores = {
    sleep: scoreSleep(inputs.checkins, inputs.nights),
    recovery: scoreRecovery(inputs.checkins, inputs.nights),
    movement: scoreMovement(inputs.checkins, inputs.days, {
      prs: inputs.liftPrs, stalls: inputs.liftStalls, count: inputs.liftCount,
    }),
    nutrition: scoreNutrition(inputs.checkins),
    mind: scoreMind(inputs.checkins, inputs.days, inputs.reflections),
    inner: scoreInner({
      lessonsCompleted: inputs.lessonsCompleted,
      lessonsTotal: inputs.lessonsTotal,
      avgQuizScore: inputs.avgQuizScore,
      reflections: inputs.reflections,
      habitStreaks: inputs.habitStreaks,
      tribeCount: inputs.tribeCount,
      friendCount: inputs.friendCount,
      iAmSet: inputs.iAmSet,
    }),
  };

  const overall = composite(
    (Object.keys(pillars) as Array<keyof PillarScores>).map((k) => ({
      score: pillars[k],
      weight: PILLAR_WEIGHTS[k],
    })),
  );

  return {
    overall,
    pillars,
    patterns: detectPatterns(inputs.checkins, inputs.reflections, inputs.nights),
  };
}
