import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SuggestedFriend {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
  level: number | null;
  mutual_tribes: number;
}

/** "People you may know" — members of your tribes you're not connected to yet. */
export const useSuggestedFriends = (enabled = true) =>
  useQuery<SuggestedFriend[]>({
    queryKey: ["people-you-may-know"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("people_you_may_know", { p_limit: 12 });
      if (error) throw error;
      return data ?? [];
    },
  });
