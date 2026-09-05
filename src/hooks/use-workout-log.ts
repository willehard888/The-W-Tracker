import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export interface WorkoutSetLog {
  id: string;
  program_id: string | null;
  week: number | null;
  day_index: number | null;
  exercise_slug: string | null;
  exercise_name: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  /** 1-based working set. Rows written before per-set logging are all set 1. */
  set_index: number;
  logged_on: string;
}

const tbl = () => supabase.from("workout_set_logs");

/** Last N logs for one exercise — powers the "last time" hint + progression. */
export const useExerciseHistory = (slug?: string | null) =>
  useQuery<WorkoutSetLog[]>({
    queryKey: ["exercise-history", slug],
    enabled: !!slug,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await tbl()
        .select("*")
        .eq("exercise_slug", slug!)
        .order("logged_on", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data as WorkoutSetLog[]) ?? [];
    },
  });

/**
 * All logs for a program-day slot, keyed by exercise slug — prefills inputs.
 *
 * One entry per EXERCISE, holding its first set. Before per-set logging the
 * table could only hold one row per exercise, so this map was unambiguous; now
 * a three-set exercise returns three rows and "last one wins" would prefill the
 * expandable row in the program view with whichever set the database happened
 * to return last. Set 1 is the stable, meaningful answer for that surface.
 *
 * The runner reads every set — see `useDaySets`.
 */
export const useDayLogs = (programId?: string | null, week?: number, day?: number) =>
  useQuery<Record<string, WorkoutSetLog>>({
    queryKey: ["day-logs", programId, week, day],
    enabled: !!programId && week != null && day != null,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await tbl()
        .select("*")
        .eq("program_id", programId!)
        .eq("week", week!)
        .eq("day_index", day!)
        .order("set_index", { ascending: true });
      if (error) throw error;
      const map: Record<string, WorkoutSetLog> = {};
      for (const r of (data ?? []) as WorkoutSetLog[]) {
        // First set wins — the query is ordered, so later sets never clobber it.
        if (r.exercise_slug && !map[r.exercise_slug]) map[r.exercise_slug] = r;
      }
      return map;
    },
  });

/**
 * Every logged set for a program-day slot, grouped by exercise and ordered by
 * set number. This is what the workout runner reads to know which sets of
 * which exercise are already done.
 */
export const useDaySets = (programId?: string | null, week?: number, day?: number) =>
  useQuery<Record<string, WorkoutSetLog[]>>({
    queryKey: ["day-sets", programId, week, day],
    enabled: !!programId && week != null && day != null,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await tbl()
        .select("*")
        .eq("program_id", programId!)
        .eq("week", week!)
        .eq("day_index", day!)
        .order("set_index", { ascending: true });
      if (error) throw error;
      const map: Record<string, WorkoutSetLog[]> = {};
      for (const r of (data ?? []) as WorkoutSetLog[]) {
        if (!r.exercise_slug) continue;
        (map[r.exercise_slug] ??= []).push(r);
      }
      return map;
    },
  });

export interface LogSetInput {
  programId?: string | null;
  week?: number;
  day?: number;
  slug?: string | null;
  name: string;
  weight: number | null;
  reps: number | null;
  rpe?: number | null;
  /**
   * Which working set within the exercise, 1-based. Defaults to 1 — which is
   * exactly what every row written before per-set logging meant — so the
   * single-top-set logger in the program view keeps working unchanged.
   */
  setIndex?: number;
}

export const useLogSet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: LogSetInput) => {
      // The SQL function accepts NULL for the optional slots; the generated
      // Args type marks them required — keep the exact runtime payload and
      // bridge the type once here.
      const args = {
        p_program: p.programId ?? null,
        p_week: p.week ?? null,
        p_day: p.day ?? null,
        p_slug: p.slug ?? null,
        p_name: p.name,
        p_weight: p.weight,
        p_reps: p.reps,
        p_rpe: p.rpe ?? null,
        p_set_index: p.setIndex ?? 1,
      } as unknown as Database["public"]["Functions"]["log_workout_set"]["Args"];
      const { error } = await supabase.rpc("log_workout_set", args);
      if (error) throw error;
    },
    onSuccess: (_d, p) => {
      qc.invalidateQueries({ queryKey: ["day-logs", p.programId, p.week, p.day] });
      qc.invalidateQueries({ queryKey: ["day-sets", p.programId, p.week, p.day] });
      qc.invalidateQueries({ queryKey: ["exercise-history", p.slug] });
    },
  });
};
