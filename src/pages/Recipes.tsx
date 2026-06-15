import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Clock, Flame, Beef, Snowflake, Refrigerator,
  ChevronRight, Utensils, Layers,
} from "lucide-react";
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
  const n = recipe.nutrition;

  return (
    <div className="flex flex-col">
      <div className="page-header-premium px-4 pt-3 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
        </Button>
        <h1 className="font-display text-base font-black tracking-tight truncate">{recipe.title}</h1>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">
        {/* Hero — poster image header (gradient fallback), title overlaid */}
        <div className="rounded-3xl overflow-hidden border border-gold/25">
          <div className="relative aspect-[16/10] bg-gradient-to-br from-gold/25 via-card to-card">
            <RecipeImage id={recipe.id} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {recipe.tags.map((t) => (
                  <span key={t} className="text-[9px] font-black uppercase tracking-[0.18em] text-gold bg-black/40 backdrop-blur-sm border border-gold/30 rounded-full px-2 py-0.5">
                    {t}
                  </span>
                ))}
              </div>
              <h2 className="font-display text-2xl font-black tracking-tight leading-tight text-white drop-shadow">{recipe.title}</h2>
            </div>
          </div>
          <div className="bg-card p-4">
            <p className="text-[12.5px] text-muted-foreground leading-snug">{recipe.blurb}</p>
            <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground font-semibold">
              <span className="inline-flex items-center gap-1"><Clock size={12} className="text-gold" /> {recipe.prepMin}m prep</span>
              <span className="inline-flex items-center gap-1"><Utensils size={12} className="text-gold" /> {recipe.cookMin}m cook</span>
            </div>
          </div>
        </div>

        {/* Nutrition (per serving) */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Flame, label: "Kcal", value: n.calories },
            { icon: Beef, label: "Protein", value: `${n.protein}g` },
            { icon: Layers, label: "Carbs", value: `${n.carbs}g` },
            { icon: Flame, label: "Fat", value: `${n.fat}g` },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-card/40 px-2 py-2.5 text-center">
              <p className="font-display text-[15px] font-black tabular-nums text-gold leading-none">{s.value}</p>
              <p className="text-[8.5px] font-black uppercase tracking-wider text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/70 text-center -mt-2">Per serving</p>

        {/* MEAL PREP — batch scaler */}
        <div className="rounded-2xl border border-gold/30 bg-gold/[0.05] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers size={13} className="text-gold" />
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold">Meal prep — cook in batch</p>
          </div>
          <div className="flex gap-1.5">
            {BATCH_OPTIONS.map((b) => (
              <button
                key={b}
                onClick={() => { hapticSelection(); setBatch(b); }}
                className={cn(
                  "flex-1 rounded-xl py-2.5 text-[13px] font-black tabular-nums transition-all active:scale-[0.97]",
                  batch === b
                    ? "bg-gold text-primary-foreground shadow-[0_2px_10px_hsl(42_78%_50%/0.4)]"
                    : "bg-card/60 border border-border/50 text-foreground/70",
                )}
              >
                {b}×
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {batch === 1 ? "1 meal." : `Ingredients below scaled for ${batch} meals — cook once, eat all week.`}
          </p>
        </div>

        {/* Ingredients (scaled) */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85 mb-2 px-1">
            Ingredients{batch > 1 && <span className="text-muted-foreground"> · {batch}×</span>}
          </p>
          <div className="space-y-3">
            {recipe.groups.map((g) => (
              <div key={g.title} className="rounded-2xl border border-border/40 bg-card/40 p-3.5">
                <p className="text-[11px] font-black text-foreground mb-2">{g.title}</p>
                <ul className="space-y-1.5">
                  {g.items.map((it, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-[12.5px]">
                      <span className="h-1 w-1 rounded-full bg-gold/60 shrink-0 mt-1.5" />
                      <span className="text-foreground/85">
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
        </div>

        {/* Method */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85 mb-2 px-1">How to make</p>
          <div className="space-y-3">
            {recipe.method.map((m, mi) => (
              <div key={mi} className="rounded-2xl border border-border/40 bg-card/40 p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-5 w-5 rounded-full bg-gold/15 border border-gold/30 text-gold flex items-center justify-center text-[10px] font-black shrink-0">{mi + 1}</span>
                  <p className="text-[12px] font-black uppercase tracking-wide text-foreground">{m.title}</p>
                </div>
                <ol className="space-y-1 pl-1">
                  {m.steps.map((s, si) => (
                    <li key={si} className="text-[12.5px] text-foreground/80 leading-snug flex gap-1.5">
                      <span className="text-gold/60 font-bold tabular-nums shrink-0">{si + 1}.</span> {s}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>

        {/* Storage / reheat panel */}
        <div className="rounded-2xl border border-[hsl(210_90%_56%)]/25 bg-[hsl(210_90%_56%)]/[0.05] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[hsl(210_90%_60%)] mb-3">Storage & reheat</p>
          <div className="flex gap-2 mb-3">
            <div className="flex-1 rounded-xl bg-card/50 border border-border/40 p-2.5 flex items-center gap-2">
              <Refrigerator size={15} className="text-[hsl(210_90%_60%)] shrink-0" />
              <div>
                <p className="text-[14px] font-black tabular-nums leading-none">{recipe.mealPrep.fridgeDays}d</p>
                <p className="text-[8.5px] uppercase tracking-wider text-muted-foreground mt-0.5">Fridge</p>
              </div>
            </div>
            {recipe.mealPrep.freezerWeeks != null && (
              <div className="flex-1 rounded-xl bg-card/50 border border-border/40 p-2.5 flex items-center gap-2">
                <Snowflake size={15} className="text-[hsl(210_90%_60%)] shrink-0" />
                <div>
                  <p className="text-[14px] font-black tabular-nums leading-none">{recipe.mealPrep.freezerWeeks}wk</p>
                  <p className="text-[8.5px] uppercase tracking-wider text-muted-foreground mt-0.5">Freezer</p>
                </div>
              </div>
            )}
          </div>
          <p className="text-[12px] text-foreground/85 leading-snug mb-2">
            <span className="font-bold text-[hsl(210_90%_60%)]">Reheat:</span> {recipe.mealPrep.reheat}
          </p>
          <ul className="space-y-1">
            {recipe.mealPrep.tips.map((t, i) => (
              <li key={i} className="text-[11.5px] text-muted-foreground leading-snug flex gap-1.5">
                <span className="text-[hsl(210_90%_60%)]/70 shrink-0">•</span> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
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
              <div className="h-14 w-14 rounded-xl overflow-hidden bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shrink-0 relative">
                <Utensils size={18} className="text-[hsl(260_18%_4%)]" strokeWidth={2.4} />
                <RecipeImage id={r.id} className="absolute inset-0 h-full w-full object-cover" />
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
