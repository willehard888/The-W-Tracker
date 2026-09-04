import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyError } from "@/lib/error-copy";
import { withNetworkRetry } from "@/lib/retry";
import { deactivateUserFood, fetchUserFoods, upsertUserFood, type FoodRow, type UserFoodPayload } from "@/lib/nutrition/queries";

const EMPTY: FoodRow[] = [];

/** The user's own foods with `save(payload) → id` (upsert_user_food) and `remove(id)` (soft-delete). */
export const useUserFoods = () => {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const key = ["user-foods", uid];

  const q = useQuery({
    queryKey: key,
    enabled: !!uid,
    staleTime: 5 * 60_000,
    queryFn: () => (uid ? fetchUserFoods(supabase, uid) : EMPTY),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["food"] });
    qc.invalidateQueries({ queryKey: ["food-search"] });
  };
  const save = useMutation({
    mutationFn: (payload: UserFoodPayload) => withNetworkRetry(() => upsertUserFood(supabase, payload)),
    onSuccess: refresh,
    onError: (e) => toast.error(friendlyError(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deactivateUserFood(supabase, id),
    onSuccess: refresh,
    onError: (e) => toast.error(friendlyError(e)),
  });

  return { foods: q.data ?? EMPTY, isLoading: q.isLoading, save: save.mutateAsync, remove: remove.mutateAsync, saving: save.isPending };
};
