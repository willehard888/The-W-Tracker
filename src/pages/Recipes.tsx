import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Clock, Snowflake, Refrigerator,
  ChevronRight, Utensils, Layers, Leaf, Maximize2,
} from "lucide-react";
import PosterZoom from "@/components/recipes/PosterZoom";
import { Button } from "@/components/ui/button";
import { RECIPES, type Recipe } from "@/data/recipes";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticSelection } from "@/lib/haptics";

const BATCH_OPTIONS = [1, 2, 3, 4, 5] as const;

// Poster images live in a public Storage bucket, named by recipe id (slug):
// e.g. recipe-images/greek-chicken-bowl.jpg. Upload the 5 posters there and
// they appear as headers automatically; until then a gold gradient shows.
const RECIPE_IMG_BASE =
  "https://gcwuvijcuzhunkcauzom.supabase.co/storage/v1/object/public/recipe-images/";

// Try common extensions in order so whatever format the poster is uploaded as
// (named by slug) just works: greek-chicken-bowl.jpg / .png / .jpeg / .webp.
const IMG_EXTS = ["jpg", "png", "jpeg", "webp"] as const;

const RecipeImage = ({ id, className }: { id: string; className?: string }) => {
  const [extIdx, setExtIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={`${RECIPE_IMG_BASE}${id}.${IMG_EXTS[extIdx]}`}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => {
        if (extIdx < IMG_EXTS.length - 1) setExtIdx(extIdx + 1);
        else setFailed(true);
      }}
      className={className}
    />
  );
};

// Scale a base (1-serving) quantity by the batch size and format cleanly.
const fmtQty = (qty: number | undefined, batch: number) => {
  if (qty == null) return "";
  const v = Math.round(qty * batch * 100) / 100;
  return String(v);
};

const RecipeDetail = ({ recipe, onBack }: { recipe: Recipe; onBack: () => void }) => {
  const [batch, setBatch] = useState(1);
  const [zoomed, setZoomed] = useState(false);
  const posterUrl = `${RECIPE_IMG_BASE}${recipe.id}.png`;

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
          <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-md bg-black/45 backdrop-blur-sm px-2 py-1 text-[9.5px] font-semibold tracking-wide text-white/85">
            <Maximize2 size={10} /> Enlarge
          </span>
        </button>

        {/* MEAL PREP — batch scaler (the one thing the poster can't do) */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Layers size={12} className="text-gold" />
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-foreground/70">Meal prep — cook in batch</p>
          </div>
          <div className="flex gap-1.5">
            {BATCH_OPTIONS.map((b) => (
              <button
                key={b}
                onClick={() => { hapticSelection(); setBatch(b); }}
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-[13px] font-black tabular-nums transition-all active:scale-[0.97] border",
                  batch === b
                    ? "bg-gold text-primary-foreground border-transparent"
                    : "bg-secondary/40 border-border/50 text-foreground/60",
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
          <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Leaf size={13} className="text-gold" />
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-foreground/70">Shopping list</p>
              <span className="ml-auto text-[11px] font-black text-gold tabular-nums">{batch}×</span>
            </div>
            <div className="space-y-3">
              {recipe.groups.map((g) => (
                <div key={g.title}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-foreground/60 mb-1.5">{g.title}</p>
                  <ul className="space-y-1">
                    {g.items.map((it, i) => (
                      <li key={i} className="flex items-baseline gap-2 text-[12.5px]">
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
        <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-foreground/70 mb-3">Storage & reheat</p>
          <div className="flex gap-2 mb-3">
            <div className="flex-1 rounded-lg bg-secondary/30 border border-border/50 p-2.5 flex items-center gap-2">
              <Refrigerator size={15} className="text-gold/80 shrink-0" />
              <div>
                <p className="text-[14px] font-black tabular-nums leading-none">{recipe.mealPrep.fridgeDays}d</p>
                <p className="text-[8.5px] uppercase tracking-wider text-muted-foreground mt-0.5">Fridge</p>
              </div>
            </div>
            {recipe.mealPrep.freezerWeeks != null && (
              <div className="flex-1 rounded-lg bg-secondary/30 border border-border/50 p-2.5 flex items-center gap-2">
                <Snowflake size={15} className="text-gold/80 shrink-0" />
                <div>
                  <p className="text-[14px] font-black tabular-nums leading-none">{recipe.mealPrep.freezerWeeks}wk</p>
                  <p className="text-[8.5px] uppercase tracking-wider text-muted-foreground mt-0.5">Freezer</p>
                </div>
              </div>
            )}
          </div>
          <p className="text-[12px] text-foreground/85 leading-snug mb-2">
            <span className="font-bold text-gold">Reheat:</span> {recipe.mealPrep.reheat}
          </p>
          <ul className="space-y-1">
            {recipe.mealPrep.tips.map((t, i) => (
              <li key={i} className="text-[11.5px] text-muted-foreground leading-snug flex gap-1.5">
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

      <div className="px-4 pt-4 pb-28 space-y-3">
        <p className="text-[12px] text-muted-foreground leading-snug px-1">
          Real-food, high-protein recipes built to batch. Tap any recipe, pick how many meals,
          and the ingredients scale automatically.
        </p>

        {RECIPES.map((r) => (
          <button
            key={r.id}
            onClick={() => { hapticImpact("light"); setSelected(r); }}
            className="w-full text-left rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.05] via-card/95 to-card p-4 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-start gap-3">
              {/* Thumbnail: crop tight to just the food bowl, which sits in the
                  top-right of every poster (~x48-97% · y4-37%). background-size +
                  background-position pans/zooms to it reliably. Gold gradient +
                  icon show through if the poster image is missing. */}
              <div className="h-14 w-14 rounded-xl overflow-hidden bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shrink-0 relative">
                <Utensils size={18} className="text-[hsl(260_18%_4%)]" strokeWidth={2.4} />
                <div
                  className="absolute inset-0 bg-no-repeat"
                  style={{
                    backgroundImage: `url(${RECIPE_IMG_BASE}${r.id}.png)`,
                    backgroundSize: "204%",
                    backgroundPosition: "95% 6%",
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-[15px] font-black leading-tight">{r.title}</p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{r.subtitle}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-muted-foreground">
                  <span className="text-gold tabular-nums">{r.nutrition.calories} kcal</span>
                  <span className="tabular-nums">{r.nutrition.protein}g protein</span>
                  <span className="inline-flex items-center gap-0.5"><Clock size={10} /> {r.prepMin + r.cookMin}m</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-gold/60 shrink-0 mt-1" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Recipes;
