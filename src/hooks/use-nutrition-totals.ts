import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTotals } from "@/lib/nutrition/queries";

export const totalsKey = (date: string, uid: string | undefined) => ["nutrition-totals", date, uid] as const;

/** Server-side day totals (by slot, counts, effective targets) for a date. */
export const useNutritionTotals = (date: string) => {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: totalsKey(date, user?.id),
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: () => fetchTotals(supabase, date),
  });
  return { day: q.data ?? null, isLoading: q.isLoading, error: q.error };
};
