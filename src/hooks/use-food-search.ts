import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { SearchFoodRow } from "@/lib/nutrition/api-types";
import { localSearch, type LocalSearchFilter } from "@/lib/nutrition/food-cache";
import { normalizeQuery } from "@/lib/nutrition/format";
import { searchFoods } from "@/lib/nutrition/queries";
import type { Food } from "@/lib/nutrition/types";

const EMPTY_ROWS: SearchFoodRow[] = [];
const EMPTY_FOODS: Food[] = [];

function useDebouncedValue<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Debounced catalog search (≥ 2 chars, aborts superseded requests) + instant local favorites/frequent/recent matches. */
export const useFoodSearch = (query: string, opts: { country?: string; filter?: LocalSearchFilter } = {}) => {
  const { user } = useAuth();
  const uid = user?.id;
  const q = normalizeQuery(useDebouncedValue(query, 250));
  const enabled = !!uid && q.length >= 2;
  const res = useQuery({
    queryKey: ["food-search", q, opts.country ?? null, uid],
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => searchFoods(supabase, { query: q, country: opts.country, signal }),
  });
  const localResults = useMemo(() => (uid ? localSearch(uid, query, opts.filter) : EMPTY_FOODS), [uid, query, opts.filter]);
  return {
    results: enabled ? (res.data ?? EMPTY_ROWS) : EMPTY_ROWS,
    isFetching: res.isFetching,
    isSearching: normalizeQuery(query) !== q || res.isFetching,
    localResults,
    error: res.error,
  };
};
