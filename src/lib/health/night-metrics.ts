// Reads last night's recovery signals from HealthKit via our custom native
// plugin (ios/local-plugins/HealthNight) and upserts them to health_night_metrics,
// so the coach can reason about WHY sleep / performance changed. iOS-native only;
// fully fail-open (never throws to callers).
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

interface HealthNightPlugin {
  /** Read-only (night metrics) — share-free, called on every sync. */
  requestAuthorization(): Promise<{ granted: boolean }>;
  queryNight(): Promise<NightResult>;
  /** Share auth for the six dietary types; rejects when HealthKit is unavailable. */
  requestMealWriteAuthorization(): Promise<{ granted: boolean }>;
  writeMeal(args: MealWriteArgs): Promise<{ written: boolean; samples?: number }>;
  deleteMeal(args: { meal_id: string }): Promise<{ deleted: number }>;
}

// No web impl → calls reject on web, which we catch (fail-open).
export const HealthNight = registerPlugin<HealthNightPlugin>("HealthNight");

const isIos = () => Capacitor.getPlatform() === "ios";
// undefined (not null) for missing values: the RPC arg is omitted and the
// SQL default (NULL) applies — same stored row, strict-clean payload type.
const round1 = (v: number | null | undefined) => (v == null ? undefined : Math.round(v * 10) / 10);
const localDate = (d = new Date()) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD

/** Request HealthKit read authorization for the night/recovery types. */
export async function requestNightAuth(): Promise<boolean> {
  if (!isIos()) return false;
  try {
    const r = await HealthNight.requestAuthorization();
    return !!r?.granted;
  } catch {
    return false;
  }
}

/**
 * Last night's total sleep in hours, for the daily HealthKit snapshot.
 * capacitor-health can't read sleep, so `health_sync_snapshots.sleep_hours`
 * was always null — this bridges the HealthNight plugin's sleep total in so
 * check-in verification and the coach see real (not just self-reported) sleep.
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
      p_sleep_total_min: r.sleep_total_min ?? undefined,
      p_sleep_deep_min: r.sleep_deep_min ?? undefined,
      p_sleep_rem_min: r.sleep_rem_min ?? undefined,
      p_sleep_core_min: r.sleep_core_min ?? undefined,
      p_awake_min: r.awake_min ?? undefined,
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
