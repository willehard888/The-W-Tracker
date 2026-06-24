import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
        .eq("exercise_slug", slug)
        .order("logged_on", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data as WorkoutSetLog[]) ?? [];
    },
  });

/** All logs for a program-day slot, keyed by exercise slug — prefills inputs. */
export const useDayLogs = (programId?: string | null, week?: number, day?: number) =>
  useQuery<Record<string, WorkoutSetLog>>({
    queryKey: ["day-logs", programId, week, day],
    enabled: !!programId && week != null && day != null,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await tbl()
        .select("*")
        .eq("program_id", programId)
        .eq("week", week)
        .eq("day_index", day);
      if (error) throw error;
      const map: Record<string, WorkoutSetLog> = {};
      for (const r of (data ?? []) as WorkoutSetLog[]) {
        if (r.exercise_slug) map[r.exercise_slug] = r;
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
}

export const useLogSet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: LogSetInput) => {
      const { error } = await supabase.rpc("log_workout_set", {
        p_program: p.programId ?? null,
        p_week: p.week ?? null,
        p_day: p.day ?? null,
        p_slug: p.slug ?? null,
        p_name: p.name,
        p_weight: p.weight,
        p_reps: p.reps,
        p_rpe: p.rpe ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, p) => {
      qc.invalidateQueries({ queryKey: ["day-logs", p.programId, p.week, p.day] });
      qc.invalidateQueries({ queryKey: ["exercise-history", p.slug] });
    },
  });
};
