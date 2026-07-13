import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
      let tz: string | null = null;
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { /* keep null */ }
      const offset = -new Date().getTimezoneOffset(); // minutes east of UTC
      supabase
        .rpc("touch_activity", { p_timezone: tz, p_utc_offset_minutes: offset })
        .then(({ error }) => {
          if (error) console.warn("touch_activity failed:", error.message);
        });
    };

    beat();
    const onVis = () => { if (document.visibilityState === "visible") beat(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [user]);
}
