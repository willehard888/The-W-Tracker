import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyError } from "@/lib/error-copy";
import { withNetworkRetry } from "@/lib/retry";
import { deleteRecipe, fetchRecipes, upsertRecipe, type RecipePayload, type RecipeWithItems } from "@/lib/nutrition/queries";

const EMPTY: RecipeWithItems[] = [];

/** The user's recipes (+ items) with `save(recipe) → {recipe, per_serving}` and `remove(id)`. */
export const useUserRecipes = () => {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const key = ["user-recipes", uid];

  const q = useQuery({
    queryKey: key,
    enabled: !!uid,
    staleTime: 5 * 60_000,
    queryFn: () => (uid ? fetchRecipes(supabase, uid) : EMPTY),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["food-search"] });
  };
  const save = useMutation({
    mutationFn: (recipe: RecipePayload) => withNetworkRetry(() => upsertRecipe(supabase, recipe)),
    onSuccess: refresh,
    onError: (e) => toast.error(friendlyError(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteRecipe(supabase, id),
    onSuccess: refresh,
    onError: (e) => toast.error(friendlyError(e)),
  });

  return { recipes: q.data ?? EMPTY, isLoading: q.isLoading, save: save.mutateAsync, remove: remove.mutateAsync, saving: save.isPending };
};
