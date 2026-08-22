import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StandingRow {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string;
  /** "Consistency" — the user-facing name for rank_score (0–100). */
  rank_score: number;
  xp: number;
  streak: number;
}

/**
 * The Standings board — rows come from get_standings, which uses the SAME
 * window order as get_user_rank, so a row's # always equals the user's own
 * #N. (The old page sorted by XP while #N came from rank_score.)
 */
export const useStandings = (limit = 50) =>
  useQuery<StandingRow[]>({
    queryKey: ["standings", limit],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_standings", { p_limit: limit });
      if (error) throw error;
      return (data ?? []) as StandingRow[];
    },
  });
