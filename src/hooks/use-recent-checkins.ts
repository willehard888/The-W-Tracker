import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Last N days of daily_checkins for the current user.
 * Used by Coach v2 StateCard to compute the 7-day trend line
 * ("Slept 6.2h avg this week — recovery is the weakest signal").
 *
 * Cached 5 min — the 24h check-in window means the data barely moves
 * during a session.
 */
export interface RecentCheckin {
  checked_in_at: string;
  sleep_hours: number;
  hydration_liters: number;
  workout: boolean;
  meditation_morning: boolean;
  meditation_evening: boolean;
}

export const useRecentCheckins = (days = 7) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["recent-checkins", user?.id, days],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<RecentCheckin[]> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("daily_checkins")
        .select(
          "checked_in_at, sleep_hours, hydration_liters, workout, meditation_morning, meditation_evening",
        )
        .eq("user_id", user!.id)
        .gte("checked_in_at", since)
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        checked_in_at: r.checked_in_at,
        sleep_hours: Number(r.sleep_hours),
        hydration_liters: Number(r.hydration_liters),
        workout: !!r.workout,
        meditation_morning: !!r.meditation_morning,
        meditation_evening: !!r.meditation_evening,
      }));
    },
  });
};
