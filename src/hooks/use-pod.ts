import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PodMember {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
  streak: number | null;
  checked_in_today: boolean;
}

export interface Pod {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
}

export interface PodToday {
  pod: Pod;
  members: PodMember[];
}

/**
 * The caller's accountability pod + each member's today check-in status.
 * Returns null when the user isn't in a pod yet.
 */
export const usePod = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<PodToday | null>({
    queryKey: ["pod-today", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const tz = new Date().getTimezoneOffset();
      const { data, error } = await supabase.rpc("pod_today", { p_tz_offset_minutes: tz });
      if (error) throw error;
      return (data as PodToday | null) ?? null;
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["pod-today", user?.id] });

  return { ...query, refresh };
};
