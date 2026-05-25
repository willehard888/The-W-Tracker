/**
 * Apple HealthKit wrapper — gracefully degrades.
 *
 * Uses `capacitor-health` (Capacitor 8 native plugin) on iOS. On web,
 * Android, or when the plugin isn't registered, every function returns
 * a safe "not available" response so the rest of the app keeps working.
 *
 * Capabilities (per the plugin's API):
 *   ✓ Steps              — aggregated per day
 *   ✓ Workouts           — list with type, duration, calories
 *   ✓ Active calories    — aggregated per day
 *   ✗ Sleep              — NOT supported by this plugin (left null;
 *                          sleep_hours stays self-reported in check-in)
 *
 * Native setup (already done in Xcode):
 *   - HealthKit capability added to App target
 *   - Info.plist: NSHealthShareUsageDescription set
 *   - Apple Developer portal: HealthKit enabled on app.lovable.wtracker
 */

import { Capacitor } from "@capacitor/core";

export interface DaySnapshot {
  /** YYYY-MM-DD in the user's local timezone. */
  date: string;
  steps: number | null;
  workout_minutes: number | null;
  workout_count: number | null;
  /** capacitor-health doesn't expose sleep — kept null until plugin upgrade. */
  sleep_hours: number | null;
  active_kcal: number | null;
}

/**
 * Lookup the plugin via Capacitor's runtime registry. Returns null on
 * any platform where capacitor-health isn't registered.
 */
function getPlugin(): any | null {
  if (Capacitor.getPlatform() !== "ios") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugins = (Capacitor as any).Plugins ?? {};
    return plugins.Health ?? null;
  } catch {
    return null;
  }
}

/** True on iOS where the plugin is registered and HealthKit available. */
export async function isHealthKitAvailable(): Promise<boolean> {
  const plugin = getPlugin();
  if (!plugin) return false;
  try {
    const result = await plugin.isHealthAvailable();
    return !!result?.available;
  } catch {
    return false;
  }
}

/**
 * Request read permission for steps + workouts + active calories.
 * Idempotent — iOS won't re-prompt if already granted/denied.
 */
export async function requestHealthKitPermissions(): Promise<{ granted: boolean; error?: string }> {
  const plugin = getPlugin();
  if (!plugin) return { granted: false, error: "plugin_unavailable" };
  try {
    await plugin.requestHealthPermissions({
      permissions: [
        "READ_STEPS",
        "READ_WORKOUTS",
        "READ_ACTIVE_CALORIES",
      ],
    });
    return { granted: true };
  } catch (e: any) {
    return { granted: false, error: e?.message ?? "denied" };
  }
}

/**
 * Read today's snapshot from HealthKit. Returns null on non-iOS or if
 * the plugin is unavailable. Each metric is read independently — a
 * missing permission for one type doesn't blank out the whole snapshot.
 */
export async function readTodaySnapshot(): Promise<DaySnapshot | null> {
  const plugin = getPlugin();
  if (!plugin) return null;

  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const safeCall = async <T>(fn: () => Promise<T>): Promise<T | null> => {
    try { return await fn(); } catch { return null; }
  };

  // Steps — aggregated daily bucket = single value for today.
  const stepsRes = await safeCall(() =>
    plugin.queryAggregated({
      startDate: startISO,
      endDate: endISO,
      dataType: "steps",
      bucket: "day",
    }),
  );
  const stepsSample = (stepsRes as any)?.aggregatedData?.[0];
  const steps = stepsSample?.value != null ? Math.round(Number(stepsSample.value)) : null;

  // Active calories — same shape.
  const kcalRes = await safeCall(() =>
    plugin.queryAggregated({
      startDate: startISO,
      endDate: endISO,
      dataType: "active-calories",
      bucket: "day",
    }),
  );
  const kcalSample = (kcalRes as any)?.aggregatedData?.[0];
  const active_kcal = kcalSample?.value != null ? Math.round(Number(kcalSample.value)) : null;

  // Workouts — list, then aggregate to count + total minutes.
  const wkRes = await safeCall(() =>
    plugin.queryWorkouts({
      startDate: startISO,
      endDate: endISO,
      includeHeartRate: false,
      includeRoute: false,
      includeSteps: false,
    }),
  );
  const workouts = ((wkRes as any)?.workouts ?? []) as Array<{ duration?: number }>;
  const workout_count = workouts.length || null;
  // `duration` from this plugin is seconds.
  const totalSeconds = workouts.reduce((s, w) => s + (Number(w.duration) || 0), 0);
  const workout_minutes = totalSeconds > 0 ? Math.round(totalSeconds / 60) : null;

  return {
    date: dateStr,
    steps,
    workout_minutes,
    workout_count,
    sleep_hours: null, // capacitor-health doesn't support sleep yet
    active_kcal,
  };
}
