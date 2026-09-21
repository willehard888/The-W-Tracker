import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { dayFocus, blockCount, isRestDay } from "@/lib/training/session";
import { programWeekState } from "@/lib/training/program-week";

// Type aliases, not interfaces: plan_json is a `Json` column, and only aliases
// get the implicit index signature that writing it back requires. One block
// shape for every reader (the week card, the exercise row, the editor); the
// runner keeps its own looser shape on purpose, since it reads raw Json.
export type ProgramBlock = {
  /** The catalog slug: logging, illustrations and swaps all key on it. */
  slug?: string | null;
  name: string;
  sets: number;
  reps: string | number;
  rpe?: number | null;
  notes?: string | null;
  rest_sec?: number | null;
  tempo?: string | null;
  alt?: string | null;
};
export type ProgramDay = {
  day: string;
  focus: string;
  duration_min: number;
  blocks: ProgramBlock[];
  conditioning?: string;
  warmup?: string;
  cooldown?: string;
};
export type ProgramWeek = {
  week: number;
  theme: string;
  days: ProgramDay[];
  nutrition: { protein_g_per_kg: number; daily_kcal_band: string; notes: string };
  recovery: { sleep_target_h: number; mobility_min: number; breathwork: string };
  progression_note?: string;
};
export type PlanJson = {
  weeks: ProgramWeek[];
  weekly_check_targets: {
    workouts: number;
    sleep_avg_h: number;
    hydration_l: number;
    perfect_days: number;
  };
  coach_signature?: string;
};
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
  /** Who wrote it: the week builder, the member (manual), the beginner path, the session builder, or the old AI block. */
  generated_with?: string | null;
}

export const PROGRAM_COLUMNS =
  "id, user_id, status, goal, experience, days_per_week, equipment, body_focus, constraints, weeks, plan_json, ai_summary, started_on, created_at, generated_with";

/**
 * Today's session in the current week, or null.
 *
 * Shape handling — the `session_name` fallback older plans used, and the
 * rest-day test — lives in `lib/training/session.ts`, which is unit-tested and
 * shared with every other training surface. Four separate answers to "is this a
 * rest day?" is exactly how they drifted apart before.
 */
export const todaySessionOf = (program: CoachProgram | null, currentWeek: number, todayDayIndex: number) => {
  // Match on the week NUMBER, falling back to the array position. Indexing
  // alone showed the wrong day whenever a plan's weeks arrived out of order.
  const week = program?.plan_json?.weeks?.find((w) => w.week === currentWeek)
    ?? program?.plan_json?.weeks?.[currentWeek - 1];
  const day = week?.days?.[todayDayIndex];
  if (!day) return null;
  return {
    focus: dayFocus(day) || "Today's session",
    duration: day.duration_min ?? null,
    blocks: blockCount(day) || null,
    isRest: isRestDay(day),
  };
};

export interface ProgramLog {
  id: string;
  program_id: string;
  week: number;
  day_index: number;
  completed: boolean;
  status?: string;
  started_at?: string | null;
  duration_sec?: number | null;
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
    staleTime: 10 * 60_000,  // program rarely changes mid-session
    gcTime:    30 * 60_000,
    queryFn: async () => {
      // Home mounts this too (TrainingZone): name the columns, not "*".
      const { data, error } = await supabase
        .from("coach_programs")
        .select(PROGRAM_COLUMNS)
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as CoachProgram | null);
    },
  });

  // Fetched alongside the program, not after it: chaining on the program id
  // cost Home a second round trip. Newest 60 rows for the user, narrowed to
  // the active program below (a superseded block's logs must not count).
  const logsQuery = useQuery({
    queryKey: ["coach-program-logs", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    gcTime:    15 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_program_logs")
        .select("id, program_id, week, day_index, completed, status, started_at, duration_sec, perceived_rpe, notes, logged_at")
        .eq("user_id", user!.id)
        .order("logged_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as ProgramLog[];
    },
  });

  const program = programQuery.data ?? null;
  const logs = useMemo(
    () => (program ? (logsQuery.data ?? []).filter((l) => l.program_id === program.id) : []),
    [logsQuery.data, program],
  );

  // Where the athlete is, from the calendar AND from what they logged.
  //
  // This used to be the calendar alone, which slid the program past anyone who
  // missed a week — you came back to week 3 having trained week 1, carrying
  // loads built on work you never did — and pinned to the final week forever,
  // so a finished block was indistinguishable from an abandoned one.
  const today = new Date();
  const todayDayIndex = DAY_INDEX_FROM_DATE(today);
  const weekState = programWeekState({
    startedOn: program?.started_on,
    weeks: program?.weeks,
    logs,
    now: today,
  });
  const currentWeek = weekState.currentWeek;

  return {
    isLoading: programQuery.isLoading,
    // Surface either query's error so Coach.tsx can show actionable UI
    // (e.g. when the DB migration for coach_programs hasn't been applied).
    error: (programQuery.error ?? logsQuery.error) as Error | null,
    program,
    logs,
    currentWeek,
    todayDayIndex,
    /** Block progress: how far behind, and whether it is time for the next one. */
    weekState,
    refetch: () => {
      programQuery.refetch();
      logsQuery.refetch();
    },
  };
};

/**
 * Hand edits to a program (src/lib/training/plan-edit.ts): the edit is applied
 * to the newest cached plan, shown at once in both caches (the active program
 * and the by-id row the runner reads), then written. Edits run one at a time,
 * so two quick taps never write over each other.
 * ponytail: last write wins across devices; add an updated_at guard if
 * multi-device editing ever appears.
 */
export const useEditProgram = (program: CoachProgram | null) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    scope: { id: "program-edit" },
    mutationFn: async (edit: (plan: PlanJson) => PlanJson) => {
      if (!program || !user?.id) throw new Error("No program to edit");
      const keys = [["coach-program", user.id], ["coach-program", "by-id", program.id]];
      const cached = keys
        .map((k) => qc.getQueryData<CoachProgram | null>(k))
        .find((p) => p?.id === program.id);
      const next = edit((cached ?? program).plan_json);
      for (const k of keys) {
        qc.setQueryData<CoachProgram | null>(k, (old) => (old && old.id === program.id ? { ...old, plan_json: next } : old));
      }
      const { error } = await supabase
        .from("coach_programs")
        .update({ plan_json: next as unknown as Json })
        .eq("id", program.id)
        .eq("user_id", user.id);
      if (error) throw error;
      return next;
    },
    onError: (e: unknown) => {
      void qc.invalidateQueries({ queryKey: ["coach-program"] });
      toast.error("Couldn't save the change", { description: e instanceof Error ? e.message : undefined });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["focus-session"] }),
  });
};
