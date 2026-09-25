import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { writeWorkoutToHealth } from "@/lib/health/workout-write";
import { track, FUNNEL } from "@/lib/analytics";

/**
 * The lifecycle of one workout: started, finished, how long it took.
 *
 * Backed by `coach_program_logs`, one row per (program, week, day). Until now
 * that row recorded a single fact — it exists, therefore the session was done —
 * written by one button at the bottom of a card. A session now has a beginning,
 * a measured duration, and a status that can say something other than "done".
 *
 * Everything is upserted on the natural key. The athlete's phone will lock,
 * lose signal and be killed by iOS mid-session; reopening must land on the same
 * row rather than colliding with it or starting a second one.
 */

export interface SessionRow {
  id: string;
  week: number;
  day_index: number;
  completed: boolean;
  status: string;
  started_at: string | null;
  duration_sec: number | null;
  perceived_rpe: number | null;
}

/** What the runner knows that the row does not — all optional, all counts. */
export interface FinishMeta {
  /** "auto" = the last set was logged and the session ended itself. */
  via?: "auto" | "button";
  exercises?: number;
  setsLogged?: number;
}

const CONFLICT = "program_id,week,day_index";

export const useWorkoutSession = (programId?: string | null, week?: number, day?: number) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const enabled = !!user?.id && !!programId && week != null && day != null;

  const key = ["workout-session", programId, week, day];

  const query = useQuery<SessionRow | null>({
    queryKey: key,
    enabled,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_program_logs")
        .select("id, week, day_index, completed, status, started_at, duration_sec, perceived_rpe")
        .eq("user_id", user!.id)
        .eq("program_id", programId!)
        .eq("week", week!)
        .eq("day_index", day!)
        .maybeSingle();
      if (error) throw error;
      return (data as SessionRow | null) ?? null;
    },
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: key });
    // The program screen, Home's training row and the check-in bridge all read
    // completion state from their own queries.
    qc.invalidateQueries({ queryKey: ["coach-program-logs"] });
    qc.invalidateQueries({ queryKey: ["session-done-today"] });
    qc.invalidateQueries({ queryKey: ["focus-session"] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, programId, week, day]);

  /**
   * Mark the session started. Idempotent: reopening a session in progress must
   * not reset the clock, so `started_at` is only written when it is absent.
   */
  const start = useMutation({
    mutationFn: async () => {
      if (!enabled) return;
      const existing = query.data;
      if (existing?.completed) return; // Already finished — nothing to start.
      // The runner calls start() on every open, and the upsert below is
      // deliberately idempotent about started_at. The event has to be too, or
      // one workout reads as five because the phone locked four times.
      const isFirstStart = !existing?.started_at;
      const { error } = await supabase.from("coach_program_logs").upsert(
        {
          user_id: user!.id,
          program_id: programId!,
          week: week!,
          day_index: day!,
          // NOT completed. A started session that is abandoned must not read as
          // a done one — that would inflate adherence and the check-in bridge.
          completed: false,
          status: "in_progress",
          started_at: existing?.started_at ?? new Date().toISOString(),
        },
        { onConflict: CONFLICT },
      );
      if (error) throw error;
      if (isFirstStart) void track(FUNNEL.workoutStarted, { week, day });
    },
    onSuccess: invalidate,
  });

  /** Finish the session, recording how long it actually took. */
  const finish = useMutation({
    mutationFn: async (meta?: FinishMeta) => {
      if (!enabled) return;
      const startedAt = query.data?.started_at;
      // A finished session can be reopened and re-finished to rewrite a longer
      // duration. That is one workout, so it is one workout_completed.
      const wasCompleted = query.data?.completed === true;
      // Measured, never estimated. An unknown duration stays null rather than
      // borrowing the plan's advertised number, which is what we are trying to
      // make honest in the first place.
      const durationSec = startedAt
        ? Math.max(0, Math.min(43200, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)))
        : null;
      const now = new Date().toISOString();
      const { error } = await supabase.from("coach_program_logs").upsert(
        {
          user_id: user!.id,
          program_id: programId!,
          week: week!,
          day_index: day!,
          completed: true,
          status: "completed",
          started_at: startedAt ?? null,
          duration_sec: durationSec,
          // The check-in bridge asks "was a session completed today?" through
          // logged_at. It defaulted to row creation — the moment the runner was
          // opened — so a session finished after midnight credited the wrong day.
          logged_at: now,
        },
        { onConflict: CONFLICT },
      );
      if (error) throw error;
      // Apple Health, after our own row is safe. Opt-in and fail-open inside;
      // a measured session is the only kind worth writing.
      if (startedAt) void writeWorkoutToHealth({ id: `${programId}-${week}-${day}`, startIso: startedAt, endIso: now });
      if (!wasCompleted) {
        void track(FUNNEL.workoutCompleted, {
          week,
          day,
          minutes: durationSec == null ? null : Math.round(durationSec / 60),
          via: meta?.via ?? "button",
          exercises: meta?.exercises ?? null,
          sets_logged: meta?.setsLogged ?? null,
        });
      }
      return durationSec;
    },
    onSuccess: invalidate,
  });

  return {
    session: query.data ?? null,
    isLoading: query.isLoading,
    /** The athlete opened the runner and began. */
    start: start.mutateAsync,
    isStarting: start.isPending,
    /** The athlete finished. Resolves with the measured duration in seconds. */
    finish: finish.mutateAsync,
    isFinishing: finish.isPending,
  };
};
