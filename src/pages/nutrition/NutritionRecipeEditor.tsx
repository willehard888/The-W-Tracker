import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import EmptyState from "@/components/ui/empty-state";
import { SEGMENT_ACTIVE, SEGMENT_IDLE, SEGMENT_TRACK } from "@/components/ui/segment";
import { Block } from "@/components/skeletons/PageSkeleton";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import PageBar from "@/components/ui/page-bar";
import NumField from "@/components/nutrition/NumField";
import NutrientPreview from "@/components/nutrition/NutrientPreview";
import FoodPickerSheet from "@/components/nutrition/FoodPickerSheet";
import NutritionSheet from "@/components/nutrition/NutritionSheet";
import { localDateKey } from "@/components/nutrition/DateBar";
import { useLogMeal } from "@/hooks/use-log-meal";
import { useUserRecipes } from "@/hooks/use-user-recipes";
import { fetchFood } from "@/lib/nutrition/queries";
import { MIN_SERVINGS, perServing, recipeTotalGrams, recipeTotals } from "@/lib/nutrition/recipe";
import { parseQty } from "@/lib/nutrition/resolve-grams";
import { MEAL_SLOTS, defaultSlotForHour } from "@/lib/nutrition/slots";
import { macroSummary } from "@/lib/nutrition/totals";
import type { Food, MealSlot } from "@/lib/nutrition/types";

type Ingredient = { key: number; food_id: string; name: string; grams: string };
let seq = 0;
const ingredient = (food_id: string, name: string, grams: string): Ingredient => ({ key: ++seq, food_id, name, grams });
const num = (s: string) => parseQty(s);

/**
 * Recipe builder and detail in one screen. Ingredients are catalog foods
 * with a weight; the per-serving MacroRow is the hero and is computed on
 * the device from the same per-100 g records the server will snapshot.
 * "Log 1 serving" writes to today's diary in servings, never in guessed grams.
 */
const NutritionRecipeEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { recipes, isLoading, save, remove, saving } = useUserRecipes();
  const { logMeal, pending } = useLogMeal();
  const saved = id ? recipes.find((r) => r.id === id) : undefined;

  const [name, setName] = useState("");
  const [servings, setServings] = useState("4");
  const [totalGrams, setTotalGrams] = useState("");
  const [items, setItems] = useState<Ingredient[]>([]);
  const [foods, setFoods] = useState<Record<string, Food>>({});
  const [errors, setErrors] = useState<{ name?: string; servings?: string; items?: string }>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logSlot, setLogSlot] = useState<MealSlot>(() => defaultSlotForHour(new Date().getHours(), new Date().getMinutes()));
  const [logQty, setLogQty] = useState("1");
  const prefilled = useRef(false);

  useEffect(() => {
    if (!saved || prefilled.current) return;
    prefilled.current = true;
    setName(saved.name);
    setServings(String(saved.servings));
    setTotalGrams(saved.total_grams != null ? String(saved.total_grams) : "");
    setItems(saved.items.map((it) => ingredient(it.food_id, "", String(it.grams))));
  }, [saved]);

  // Load every ingredient's Food once; names come from the record, so a row never shows a stale label.
  useEffect(() => {
    const missing = [...new Set(items.map((i) => i.food_id))].filter((fid) => !foods[fid]);
    if (missing.length === 0) return;
    let alive = true;
    Promise.all(missing.map((fid) => fetchFood(supabase, fid).catch(() => null))).then((loaded) => {
      if (!alive) return;
      const next: Record<string, Food> = {};
      loaded.forEach((f) => {
        if (f) next[f.id] = f;
      });
      setFoods((prev) => ({ ...prev, ...next }));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const servingsN = num(servings);
  const servingsOk = servingsN !== null && servingsN >= MIN_SERVINGS;
  const preview = useMemo(() => {
    const rows = items.flatMap((i) => {
      const f = foods[i.food_id];
      const g = num(i.grams);
      return f && g !== null && g > 0 ? [{ food: f, grams: g }] : [];
    });
    const totals = recipeTotals(rows);
    const ps = servingsOk ? perServing(totals, servingsN) : null;
    return { rows, totals, per: ps && ps.ok ? macroSummary(ps.vector) : macroSummary({}) };
  }, [items, foods, servingsOk, servingsN]);
  const totalWeight = recipeTotalGrams({ totalGrams: num(totalGrams), items: preview.rows });

  const addFood = (foodId: string, foodName: string) => {
    setPickerOpen(false);
    setItems((rows) => [...rows, ingredient(foodId, foodName, "100")]);
    if (errors.items) setErrors((e) => ({ ...e, items: undefined }));
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Give the recipe a name";
    if (!servingsOk) next.servings = `At least ${MIN_SERVINGS}`;
    const bad = items.some((i) => (num(i.grams) ?? 0) <= 0);
    if (items.length === 0) next.items = "Add at least one ingredient";
    else if (bad) next.items = "Every ingredient needs a weight";
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const submit = async () => {
    if (!validate()) return;
    try {
      const { recipe } = await save({
        id,
        name: name.trim(),
        servings: servingsN as number,
        total_grams: num(totalGrams) || null,
        items: items.map((i, sort_order) => ({ food_id: i.food_id, grams: num(i.grams) as number, sort_order })),
      });
      toast.success("Recipe saved");
      if (!id) navigate(`/nutrition/recipes/${recipe.id}`, { replace: true });
    } catch {
      /* the hook already toasted */
    }
  };
  const destroy = async () => {
    if (!id) return;
    setConfirmDelete(false);
    try {
      await remove(id);
      navigate("/nutrition/recipes", { replace: true });
    } catch {
      /* the hook already toasted */
    }
  };
  const logServing = async () => {
    if (!saved) return;
    const qty = num(logQty);
    if (qty === null || qty <= 0) return;
    const savedGrams = saved.total_grams ?? saved.items.reduce((s, i) => s + i.grams, 0);
    try {
      await logMeal({
        date: localDateKey(),
        slot: logSlot,
        source: "recipe",
        items: [{ kind: "recipe", recipe_id: saved.id, serving_qty: qty, grams: (qty * savedGrams) / saved.servings, name: saved.name }],
      });
      setLogOpen(false);
      toast.success(`Logged to ${MEAL_SLOTS.find((s) => s.key === logSlot)?.label ?? "the diary"}`);
    } catch {
      /* the hook already toasted */
    }
  };

  const title = id ? "Recipe" : "New recipe";
  if (id && isLoading) {
    return (
      <div className="min-h-full">
        <PageBar title={title} onBack={() => navigate(-1)} />
        <div className="px-4 pt-4 pb-8">
          <Block height={52} className="!rounded-xl" />
          <Block height={88} delay={40} className="mt-4 !rounded-2xl" />
          <Block height={160} delay={80} className="mt-4" />
        </div>
      </div>
    );
  }
  if (id && !saved) {
    return (
      <div className="min-h-full">
        <PageBar title={title} onBack={() => navigate(-1)} />
        <div className="px-4 pt-6">
          <EmptyState title="Recipe not found" description="It may have been deleted." action={<Button variant="outline" onClick={() => navigate("/nutrition/recipes", { replace: true })}>All recipes</Button>} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <PageBar
        title={title}
        onBack={() => navigate(-1)}
        action={
          id ? (
            <Button variant="ghost" size="icon" aria-label="Delete recipe" className="text-muted-foreground" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={18} />
            </Button>
          ) : undefined
        }
      />

      <form
        className="px-4 pt-4 pb-6 space-y-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="home-rise space-y-3">
          <label className="block">
            <span className="sr-only">Recipe name</span>
            <input
              type="text"
              value={name}
              autoFocus={!id}
              placeholder="Recipe name"
              aria-label="Recipe name"
              aria-required
              aria-invalid={!!errors.name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((er) => ({ ...er, name: undefined }));
              }}
              className={cn(
                "w-full bg-transparent border-b border-border/60 py-2 font-display text-[24px] font-black tracking-tight leading-tight outline-none focus:border-gold/50 transition-colors placeholder:text-muted-foreground/40",
                errors.name && "border-destructive/60",
              )}
            />
            {errors.name && (
              <span role="alert" className="block text-[11px] text-[hsl(var(--ember))] mt-1">
                {errors.name}
              </span>
            )}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Servings" required value={servings} onChange={(v) => { setServings(v); if (errors.servings) setErrors((e) => ({ ...e, servings: undefined })); }} error={errors.servings} />
            <NumField label="Cooked weight" unit="g" value={totalGrams} onChange={setTotalGrams} placeholder={totalWeight > 0 ? String(Math.round(totalWeight)) : "Optional"} />
          </div>
        </div>

        <div className="home-rise home-rise-1">
          <p className="text-[12px] font-bold text-muted-foreground mb-2">Per serving</p>
          <NutrientPreview nutrition={preview.per} dim={!servingsOk || preview.rows.length === 0} />
        </div>

        <div className="home-rise home-rise-2">
          <div className="flex items-center justify-between gap-3 mb-1">
            <p className="text-[12px] font-bold text-muted-foreground">Ingredients</p>
            <Button type="button" variant="ghost" size="xs" onClick={() => setPickerOpen(true)}>
              <Plus aria-hidden /> Add ingredient
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="text-[12px] text-muted-foreground leading-snug">Search the catalog for each ingredient and give it a weight.</p>
          ) : (
            <div className="divide-y divide-border/35">
              {items.map((it) => {
                const f = foods[it.food_id];
                return (
                  <div key={it.key} className="py-2 flex items-center gap-2">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-bold leading-tight truncate">{f?.name ?? it.name ?? "…"}</span>
                      {f?.brand && <span className="block text-[12px] text-muted-foreground truncate">{f.brand}</span>}
                    </span>
                    <label className="shrink-0 flex items-center gap-1.5">
                      <span className="sr-only">Grams for {f?.name ?? it.name}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={it.grams}
                        aria-label={`Grams for ${f?.name ?? it.name}`}
                        onChange={(e) => setItems((rows) => rows.map((r) => (r.key === it.key ? { ...r, grams: e.target.value } : r)))}
                        className="w-20 surface-inset rounded-xl h-11 px-3 text-[15px] font-black tabular-nums outline-none focus:border-gold/50"
                      />
                      <span className="text-[12px] font-bold text-muted-foreground">g</span>
                    </label>
                    <button
                      type="button"
                      aria-label={`Remove ${f?.name ?? it.name}`}
                      onClick={() => setItems((rows) => rows.filter((r) => r.key !== it.key))}
                      className="press shrink-0 h-11 w-11 flex items-center justify-center rounded-xl text-muted-foreground transition-transform"
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {errors.items && (
            <p role="alert" className="text-[11px] text-[hsl(var(--ember))] mt-1">
              {errors.items}
            </p>
          )}
        </div>

        <div className="home-rise home-rise-3 flex gap-2">
          {saved && (
            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setLogOpen(true)}>
              Log 1 serving
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1" loading={saving} disabled={saving}>
            {id ? "Save changes" : "Save recipe"}
          </Button>
        </div>
      </form>

      <FoodPickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(f) => addFood(f.id, f.name)} title="Add ingredient" />

      <NutritionSheet
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title={saved?.name ?? "Log"}
        label="Log a serving"
        footer={
          <Button size="lg" className="w-full" onClick={() => void logServing()} loading={pending} disabled={pending || !((num(logQty) ?? 0) > 0)}>
            Add to {MEAL_SLOTS.find((s) => s.key === logSlot)?.label ?? "diary"}
          </Button>
        }
      >
        <div className="space-y-5 pt-1">
          <NumField label="Servings" value={logQty} onChange={setLogQty} error={(num(logQty) ?? 0) > 0 ? null : "Enter an amount"} />
          <div>
            <p className="text-[12px] font-bold text-muted-foreground mb-1.5">Meal</p>
            <div className={SEGMENT_TRACK} role="group" aria-label="Meal slot">
              {MEAL_SLOTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={logSlot === s.key}
                  onClick={() => {
                    hapticSelection();
                    setLogSlot(s.key);
                  }}
                  className={cn("press flex-1 h-11 rounded-lg text-[12px] font-black transition-all ", logSlot === s.key ? SEGMENT_ACTIVE : SEGMENT_IDLE)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </NutritionSheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this recipe?"
        description="Meals you already logged keep their numbers."
        onConfirm={() => void destroy()}
      />
    </div>
  );
};

export default NutritionRecipeEditor;
