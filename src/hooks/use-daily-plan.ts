import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime";

export type MissionKind = "primary" | "recovery" | "focus" | "habit" | "edge";
export type MissionPriority = "high" | "medium" | "low";

export interface Mission {
  id: string;
  kind: MissionKind;
  title: string;
  detail?: string;
  xp: number;
  priority: MissionPriority;
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

export interface MissionLog {
  id: string;
  daily_plan_id: string;
  mission_id: string;
  xp_awarded: number;
  completed_at: string;
}

const todayISO = () => {
  const d = new Date();
  // local YYYY-MM-DD (avoids UTC slip)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const useDailyPlan = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const date = todayISO();

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

  const logsQuery = useQuery({
    queryKey: ["coach-mission-logs", user?.id, planQuery.data?.id],
    enabled: !!user?.id && !!planQuery.data?.id,
    staleTime: 2 * 60_000,  // mission logs update frequently; realtime also refreshes
    gcTime:    10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_mission_logs")
        .select("*")
        .eq("daily_plan_id", planQuery.data!.id);
      if (error) throw error;
      return (data ?? []) as MissionLog[];
    },
  });

  // Realtime subscription so mission completion / new plan updates instantly.
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coach_mission_logs", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["coach-mission-logs", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, qc]);

  const generate = async () => {
    const { data, error } = await supabase.functions.invoke("coach-daily-plan");
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    qc.invalidateQueries({ queryKey: ["coach-daily-plan", user?.id] });
    return data;
  };

  const completeMission = async (missionId: string) => {
    if (!planQuery.data) throw new Error("No plan");
    const { data, error } = await supabase.rpc("complete_coach_mission", {
      _plan_id: planQuery.data.id,
      _mission_id: missionId,
    });
    if (error) throw error;
    const result = data as any;
    if (result?.error) throw new Error(result.error);
    qc.invalidateQueries({ queryKey: ["coach-mission-logs", user?.id] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    return result as { ok: true; xp_awarded: number; new_xp: number };
  };

  const completedIds = new Set((logsQuery.data ?? []).map((l) => l.mission_id));
  const total = planQuery.data?.missions.length ?? 0;
  const done = (planQuery.data?.missions ?? []).filter((m) => completedIds.has(m.id)).length;

  return {
    isLoading: planQuery.isLoading,
    plan: planQuery.data ?? null,
    logs: logsQuery.data ?? [],
    completedIds,
    done,
    total,
    refetch: () => {
      planQuery.refetch();
      logsQuery.refetch();
    },
    generate,
    completeMission,
  };
};
