import { backOr } from "@/lib/nav";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { ChefHat, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Block } from "@/components/skeletons/PageSkeleton";
import { supabase } from "@/integrations/supabase/client";
import PageBar from "@/components/ui/page-bar";
import { useUserRecipes } from "@/hooks/use-user-recipes";
import { fmtQty } from "@/lib/nutrition/format";
import { recipePerServing } from "@/lib/nutrition/queries";
import { DoorRow } from "@/components/coach/rows";

/**
 * Foods made of foods. One hairline row per recipe — name, servings, and
 * what one serving costs — so the list reads like the diary it feeds.
 * Per-serving numbers come from the server's own computation.
 */
const NutritionRecipes = () => {
  const navigate = useNavigate();
  const { recipes, isLoading, error, refetch } = useUserRecipes();
  const perServing = useQueries({
    queries: recipes.map((r) => ({
      queryKey: ["recipe-per-serving", r.id, r.updated_at],
      staleTime: 5 * 60_000,
      queryFn: () => recipePerServing(supabase, r.id),
    })),
  });

  const newRecipe = () => navigate("/nutrition/recipes/new");
  const action = (
    <Button variant="ghost" size="sm" className="min-h-11" onClick={newRecipe}>
      <Plus aria-hidden /> New
    </Button>
  );

  if (isLoading) {
    return (
      <div className="min-h-full">
        <PageBar title="Recipes" onBack={() => backOr(navigate, "/nutrition")} action={action} />
        <div className="px-4 pt-4 pb-8">
          <Block height={28} className="w-2/3 !rounded-lg" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Block key={i} height={60} delay={40 + i * 40} className="mt-3" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <PageBar title="Recipes" onBack={() => backOr(navigate, "/nutrition")} action={action} />
      <div className="px-4 pt-4 pb-6">
        {error && recipes.length === 0 ? (
          <div className="home-rise pt-6">
            <ErrorState title="Couldn't load your recipes" onRetry={refetch} />
          </div>
        ) : recipes.length === 0 ? (
          <div className="home-rise pt-6">
            <EmptyState
              icon={ChefHat}
              title="No recipes yet"
              description="Build a dish once from its ingredients, then log it in servings."
              action={<Button onClick={newRecipe}>Create a recipe</Button>}
            />
          </div>
        ) : (
          <>
            <div className="home-rise">
              <h2 className="h-page">
                {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"} ready to log.
              </h2>
            </div>
            <div className="home-rise home-rise-1 mt-4 divide-y divide-border/35">
              {recipes.map((r, i) => {
                const ps = perServing[i]?.data;
                const stats = ps
                  ? `${Math.round(ps.kcal ?? 0)} kcal · ${Math.round(ps.protein_g ?? 0)} g protein`
                  : perServing[i]?.isError
                    ? "nutrition unavailable"
                    : "…";
                return (
                  <DoorRow
                    key={r.id}
                    onClick={() => navigate(`/nutrition/recipes/${r.id}`)}
                    label={r.name}
                    sub={<span className="tabular-nums">{fmtQty(r.servings)} {r.servings === 1 ? "serving" : "servings"} · per serving {stats}</span>}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NutritionRecipes;
