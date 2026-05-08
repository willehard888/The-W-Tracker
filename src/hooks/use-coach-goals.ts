import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CoachGoal {
  id: string;
  user_id: string;
  title: string;
  metric: string;
  unit: string;
  baseline_value: number | null;
  current_value: number | null;
  target_value: number;
  deadline: string | null;
  weekly_milestone: number | null;
  status: "active" | "paused" | "achieved" | "abandoned";
  created_at: string;
  updated_at: string;
}

export const useCoachGoals = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["coach-goals", user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60_000,
    gcTime:    30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_goals" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("status", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CoachGoal[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (patch: Partial<CoachGoal>) => {
      const { data, error } = await supabase.rpc("upsert_goal" as any, { _patch: patch as any });
      if (error) throw error;
      return data as CoachGoal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-goals", user?.id] }),
  });

  const updateProgress = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { data, error } = await supabase.rpc("update_goal_progress" as any, {
        _goal_id: id, _new_value: value,
      });
      if (error) throw error;
      return data as CoachGoal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-goals", user?.id] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coach_goals" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-goals", user?.id] }),
  });

  return {
    goals: query.data ?? [],
    activeGoal: (query.data ?? []).find((g) => g.status === "active") ?? null,
    isLoading: query.isLoading,
    upsert: upsert.mutateAsync,
    updateProgress: updateProgress.mutateAsync,
    remove: remove.mutateAsync,
  };
};
