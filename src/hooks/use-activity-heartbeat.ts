import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { captureException } from "@/lib/observability";
import { useAuth } from "@/contexts/AuthContext";
import { track, FUNNEL } from "@/lib/analytics";

// Once per app SESSION (module-level): the D1-return signal richer than
// check-ins — "did they come back at all", not just "did they log".
let appOpenedTracked = false;

/**
 * Stamp last_active_at + timezone whenever the app is foregrounded, so
 * server-side jobs can reach the user at the RIGHT local time:
 *   - timezone-correct streak reminders (evening in the user's own tz)
 *   - lapsed win-back pushes (nothing else reaches a churned user)
 *
 * The server owns the timestamp (trusted clock); we only send the device's
 * IANA timezone + offset. Fire-and-forget, throttled to once / 5 min so tab
 * flipping doesn't hammer the RPC.
 */
export function useActivityHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let lastBeat = 0;

    const beat = () => {
      const nowMs = Date.now();
      if (nowMs - lastBeat < 5 * 60 * 1000) return; // throttle
      lastBeat = nowMs;
      if (!appOpenedTracked) {
        appOpenedTracked = true;
        void track(FUNNEL.appOpened);
      }
      let tz: string | null = null;
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { /* keep null */ }
      const offset = -new Date().getTimezoneOffset(); // minutes east of UTC
      supabase
        .rpc("touch_activity", { p_timezone: tz ?? undefined, p_utc_offset_minutes: offset })
        .then(({ error }) => {
          // This RPC is the only sanctioned writer of profiles.timezone, and
          // the timezone is what schedules every push the app sends. A
          // persistently failing heartbeat is a quiet cross-feature failure,
          // so it leaves a trace rather than only a console line.
          if (error) {
            console.warn("touch_activity failed:", error.message);
            captureException(error, { where: "activity.touch" });
          }
        });
    };

    beat();
    const onVis = () => { if (document.visibilityState === "visible") beat(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // Key on user?.id, NOT the user object — supabase hands us a fresh user
    // object on every hourly TOKEN_REFRESHED, which would otherwise tear down +
    // re-run this effect every hour for no reason.
  }, [user?.id]);
}
