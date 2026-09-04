import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyError } from "@/lib/error-copy";
import { localDateStr } from "@/lib/offline-checkin";
import { withNetworkRetry } from "@/lib/retry";
import type { NutritionTargetsRow } from "@/lib/nutrition/api-types";
import { fetchTargets, upsertTargets, type TargetsPatch } from "@/lib/nutrition/queries";

/** The targets in effect today + an optimistic `save(patch)` through upsert_nutrition_targets. */
export const useNutritionTargets = () => {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const key = ["nutrition-targets", uid];

  const q = useQuery({
    queryKey: key,
    enabled: !!uid,
    staleTime: 5 * 60_000,
    queryFn: () => (uid ? fetchTargets(supabase, uid, localDateStr()) : null),
  });

  const m = useMutation({
    mutationFn: (patch: TargetsPatch) => withNetworkRetry(() => upsertTargets(supabase, patch)),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<NutritionTargetsRow | null>(key);
      if (previous) qc.setQueryData<NutritionTargetsRow | null>(key, { ...previous, ...patch });
      return { previous };
    },
    onError: (e, _patch, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(key, ctx.previous);
      toast.error(friendlyError(e));
    },
    onSuccess: (row) => {
      qc.setQueryData(key, row);
      toast.success("Targets set");
      qc.invalidateQueries({ queryKey: ["nutrition-targets"] });
      qc.invalidateQueries({ queryKey: ["nutrition-totals"] });
    },
  });

  return { targets: q.data ?? null, isLoading: q.isLoading, error: q.error, save: m.mutateAsync, saving: m.isPending };
};
