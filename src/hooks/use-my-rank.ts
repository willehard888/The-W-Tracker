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
      const { data, error } = await supabase.rpc("get_user_rank", {
        p_user_id: userId,
      });
      if (error) {
        console.error("get_user_rank failed", error);
        return null;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        rank: Number(row.rank) || 0,
        totalUsers: Number(row.total_users) || 0,
        percentile: Number(row.percentile) || 0,
        hasRank: Boolean(row.has_rank),
      };
    },
    enabled: !!userId,
    // 30s stale window — rank doesn't change that fast, and staleTime: 0 was
    // triggering an RPC call on every single mount/window-focus event (multiple
    // components use this hook simultaneously).
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
};
