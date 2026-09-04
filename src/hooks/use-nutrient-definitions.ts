import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchNutrientDefinitions, type NutrientDefinition } from "@/lib/nutrition/queries";

const EMPTY: NutrientDefinition[] = [];

/** The nutrient catalog (labels/units by key), fetched once per session and kept forever. */
export const useNutrientDefinitions = () => {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["nutrient-definitions", user?.id],
    enabled: !!user?.id,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: () => fetchNutrientDefinitions(supabase),
  });
  const defs = q.data ?? EMPTY;
  const byKey = useMemo(() => new Map(defs.map((d) => [d.key, d])), [defs]);
  return { defs, byKey, isLoading: q.isLoading, error: q.error };
};
