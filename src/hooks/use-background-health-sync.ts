import { useEffect } from "react";
import { syncHealthIfStale } from "@/lib/health/background-sync";

/**
 * Silent HealthKit sync from Home. The consent gate, the hour throttle and
 * the two syncs themselves live in lib/health/background-sync.ts, which the
 * app's resume listener (src/main.tsx) also calls — so the morning's watch
 * sync reaches the app without a cold start.
 */
export const useBackgroundHealthSync = () => {
  useEffect(() => {
    // Past first paint, so the read never competes with Home rendering.
    const t = setTimeout(() => { void syncHealthIfStale(); }, 3000);
    return () => clearTimeout(t);
  }, []);
};
