import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localDateKey } from "@/lib/date";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime";
import { readEdgeError } from "@/lib/error-copy";
import { useRecentCheckins } from "@/hooks/use-recent-checkins";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { useTodayReflection } from "@/hooks/use-coach-reflection";
import { habitsEarnedToday } from "@/lib/recovery/completion";
import { useHealthWorkouts } from "@/hooks/use-health-workouts";
import { settledMissions } from "@/lib/coach/plan-evidence";

export type MissionKind = "primary" | "recovery" | "focus" | "habit" | "edge";
export type MissionPriority = "high" | "medium" | "low";

export interface Mission {
  id: string;
  kind: MissionKind;
  title: string;
  detail?: string;
  priority: MissionPriority;
  /** coach-daily-plan catalog id — says which check-in habit settles the reminder. */
  protocol_id?: string;
  /** The coach's reason it matters for this athlete today. */
  why?: string;
}

export interface DailyPlan {
  id: string;
  user_id: string;
  plan_date: string;
  readiness_score: number;
  readiness_breakdown: Record<string, number | string>;
  adjustment: "push" | "hold" | "deload" | "swap";
  headline: string | null;
  missions: Mission[];
  generated_at: string;
}

/**
 * Today's reminders and which of them the day's data has already settled.
 *
 * Nothing here is ticked by hand any more. The card was a second check-in —
 * the member tapped "Mindful evening wind-down" done, then recorded the same
 * evening in the check-in — so `done` now reads the check-in row, the runner's
 * session log, today's reflection and a finished recovery routine.
 * (coach_mission_logs and complete_coach_mission are no longer written.)
 */
export const useDailyPlan = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const date = localDateKey();

  const planQuery = useQuery({
    queryKey: ["coach-daily-plan", user?.id, date],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,  // plan is per-day; realtime sub handles live updates
    gcTime:    24 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_daily_plans")
        .select("*")
        .eq("user_id", user!.id)
        .eq("plan_date", date)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as DailyPlan | null) ?? null;
    },
  });

  // Realtime subscription so a new plan lands instantly.
  // Channel name carries a per-mount UUID so React StrictMode's double-mount
  // (and HMR re-mounts) doesn't return a cached already-subscribed channel
  // on the second mount — which would make `.on()` throw "cannot add
  // postgres_changes callbacks after subscribe()".
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(uniqueChannelName("daily-plan", user.id))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coach_daily_plans", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["coach-daily-plan", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, qc]);

  const generate = async () => {
    // The function runs in UTC; without the device's offset it stamped the plan
    // with the UTC day while this hook reads the local one — in Finland the
    // plan "vanished" every night between 00:00 and 03:00.
    const { data, error } = await supabase.functions.invoke("coach-daily-plan", {
      body: { tz_offset_minutes: new Date().getTimezoneOffset() },
    });
    if (error) {
      // supabase.functions.invoke wraps non-2xx as FunctionsHttpError with the
      // Response on `context` — surface the status so the UI can distinguish
      // "membership required" (403) from a real failure instead of showing the
      // raw "non-2xx status code" string to users.
      const edge = await readEdgeError(error, "Today's plan is unavailable right now.");
      throw new Error(edge.status === 403 && !edge.code ? "membership_required" : (edge.code ?? edge.message));
    }
    interface GeneratePayload {
      error?: string;
      plan_id?: string;
      readiness_score?: number;
      readiness_breakdown?: Record<string, number | string>;
      adjustment?: DailyPlan["adjustment"];
      headline?: string | null;
      missions?: Mission[];
    }
    const d = (data ?? {}) as GeneratePayload;
    if (d.error) throw new Error(d.error);
    // Seed the cache straight from the response — the invalidate alone left a
    // one-render gap where plan===null and the "Build today's plan" CTA
    // flashed before the refetch landed.
    if (d?.plan_id && user?.id) {
      qc.setQueryData(["coach-daily-plan", user.id, date], {
        id: d.plan_id,
        user_id: user.id,
        plan_date: date,
        readiness_score: d.readiness_score ?? 50,
        readiness_breakdown: d.readiness_breakdown ?? {},
        adjustment: d.adjustment ?? "hold",
        headline: d.headline ?? null,
        missions: d.missions ?? [],
        generated_at: new Date().toISOString(),
      } satisfies DailyPlan);
    }
    qc.invalidateQueries({ queryKey: ["coach-daily-plan", user?.id] });
    return data;
  };

  // The day's evidence. All three queries are already warm on the Coach page
  // (StateCard, TrainingZone, the reflection card); react-query dedupes them.
  const { data: recent } = useRecentCheckins(7);
  const { logs } = useCoachProgram();
  const { reflection } = useTodayReflection();
  const health = useHealthWorkouts(1);
  const todayCheckin = useMemo(
    () => (recent ?? []).find((r) => localDateKey(new Date(r.checked_in_at)) === date) ?? null,
    [recent, date],
  );
  // The runner's log or a session the watch recorded (a Polar match counts).
  const trainedToday = useMemo(
    () => health.trainedToday || logs.some((l) => l.completed && localDateKey(new Date(l.logged_at)) === date),
    [logs, date, health.trainedToday],
  );
  const missions = planQuery.data?.missions ?? [];
  const completedIds = useMemo(
    () =>
      settledMissions(missions, {
        checkin: todayCheckin as Record<string, unknown> | null,
        trainedToday,
        reflectionToday: !!reflection,
        recoveryHabits: new Set(habitsEarnedToday()),
      }),
    [missions, todayCheckin, trainedToday, reflection],
  );
  const total = missions.length;
  const done = missions.filter((m) => completedIds.has(m.id)).length;

  return {
    isLoading: planQuery.isLoading,
    plan: planQuery.data ?? null,
    /** Today's check-in has been made (the reminders are settled, not pending). */
    checkedIn: !!todayCheckin,
    completedIds,
    done,
    total,
    refetch: () => {
      planQuery.refetch();
    },
    generate,
  };
};
