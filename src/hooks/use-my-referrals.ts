import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MyReferral {
  referred_username: string;
  avatar_url: string | null;
  converted: boolean;
  activated_at: string | null;
  created_at: string;
  converted_at: string | null;
}

/** Recent recruits (people who joined with my code) — newest first. */
export const useMyReferrals = (enabled = true) =>
  useQuery<MyReferral[]>({
    queryKey: ["my-referrals"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_my_referrals", { p_limit: 20 });
      if (error) throw error;
      return data ?? [];
    },
  });
