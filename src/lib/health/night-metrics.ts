// Reads last night's recovery signals from HealthKit (via @perfood plugin) and
// upserts them to health_night_metrics, so the coach can reason about WHY sleep /
// performance changed. iOS-native only; fully fail-open (never throws to callers).
//
// Signals: sleep stages (deep/rem/core/awake), resting HR, overnight avg/min HR,
// respiratory rate, SpO2. HRV (SDNN) is not exposed by this plugin — left null.
import { Capacitor } from "@capacitor/core";
import { CapacitorHealthkit, SampleNames } from "@perfood/capacitor-healthkit";
import { supabase } from "@/integrations/supabase/client";

const READ_TYPES = [
  SampleNames.SLEEP_ANALYSIS,
  SampleNames.HEART_RATE,
  SampleNames.RESTING_HEART_RATE,
  SampleNames.RESPIRATORY_RATE,
  SampleNames.OXYGEN_SATURATION,
];

const isIos = () => Capacitor.getPlatform() === "ios";
const min = (arr: number[]) => (arr.length ? Math.min(...arr) : null);
const mean = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
const round1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
const localDate = (d = new Date()) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD

interface Sample { startDate: string; endDate: string; value?: number; sleepState?: string }
const durMin = (s: Sample) => Math.max(0, (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000);

/** Request read authorization for the night/recovery types. Safe to call repeatedly. */
export async function requestNightAuth(): Promise<boolean> {
  if (!isIos()) return false;
  try {
    await CapacitorHealthkit.requestAuthorization({ read: READ_TYPES, write: [], all: [] });
    return true;
  } catch {
    return false;
  }
}

const query = async (sampleName: string, startISO: string, endISO: string, limit = 1000): Promise<Sample[]> => {
  try {
    const out: { resultData?: Sample[] } = await CapacitorHealthkit.queryHKitSampleType({
      sampleName, startDate: startISO, endDate: endISO, limit,
    });
    return out?.resultData ?? [];
  } catch {
    return [];
  }
};

/**
 * Read last night + upsert. Returns true if anything was written. Fail-open.
 */
export async function syncNightMetrics(): Promise<boolean> {
  if (!isIos()) return false;
  try {
    await requestNightAuth();
    const now = new Date();
    // Window: yesterday afternoon → now, wide enough to capture the whole night.
    const start = new Date(now.getTime() - 20 * 3600_000).toISOString();
    const end = now.toISOString();

    const [sleep, hr, restingHr, resp, spo2] = await Promise.all([
      query(SampleNames.SLEEP_ANALYSIS, start, end, 2000),
      query(SampleNames.HEART_RATE, start, end, 3000),
      query(SampleNames.RESTING_HEART_RATE, start, end, 50),
      query(SampleNames.RESPIRATORY_RATE, start, end, 500),
      query(SampleNames.OXYGEN_SATURATION, start, end, 500),
    ]);

    // Sleep stages — match HealthKit state strings loosely (deep/rem/core/awake).
    let deep = 0, rem = 0, core = 0, awake = 0;
    const asleep: Sample[] = [];
    for (const s of sleep) {
      const state = (s.sleepState ?? "").toLowerCase();
      if (state.includes("inbed")) continue; // "in bed" is not an asleep stage
      const d = durMin(s);
      if (state.includes("awake")) { awake += d; continue; }
      if (state.includes("deep")) deep += d;
      else if (state.includes("rem")) rem += d;
      else core += d; // "core" / "asleep" / "unspecified"
      asleep.push(s);
    }
    const totalAsleep = Math.round(deep + rem + core);
    const sleepStart = asleep.length ? asleep.reduce((a, b) => (a.startDate < b.startDate ? a : b)).startDate : null;
    const sleepEnd = asleep.length ? asleep.reduce((a, b) => (a.endDate > b.endDate ? a : b)).endDate : null;

    // Restrict HR/resp/spo2 to the sleep span when we have one.
    const inSleep = (s: Sample) =>
      !sleepStart || !sleepEnd || (s.startDate >= sleepStart && s.endDate <= sleepEnd);
    const hrVals = hr.filter(inSleep).map((s) => s.value ?? 0).filter((v) => v > 0);
    const respVals = resp.filter(inSleep).map((s) => s.value ?? 0).filter((v) => v > 0);
    const spo2Vals = spo2.filter(inSleep).map((s) => s.value ?? 0).filter((v) => v > 0);
    const restVal = restingHr.length ? restingHr[restingHr.length - 1].value ?? null : null;

    const payload = {
      p_night_date: localDate(now),
      p_resting_hr: round1(restVal),
      p_avg_hr: round1(mean(hrVals)),
      p_min_hr: round1(min(hrVals)),
      p_hrv_sdnn: null,
      p_respiratory_rate: round1(mean(respVals)),
      // HealthKit SpO2 is a fraction (0..1) → percent.
      p_spo2: round1(spo2Vals.length ? (mean(spo2Vals) as number) * (mean(spo2Vals)! <= 1 ? 100 : 1) : null),
      p_sleep_total_min: totalAsleep || null,
      p_sleep_deep_min: Math.round(deep) || null,
      p_sleep_rem_min: Math.round(rem) || null,
      p_sleep_core_min: Math.round(core) || null,
      p_awake_min: Math.round(awake) || null,
      p_sleep_start: sleepStart,
      p_sleep_end: sleepEnd,
    };

    // Nothing meaningful captured → skip the write.
    const hasData = payload.p_resting_hr != null || payload.p_sleep_total_min != null ||
      payload.p_avg_hr != null || payload.p_respiratory_rate != null;
    if (!hasData) return false;

    const { error } = await (supabase.rpc as any)("upsert_night_metrics", payload);
    if (error) { console.warn("upsert_night_metrics failed", error); return false; }
    return true;
  } catch (e) {
    console.warn("syncNightMetrics failed", e);
    return false;
  }
}
