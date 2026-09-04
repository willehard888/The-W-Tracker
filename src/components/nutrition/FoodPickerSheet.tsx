import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import NutritionSheet from "@/components/nutrition/NutritionSheet";
import FoodSearchPanel, { type OnlineState, type SearchFilter } from "@/components/nutrition/FoodSearchPanel";
import type { FoodResultView } from "@/components/nutrition/FoodResultRow";
import { useFoodFavorites } from "@/hooks/use-food-favorites";
import { useFoodSearch } from "@/hooks/use-food-search";
import { searchOnline } from "@/lib/nutrition/queries";

/**
 * Search-only picker for the recipe builder and the photo review: the user
 * taps a catalog food and the caller decides what to do with its id. No
 * portion step here, no diary write, and recipes are hidden because both
 * callers need a `food_id`.
 */
const FoodPickerSheet = ({
  open,
  onClose,
  onPick,
  title = "Pick a food",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (food: FoodResultView) => void;
  title?: string;
}) => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [online, setOnline] = useState<OnlineState>("idle");
  const favorites = useFoodFavorites();
  const search = useFoodSearch(query, { filter });

  const localResults: FoodResultView[] = search.localResults.map((f) => ({
    id: f.id,
    name: f.name,
    brand: f.brand,
    kcal: f.per100g.kcal,
    protein: f.per100g.protein_g,
    source: f.source,
    isFavorite: favorites.ids.has(f.id),
  }));
  const results: FoodResultView[] = search.results
    .filter((r) => r.kind === "food")
    .map((r) => ({ id: r.id, name: r.name, brand: r.brand, kcal: r.kcal, protein: r.protein_g, source: r.source, isFavorite: favorites.ids.has(r.id) }));

  const pick = (f: FoodResultView) => {
    onPick(f);
    setQuery("");
    setOnline("idle");
  };

  const searchTheWeb = async () => {
    setOnline("loading");
    const r = await searchOnline(supabase, { query });
    setOnline(r.status === "rate_limited" ? "rate_limited" : r.status === "error" || r.status === "membership_required" ? "error" : "done");
    qc.invalidateQueries({ queryKey: ["food-search"] });
  };

  return (
    <NutritionSheet open={open} onClose={onClose} title={title} label={title}>
      <FoodSearchPanel
        query={query}
        onQueryChange={(q) => {
          setQuery(q);
          setOnline("idle");
        }}
        filter={filter}
        onFilterChange={setFilter}
        localResults={localResults}
        results={results}
        loading={search.isSearching}
        onlineState={online}
        onPick={pick}
        onToggleFavorite={(f) => favorites.toggle(f.id)}
        barcodeSupported={false}
        onCreateFood={() => navigate(`/nutrition/foods/new?name=${encodeURIComponent(query.trim())}`)}
        onSearchOnline={searchTheWeb}
      />
    </NutritionSheet>
  );
};

export default FoodPickerSheet;
