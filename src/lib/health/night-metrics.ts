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
  sleep_total_min?: number;
  sleep_deep_min?: number;
  sleep_rem_min?: number;
  sleep_core_min?: number;
  awake_min?: number;
  sleep_start?: string;
  sleep_end?: string;
}

interface HealthNightPlugin {
  requestAuthorization(): Promise<{ granted: boolean }>;
  queryNight(): Promise<NightResult>;
}

// No web impl → calls reject on web, which we catch (fail-open).
const HealthNight = registerPlugin<HealthNightPlugin>("HealthNight");

const isIos = () => Capacitor.getPlatform() === "ios";
const round1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10);
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
      p_hrv_sdnn: null,
      p_respiratory_rate: round1(r.respiratory_rate),
      p_spo2: round1(r.spo2),
      p_sleep_total_min: r.sleep_total_min ?? null,
      p_sleep_deep_min: r.sleep_deep_min ?? null,
      p_sleep_rem_min: r.sleep_rem_min ?? null,
      p_sleep_core_min: r.sleep_core_min ?? null,
      p_awake_min: r.awake_min ?? null,
      p_sleep_start: r.sleep_start ?? null,
      p_sleep_end: r.sleep_end ?? null,
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
