import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfLocalDayISO } from "@/lib/training/session";

/**
 * Did the athlete complete a prescribed program session today?
 *
 * WHY THIS EXISTS
 *
 * The training feature and the reward economy have never met. XP, the streak,
 * the tier ladder and every badge derive from `daily_checkins` — and the one
 * training input there is a self-reported toggle in the check-in's sport
 * picker. Meanwhile `coach_program_logs` records that the athlete actually did
 * the session the app itself prescribed, and nothing reads it.
 *
 * So an athlete could finish their programmed workout in the app, tap "Done",
 * and then still have to go to a different screen and separately declare that
 * they had trained — otherwise they earned nothing for it. That is the single
 * clearest reason training feels disconnected from the rest of the product.
 *
 * This is the bridge. The check-in PREFILLS from it rather than writing on the
 * athlete's behalf: the check-in is their own report of their day, and the app
 * filling it in silently would both be presumptuous and let a stale row inflate
 * a streak nobody earned. Prefilled, visible, and theirs to change — the same
 * contract the HealthKit prefill already honours.
 */
export const useSessionDoneToday = () => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["session-done-today", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_program_logs")
        .select("id, logged_at, perceived_rpe, duration_sec, status, completed")
        .eq("user_id", user!.id)
        .eq("completed", true)
        .gte("logged_at", startOfLocalDayISO())
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fail open. A check-in must never be blocked by this lookup — the
      // athlete can always pick their sport by hand.
      if (error) return null;
      return data ?? null;
    },
  });

  return {
    /** A prescribed session was completed today. */
    done: !!query.data,
    /** The log row, when there is one — carries RPE and measured duration. */
    log: query.data ?? null,
    isLoading: query.isLoading,
  };
};
