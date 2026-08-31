import { useEffect } from "react";
import { useHealthKit } from "@/hooks/use-healthkit";
import { syncNightMetrics } from "@/lib/health/night-metrics";
import { hasHealthConsent } from "@/lib/health/health-consent";

// HealthKit syncs used to fire only when SPECIFIC screens mounted (day
// snapshot on the check-in screen, night metrics on Profile) — so the DB had
// holes on days the user never opened those screens, and the Whealth Index
// starved. This hook runs both syncs once per app session from Home.
let syncedThisSession = false;

/** Silent, once-per-session HealthKit sync (day snapshot + night metrics).
 *  Fail-open: every path swallows errors; web/Android no-ops.
 *
 *  Runs ONLY for users who already connected Apple Health through
 *  HealthKitConnectCard. `available` is a platform probe, not a permission
 *  check, so without the consent gate this hook called requestAuthorization()
 *  three seconds after Home mounted and iOS raised its Health sheet over a
 *  screen that never mentioned Health. */
export const useBackgroundHealthSync = () => {
  const { available, syncToday } = useHealthKit();

  useEffect(() => {
    if (syncedThisSession || available !== true) return;
    if (!hasHealthConsent()) return;
    syncedThisSession = true;
    // Delay past first paint so the sync never competes with Home rendering.
    const t = setTimeout(() => {
      syncNightMetrics().catch(() => {});
      syncToday().catch(() => {});
    }, 3000);
    return () => clearTimeout(t);
  }, [available, syncToday]);
};
