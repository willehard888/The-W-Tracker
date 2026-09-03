import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { syncNightMetrics } from "@/lib/health/night-metrics";
import { useAuth } from "@/contexts/AuthContext";

export interface NightMetrics {
  night_date: string;
  resting_hr: number | null;
  avg_hr: number | null;
  min_hr: number | null;
  hrv_sdnn: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  sleep_total_min: number | null;
  sleep_deep_min: number | null;
  sleep_rem_min: number | null;
  sleep_core_min: number | null;
  awake_min: number | null;
  sleep_start: string | null;
  sleep_end: string | null;
  factors: string[] | null;
}

/** The set of factors a user can attribute to a night. */
export const NIGHT_FACTORS = ["alcohol", "late meal", "stress", "travel", "sick", "caffeine", "late screen"] as const;

/** Recent nightly recovery metrics (newest first) — powers the Recovery card. */
export const useRecentNights = (days = 30) => {
  const { user } = useAuth();
  return useQuery<NightMetrics[]>({
    // Scope the cache to the user — otherwise account B sees account A's cached
    // recovery metrics on a shared device until a refetch.
    queryKey: ["night-metrics", user?.id, days],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("recent_night_metrics", { p_days: days });
      if (error) throw error;
      return data ?? [];
    },
  });
};

/** Tag what happened last night (alcohol, late meal, …) — ground truth the coach reads. */
export const useSetNightFactors = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { nightDate: string; factors: string[] }) => {
      const { error } = await supabase.rpc("set_night_factors", { p_night_date: p.nightDate, p_factors: p.factors });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["night-metrics"] }),
  });
};

/**
 * Trigger a HealthKit night-metrics sync once on mount (iOS only; no-op
 * elsewhere), then refresh the query so the Recovery card + coach see last night.
 */
export const useNightSync = () => {
  const qc = useQueryClient();
  useEffect(() => {
    let alive = true;
    syncNightMetrics().then((wrote) => {
      if (wrote && alive) qc.invalidateQueries({ queryKey: ["night-metrics"] });
    });
    return () => { alive = false; };
  }, [qc]);
};
