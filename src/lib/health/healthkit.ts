/**
 * Apple HealthKit — the day snapshot. Gracefully degrades: on web, Android,
 * or when HealthKit is unavailable every function resolves to "not available"
 * and the rest of the app keeps working.
 *
 * Reads through `HealthNight`, the app's one HealthKit plugin (compiled into
 * the App target, registered in code — see ios/App/App/HealthNight.swift).
 * The previous implementation looked up `Capacitor.Plugins.Health`, which the
 * `capacitor-health` pod never populated (it registers as `HealthPlugin`, and
 * nothing imported it), so from 2026-05-25 to now this whole file returned
 * "unavailable" on every device: no auto-detect, no verified check-ins, no
 * connect card. One plugin, one permission sheet, one name checked here.
 *
 * What a day carries: steps, distance, flights, active energy, workouts (count,
 * minutes, the longest one's sport), mindful minutes, last night's sleep, the
 * newest body-mass / body-fat / VO2 max readings, and `sources` — the apps that
 * wrote any of it ("Garmin Connect", "Oura", "Polar Flow", "Strava", "Apple
 * Watch"). Every wearable that syncs to Apple Health arrives through here.
 */

import { Capacitor } from "@capacitor/core";
import {
  HealthNight,
  readLastNightSleepHours,
  type BodyResult,
  type DayResult,
} from "@/lib/health/night-metrics";
import { sportFromHealthKit } from "@/lib/sports";
import { localDateKey } from "@/lib/date";

export interface DaySnapshot {
  /** YYYY-MM-DD in the user's local timezone. */
  date: string;
  steps: number | null;
  /** Walking + running + cycling, metres. */
  distance_m: number | null;
  flights: number | null;
  workout_minutes: number | null;
  workout_count: number | null;
  /** Sport id (src/lib/sports.ts) of the day's LONGEST workout — pre-fills
   *  the check-in sport picker. */
  primary_sport: string | null;
  /** Every session of the day, oldest first — the sport as the app names it,
   *  its numbers, and the app that recorded it ("Polar Flow"). */
  workouts: DayWorkout[];
  /** Last night, from the same plugin's sleep query. */
  sleep_hours: number | null;
  active_kcal: number | null;
  mindful_minutes: number | null;
  /** Newest reading in the last 90 days; null when the user never logs it. */
  body_mass_kg: number | null;
  body_fat_pct: number | null;
  vo2max: number | null;
  /** Distinct source apps that wrote anything today. Empty when nothing did. */
  sources: string[];
}

export interface DayWorkout {
  /** Sport id (src/lib/sports.ts); "other" when HealthKit's type has no row. */
  sport: string;
  /** camelCase HKWorkoutActivityType, kept for the label of an "other". */
  hk_type: string;
  duration_min: number;
  kcal: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  source: string | null;
  /** ISO-8601; null on a build that predates it. */
  start: string | null;
}

/** The day's sessions as the app names them; warm-ups and transitions drop. */
const MAX_WORKOUTS = 20;
const assembleWorkouts = (day: DayResult | null): DayWorkout[] =>
  (day?.workouts ?? [])
    .filter((w) => Number.isFinite(Number(w.duration_s)) && Number(w.duration_s) > 0)
    .map((w) => ({ w, sport: sportFromHealthKit(w.type) }))
    .filter((x): x is { w: NonNullable<DayResult["workouts"]>[number]; sport: string } => x.sport != null)
    .map(({ w, sport }) => ({
      sport,
      hk_type: typeof w.type === "string" ? w.type : "other",
      duration_min: Math.max(1, Math.round(Number(w.duration_s) / 60)),
      kcal: whole(w.kcal) || null,
      distance_m: whole(w.distance_m) || null,
      avg_hr: whole(w.avg_hr) || null,
      source: typeof w.source === "string" && w.source ? w.source : null,
      start: typeof w.start === "string" && w.start ? w.start : null,
    }))
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
    .slice(0, MAX_WORKOUTS);

const isIos = () => Capacitor.getPlatform() === "ios";

/** Finite, non-negative, rounded — or null. Malformed HK reads never reach the server. */
const whole = (v: unknown): number | null => {
  const n = Number(v);
  return v != null && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};
const tenth = (v: unknown): number | null => {
  const n = Number(v);
  return v != null && Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
};

/**
 * Pure assembly of a snapshot from the plugin's raw results. Exported so the
 * clamps and the longest-workout rule can be tested without a device.
 */
export function assembleDaySnapshot(
  date: string,
  day: DayResult | null,
  body: BodyResult | null,
  sleepHours: number | null,
): DaySnapshot {
  const workouts = (day?.workouts ?? []).filter((w) => Number.isFinite(Number(w.duration_s)));
  const totalSeconds = workouts.reduce((s, w) => s + Math.max(0, Number(w.duration_s) || 0), 0);
  const longest = [...workouts].sort((a, b) => (Number(b.duration_s) || 0) - (Number(a.duration_s) || 0))[0];
  const walk = Number(day?.distance_walk_m) || 0;
  const cycle = Number(day?.distance_cycle_m) || 0;
  const distance = walk + cycle;

  return {
    date,
    steps: whole(day?.steps),
    distance_m: distance > 0 ? whole(distance) : null,
    flights: whole(day?.flights),
    workout_count: workouts.length || null,
    workout_minutes: totalSeconds > 0 ? Math.round(totalSeconds / 60) : null,
    primary_sport: sportFromHealthKit(longest?.type ?? day?.primary_type),
    workouts: assembleWorkouts(day),
    sleep_hours: sleepHours,
    active_kcal: whole(day?.active_kcal),
    mindful_minutes: whole(day?.mindful_minutes),
    body_mass_kg: tenth(body?.body_mass_kg),
    body_fat_pct: tenth(body?.body_fat_pct),
    vo2max: tenth(body?.vo2max),
    sources: Array.from(new Set((day?.sources ?? []).filter((s): s is string => typeof s === "string" && s.length > 0))).sort(),
  };
}

/** True on iOS where HealthKit exists on this device. */
export async function isHealthKitAvailable(): Promise<boolean> {
  if (!isIos()) return false;
  try {
    const r = await HealthNight.isAvailable();
    return !!r?.available;
  } catch {
    return false;
  }
}

/**
 * The one permission ask — night, day and body types on a single sheet.
 * Idempotent: iOS does not re-prompt once answered. `granted` is what the
 * sheet reported; for READ types iOS never reveals a denial, so an empty
 * read afterwards is the only signal there is (the connect card says so).
 */
export async function requestHealthKitPermissions(): Promise<{ granted: boolean; error?: string }> {
  if (!isIos()) return { granted: false, error: "plugin_unavailable" };
  try {
    const r = await HealthNight.requestAuthorization();
    return r?.granted ? { granted: true } : { granted: false, error: "denied" };
  } catch (e) {
    return { granted: false, error: e instanceof Error ? e.message : "denied" };
  }
}

/**
 * Today's snapshot. Null on non-iOS or when HealthKit is unavailable. The
 * three plugin calls are independent — a failed body read does not blank the
 * day — and last night's sleep rides along from the same plugin.
 */
export async function readTodaySnapshot(): Promise<DaySnapshot | null> {
  if (!isIos()) return null;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const safe = async <T>(fn: () => Promise<T>): Promise<T | null> => {
    try { return await fn(); } catch { return null; }
  };

  const [day, body, sleepHours] = await Promise.all([
    safe(() => HealthNight.queryDay({ start: start.toISOString(), end: end.toISOString() })),
    safe(() => HealthNight.queryBody()),
    readLastNightSleepHours(),
  ]);
  if (!day || day.available === false) return null;

  return assembleDaySnapshot(localDateKey(now), day, body, sleepHours);
}
