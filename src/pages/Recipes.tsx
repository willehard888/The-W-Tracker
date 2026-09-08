import { Input } from "@/components/ui/input";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";
import { backOr } from "@/lib/nav";
import { Search, X, Utensils } from "lucide-react";
import { recipeThumb, recipeSquare } from "@/lib/recipe-images";
import { fmtQty } from "@/lib/recipe-scaling";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";
import EmptyState from "@/components/ui/empty-state";
import { FactRow } from "@/components/coach/rows";
import { RECIPES, type Recipe } from "@/data/recipes";
import { cn } from "@/lib/utils";
import { SEGMENT_TRACK, SEGMENT_ACTIVE, SEGMENT_IDLE } from "@/components/ui/segment";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import MacroRow from "@/components/nutrition/MacroRow";

const BATCH_OPTIONS = [1, 2, 3, 4, 5] as const;

/**
 * /recipes — what to cook tonight. The list is a beat, a search and hairline
 * rows with the photo as the only picture; the detail is the photo, the
 * protein number, then the recipe as prose. Everything the poster used to
 * bake into pixels is real text here.
 */

/** `tile` takes the 560px thumb (fifteen sit in one list), `hero` the 1000px square. */
const RecipePhoto = ({ id, className, variant = "hero" }: { id: string; className?: string; variant?: "tile" | "hero" }) => {
  const [failed, setFailed] = useState(false);
  const src = variant === "tile" ? recipeThumb(id) ?? recipeSquare(id) : recipeSquare(id) ?? recipeThumb(id);
  if (!src || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-secondary/50", className)}>
        <Utensils size={22} className="text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
};

const RecipeDetail = ({ recipe }: { recipe: Recipe }) => {
  const navigate = useNavigate();
  const [batch, setBatch] = useState(1);
  // The pop belongs to a choice, not to the mount.
  const [touched, setTouched] = useState(false);
  const totalMin = recipe.prepMin + recipe.cookMin;

  return (
    <div className="min-h-full">
      <PageBar onBack={() => backOr(navigate, "/recipes")} />
      {/* Photo runs edge to edge under the bar; the fade hands off to the copy. */}
      <div className="relative">
        <RecipePhoto id={recipe.id} className="w-full aspect-[4/3]" />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
          style={{ background: "linear-gradient(to top, hsl(var(--background)), transparent)" }}
        />
      </div>

      <div className="px-4 pb-6 -mt-6 relative">
        <header className="home-rise">
          <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">{recipe.title}</h1>
          <p className="mt-2 text-[13px] text-muted-foreground leading-snug">{recipe.blurb}</p>
          <p className="mt-2 text-[12px] font-bold text-muted-foreground tabular-nums">
            {[...recipe.tags, `${totalMin} min`].join(" · ")}
          </p>
        </header>

        <div className="home-rise home-rise-1 mt-5">
          <MacroRow nutrition={recipe.nutrition} />
        </div>

        <div className="home-rise home-rise-2 mt-5">
          <p className="text-[11px] font-bold text-muted-foreground mb-2">Cook in batch</p>
          <div className={SEGMENT_TRACK}>
            {BATCH_OPTIONS.map((b) => (
              <button
                key={b}
                onClick={() => { hapticSelection(); setBatch(b); setTouched(true); }}
                aria-pressed={batch === b}
                className={cn(
                  "flex-1 h-11 rounded-lg text-[13px] font-black tabular-nums transition-colors",
                  batch === b ? SEGMENT_ACTIVE : SEGMENT_IDLE,
                )}
              >
                {b}×
              </button>
            ))}
          </div>
          <p key={batch} className={cn("origin-left mt-2 text-[12px] text-muted-foreground leading-snug", touched && "commit-pop")}>
            {batch === 1
              ? "Quantities below are for one serving."
              : `Scaled for ${batch} meals — cook once, eat all week.`}
          </p>
        </div>

        <section className="home-rise home-rise-3 mt-7">
          <h2 className="font-display font-black text-[17px] leading-tight tracking-tight">Ingredients</h2>
          {recipe.groups.map((g) => (
            <div key={g.title} className="mt-3.5">
              <p className="text-[11px] font-bold text-muted-foreground mb-1.5">{g.title}</p>
              <ul className="divide-y divide-border/35 border-t border-border/35">
                {g.items.map((it, i) => (
                  <li key={i} className="flex items-baseline gap-3 py-2 text-[14px] leading-snug">
                    <span className="w-16 shrink-0 font-semibold tabular-nums">
                      {it.qty != null ? `${fmtQty(it.qty, batch)}${it.unit ? ` ${it.unit}` : ""}` : ""}
                    </span>
                    <span className="min-w-0 text-foreground/90">
                      {it.item}
                      {it.note && <span className="text-muted-foreground/70"> ({it.note})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="home-rise home-rise-4 mt-7">
          <h2 className="font-display font-black text-[17px] leading-tight tracking-tight">Method</h2>
          <div className="mt-1 divide-y divide-border/35">
            {recipe.method.map((phase, pi) => (
              <div key={phase.title} className="py-3.5 flex gap-3">
                <span className="w-5 shrink-0 text-[14px] font-bold tabular-nums text-muted-foreground">{pi + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold leading-snug">{phase.title}</p>
                  <ol className="mt-1.5 space-y-1.5">
                    {phase.steps.map((s, i) => (
                      <li key={i} className="text-[14px] leading-relaxed text-muted-foreground">{s}</li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="home-rise home-rise-5 mt-7">
          <h2 className="font-display font-black text-[17px] leading-tight tracking-tight">Keeps</h2>
          <div className="mt-1 divide-y divide-border/35">
            <FactRow k="Fridge" v={`${recipe.mealPrep.fridgeDays} days`} />
            {recipe.mealPrep.freezerWeeks != null && (
              <FactRow k="Freezer" v={`${recipe.mealPrep.freezerWeeks} weeks`} />
            )}
            <FactRow k="Reheat" v={recipe.mealPrep.reheat} />
            {recipe.mealPrep.tips.length > 0 && <FactRow k="Tips" v={recipe.mealPrep.tips.join(" ")} />}
          </div>
        </section>
      </div>
    </div>
  );
};

/** Every tag actually present in the data — never a hand-kept list. */
const ALL_TAGS = [...new Set(RECIPES.flatMap((r) => r.tags))].sort();

const RecipeList = ({ onOpen }: { onOpen: () => void }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return RECIPES.filter((r) => {
      if (tag && !r.tags.includes(tag)) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q) ||
        r.groups.some((g) => g.items.some((it) => it.item.toLowerCase().includes(q)))
      );
    });
  }, [query, tag]);

  return (
    <div className="min-h-full">
      <PageBar title="Recipes" onBack={() => backOr(navigate, "/")} />

      <div className="px-4 pt-4 pb-6">
        <header className="home-rise">
          <h2 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">What to cook tonight.</h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground leading-snug">
            Every recipe scales to a week of meals. Search by what's in the fridge.
          </p>
        </header>

        {/* Search covers ingredients too — "what can I make with salmon" is the
            question people actually arrive with. */}
        <div className="home-rise home-rise-1 mt-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes or ingredients"
              aria-label="Search recipes or ingredients"
              className="h-11 rounded-xl pl-9 pr-9 text-[14px]"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2 before:absolute before:-inset-x-1 before:inset-y-0 before:content-[''] h-11 w-9 flex items-center justify-center text-muted-foreground"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-2.5 -mx-4 px-4 pb-0.5">
            {ALL_TAGS.map((t) => (
              <Button
                key={t}
                size="pill"
                variant={tag === t ? "gold-outline" : "outline"}
                onClick={() => { hapticSelection(); setTag(tag === t ? null : t); }}
                aria-pressed={tag === t}
                className="shrink-0"
              >
                {t}
              </Button>
            ))}
          </div>
        </div>

        <div className="home-rise home-rise-2 mt-5">
          <p className="text-[11px] font-bold text-muted-foreground tabular-nums">
            {results.length} {results.length === 1 ? "recipe" : "recipes"}
          </p>

          {results.length === 0 ? (
            <EmptyState
              size="compact"
              title="Nothing matches that"
              description="Try a different ingredient, or clear the filter."
            />
          ) : (
            <ul className="mt-1.5 divide-y divide-border/35 border-t border-border/35">
              {results.map((r, i) => (
                // Entrance on the wrapper: the keyframe pins transform, which would kill the row's press.
                <li key={r.id} className={cn(i < 8 && "animate-fade-in-up")} style={i < 8 ? { animationDelay: `${140 + i * 40}ms` } : undefined}>
                  <button
                    type="button"
                    onClick={() => { hapticImpact("light"); onOpen(); navigate(`/recipes/${r.id}`); }}
                    className="w-full min-h-11 flex items-center gap-3 py-2.5 text-left"
                  >
                    <RecipePhoto id={r.id} variant="tile" className="h-14 w-14 shrink-0 rounded-xl" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[15px] font-black leading-tight truncate">{r.title}</span>
                      <span className="block mt-0.5 text-[12px] text-muted-foreground tabular-nums">
                        {r.nutrition.protein}g protein · {r.prepMin + r.cookMin} min
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const Recipes = () => {
  const { id } = useParams<{ id: string }>();
  const scroller = useScrollContainer();
  const [opened, setOpened] = useState(false);
  const listScroll = useRef(0);
  // An unknown id falls back to the list rather than a dead end.
  const recipe = id ? RECIPES.find((r) => r.id === id) : undefined;
  // The list stays mounted under the detail, so search, filter and scroll
  // survive the hop; `entrance-done` keeps it from replaying its entrance.
  useLayoutEffect(() => {
    scroller?.current?.scrollTo(0, recipe ? 0 : listScroll.current);
  }, [recipe, scroller]);
  return (
    <>
      {recipe && <RecipeDetail recipe={recipe} />}
      <div className={cn(opened && "entrance-done")} hidden={!!recipe}>
        <RecipeList onOpen={() => { listScroll.current = scroller?.current?.scrollTop ?? 0; setOpened(true); }} />
      </div>
    </>
  );
};

export default Recipes;
