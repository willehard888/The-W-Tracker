import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { flushPendingCheckin, getPendingCheckin } from "@/lib/offline-checkin";

/**
 * Mount once at the app root. Replays a check-in that was queued offline as soon
 * as connectivity returns (online event), the app is foregrounded
 * (visibilitychange), or on first load. On success, refreshes streak/profile
 * data and tells the user it synced.
 */
export function useOfflineCheckinSync() {
  const qc = useQueryClient();

  useEffect(() => {
    let alive = true;
    let running = false;

    const flush = async () => {
      if (running || !getPendingCheckin()) return;
      running = true;
      try {
        const res = await flushPendingCheckin(supabase);
        if (!alive) return;
        if (res === "synced") {
          qc.invalidateQueries(); // refresh streak, profile, leaderboard, etc.
          toast.success("Your offline check-in synced ✓", {
            description: "We saved it while you were offline and just logged it.",
          });
        }
      } catch { /* keep the queue; we'll retry on the next trigger */ }
      finally { running = false; }
    };

    flush();
    const onVisible = () => { if (document.visibilityState === "visible") flush(); };
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [qc]);
}
