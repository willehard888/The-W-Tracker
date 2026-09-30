import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { track, FUNNEL } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { localDateKey } from "@/lib/date";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";
import { errorCategory, friendlyError, isOurFault } from "@/lib/error-copy";
import { captureException } from "@/lib/observability";


export const useTodayReflection = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const date = localDateKey();

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
    onSuccess: (_data, input) => {
      // Whether the optional boxes were used, never a word of what was written
      // in them. The feature looked unused for months because nothing counted it.
      void track(FUNNEL.reflectionSubmitted, {
        date,
        has_win: !!input.win,
        has_friction: !!input.friction,
        has_rpe: input.rpe_1to10 != null,
      });
      qc.invalidateQueries({ queryKey: ["coach-reflection", user?.id] });
      qc.invalidateQueries({ queryKey: ["coach-daily-plan"] });
      toast.success("Reflection logged");
    },
    onError: (e: unknown) => {
      // The toast used to be the only trace: "Connection hiccup. Try again."
      // on a phone, and a console line nobody was holding. A transport failure
      // on a train is not a defect, but a constraint violation or a missing
      // function is ours and was invisible.
      const category = errorCategory(e);
      if (isOurFault(category)) captureException(e, { where: "reflection.upsert", category });
      toast.error(
        category === "auth"
          ? "Your session expired — sign in and try again."
          : friendlyError(e, "Couldn't save that. Your answers are still here — try again."),
      );
    },
  });

  return { reflection: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch, submit };
};
