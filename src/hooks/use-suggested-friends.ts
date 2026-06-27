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

// RPC lands in generated types after the migration is applied; cast until then.
const rpc = supabase.rpc.bind(supabase) as any;

/** "People you may know" — members of your tribes you're not connected to yet. */
export const useSuggestedFriends = (enabled = true) =>
  useQuery<SuggestedFriend[]>({
    queryKey: ["people-you-may-know"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await rpc("people_you_may_know", { p_limit: 12 });
      if (error) throw error;
      return (data as SuggestedFriend[]) ?? [];
    },
  });
