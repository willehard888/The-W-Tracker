import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_CHECKIN_KEYS } from "@/lib/checkin-habits";

/**
 * The user's personalized check-in habit selection.
 *
 * Reads profiles.checkin_habits (NULL/empty → the classic default set).
 * Writes via the set_checkin_habits SECURITY DEFINER RPC. Cast as any until
 * the Supabase types are regenerated after the migration runs.
 */
export const useCheckinConfig = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["checkin-config", user?.id],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    enabled: !!user,
    queryFn: async (): Promise<string[]> => {
      if (!user) return DEFAULT_CHECKIN_KEYS;
      const { data } = await supabase
        .from("profiles")
        .select("checkin_habits")
        .eq("user_id", user.id)
        .maybeSingle();
      const keys = (data as any)?.checkin_habits as string[] | null | undefined;
      return keys && keys.length ? keys : DEFAULT_CHECKIN_KEYS;
    },
  });

  const mutation = useMutation({
    mutationFn: async (keys: string[]) => {
      const { error } = await supabase.rpc("set_checkin_habits", { p_keys: keys });
      if (error) throw new Error(error.message);
      return keys;
    },
    onSuccess: (keys) => {
      queryClient.setQueryData(["checkin-config", user?.id], keys);
    },
  });

  const save = useCallback((keys: string[]) => mutation.mutateAsync(keys), [mutation]);

  return {
    keys: query.data ?? DEFAULT_CHECKIN_KEYS,
    isLoading: query.isLoading,
    save,
    saving: mutation.isPending,
  };
};
