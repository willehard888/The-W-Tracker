import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { localDateKey } from "@/lib/date";
import { track, FUNNEL } from "@/lib/analytics";
import { PROGRAM_COLUMNS, type CoachProgram, type PlanJson, type ProgramWeek } from "@/hooks/use-coach-program";
import { useAthleteProfile, type AthleteProfile } from "@/hooks/use-athlete-profile";
import { useRecentWorkoutLogs } from "@/hooks/use-workout-log";
import { normalizeInjuries } from "@/lib/training/injuries";
import { isRepeatingWeek, repeatWeek } from "@/lib/training/plan-edit";
import type { Json } from "@/integrations/supabase/types";

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
  return { program: q.data ?? null, isLoading: q.isLoading, error: q.error, refetch: q.refetch };
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
export { sessionMinutes } from "@/lib/training/plan-edit";

export type Feel = "light" | "normal" | "hard";

interface BuildArgs { focus: Focus[]; minutes: number; feel?: Feel; seed?: string; commit: boolean; slugs?: string[] }
interface BuildResult { day?: BuiltSession; program?: CoachProgram; dayIndex: number }
interface SwapArgs { focus: Focus[]; minutes: number; feel?: Feel; seed?: string; slug: string; sets?: number; exclude?: string[]; program_id?: string }
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

/**
 * The morning brief is cached for the day and names the session that was on
 * deck when it was written: after a new program, or a session built for today,
 * it kept announcing "today's Upper session" over a Chest day. Written again
 * once, against what is true now (the function caps these per member per day).
 * ponytail: a hand edit of today's day does not refresh it; call this from
 * useEditProgram if that contradiction shows up.
 */
const rewriteBrief = (qc: ReturnType<typeof useQueryClient>, userId: string | undefined) => {
  if (!userId) return;
  void supabase.functions
    .invoke("coach-daily-brief", { body: { tz_offset_minutes: new Date().getTimezoneOffset(), force: true } })
    .then(({ data }) => { if (data?.brief) qc.setQueryData(["coach-brief", userId, localDateKey()], data.brief); })
    .catch(() => { /* the cached brief stays; tomorrow's is written fresh */ });
};

/** The one call: preview (`commit: false`) or store (`commit: true`, with the preview's slugs after swaps). */
export const useBuildFocusSession = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (args: BuildArgs): Promise<BuildResult> => {
      const res = await call<BuildResult>(args);
      void track(FUNNEL.sessionBuilt, { focus: args.focus, minutes: args.minutes, feel: args.feel ?? "normal", commit: args.commit });
      return res;
    },
    onSuccess: (res) => {
      if (!res.program) return;
      void qc.invalidateQueries({ queryKey: ["focus-session"] });
      rewriteBrief(qc, user?.id);
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

// ── The engine on the client ─────────────────────────────────────────────
//
// The session builder (the pool, its safety rules, the swap ranking, the week
// split, the balance read) is one module, shared with the edge function. It
// is imported here, never copied, and only ever dynamically: this file is in
// Home's import graph and the module carries the 90 kB exercise catalog.
export const loadEngine = () => import("../../supabase/functions/_shared/session-builder.ts");
export type Engine = Awaited<ReturnType<typeof loadEngine>>;

/** The days the athlete trains (0 = Sun, the profile's convention); Mon, Tue, Thu, Fri until they say. */
export const trainingDaysOf = (profile: AthleteProfile | null | undefined): number[] =>
  profile?.training_days_pref?.length ? profile.training_days_pref : [1, 2, 4, 5];

/** The athlete's profile in the shape the engine builds from. */
export const engineInput = (profile: AthleteProfile | null | undefined, minutes?: number) => ({
  minutes: Math.min(120, Math.max(20, minutes ?? profile?.preferred_session_length_min ?? 45)),
  goal: profile?.primary_goal ?? null,
  experience: profile?.training_experience ?? null,
  equipment: profile?.equipment ?? [],
  injuries: normalizeInjuries(profile?.injuries),
  seed: `${localDateKey()}:${profile?.user_id ?? ""}`,
});

/** The engine plus the athlete's input, loaded when a picker or a builder opens. */
export const useEngine = (enabled: boolean) => {
  const { profile } = useAthleteProfile();
  const q = useQuery({ queryKey: ["training-engine"], enabled, staleTime: Infinity, gcTime: Infinity, queryFn: loadEngine });
  return { engine: q.data ?? null, input: engineInput(profile), isLoading: q.isLoading };
};

/** The muscle groups the athlete has been avoiding (last 28 days of logs); empty until there is enough to say. */
export const useMuscleBalance = (enabled = true): Focus[] => {
  const logs = useRecentWorkoutLogs();
  const { engine } = useEngine(enabled && (logs.data?.length ?? 0) > 0);
  if (!engine || !logs.data) return [];
  return engine.neglectedFocuses(logs.data, localDateKey());
};

type CreateKind = { kind: "week" } | { kind: "manual" } | { kind: "repeat"; from: CoachProgram };

/**
 * A program written on the client, the way the beginner path is: the coach's
 * week (one session per training day from the split, instant, no model), an
 * empty week for a member's own program, or the running weeks once more. Four
 * numbered copies of the week, because logs are unique per week and day.
 */
export const useCreateProgram = () => {
  const { user } = useAuth();
  const { profile } = useAthleteProfile();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (arg: CreateKind): Promise<CoachProgram> => {
      if (!user?.id) throw new Error("Not signed in");
      // Both loaded on demand: this file is in Home's import graph, and the
      // beginner path's written programme rides along with its module.
      const [engine, { insertActiveProgram }] = await Promise.all([loadEngine(), import("@/lib/beginner-program")]);
      let week: ProgramWeek | null = null;
      let carried: ProgramWeek[] | null = null;
      let targets: PlanJson["weekly_check_targets"];
      let trainingDays = 0;
      if (arg.kind === "repeat") {
        const weeks = [...(arg.from.plan_json.weeks ?? [])].sort((a, b) => a.week - b.week);
        if (weeks.length === 0) throw new Error("This program has no week to run again.");
        // A block that progresses is run again as it is, week for week. Taking
        // its newest week four times turned "run these four weeks again" into
        // four copies of the hardest one.
        if (isRepeatingWeek(arg.from.plan_json)) week = weeks[weeks.length - 1];
        else carried = weeks.map((w, i) => ({ ...w, week: i + 1 }));
        targets = arg.from.plan_json.weekly_check_targets;
        trainingDays = (week ?? weeks[0]).days.filter((d) => d.blocks.length > 0).length;
      } else {
        // The profile counts days from Sunday; a plan counts them from Monday.
        const days = arg.kind === "week" ? trainingDaysOf(profile).map((d) => (d + 6) % 7) : [];
        const built = arg.kind === "week" ? engine.buildWeek(engineInput(profile), days) : engine.DAY_NAMES.map(() => null);
        trainingDays = built.filter(Boolean).length;
        if (arg.kind === "week" && trainingDays === 0) {
          throw new Error("Not enough safe movements for your equipment. Add equipment in your profile, or build your own week.");
        }
        const plan = engine.weekPlan(built, {
          theme: arg.kind === "week" ? "Your week" : "Your own week",
          nutritionNote: "Protein at every meal. Eat to the training day.",
          progressionNote: "Beat last week by one rep or one small plate.",
        });
        week = plan.weeks[0] as ProgramWeek;
        targets = plan.weekly_check_targets;
      }
      const plan: PlanJson = { weekly_check_targets: targets, weeks: carried ?? repeatWeek(week!, 4) };
      const row = await insertActiveProgram({
        user_id: user.id,
        goal: profile?.primary_goal ?? "all",
        experience: profile?.training_experience ?? "unknown",
        days_per_week: Math.max(1, trainingDays),
        equipment: (profile?.equipment ?? []).join(", ") || "Full gym",
        body_focus: [],
        constraints: null,
        weeks: plan.weeks.length,
        plan_json: plan as unknown as Json,
        ai_summary: null,
        generated_with: arg.kind === "week" ? "week_builder_v1" : arg.kind === "manual" ? "manual_v1" : "repeat_v1",
        started_on: localDateKey(),
      });
      if (arg.kind === "week") void track(FUNNEL.weekBuilt, { days: trainingDays, minutes: engineInput(profile).minutes });
      else void track(FUNNEL.programEdited, { op: arg.kind === "manual" ? "manual_start" : "repeat", scope: "remaining", source: "program", via: "manual" });
      return row as unknown as CoachProgram;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["coach-program"] });
      void qc.invalidateQueries({ queryKey: ["coach-program-logs"] });
      rewriteBrief(qc, user?.id);
    },
  });
};
