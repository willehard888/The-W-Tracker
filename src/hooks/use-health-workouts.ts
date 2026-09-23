import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { localDateKey } from "@/lib/date";

/**
 * The last N days of sessions Apple Health holds for this member — a Polar
 * tennis match with its sport, minutes, calories and average heart rate —
 * from the day snapshots the background sync writes (`health_sync_snapshots.
 * workouts`, migration 20260923100000).
 *
 * One reader for every place that counts training: the Coach state card,
 * Progress, and the day card's "workout" reminder all read the check-in tick
 * and the runner's log — a session the watch recorded on a day without a
 * check-in was not a training day to any of them.
 */
export interface HealthSession {
  date: string;
  sport: string;
  duration_min: number;
  kcal: number | null;
  avg_hr: number | null;
  source: string | null;
}

const shape = (date: string, raw: unknown): HealthSession[] =>
  (Array.isArray(raw) ? raw : [])
    .filter((w): w is Record<string, unknown> => !!w && typeof w === "object" && typeof (w as { sport?: unknown }).sport === "string")
    .map((w) => ({
      date,
      sport: String(w.sport),
      duration_min: Math.max(0, Number(w.duration_min) || 0),
      kcal: Number.isFinite(Number(w.kcal)) && Number(w.kcal) > 0 ? Number(w.kcal) : null,
      avg_hr: Number.isFinite(Number(w.avg_hr)) && Number(w.avg_hr) > 0 ? Number(w.avg_hr) : null,
      source: typeof w.source === "string" && w.source ? w.source : null,
    }))
    .filter((w) => w.duration_min > 0);

export const useHealthWorkouts = (days = 7) => {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["health-workouts", user?.id, days],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("health_sync_snapshots")
        .select("snapshot_date, workout_count, workouts")
        .eq("user_id", user!.id)
        .gte("snapshot_date", since)
        .order("snapshot_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        date: r.snapshot_date as string,
        workoutCount: Number(r.workout_count) || 0,
        sessions: shape(r.snapshot_date as string, r.workouts),
      }));
    },
  });

  return useMemo(() => {
    const rows = query.data ?? [];
    const sessions = rows.flatMap((r) => r.sessions);
    // A day counts when Health holds a session for it — by the list, or by the
    // count an older build wrote before the list existed.
    const workoutDays = new Set(rows.filter((r) => r.sessions.length > 0 || r.workoutCount > 0).map((r) => r.date));
    const today = localDateKey();
    return {
      sessions,
      workoutDays,
      trainedToday: workoutDays.has(today),
      isLoading: query.isLoading,
    };
  }, [query.data, query.isLoading]);
};

/** "Tennis 62 min · 142 bpm · Gym 45 min" — the week by sport, longest first. */
export const sessionsBySport = (
  sessions: HealthSession[],
  label: (sport: string) => string,
): { sport: string; label: string; minutes: number; avgHr: number | null; count: number }[] => {
  const by = new Map<string, { minutes: number; hrSum: number; hrN: number; count: number }>();
  for (const s of sessions) {
    const cur = by.get(s.sport) ?? { minutes: 0, hrSum: 0, hrN: 0, count: 0 };
    cur.minutes += s.duration_min;
    cur.count += 1;
    if (s.avg_hr) { cur.hrSum += s.avg_hr * s.duration_min; cur.hrN += s.duration_min; }
    by.set(s.sport, cur);
  }
  return [...by.entries()]
    .map(([sport, v]) => ({ sport, label: label(sport), minutes: v.minutes, avgHr: v.hrN ? Math.round(v.hrSum / v.hrN) : null, count: v.count }))
    .sort((a, b) => b.minutes - a.minutes);
};
