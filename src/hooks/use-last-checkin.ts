import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * The newest check-in row for a user — Home's card and the check-in page
 * both read it. One key, one config: the two copies used to disagree
 * (staleTime 0 + refetch on focus vs. five minutes) and whichever mounted
 * last won for both. Writers invalidate ["last-checkin"].
 */
export const useLastCheckin = (userId: string | undefined) =>
  useQuery({
    queryKey: ["last-checkin", userId],
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_checkins")
        .select("checked_in_at")
        .eq("user_id", userId!)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
