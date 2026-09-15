import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { localDateKey } from "@/lib/date";
import { track, FUNNEL } from "@/lib/analytics";
import type { CoachProgram } from "@/hooks/use-coach-program";

/**
 * Today's session by focus — a one-day `coach_programs` row with
 * `status = "session"`, built by the coach-build-session function from the
 * muscles the athlete picked. It lives beside the 4-week program: the active
 * program's readers filter on `status = "active"` and never see it, and the
 * runner opens it by id (`/coach/session/1/<day>?p=<id>`).
 */

export type Focus = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "legs" | "glutes" | "core";

export interface BuiltSession {
  focus: string;
  duration_min: number;
  blocks: { slug: string; name: string; sets: number; reps: string; rpe: number; rest_sec: number }[];
}

const PROGRAM_COLUMNS =
  "id, user_id, status, goal, experience, days_per_week, equipment, body_focus, constraints, weeks, plan_json, ai_summary, started_on, created_at";

/** One program by id, any status — the runner's door into a focus session. */
export const useProgramById = (id?: string | null) => {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["coach-program", "by-id", id],
    enabled: !!user?.id && !!id,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_programs")
        .select(PROGRAM_COLUMNS)
        .eq("id", id!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as CoachProgram | null);
    },
  });
  return { program: q.data ?? null, isLoading: q.isLoading };
};

export interface FocusSessionLog {
  completed: boolean;
  status: string | null;
  started_at: string | null;
}

/** Today's focus session (newest), with its completion row when one exists. */
export const useTodayFocusSession = () => {
  const { user } = useAuth();
  const today = localDateKey();
  const q = useQuery({
    queryKey: ["focus-session", user?.id, today],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: program, error } = await supabase
        .from("coach_programs")
        .select(PROGRAM_COLUMNS)
        .eq("user_id", user!.id)
        .eq("status", "session")
        .eq("started_on", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!program) return null;
      const { data: log } = await supabase
        .from("coach_program_logs")
        .select("completed, status, started_at")
        .eq("program_id", program.id)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { program: program as unknown as CoachProgram, log: (log as FocusSessionLog | null) ?? null };
    },
  });
  return { session: q.data ?? null, isLoading: q.isLoading };
};

export type SessionBlock = BuiltSession["blocks"][number];

/** Duration under the builder's own model — the preview recomputes it after a swap. */
export const sessionMinutes = (blocks: { sets: number; rest_sec: number }[]) =>
  Math.round(10 + blocks.reduce((t, b) => t + (b.sets * (45 + b.rest_sec)) / 60, 0));

interface BuildArgs { focus: Focus[]; minutes: number; seed?: string; commit: boolean; slugs?: string[] }
interface BuildResult { day?: BuiltSession; program?: CoachProgram; dayIndex: number }
interface SwapArgs { focus: Focus[]; minutes: number; seed?: string; slug: string; sets?: number; exclude?: string[]; program_id?: string }
interface SwapResult { block: SessionBlock; program?: CoachProgram; dayIndex: number }

const call = async <T,>(body: object): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("coach-build-session", {
    body: { ...body, tz_offset_minutes: new Date().getTimezoneOffset() },
  });
  if (error) {
    // supabase-js hides the body behind "non-2xx"; the function's reason
    // and status are what the sheet routes on (403 paywall, 400 profile).
    let reason = error.message;
    let status = 0;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.text === "function") {
      status = ctx.status;
      try {
        const raw = (await ctx.text())?.trim();
        if (raw) { try { reason = JSON.parse(raw)?.error || raw; } catch { reason = raw.slice(0, 200); } }
      } catch { /* keep generic */ }
    }
    throw Object.assign(new Error(reason), { status });
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
};

/** The one call: preview (`commit: false`) or store (`commit: true`, with the preview's slugs after swaps). */
export const useBuildFocusSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: BuildArgs): Promise<BuildResult> => {
      const res = await call<BuildResult>(args);
      void track(FUNNEL.sessionBuilt, { focus: args.focus, minutes: args.minutes, commit: args.commit });
      return res;
    },
    onSuccess: (res) => {
      if (res.program) void qc.invalidateQueries({ queryKey: ["focus-session"] });
    },
  });
};

/**
 * One movement for another of the same pattern. In the preview it returns
 * the block; with `program_id` it rewrites the stored session and hands the
 * runner the updated program without a refetch.
 */
export const useSwapExercise = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: SwapArgs) => call<SwapResult>({ ...args, action: "swap" }),
    onSuccess: (res) => {
      if (res.program) {
        qc.setQueryData(["coach-program", "by-id", res.program.id], res.program);
        void qc.invalidateQueries({ queryKey: ["focus-session"] });
      }
    },
  });
};
