/**
 * The two HealthKit syncs (last night → health_night_metrics, today →
 * health_sync_snapshots) behind one consent gate and one throttle, callable
 * from a mount and from the app's resume listener alike.
 *
 * Why a lib and not the hook: the sync used to live only in a Home-mounted
 * hook with a once-per-JS-session flag, so a user who opened the app at 07:00
 * and again at 19:00 without killing it never got the day's second read — and
 * the morning's Garmin sync, which lands in Apple Health minutes after the
 * watch connects, never reached the app until a cold start.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { hasHealthConsent, markHealthConnected } from "@/lib/health/health-consent";
import { isHealthKitAvailable, readTodaySnapshot, type DaySnapshot } from "@/lib/health/healthkit";
import { syncNightMetrics } from "@/lib/health/night-metrics";
import { captureException } from "@/lib/observability";

/** Read today + upsert. The one place the snapshot RPC is called. */
export async function syncDaySnapshot(): Promise<DaySnapshot | null> {
  const snap = await readTodaySnapshot();
  if (!snap) return null;
  // Self-heal for accounts that granted Health before the consent flag
  // existed: a successful read proves permission.
  markHealthConnected();
  const { error } = await supabase.rpc("upsert_health_snapshot", {
    _date: snap.date,
    // null → undefined: the arg is omitted and the SQL default (NULL) applies.
    _steps: snap.steps ?? undefined,
    _workout_minutes: snap.workout_minutes ?? undefined,
    _workout_count: snap.workout_count ?? undefined,
    _sleep_hours: snap.sleep_hours ?? undefined,
    _active_kcal: snap.active_kcal ?? undefined,
    _source: "healthkit",
    _mindful_minutes: snap.mindful_minutes ?? undefined,
    _distance_m: snap.distance_m ?? undefined,
    _flights: snap.flights ?? undefined,
    _body_mass_kg: snap.body_mass_kg ?? undefined,
    _body_fat_pct: snap.body_fat_pct ?? undefined,
    _vo2max: snap.vo2max ?? undefined,
    _sources: snap.sources.length ? snap.sources : undefined,
    // The sport used to stop here: count and minutes went up, "tennis" did not.
    _primary_sport: snap.primary_sport ?? undefined,
    _workouts: snap.workouts.length ? (snap.workouts as unknown as Json) : undefined,
  });
  if (error) throw new Error(error.message);
  return snap;
}

const STALE_MS = 60 * 60_000;
let lastSyncAt = 0;
let inFlight: Promise<void> | null = null;

/**
 * Both syncs, if the user has connected Health and the last run is over an
 * hour old. Silent and fail-open. Safe to call from anywhere, any number of
 * times — concurrent calls share one run.
 */
export function syncHealthIfStale(): Promise<void> {
  if (inFlight) return inFlight;
  if (!hasHealthConsent() || Date.now() - lastSyncAt < STALE_MS) return Promise.resolve();
  inFlight = (async () => {
    try {
      if (!(await isHealthKitAvailable())) return;
      lastSyncAt = Date.now();
      await Promise.all([
        syncNightMetrics().catch((e) => captureException(e, { where: "health.night" })),
        syncDaySnapshot().catch((e) => captureException(e, { where: "health.day" })),
      ]);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Test seam: forget the throttle. */
export const _resetHealthSyncThrottle = () => { lastSyncAt = 0; };
