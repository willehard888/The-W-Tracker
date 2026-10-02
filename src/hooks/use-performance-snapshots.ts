import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { localDateKey } from "@/lib/date";
import { track, FUNNEL } from "@/lib/analytics";

export const usePerformanceSnapshots = (days = 28) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["coach-performance-snapshots", user?.id, days],
    enabled: !!user?.id,
    staleTime: 10 * 60_000,  // snapshots are computed once daily
    gcTime:    30 * 60_000,
    queryFn: async () => {
      // snapshot_date is a local calendar day — a UTC cut dropped or added a
      // whole day off the window's edge every evening.
      const since = localDateKey(new Date(Date.now() - days * 86400_000));
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
    staleTime: 30 * 60_000,  // weekly reviews only change once per week
    gcTime:    60 * 60_000,
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

/** The review's week key — Monday as a UTC date string, exactly as coach-weekly-review writes it. */
export const weekStartsOnKey = (d = new Date()) => {
  const dt = new Date(d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
};

/** The questions stored with a review, or nothing for a row written before they existed. */
export const reviewQuestions = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((q): q is string => typeof q === "string" && q.trim().length > 0).slice(0, 3) : [];

// One attempt per week per app session, shared by every page that shows the review.
const attempted = new Set<string>();
let inflight: Promise<unknown> | null = null;

/**
 * The weekly review writes itself: the first page to show it in a week
 * without a row asks coach-weekly-review once (idempotent on week_starts_on).
 * The button on Progress is then a refresh, not the only way the review exists.
 */
export const useAutoWeeklyReview = () => {
  const q = useLatestWeeklyReview();
  const qc = useQueryClient();
  const { user } = useAuth();
  const current = q.data?.week_starts_on;
  useEffect(() => {
    if (!user?.id || q.isLoading || q.isError) return;
    const week = weekStartsOnKey();
    if (current === week || attempted.has(week)) return;
    attempted.add(week);
    inflight ??= supabase.functions.invoke("coach-weekly-review")
      .then(({ error }) => {
        if (error) throw error;
        void track(FUNNEL.coachWeeklyReviewAuto, { week });
        return qc.invalidateQueries({ queryKey: ["coach-weekly-review-latest"] });
      })
      .catch(() => { /* the button on Progress remains */ })
      .finally(() => { inflight = null; });
  }, [user?.id, q.isLoading, q.isError, current, qc]);
  return q;
};
