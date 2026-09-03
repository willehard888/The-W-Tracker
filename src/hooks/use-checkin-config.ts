import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withNetworkRetry } from "@/lib/retry";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_CHECKIN_KEYS } from "@/lib/checkin-habits";

/**
 * The user's personalized check-in habit selection.
 *
 * Reads profiles.checkin_habits (NULL/empty → the classic default set).
 * Writes via the set_checkin_habits SECURITY DEFINER RPC.
 *
 */
export const useCheckinConfig = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["checkin-config", user?.id],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    enabled: !!user,
    queryFn: async (): Promise<{ keys: string[]; customized: boolean }> => {
      if (!user) return { keys: DEFAULT_CHECKIN_KEYS, customized: false };
      const { data } = await supabase
        .from("profiles")
        .select("checkin_habits")
        .eq("user_id", user.id)
        .maybeSingle();
      const saved = data?.checkin_habits;
      const customized = !!(saved && saved.length);
      return { keys: customized ? saved! : DEFAULT_CHECKIN_KEYS, customized };
    },
  });

  const mutation = useMutation({
    mutationFn: async (keys: string[]) => {
      // Retried on transient drops (WKWebView "Load failed" on flaky cellular)
      // — this save used to fail silently and the picker closed anyway.
      await withNetworkRetry(async () => {
        const { error } = await supabase.rpc("set_checkin_habits", { p_keys: keys });
        if (error) throw new Error(error.message);
      });
      return keys;
    },
    // Optimistic: the check-in reflects the new set the instant the sheet
    // closes; a failed save rolls back AND says so out loud.
    onMutate: async (keys: string[]) => {
      await queryClient.cancelQueries({ queryKey: ["checkin-config", user?.id] });
      const previous = queryClient.getQueryData(["checkin-config", user?.id]);
      queryClient.setQueryData(["checkin-config", user?.id], { keys, customized: true });
      return { previous };
    },
    onError: (_err, _keys, ctx) => {
      if (ctx?.previous !== undefined) queryClient.setQueryData(["checkin-config", user?.id], ctx.previous);
      toast.error("Couldn't save your habits", {
        description: "Check your connection and save again — nothing was changed.",
      });
    },
    onSuccess: (keys) => {
      queryClient.setQueryData(["checkin-config", user?.id], { keys, customized: true });
    },
  });

  const save = useCallback((keys: string[]) => mutation.mutateAsync(keys), [mutation]);

  return {
    keys: query.data?.keys ?? DEFAULT_CHECKIN_KEYS,
    /** True once the user has explicitly saved a custom habit set. */
    isCustomized: query.data?.customized ?? false,
    isLoading: query.isLoading,
    save,
    saving: mutation.isPending,
  };
};
