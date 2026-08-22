import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Clock, Snowflake, Refrigerator,
  ChevronRight, Utensils, Layers, Leaf, Maximize2,
} from "lucide-react";
import PosterZoom from "@/components/recipes/PosterZoom";
import { recipeThumb, recipePoster, recipeSquare } from "@/lib/recipe-images";
import { fmtQty } from "@/lib/recipe-scaling";
import { Button } from "@/components/ui/button";
import { RECIPES, type Recipe } from "@/data/recipes";
import { cn } from "@/lib/utils";
import { SEGMENT_ACTIVE, SEGMENT_IDLE } from "@/components/ui/segment";
import { hapticImpact, hapticSelection } from "@/lib/haptics";

const BATCH_OPTIONS = [1, 2, 3, 4, 5] as const;

// Recipe list sections — savoury mains first, then breakfast & sweet.
const SECTIONS = [
  { key: "main", label: "Mains" },
  { key: "sweet", label: "Breakfast & sweet" },
] as const;

// Recipe images are bundled + pre-optimized locally — see src/lib/recipe-images.ts.
// (Supabase image transforms aren't enabled on this plan, so the storage
// originals were ~2MB PNGs; the bundled JPEGs load ~30× faster from the CDN.)

const RecipeImage = ({ id, className }: { id: string; className?: string }) => {
  const src = recipePoster(id);
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};


const RecipeDetail = ({ recipe, onBack }: { recipe: Recipe; onBack: () => void }) => {
  const [batch, setBatch] = useState(1);
  const [zoomed, setZoomed] = useState(false);
  const posterUrl = recipePoster(recipe.id) ?? "";

  return (
    <div className="flex flex-col">
      <div className="page-header-premium px-4 pt-3 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
        </Button>
        <h1 className="font-display text-base font-black tracking-tight truncate">{recipe.title}</h1>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-3">
        {/* The poster IS the recipe. Clean, flat frame; tap to read it large. */}
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="block w-full rounded-2xl overflow-hidden border border-border/60 relative aspect-[2/3] bg-card active:scale-[0.99] transition-transform"
        >
          {/* Fallback (shown only if the poster image is missing) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Utensils size={32} className="text-gold" />
            <h2 className="font-display text-2xl font-black tracking-tight leading-tight text-foreground">{recipe.title}</h2>
            <p className="text-[12px] text-muted-foreground leading-snug">{recipe.blurb}</p>
          </div>
          <RecipeImage id={recipe.id} className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-md bg-black/45 backdrop-blur-sm px-2 py-1 text-[10px] font-semibold tracking-wide text-white/85">
            <Maximize2 size={10} /> Enlarge
          </span>
        </button>

        {/* MEAL PREP — batch scaler (the one thing the poster can't do) */}
        <div className="surface-card p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Layers size={12} className="text-gold" />
            <p className="eyebrow text-foreground/70">Meal prep — cook in batch</p>
          </div>
          <div className="flex gap-1.5">
            {BATCH_OPTIONS.map((b) => (
              <button
                key={b}
                onClick={() => { hapticSelection(); setBatch(b); }}
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-[13px] font-black tabular-nums transition-all active:scale-[0.97] border",
                  batch === b
                    ? cn(SEGMENT_ACTIVE, "border-transparent")
                    : cn("bg-secondary/40 border-border/50", SEGMENT_IDLE),
                )}
              >
                {b}×
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2.5 leading-snug">
            {batch === 1
              ? "Single serving — full quantities are on the poster. Tap 2×–5× for a batch shopping list."
              : `Shopping list scaled for ${batch} meals — cook once, eat all week.`}
          </p>
        </div>

        {/* Scaled shopping list — only when batching (poster covers the 1× case) */}
        {batch > 1 && (
          <div className="surface-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Leaf size={13} className="text-gold" />
              <p className="eyebrow text-foreground/70">Shopping list</p>
              <span className="ml-auto text-[11px] font-black text-gold tabular-nums">{batch}×</span>
            </div>
            <div className="space-y-3">
              {recipe.groups.map((g) => (
                <div key={g.title}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-foreground/60 mb-1.5">{g.title}</p>
                  <ul className="space-y-1">
                    {g.items.map((it, i) => (
                      <li key={i} className="flex items-baseline gap-2 text-[12px]">
                        <span className="h-1 w-1 rounded-full bg-gold/50 shrink-0 mt-1.5" />
                        <span className="text-foreground/85">
                          {it.qty != null && (
                            <b className="text-gold tabular-nums">{fmtQty(it.qty, batch)}{it.unit ? ` ${it.unit}` : ""} </b>
                          )}
                          {it.item}
                          {it.note && <span className="text-muted-foreground/60"> ({it.note})</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Storage / reheat — same calm palette (no competing accent colour) */}
        <div className="surface-card p-4">
          <p className="eyebrow text-foreground/70 mb-3">Storage & reheat</p>
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
          <p className="text-[12px] text-foreground/85 leading-snug mb-2">
            <span className="font-bold text-gold">Reheat:</span> {recipe.mealPrep.reheat}
          </p>
          <ul className="space-y-1">
            {recipe.mealPrep.tips.map((t, i) => (
              <li key={i} className="text-[11px] text-muted-foreground leading-snug flex gap-1.5">
                <span className="text-gold/50 shrink-0">•</span> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Full-screen poster zoom — pinch / double-tap / +- buttons to read the
          small poster text; close is always reachable. */}
      {zoomed && (
        <PosterZoom url={posterUrl} alt={recipe.title} onClose={() => setZoomed(false)} />
      )}
    </div>
  );
};

const Recipes = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Recipe | null>(null);

  if (selected) {
    return <RecipeDetail recipe={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="flex flex-col">
      <div className="page-header-premium px-4 pt-3 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={18} />
        </Button>
        <h1 className="font-display text-base font-black tracking-tight">Meal-prep recipes</h1>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-6">
        <p className="text-[12px] text-muted-foreground leading-snug px-1">
          Real-food, high-protein recipes built to batch. Tap any recipe, pick how many meals,
          and the ingredients scale automatically.
        </p>

        {SECTIONS.map((sec) => {
          const items = RECIPES.filter((r) =>
            sec.key === "sweet" ? r.category === "sweet" : r.category !== "sweet",
          );
          if (items.length === 0) return null;
          return (
            <div key={sec.key}>
              <div className="flex items-baseline gap-2 mb-2.5 px-1">
                <p className="eyebrow text-gold/80">{sec.label}</p>
                <span className="text-[10px] font-bold text-muted-foreground/50 tabular-nums">{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { hapticImpact("light"); setSelected(r); }}
                    className="w-full text-left rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.05] via-card/95 to-card p-4 active:scale-[0.99] transition-transform"
                  >
                    <div className="flex items-start gap-3">
                      {/* Thumbnail: a DEDICATED square food crop (cut from the
                          branded card's photo region at build time) — the old
                          CSS pan/zoom over the full 2:3 card showed an awkward
                          off-center slice. Gold gradient + icon = missing-image
                          fallback. */}
                      <div className="h-16 w-16 rounded-xl overflow-hidden bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shrink-0 relative border border-border/40">
                        <Utensils size={18} className="text-[hsl(260_18%_4%)]" strokeWidth={2.4} />
                        <div
                          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                          style={{
                            backgroundImage: `url(${recipeSquare(r.id) ?? recipeThumb(r.id)})`,
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-[15px] font-black leading-tight">{r.title}</p>
                        <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{r.subtitle}</p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] font-bold text-muted-foreground">
                          <span className="text-gold tabular-nums">{r.nutrition.calories} kcal</span>
                          <span className="tabular-nums">{r.nutrition.protein}g protein</span>
                          <span className="inline-flex items-center gap-0.5"><Clock size={11} /> {r.prepMin + r.cookMin}m</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gold/60 shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Recipes;
