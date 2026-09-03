import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const useTodayReflection = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const date = todayISO();

  const query = useQuery({
    queryKey: ["coach-reflection", user?.id, date],
    enabled: !!user?.id,
    staleTime: 10 * 60_000,  // today's reflection won't change often
    gcTime:    24 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_reflections")
        .select("*")
        .eq("user_id", user!.id)
        .eq("reflection_date", date)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async (input: {
      energy_1to5: number;
      rpe_1to10?: number | null;
      sleep_quality_1to5?: number | null;
      mood_1to5?: number | null;
      win?: string | null;
      friction?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("upsert_reflection", {
        _reflection_date: date,
        _energy_1to5: input.energy_1to5,
        // null → undefined: omitted args fall back to the SQL default (NULL).
        _rpe_1to10: input.rpe_1to10 ?? undefined,
        _sleep_quality_1to5: input.sleep_quality_1to5 ?? undefined,
        _mood_1to5: input.mood_1to5 ?? undefined,
        _win: input.win ?? undefined,
        _friction: input.friction ?? undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-reflection", user?.id] });
      qc.invalidateQueries({ queryKey: ["coach-daily-plan"] });
      toast.success("Reflection logged");
    },
    onError: (e: any) => toast.error(friendlyError(e, "Failed to save")),
  });

  return { reflection: query.data, isLoading: query.isLoading, submit };
};
