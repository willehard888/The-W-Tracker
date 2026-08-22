import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RankBreakdown {
  active_days: number;
  active_days_score: number;
  xp_score: number;
  streak_score: number;
  trust: number;
  total: number;
}

/** The three inputs behind "Consistency" (rank_score) — read-only RPC. */
export const useRankBreakdown = (userId: string | undefined) =>
  useQuery<RankBreakdown | null>({
    queryKey: ["rank-breakdown", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_rank_score_breakdown", { p_user_id: userId! });
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as RankBreakdown | undefined) ?? null;
    },
  });
