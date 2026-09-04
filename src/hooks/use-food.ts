import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCachedFood } from "@/lib/nutrition/food-cache";
import { fetchFood } from "@/lib/nutrition/queries";

/** One food as the engine `Food`; the local cache answers instantly (placeholder) while the server row loads. */
export const useFood = (id: string | null) => {
  const { user } = useAuth();
  const uid = user?.id;
  const q = useQuery({
    queryKey: ["food", id, uid],
    enabled: !!uid && !!id,
    staleTime: 60 * 60_000,
    placeholderData: () => (uid && id ? (getCachedFood(uid, id) ?? undefined) : undefined),
    queryFn: () => (id ? fetchFood(supabase, id) : null),
  });
  return { food: q.data ?? null, isLoading: q.isLoading, isPlaceholder: q.isPlaceholderData, error: q.error };
};
