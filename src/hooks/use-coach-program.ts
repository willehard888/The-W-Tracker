import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ProgramBlock {
  name: string;
  sets: number;
  reps: string;
  rpe?: number;
  notes?: string;
}
export interface ProgramDay {
  day: string;
  focus: string;
  duration_min: number;
  blocks: ProgramBlock[];
  conditioning?: string;
}
export interface ProgramWeek {
  week: number;
  theme: string;
  days: ProgramDay[];
  nutrition: { protein_g_per_kg: number; daily_kcal_band: string; notes: string };
  recovery: { sleep_target_h: number; mobility_min: number; breathwork: string };
}
export interface PlanJson {
  weeks: ProgramWeek[];
  weekly_check_targets: {
    workouts: number;
    sleep_avg_h: number;
    hydration_l: number;
    perfect_days: number;
  };
}
export interface CoachProgram {
  id: string;
  user_id: string;
  status: string;
  goal: string;
  experience: string;
  days_per_week: number;
  equipment: string | null;
  body_focus: string[];
  constraints: string | null;
  weeks: number;
  plan_json: PlanJson;
  ai_summary: string | null;
  started_on: string;
  created_at: string;
}

export interface ProgramLog {
  id: string;
  program_id: string;
  week: number;
  day_index: number;
  completed: boolean;
  perceived_rpe: number | null;
  notes: string | null;
  logged_at: string;
}

const DAY_INDEX_FROM_DATE = (d: Date) => {
  // 0 = Mon … 6 = Sun
  const js = d.getDay(); // 0 = Sun
  return (js + 6) % 7;
};

export const useCoachProgram = () => {
  const { user } = useAuth();

  const programQuery = useQuery({
    queryKey: ["coach-program", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_programs")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as CoachProgram | null);
    },
  });

  const logsQuery = useQuery({
    queryKey: ["coach-program-logs", user?.id, programQuery.data?.id],
    enabled: !!user?.id && !!programQuery.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_program_logs")
        .select("*")
        .eq("user_id", user!.id)
        .eq("program_id", programQuery.data!.id);
      if (error) throw error;
      return (data ?? []) as ProgramLog[];
    },
  });

  const program = programQuery.data ?? null;
  const logs = logsQuery.data ?? [];

  // Compute current week / today's day relative to started_on
  const today = new Date();
  let currentWeek = 1;
  let todayDayIndex = DAY_INDEX_FROM_DATE(today);
  if (program) {
    const started = new Date(program.started_on);
    const days = Math.floor(
      (today.getTime() - new Date(started.getFullYear(), started.getMonth(), started.getDate()).getTime()) /
        86400_000,
    );
    currentWeek = Math.min(program.weeks, Math.max(1, Math.floor(days / 7) + 1));
  }

  return {
    isLoading: programQuery.isLoading,
    program,
    logs,
    currentWeek,
    todayDayIndex,
    refetch: () => {
      programQuery.refetch();
      logsQuery.refetch();
    },
  };
};
