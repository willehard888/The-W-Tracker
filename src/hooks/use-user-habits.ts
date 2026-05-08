import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserHabit {
  id: string;
  user_id: string;
  protocol_id: string;
  added_at: string;
  archived_at: string | null;
  current_streak: number;
  best_streak: number;
  level: number;
  last_logged_on: string | null;
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const useUserHabits = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const habitsQuery = useQuery({
    queryKey: ["user-habits", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,  // realtime sub handles live updates
    gcTime:    15 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_habits")
        .select("*")
        .eq("user_id", user!.id)
        .is("archived_at", null)
        .order("added_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as UserHabit[];
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`user-habits-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_habits", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["user-habits", user.id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_habit_logs", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["user-habits", user.id] });
          qc.invalidateQueries({ queryKey: ["user-habit-logs", user.id] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc]);

  const today = todayISO();
  const todayLogsQuery = useQuery({
    queryKey: ["user-habit-logs", user?.id, today],
    enabled: !!user?.id,
    staleTime: 2 * 60_000,  // logs can change when user logs a habit
    gcTime:    24 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_habit_logs")
        .select("habit_id, xp_awarded, logged_on")
        .eq("user_id", user!.id)
        .eq("logged_on", today);
      if (error) throw error;
      return (data ?? []) as { habit_id: string; xp_awarded: number; logged_on: string }[];
    },
  });

  const completedTodaySet = new Set((todayLogsQuery.data ?? []).map((l) => l.habit_id));

  const addHabit = async (protocolId: string) => {
    const { data, error } = await supabase.rpc("add_user_habit", { _protocol_id: protocolId });
    if (error) throw error;
    const r = data as any;
    if (r?.error) throw new Error(r.error);
    qc.invalidateQueries({ queryKey: ["user-habits", user?.id] });
    return r as { ok: true; habit_id: string };
  };

  const logHabit = async (habitId: string) => {
    const { data, error } = await supabase.rpc("log_habit", { _habit_id: habitId, _date: today });
    if (error) throw error;
    const r = data as any;
    if (r?.error) throw new Error(r.error);
    qc.invalidateQueries({ queryKey: ["user-habits", user?.id] });
    qc.invalidateQueries({ queryKey: ["user-habit-logs", user?.id] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    return r as { ok: true; xp_awarded: number; streak: number; level: number };
  };

  const archiveHabit = async (habitId: string) => {
    const { error } = await supabase
      .from("user_habits")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", habitId);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["user-habits", user?.id] });
  };

  return {
    isLoading: habitsQuery.isLoading,
    habits: habitsQuery.data ?? [],
    completedTodaySet,
    addHabit,
    logHabit,
    archiveHabit,
  };
};
