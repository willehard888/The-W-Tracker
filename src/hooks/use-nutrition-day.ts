import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { MealLogItemRow, MealLogRow } from "@/lib/nutrition/api-types";
import { fetchDay } from "@/lib/nutrition/queries";

/** Cache shape of one diary day; `pendingMealIds` = optimistic meals not yet confirmed by the server. */
export interface DayData {
  meals: MealLogRow[];
  items: MealLogItemRow[];
  pendingMealIds?: string[];
}
export const dayKey = (date: string, uid: string | undefined) => ["nutrition-day", date, uid] as const;

const EMPTY: DayData = { meals: [], items: [] };

/** One diary day: meals + items grouped by meal, plus which meals are still syncing. */
export const useNutritionDay = (date: string) => {
  const { user } = useAuth();
  const uid = user?.id;
  const q = useQuery({
    queryKey: dayKey(date, uid),
    enabled: !!uid,
    staleTime: 30_000,
    queryFn: (): Promise<DayData> => (uid ? fetchDay(supabase, uid, date) : Promise.resolve(EMPTY)),
  });
  const data = q.data ?? EMPTY;
  const { itemsByMeal, pendingIds } = useMemo(() => {
    const byMeal = new Map<string, MealLogItemRow[]>();
    for (const it of data.items) byMeal.set(it.meal_log_id, [...(byMeal.get(it.meal_log_id) ?? []), it]);
    return { itemsByMeal: byMeal, pendingIds: new Set(data.pendingMealIds ?? []) };
  }, [data]);
  return { meals: data.meals, items: data.items, itemsByMeal, pendingIds, isLoading: q.isLoading, error: q.error, refetch: q.refetch };
};
