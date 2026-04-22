import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MyRankData {
  rank: number;
  totalUsers: number;
  percentile: number;
  hasRank: boolean;
}

/**
 * Single source of truth for the current user's rank/percentile.
 *
 * - Uses the SQL `get_user_rank` RPC so the universe (rank_score > 0) is
 *   identical to the one `update_all_status_tiers` uses → percentile and
 *   tier always agree.
 * - Shared cache (queryKey ["my-rank", userId]) so navigating between
 *   /index and /profile only triggers one network call per minute.
 */
export const useMyRank = (userId: string | undefined) => {
  return useQuery<MyRankData | null>({
    queryKey: ["my-rank", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.rpc("get_user_rank" as any, {
        p_user_id: userId,
      });
      if (error) {
        console.error("get_user_rank failed", error);
        return null;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        rank: Number((row as any).rank) || 0,
        totalUsers: Number((row as any).total_users) || 0,
        percentile: Number((row as any).percentile) || 0,
        hasRank: Boolean((row as any).has_rank),
      };
    },
    enabled: !!userId,
    // Always refetch when a screen using rank mounts so % stays in sync
    // with leaderboard / tier changes (cache showing stale "89%" after
    // user climbed to #1 was reported).
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
};
