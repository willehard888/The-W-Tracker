import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const usePerformanceSnapshots = (days = 28) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["coach-performance-snapshots", user?.id, days],
    enabled: !!user?.id,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("coach_performance_snapshots")
        .select("snapshot_date, performance_score, components")
        .eq("user_id", user!.id)
        .gte("snapshot_date", since)
        .order("snapshot_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useLatestWeeklyReview = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["coach-weekly-review-latest", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_weekly_reviews")
        .select("*")
        .eq("user_id", user!.id)
        .order("week_starts_on", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });
};
