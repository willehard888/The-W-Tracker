import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  isHealthKitAvailable,
  requestHealthKitPermissions,
  readTodaySnapshot,
  type DaySnapshot,
} from "@/lib/health/healthkit";
import { readLastNightSleepHours } from "@/lib/health/night-metrics";
import { markHealthConnected } from "@/lib/health/health-consent";

/**
 * useHealthKit — single React entry point for HealthKit syncing.
 *
 * Lifecycle:
 *  1. On mount, probe `isHealthKitAvailable()` to know if we should even
 *     surface a "connect" CTA.
 *  2. When the user opts in (via `connect()`), request permissions, sync
 *     today, and persist a snapshot via the `upsert_health_snapshot` RPC.
 *  3. `syncToday()` can be called any time (after a check-in submit, on
 *     manual refresh, on app foreground) to refresh.
 *
 * Web / Android / missing plugin → `available = false` and all calls
 * resolve to no-ops, so consumer UI gracefully renders the "not
 * available on this platform" state.
 */
export const useHealthKit = () => {
  const { user } = useAuth();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<DaySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // Probe availability, but never let a hung/failing native bridge call
    // leave `available` stuck at null — fall back to "unavailable" so the UI
    // resolves instead of hiding the card forever.
    Promise.race([
      isHealthKitAvailable(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
    ])
      .then((v) => { if (alive) setAvailable(v); })
      .catch(() => { if (alive) setAvailable(false); });
    return () => { alive = false; };
  }, []);

  const persistSnapshot = useCallback(async (snap: DaySnapshot) => {
    if (!user?.id) return;
    const { error: rpcErr } = await supabase.rpc("upsert_health_snapshot", {
      _date: snap.date,
      _steps: snap.steps,
      _workout_minutes: snap.workout_minutes,
      _workout_count: snap.workout_count,
      _sleep_hours: snap.sleep_hours,
      _active_kcal: snap.active_kcal,
      _source: "healthkit",
      _mindful_minutes: snap.mindful_minutes,
    });
    if (rpcErr) throw new Error(rpcErr.message);
  }, [user?.id]);

  /** Read HealthKit + upsert today's row. Safe to call repeatedly. */
  const syncToday = useCallback(async (): Promise<DaySnapshot | null> => {
    if (!available) return null;
    setSyncing(true);
    setError(null);
    try {
      const snap = await readTodaySnapshot();
      if (snap) {
        // capacitor-health can't read sleep, so fold in last night's sleep from
        // the HealthNight plugin — otherwise sleep_hours is always null and the
        // check-in's sleep can never be HealthKit-verified.
        if (snap.sleep_hours == null) {
          const sleepH = await readLastNightSleepHours();
          if (sleepH != null) snap.sleep_hours = sleepH;
        }
        await persistSnapshot(snap);
        setLastSnapshot(snap);
      }
      return snap;
    } catch (e: any) {
      setError(e?.message ?? "Sync failed");
      return null;
    } finally {
      setSyncing(false);
    }
  }, [available, persistSnapshot]);

  /** Request permission then run a first sync. Returns true if granted. */
  const connect = useCallback(async (): Promise<boolean> => {
    setError(null);
    const perm = await requestHealthKitPermissions();
    if (!perm.granted) {
      setError(perm.error ?? "denied");
      return false;
    }
    // This is the ONLY place permission is asked for, and it always follows an
    // on-screen explanation. Recording it here is what unlocks the background
    // sync — see lib/health/health-consent.ts.
    markHealthConnected();
    await syncToday();
    return true;
  }, [syncToday]);

  /**
   * Server-side verification of a check-in against the HealthKit snapshot.
   * Pass the LOCAL snapshot date (snap.date) so verify matches the row that
   * upsert_health_snapshot stored under the user's local calendar day — avoids
   * the tz off-by-one that silently broke verification for most timezones.
   */
  const verifyCheckin = useCallback(async (checkinId: string, snapshotDate?: string | null) => {
    const { data, error: rpcErr } = await supabase.rpc("verify_checkin", {
      _checkin_id: checkinId,
      _snapshot_date: snapshotDate ?? null,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    return data as {
      ok: boolean;
      verified?: boolean;
      reason?: string;
      matches?: number;
      claims?: number;
      signals?: Record<string, any>;
    };
  }, []);

  return {
    /** null while probing, true if plugin + iOS, false otherwise. */
    available,
    syncing,
    lastSnapshot,
    error,
    connect,
    syncToday,
    verifyCheckin,
  };
};
