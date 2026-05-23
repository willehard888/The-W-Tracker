/**
 * Apple HealthKit wrapper — gracefully degrades.
 *
 * Uses @perfood/capacitor-healthkit when available on iOS native. On
 * web / Android / missing plugin, every function returns a safe "not
 * available" response so the rest of the app keeps working.
 *
 * Install (run in shell, not by Claude):
 *   npm install @perfood/capacitor-healthkit
 *   npx cap sync ios
 *
 * iOS native setup (one-time, must be done in Xcode + Codemagic):
 *   - Add HealthKit capability to the App target
 *   - Info.plist: NSHealthShareUsageDescription = "Whealth Factory uses
 *     HealthKit to verify workouts, sleep, and steps so your stats are
 *     trustworthy."
 *   - Codemagic build config: ensure the entitlements file is signed
 *     with a provisioning profile that includes HealthKit
 *
 * Until the install + entitlements ship, isHealthKitAvailable() returns
 * false and the Verified Performer UI shows a "connect HealthKit" CTA.
 */

import { Capacitor } from "@capacitor/core";

export interface DaySnapshot {
  /** YYYY-MM-DD in the user's local timezone. */
  date: string;
  steps: number | null;
  workout_minutes: number | null;
  workout_count: number | null;
  sleep_hours: number | null;
  active_kcal: number | null;
}

/**
 * Lookup the plugin via Capacitor's runtime plugin registry — avoids the
 * Rollup static-import resolution problem when the package isn't yet
 * `npm install`-ed. Once `@perfood/capacitor-healthkit` is installed and
 * `npx cap sync ios` is run, the plugin registers itself as
 * `Capacitor.Plugins.CapacitorHealthkit` and the wrapper picks it up
 * automatically.
 *
 * Returns null on web / Android / pre-install, so all consumer code
 * sees `available = false`.
 */
async function getPlugin(): Promise<any | null> {
  if (Capacitor.getPlatform() !== "ios") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugins = (Capacitor as any).Plugins ?? {};
    return plugins.CapacitorHealthkit ?? plugins.Health ?? null;
  } catch {
    return null;
  }
}

/** True on iOS where the plugin is installed and HealthKit available. */
export async function isHealthKitAvailable(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    const result = await plugin.isAvailable();
    return !!(result?.isAvailable ?? result === true);
  } catch {
    return false;
  }
}

/**
 * Request read permission for the data types we use.
 * Idempotent — user can re-prompt and iOS will silently allow if already
 * granted, prompt fresh otherwise.
 */
export async function requestHealthKitPermissions(): Promise<{ granted: boolean; error?: string }> {
  const plugin = await getPlugin();
  if (!plugin) return { granted: false, error: "plugin_unavailable" };
  try {
    await plugin.requestAuthorization({
      all: [],
      read: [
        "steps",
        "stairs",
        "activity", // HKWorkout
        "sleep",
        "calories",
      ],
      write: [],
    });
    return { granted: true };
  } catch (e: any) {
    return { granted: false, error: e?.message ?? "denied" };
  }
}

/**
 * Read today's snapshot from HealthKit. Returns null if plugin unavailable
 * OR the data cannot be read (no permission for any type).
 *
 * Date arithmetic is local-time aware via Date — HealthKit returns samples
 * in the user's wall-clock timezone, which matches our daily_checkins
 * date convention.
 */
export async function readTodaySnapshot(): Promise<DaySnapshot | null> {
  const plugin = await getPlugin();
  if (!plugin) return null;

  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const safeCall = async <T>(fn: () => Promise<T>): Promise<T | null> => {
    try { return await fn(); } catch { return null; }
  };

  // Steps — sum of all step samples for today.
  const stepsRes = await safeCall(() =>
    plugin.queryHKitSampleType({
      sampleName: "stepCount",
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      limit: 0,
    }),
  );
  const steps = stepsRes?.resultData
    ? Math.round((stepsRes.resultData as any[]).reduce((s, r) => s + (Number(r.value) || 0), 0))
    : null;

  // Workouts — count + total active minutes for today.
  const workoutsRes = await safeCall(() =>
    plugin.queryHKitSampleType({
      sampleName: "workoutType",
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      limit: 0,
    }),
  );
  const workouts = (workoutsRes?.resultData as any[]) ?? [];
  const workout_count = workouts.length;
  const workout_minutes = workouts.reduce((s, w) => {
    const ms = (new Date(w.endDate).getTime()) - (new Date(w.startDate).getTime());
    return s + (ms > 0 ? Math.round(ms / 60000) : 0);
  }, 0);

  // Sleep — HKCategoryTypeIdentifierSleepAnalysis aggregated for last night.
  // We use the "asleep" categories (Core / Deep / REM, value codes 3-5)
  // and exclude in-bed (value 0).
  const sleepStart = new Date(today);
  sleepStart.setDate(sleepStart.getDate() - 1);
  sleepStart.setHours(18, 0, 0, 0); // 18:00 yesterday → 18:00 today
  const sleepRes = await safeCall(() =>
    plugin.queryHKitSampleType({
      sampleName: "sleepAnalysis",
      startDate: sleepStart.toISOString(),
      endDate: end.toISOString(),
      limit: 0,
    }),
  );
  const asleepCategories = new Set([2, 3, 4, 5]); // Asleep / Core / Deep / REM
  let sleepMs = 0;
  for (const s of ((sleepRes?.resultData as any[]) ?? [])) {
    if (asleepCategories.has(Number(s.sleepState ?? s.value))) {
      sleepMs += new Date(s.endDate).getTime() - new Date(s.startDate).getTime();
    }
  }
  const sleep_hours = sleepMs > 0 ? Number((sleepMs / 3_600_000).toFixed(2)) : null;

  // Active calories
  const kcalRes = await safeCall(() =>
    plugin.queryHKitSampleType({
      sampleName: "activeEnergyBurned",
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      limit: 0,
    }),
  );
  const active_kcal = kcalRes?.resultData
    ? Math.round((kcalRes.resultData as any[]).reduce((s, r) => s + (Number(r.value) || 0), 0))
    : null;

  return {
    date: dateStr,
    steps,
    workout_minutes: workout_minutes || null,
    workout_count: workout_count || null,
    sleep_hours,
    active_kcal,
  };
}
