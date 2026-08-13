import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { PillarScores, WhealthPattern } from "@/lib/whealth-index";

export interface WhealthSnapshot {
  snapshotDate: string;
  overall: number;
  pillars: PillarScores;
  patterns: WhealthPattern[];
  observations: string[];
  focus: string | null;
}

/** Daily Whealth OS snapshots (newest first), computed by coach-insights. */
export const useWhealthSnapshots = (days = 28) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["whealth-snapshots", user?.id, days],
    enabled: !!user?.id,
    staleTime: 30 * 60_000, // recomputed nightly — half-hour staleness is fine
    gcTime: 60 * 60_000,
    queryFn: async (): Promise<WhealthSnapshot[]> => {
      const { data, error } = await supabase
        .from("coach_performance_snapshots")
        .select("snapshot_date, performance_score, components")
        .eq("user_id", user!.id)
        .order("snapshot_date", { ascending: false })
        .limit(days);
      if (error) throw error;
      return (data ?? [])
        .filter((r) => (r.components as Record<string, unknown>)?.["engine"] === "whealth-os")
        .map((r) => {
          const c = r.components as Record<string, unknown>;
          return {
            snapshotDate: r.snapshot_date,
            overall: r.performance_score ?? 0,
            pillars: (c.pillars ?? {}) as PillarScores,
            patterns: (Array.isArray(c.patterns) ? c.patterns : []) as WhealthPattern[],
            observations: (Array.isArray(c.observations) ? c.observations : []) as string[],
            focus: typeof c.focus === "string" ? c.focus : null,
          };
        });
    },
  });
};
