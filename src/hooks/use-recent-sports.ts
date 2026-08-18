import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * The user's recent check-in sports (last 60 days), ranked by frequency with
 * a recency boost — feeds the picker's "For you" shortlist. Fail-open: any
 * error returns [] so the picker just falls back to the grouped catalog.
 */
export const useRecentSports = () => {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["recent-sports", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const since = new Date(Date.now() - 60 * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("daily_checkins")
        .select("sport, checked_in_at")
        .eq("user_id", user!.id)
        .not("sport", "is", null)
        .gte("checked_in_at", since)
        .order("checked_in_at", { ascending: false })
        .limit(60);
      if (error) {
        console.warn("recent-sports:", error.message);
        return [];
      }
      const weekAgo = Date.now() - 7 * 86400_000;
      const score = new Map<string, number>();
      for (const row of data ?? []) {
        if (!row.sport) continue;
        // Frequency + double weight for the last 7 days.
        const w = new Date(row.checked_in_at).getTime() >= weekAgo ? 2 : 1;
        score.set(row.sport, (score.get(row.sport) ?? 0) + w);
      }
      return [...score.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id]) => id);
    },
  });
  return query.data ?? [];
};
