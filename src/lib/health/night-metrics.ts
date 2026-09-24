// The JS side of `ios/App/App/HealthNight.swift` — the app's one HealthKit
// plugin. This module owns the proxy and the NIGHT sync (upsert to
// health_night_metrics); `healthkit.ts` builds the DAY snapshot on the same
// proxy. iOS-native only; fully fail-open (never throws to callers).
import { vitalOrNull } from "./measurement";
import { registerPlugin, Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

interface NightResult {
  available?: boolean;
  resting_hr?: number;
  avg_hr?: number;
  min_hr?: number;
  respiratory_rate?: number;
  spo2?: number;
  hrv_sdnn?: number;
  sleep_total_min?: number;
  sleep_deep_min?: number;
  sleep_rem_min?: number;
  sleep_core_min?: number;
  awake_min?: number;
  sleep_start?: string;
  sleep_end?: string;
}

/** Args for `writeMeal` — one HKQuantitySample per present nutrient. */
export interface MealWriteArgs {
  meal_id: string;
  name?: string;
  /** ISO-8601; default now / start on the native side. */
  start?: string;
  end?: string;
  /** HKMetadataKeySyncVersion — bump on edit so HealthKit replaces, not duplicates. */
  version?: number;
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  water_ml?: number;
  caffeine_mg?: number;
}

/** Args for `writeWorkout` — one strength workout per finished session. */
export interface WorkoutWriteArgs {
  session_id: string;
  /** ISO-8601. Under 60 s between them is skipped, not written. */
  start: string;
  end: string;
}

/** Raw `queryDay` result — sums over the local day, plus who contributed. */
export interface DayResult {
  available?: boolean;
  steps?: number;
  active_kcal?: number;
  distance_walk_m?: number;
  distance_cycle_m?: number;
  flights?: number;
  workouts?: Array<{
    type?: string;
    duration_s?: number;
    kcal?: number;
    source?: string;
    /** ISO-8601, set by HealthNight ≥ the 2026-09-23 build. */
    start?: string;
    end?: string;
    distance_m?: number;
    /** Average heart rate over the session (workout statistics), bpm. */
    avg_hr?: number;
    /** Entered by hand in the Health app (HealthNight ≥ the 2026-09-25 build). */
    manual?: boolean;
  }>;
  /** camelCase HKWorkoutActivityType of the day's longest workout. */
  primary_type?: string;
  mindful_minutes?: number;
  /** Distinct source-app names that wrote anything today. */
  sources?: string[];
}

/** Raw `queryBody` result — newest reading of each over the last 90 days. */
export interface BodyResult {
  available?: boolean;
  body_mass_kg?: number;
  body_mass_kg_at?: string;
  body_fat_pct?: number;
  body_fat_pct_at?: string;
  vo2max?: number;
  vo2max_at?: string;
}

interface HealthNightPlugin {
  /** `HKHealthStore.isHealthDataAvailable()` — the platform probe. */
  isAvailable(): Promise<{ available: boolean }>;
  /** Read-only, the ONE sheet: night + day + body types together. */
  requestAuthorization(): Promise<{ granted: boolean }>;
  queryNight(): Promise<NightResult>;
  /** ISO start/end; defaults to the device's local day. */
  queryDay(args?: { start?: string; end?: string }): Promise<DayResult>;
  queryBody(): Promise<BodyResult>;
  /** Share auth for the six dietary types; rejects when HealthKit is unavailable. */
  requestMealWriteAuthorization(): Promise<{ granted: boolean }>;
  writeMeal(args: MealWriteArgs): Promise<{ written: boolean; samples?: number }>;
  deleteMeal(args: { meal_id: string }): Promise<{ deleted: number }>;
  /** Share auth for the workout type only; rejects when HealthKit is unavailable. */
  requestWorkoutWriteAuthorization(): Promise<{ granted: boolean }>;
  writeWorkout(args: WorkoutWriteArgs): Promise<{ written: boolean }>;
}

// No web impl → calls reject on web, which we catch (fail-open).
export const HealthNight = registerPlugin<HealthNightPlugin>("HealthNight");

const isIos = () => Capacitor.getPlatform() === "ios";
// undefined (not null) for missing values: the RPC arg is omitted and the
// SQL default (NULL) applies — same stored row, strict-clean payload type.
const round1 = (v: number | null | undefined) => (v == null ? undefined : Math.round(v * 10) / 10);
const localDate = (d = new Date()) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD

/**
 * Last night's total sleep in hours, folded into the day snapshot so
 * check-in verification and the coach see real (not self-reported) sleep.
 * Fail-open → null.
 */
export async function readLastNightSleepHours(): Promise<number | null> {
  if (!isIos()) return null;
  try {
    await HealthNight.requestAuthorization().catch(() => {});
    const r = await HealthNight.queryNight();
    if (!r || r.available === false || r.sleep_total_min == null) return null;
    const hours = r.sleep_total_min / 60;
    return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 10) / 10 : null;
  } catch {
    return null;
  }
}

/** Read last night + upsert. Returns true if anything was written. Fail-open. */
export async function syncNightMetrics(): Promise<boolean> {
  if (!isIos()) return false;
  try {
    await HealthNight.requestAuthorization().catch(() => {});
    const r = await HealthNight.queryNight();
    if (!r || r.available === false) return false;

    const payload = {
      p_night_date: localDate(),
      p_resting_hr: round1(r.resting_hr),
      p_avg_hr: round1(r.avg_hr),
      p_min_hr: round1(r.min_hr),
      p_hrv_sdnn: round1(r.hrv_sdnn), // overnight SDNN avg (ms) — plugin queries it as of Whealth OS
      p_respiratory_rate: round1(r.respiratory_rate),
      p_spo2: round1(r.spo2),
      // `?? undefined` was not enough on its own: an app build from before the
      // native fix reports an unrecorded night as 0, and 0 is not null, so it
      // sailed through here and was stored as a real measurement. Nobody sleeps
      // zero minutes — a zero in these columns is an absent sensor, and a phone
      // that has not been updated must not be able to create one.
      p_sleep_total_min: vitalOrNull(r.sleep_total_min) ?? undefined,
      p_sleep_deep_min: vitalOrNull(r.sleep_deep_min) ?? undefined,
      p_sleep_rem_min: vitalOrNull(r.sleep_rem_min) ?? undefined,
      p_sleep_core_min: vitalOrNull(r.sleep_core_min) ?? undefined,
      p_awake_min: vitalOrNull(r.awake_min) ?? undefined,
      p_sleep_start: r.sleep_start ?? undefined,
      p_sleep_end: r.sleep_end ?? undefined,
    };

    const hasData = payload.p_resting_hr != null || payload.p_sleep_total_min != null ||
      payload.p_avg_hr != null || payload.p_respiratory_rate != null;
    if (!hasData) return false;

    const { error } = await supabase.rpc("upsert_night_metrics", payload);
    if (error) { console.warn("upsert_night_metrics failed", error); return false; }
    return true;
  } catch (e) {
    console.warn("syncNightMetrics failed", e);
    return false;
  }
}
