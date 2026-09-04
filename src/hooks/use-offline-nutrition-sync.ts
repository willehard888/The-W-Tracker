import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { flushPendingMeals, getPendingMeals } from "@/lib/nutrition/offline-meals";
import { logMeal } from "@/lib/nutrition/queries";

/**
 * Mount once at the app root. Replays meals queued offline as soon as
 * connectivity returns (online event), the app is foregrounded
 * (visibilitychange), or on first load; then refreshes the diary.
 */
export function useOfflineNutritionSync() {
  const qc = useQueryClient();

  useEffect(() => {
    let alive = true;
    let running = false;

    const flush = async () => {
      if (running || getPendingMeals().length === 0) return;
      running = true;
      try {
        const res = await flushPendingMeals({
          getUserId: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
          logMeal: async (args) => {
            await logMeal(supabase, args);
          },
        });
        if (!alive) return;
        if (res.synced > 0) {
          qc.invalidateQueries({ queryKey: ["nutrition-day"] });
          qc.invalidateQueries({ queryKey: ["nutrition-totals"] });
          toast.success("Your offline meals synced", {
            description: `${res.synced} meal${res.synced === 1 ? "" : "s"} saved while you were offline just landed in your diary.`,
          });
        }
        if (res.failed > 0) {
          toast.error("Some offline meals couldn't sync", {
            description: "They were rejected by the server and removed — log them again.",
            duration: 8000,
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
