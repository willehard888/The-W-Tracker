import { useEffect } from "react";
import { useHealthKit } from "@/hooks/use-healthkit";
import { syncNightMetrics } from "@/lib/health/night-metrics";

// HealthKit syncs used to fire only when SPECIFIC screens mounted (day
// snapshot on the check-in screen, night metrics on Profile) — so the DB had
// holes on days the user never opened those screens, and the Whealth Index
// starved. This hook runs both syncs once per app session from Home.
let syncedThisSession = false;

/** Silent, once-per-session HealthKit sync (day snapshot + night metrics).
 *  Fail-open: every path swallows errors; web/Android no-ops. */
export const useBackgroundHealthSync = () => {
  const { available, syncToday } = useHealthKit();

  useEffect(() => {
    if (syncedThisSession || available !== true) return;
    syncedThisSession = true;
    // Delay past first paint so the sync never competes with Home rendering.
    const t = setTimeout(() => {
      syncNightMetrics().catch(() => {});
      syncToday().catch(() => {});
    }, 3000);
    return () => clearTimeout(t);
  }, [available, syncToday]);
};
