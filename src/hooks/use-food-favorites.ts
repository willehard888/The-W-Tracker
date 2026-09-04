import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyError } from "@/lib/error-copy";
import { isFavorite, toggleFavorite } from "@/lib/nutrition/food-cache";
import { fetchFavorites, setFavorite } from "@/lib/nutrition/queries";

/** Starred food ids (server truth) with an optimistic `toggle` mirrored into the local food cache. */
export const useFoodFavorites = () => {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const key = ["food-favorites", uid];

  const q = useQuery({
    queryKey: key,
    enabled: !!uid,
    staleTime: 5 * 60_000,
    queryFn: () => (uid ? fetchFavorites(supabase, uid) : []),
  });
  const ids = useMemo(() => new Set(q.data ?? []), [q.data]);

  const syncLocal = (foodId: string, on: boolean) => {
    if (uid && isFavorite(uid, foodId) !== on) toggleFavorite(uid, foodId);
  };
  const m = useMutation({
    mutationFn: ({ foodId, on }: { foodId: string; on: boolean }) => (uid ? setFavorite(supabase, uid, foodId, on) : Promise.resolve()),
    onMutate: async ({ foodId, on }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<string[]>(key) ?? [];
      qc.setQueryData<string[]>(key, on ? [...new Set([...previous, foodId])] : previous.filter((f) => f !== foodId));
      syncLocal(foodId, on);
      return { previous };
    },
    onError: (e, { foodId, on }, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.previous);
      syncLocal(foodId, !on);
      toast.error(friendlyError(e));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { ids, toggle: (foodId: string) => m.mutate({ foodId, on: !ids.has(foodId) }), isLoading: q.isLoading };
};
