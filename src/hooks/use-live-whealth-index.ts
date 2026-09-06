import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { computeWhealthIndexDetailed, type WhealthResultDetailed } from "@/lib/whealth-index";
import { mapLiveInputs } from "@/lib/whealth-live-inputs";

// LIVE Whealth Index — the same pure core the nightly coach-insights engine
// runs, executed client-side over the user's own data. One RPC
// (whealth_live_inputs, SECURITY INVOKER — own-row RLS on every table) replaces
// the 12 parallel reads it used to make. The index moves the moment you check
// in, instead of waiting for the 03:15 UTC cron.

/** Live Whealth Index computed on-device from the user's own data. */
export const useLiveWhealthIndex = () => {
  const { user } = useAuth();
  return useQuery<WhealthResultDetailed>({
    queryKey: ["whealth-live", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whealth_live_inputs");
      if (error) throw error;
      return computeWhealthIndexDetailed(mapLiveInputs(data));
    },
  });
};
