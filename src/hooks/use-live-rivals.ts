import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RivalProfile {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status_tier: string;
  rank_score: number;
  delta: number; // absolute point difference vs. me
}

export interface LiveRivals {
  above: RivalProfile | null;
  below: RivalProfile | null;
}

/**
 * Fetches the closest user above and below the given user in rank_score.
 * Cached for 30s to avoid hammering the DB.
 */
export const useLiveRivals = (userId?: string, myScore?: number) => {
  return useQuery<LiveRivals>({
    queryKey: ["live-rivals", userId, myScore],
    queryFn: async () => {
      if (!userId || myScore === undefined) return { above: null, below: null };

      const select = "user_id, username, display_name, avatar_url, status_tier, rank_score";

      const [aboveRes, belowRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(select)
          .gt("rank_score", myScore)
          .neq("user_id", userId)
          .order("rank_score", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select(select)
          .lt("rank_score", myScore)
          .neq("user_id", userId)
          .gt("rank_score", 0)
          .order("rank_score", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const above = aboveRes.data
        ? { ...(aboveRes.data as any), delta: Math.abs((aboveRes.data as any).rank_score - myScore) }
        : null;
      const below = belowRes.data
        ? { ...(belowRes.data as any), delta: Math.abs(myScore - (belowRes.data as any).rank_score) }
        : null;

      return { above, below };
    },
    enabled: !!userId && myScore !== undefined,
    staleTime: 30_000,
  });
};
