import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  isHealthKitAvailable,
  requestHealthKitPermissions,
  type DaySnapshot,
} from "@/lib/health/healthkit";
import { onDaySnapshot, syncDaySnapshot } from "@/lib/health/background-sync";
import { markHealthConnected } from "@/lib/health/health-consent";

/**
 * useHealthKit — the React entry point for HealthKit.
 *
 *  1. On mount, probe `isHealthKitAvailable()` to know whether to surface the
 *     connect CTA at all.
 *  2. `connect()` is the ONE permission ask; it always follows an on-screen
 *     explanation (HealthKitConnectCard) and records consent so the
 *     background sync is allowed to touch Health afterwards.
 *  3. `syncToday()` reads + persists today's snapshot on demand (check-in
 *     open, check-in submit, the card's Sync button). The scheduled syncs live
 *     in lib/health/background-sync.ts.
 *
 * Web / Android / no HealthKit → `available = false` and every call no-ops.
 */
export const useHealthKit = () => {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<DaySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A sync that ran elsewhere (the resume listener, another screen) lands here too.
  useEffect(() => onDaySnapshot(setLastSnapshot), []);

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

  /** Read HealthKit + upsert today's row. Safe to call repeatedly. */
  const syncToday = useCallback(async (): Promise<DaySnapshot | null> => {
    if (!available) return null;
    setSyncing(true);
    setError(null);
    try {
      const snap = await syncDaySnapshot();
      if (snap) setLastSnapshot(snap);
      return snap;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
      return null;
    } finally {
      setSyncing(false);
    }
  }, [available]);

  /** Request permission then run a first sync. Returns true if granted. */
  const connect = useCallback(async (): Promise<boolean> => {
    setError(null);
    const perm = await requestHealthKitPermissions();
    if (!perm.granted) {
      setError(perm.error ?? "denied");
      return false;
    }
    // Recording consent here is what unlocks the background sync — see
    // lib/health/health-consent.ts.
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
      _snapshot_date: snapshotDate ?? undefined,
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
