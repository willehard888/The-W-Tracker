import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Clock, Snowflake, Refrigerator, Search, X, Utensils, Layers,
} from "lucide-react";
import { recipeThumb, recipeSquare } from "@/lib/recipe-images";
import { fmtQty } from "@/lib/recipe-scaling";
import { Button } from "@/components/ui/button";
import { RECIPES, type Recipe } from "@/data/recipes";
import { cn } from "@/lib/utils";
import { SEGMENT_TRACK, SEGMENT_ACTIVE, SEGMENT_IDLE } from "@/components/ui/segment";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import MacroRow from "@/components/nutrition/MacroRow";

const BATCH_OPTIONS = [1, 2, 3, 4, 5] as const;

/**
 * The photo IS the card now.
 *
 * The old design led with a cream-background recipe POSTER that carried every
 * ingredient and step as pixels — unreadable at phone size, which is why the
 * detail view offered a pinch-to-zoom. All of that content is real text on this
 * screen now, so the image only has to do what an image is good at: make you
 * want to cook the thing.
 */

/** `tile` takes the 560px thumb (fifteen sit in one grid), `hero` the 1000px square. */
const RecipePhoto = ({ id, className, variant = "hero" }: { id: string; className?: string; variant?: "tile" | "hero" }) => {
  const [failed, setFailed] = useState(false);
  const src = variant === "tile" ? recipeThumb(id) ?? recipeSquare(id) : recipeSquare(id) ?? recipeThumb(id);
  if (!src || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-secondary/50", className)}>
        <Utensils size={22} className="text-gold/50" />
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
  const totalMin = recipe.prepMin + recipe.cookMin;

  return (
    <div className="flex flex-col">
      {/* Photo runs edge to edge behind a floating back button — no header bar
          competing with it for the top of a phone screen. */}
      <div className="relative">
        <RecipePhoto id={recipe.id} className="w-full aspect-[4/3]" />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
          style={{ background: "linear-gradient(to top, hsl(var(--background)), transparent)" }}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/recipes")}
          aria-label="Back to recipes"
          className="absolute left-3 top-3 rounded-full bg-background/70 backdrop-blur-sm"
        >
          <ArrowLeft size={18} />
        </Button>
      </div>

      <div className="home-rise px-4 pb-28 -mt-6 relative space-y-5">
        <div>
          <h1 className="font-display text-[26px] font-black tracking-tight leading-tight">{recipe.title}</h1>
          <p className="text-[13px] text-muted-foreground leading-snug mt-1.5">{recipe.blurb}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {recipe.tags.map((t) => (
              <span key={t} className="rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {t}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 text-[12px] font-bold text-muted-foreground ml-auto">
              <Clock size={12} /> {totalMin} min
            </span>
          </div>
        </div>

        <MacroRow nutrition={recipe.nutrition} />

        <div className="surface-card p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Layers size={12} className="text-gold" />
            <p className="eyebrow text-foreground/70">Cook in batch</p>
          </div>
          <div className={SEGMENT_TRACK}>
            {BATCH_OPTIONS.map((b) => (
              <button
                key={b}
                onClick={() => { hapticSelection(); setBatch(b); }}
                aria-pressed={batch === b}
                className={cn(
                  "flex-1 h-11 rounded-lg text-[13px] font-black tabular-nums transition-all active:scale-[0.97]",
                  batch === b ? SEGMENT_ACTIVE : SEGMENT_IDLE,
                )}
              >
                {b}×
              </button>
            ))}
          </div>
          <p className="text-[12px] text-muted-foreground mt-2.5 leading-snug">
            {batch === 1
              ? "Quantities below are for one serving."
              : `Scaled for ${batch} meals — cook once, eat all week.`}
          </p>
        </div>

        <section>
          <p className="eyebrow text-gold/85 mb-3">Ingredients</p>
          <div className="space-y-4">
            {recipe.groups.map((g) => (
              <div key={g.title}>
                <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-2">{g.title}</p>
                <ul className="space-y-1.5">
                  {g.items.map((it, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-[14px] leading-snug">
                      <span className="h-1 w-1 rounded-full bg-gold/50 shrink-0 mt-2" />
                      <span className="text-foreground/90">
                        {it.qty != null && (
                          <b className="text-gold tabular-nums">{fmtQty(it.qty, batch)}{it.unit ? ` ${it.unit}` : ""} </b>
                        )}
                        {it.item}
                        {it.note && <span className="text-muted-foreground/70"> ({it.note})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="eyebrow text-gold/85 mb-3">Method</p>
          <div className="space-y-5">
            {recipe.method.map((phase, pi) => (
              <div key={phase.title} className="flex gap-3">
                <span className="shrink-0 h-7 w-7 rounded-full bg-gold text-[13px] font-black text-primary-foreground flex items-center justify-center tabular-nums">
                  {pi + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-black uppercase tracking-wider mb-1.5">{phase.title}</p>
                  <ol className="space-y-1.5">
                    {phase.steps.map((s, i) => (
                      <li key={i} className="text-[14px] leading-relaxed text-muted-foreground">{s}</li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card surface-card-quiet p-4">
          <p className="eyebrow text-foreground/70 mb-3">Storage &amp; reheat</p>
          <div className="flex gap-2 mb-3">
            <div className="flex-1 rounded-lg bg-secondary/30 border border-border/50 p-2.5 flex items-center gap-2">
              <Refrigerator size={15} className="text-gold/80 shrink-0" />
              <div>
                <p className="text-[14px] font-black tabular-nums leading-none">{recipe.mealPrep.fridgeDays}d</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Fridge</p>
              </div>
            </div>
            {recipe.mealPrep.freezerWeeks != null && (
              <div className="flex-1 rounded-lg bg-secondary/30 border border-border/50 p-2.5 flex items-center gap-2">
                <Snowflake size={15} className="text-gold/80 shrink-0" />
                <div>
                  <p className="text-[14px] font-black tabular-nums leading-none">{recipe.mealPrep.freezerWeeks}wk</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Freezer</p>
                </div>
              </div>
            )}
          </div>
          <p className="text-[13px] text-foreground/85 leading-snug mb-2">
            <span className="font-bold text-gold">Reheat:</span> {recipe.mealPrep.reheat}
          </p>
          <ul className="space-y-1">
            {recipe.mealPrep.tips.map((t, i) => (
              <li key={i} className="text-[13px] text-muted-foreground leading-snug flex gap-1.5">
                <span className="text-gold/50 shrink-0">•</span> {t}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

/** Every tag actually present in the data — never a hand-kept list. */
const ALL_TAGS = [...new Set(RECIPES.flatMap((r) => r.tags))].sort();

const RecipeList = () => {
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
    <div className="flex flex-col">
      <div className="page-header-premium px-4 pt-3 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={18} />
        </Button>
        <h1 className="font-display text-base font-black tracking-tight">Meal-prep recipes</h1>
      </div>

      <div className="px-4 pt-3 pb-28">
        {/* Search covers ingredients too — "what can I make with salmon" is the
            question people actually arrive with. */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes or ingredients"
            aria-label="Search recipes or ingredients"
            className="w-full surface-inset rounded-xl h-11 pl-9 pr-9 text-[14px] outline-none focus:border-gold/50 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-9 flex items-center justify-center text-muted-foreground"
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

        <p className="text-[12px] text-muted-foreground mt-3 mb-2.5 px-0.5 tabular-nums">
          {results.length} {results.length === 1 ? "recipe" : "recipes"}
        </p>

        {results.length === 0 ? (
          <div className="text-center py-14">
            <Utensils size={26} className="text-gold/40 mx-auto mb-3" />
            <p className="text-[14px] font-bold">Nothing matches that</p>
            <p className="text-[12px] text-muted-foreground mt-1">Try a different ingredient, or clear the filter.</p>
          </div>
        ) : (
          <div className="home-rise home-rise-1 grid grid-cols-2 gap-3">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => { hapticImpact("light"); navigate(`/recipes/${r.id}`); }}
                className="text-left rounded-2xl overflow-hidden border border-border/60 bg-card active:scale-[0.98] transition-transform"
              >
                <RecipePhoto id={r.id} variant="tile" className="w-full aspect-square" />
                <div className="p-2.5">
                  <p className="font-display text-[13px] font-black leading-tight line-clamp-2">{r.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] font-bold">
                    <span className="text-gold tabular-nums">{r.nutrition.protein}g protein</span>
                    <span className="text-muted-foreground tabular-nums ml-auto">{r.prepMin + r.cookMin}m</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Recipes = () => {
  const { id } = useParams<{ id: string }>();
  const recipe = id ? RECIPES.find((r) => r.id === id) : undefined;
  // An unknown id falls back to the list rather than a dead end.
  return recipe ? <RecipeDetail recipe={recipe} /> : <RecipeList />;
};

export default Recipes;
