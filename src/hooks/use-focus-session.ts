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

interface BuildArgs { focus: Focus[]; minutes: number; seed?: string; commit: boolean }
interface BuildResult { day?: BuiltSession; program?: CoachProgram; dayIndex: number }

/** The one call: preview (`commit: false`) or store (`commit: true`). */
export const useBuildFocusSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: BuildArgs): Promise<BuildResult> => {
      const { data, error } = await supabase.functions.invoke("coach-build-session", {
        body: { ...args, tz_offset_minutes: new Date().getTimezoneOffset() },
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
      void track(FUNNEL.sessionBuilt, { focus: args.focus, minutes: args.minutes, commit: args.commit });
      return data as BuildResult;
    },
    onSuccess: (res) => {
      if (res.program) void qc.invalidateQueries({ queryKey: ["focus-session"] });
    },
  });
};
