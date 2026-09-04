import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, parseISO } from "date-fns";
import { ArrowLeft, Info, Loader2, Target, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import EmptyState from "@/components/ui/empty-state";
import MoreSection from "@/components/ui/more-section";
import { Block } from "@/components/skeletons/PageSkeleton";
import { friendlyError } from "@/lib/error-copy";
import { hapticNotification } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import BarcodeMiss from "@/components/nutrition/BarcodeMiss";
import DateBar, { localDateKey } from "@/components/nutrition/DateBar";
import DiarySlot from "@/components/nutrition/DiarySlot";
import FoodSearchPanel, { type OnlineState, type SearchFilter } from "@/components/nutrition/FoodSearchPanel";
import type { FoodResultView } from "@/components/nutrition/FoodResultRow";
import MacroBars from "@/components/nutrition/MacroBars";
import MacroRow from "@/components/nutrition/MacroRow";
import MealItemRow from "@/components/nutrition/MealItemRow";
import MicrosPanel, { type MicroRow } from "@/components/nutrition/MicrosPanel";
import NutritionInfoSheet, { type FoodSourceInfo } from "@/components/nutrition/NutritionInfoSheet";
import NutritionSheet from "@/components/nutrition/NutritionSheet";
import PortionPanel, { type PortionCommit } from "@/components/nutrition/PortionPanel";
import type { PortionState } from "@/components/nutrition/ServingPicker";
import { useBarcodeScan } from "@/hooks/use-barcode-scan";
import { useFood } from "@/hooks/use-food";
import { useFoodFavorites } from "@/hooks/use-food-favorites";
import { useFoodSearch } from "@/hooks/use-food-search";
import { useLogMeal, type LogMealItemInput } from "@/hooks/use-log-meal";
import { useNutrientDefinitions } from "@/hooks/use-nutrient-definitions";
import { dayKey, useNutritionDay } from "@/hooks/use-nutrition-day";
import { useNutritionTargets } from "@/hooks/use-nutrition-targets";
import { useNutritionTotals } from "@/hooks/use-nutrition-totals";
import type { MealLogItemRow, NutritionTargetsRow } from "@/lib/nutrition/api-types";
import { normalizeBarcode } from "@/lib/nutrition/barcode";
import { itemToDisplay, targetsToMacros } from "@/lib/nutrition/diary-view";
import { touchFood } from "@/lib/nutrition/food-cache";
import { fmtKcal } from "@/lib/nutrition/format";
import type { MealSource } from "@/lib/nutrition/offline-meals";
import { fetchDay, lookupBarcode, recipePerServing, searchOnline } from "@/lib/nutrition/queries";
import { roundTo, scale } from "@/lib/nutrition/scale";
import { defaultSlotForHour, MEAL_SLOTS } from "@/lib/nutrition/slots";
import { dayState, macroSummary, sumVectors, type DayState } from "@/lib/nutrition/totals";
import { NUTRIENT_KEYS, type Food, type MealSlot, type NutrientKey, type NutrientVector, type Targets } from "@/lib/nutrition/types";

/**
 * The diary: what you ate today against what you need. One display line
 * carries the day's verdict (the hero), the protein bar is the page's single
 * gold, and the four meal slots recede into hairline sections. Everything
 * below the page layer — data, arithmetic, the sheet flows' panels — already
 * exists; this file only composes it and owns the sheet state machine.
 */

type Sheet =
  | { view: "search"; slot: MealSlot }
  | { view: "barcode"; slot: MealSlot }
  | { view: "miss"; slot: MealSlot; code: string; rateLimited: boolean }
  | { view: "portion"; slot: MealSlot; foodId: string | null; food: Food | null; source: MealSource; item: MealLogItemRow | null }
  | { view: "quick"; slot: MealSlot; item: MealLogItemRow };

const RISE = ["home-rise-2", "home-rise-3", "home-rise-4", "home-rise-5"] as const;
const MACRO_SET: ReadonlySet<string> = new Set(["kcal", "protein_g", "carbs_g", "fat_g"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KEY_SET: ReadonlySet<string> = new Set<string>(NUTRIENT_KEYS);

const isNutrientKey = (k: string): k is NutrientKey => KEY_SET.has(k);
const isSlot = (s: string | null): s is MealSlot => MEAL_SLOTS.some((m) => m.key === s);
const slotLabel = (slot: MealSlot) => MEAL_SLOTS.find((s) => s.key === slot)?.label ?? "meal";
const country = () => (typeof navigator === "undefined" ? "FI" : (navigator.language.split("-")[1] ?? "FI")).toUpperCase();
const validDate = (raw: string | null): string => {
  const today = localDateKey();
  return raw && DATE_RE.test(raw) && raw <= today ? raw : today;
};
const nowSlot = () => {
  const d = new Date();
  return defaultSlotForHour(d.getHours(), d.getMinutes());
};

/** The five things the opening line can say. */
function beatFor(state: DayState, kcal: number, targetKcal: number | null): string {
  switch (state) {
    case "no_targets":
      return "Set your targets.";
    case "empty":
      return "Nothing logged yet.";
    case "complete":
      return "Fueled.";
    case "over":
      return `${fmtKcal(kcal - (targetKcal ?? 0))} over today.`;
    default:
      return `${fmtKcal((targetKcal ?? 0) - kcal)} kcal to go.`;
  }
}

const subFor = (state: DayState, kcal: number, targetKcal: number | null, meals: number): string => {
  if (state === "no_targets") return kcal > 0 ? `${fmtKcal(kcal)} kcal logged. Targets turn it into a plan.` : "Targets turn the diary into a plan.";
  if (state === "empty") return `Your target is ${fmtKcal(targetKcal ?? 0)} kcal.`;
  const m = `${meals} meal${meals === 1 ? "" : "s"}`;
  if (state === "complete") return `${fmtKcal(kcal)} of ${fmtKcal(targetKcal ?? 0)} kcal · protein hit · ${m}`;
  return `${fmtKcal(kcal)} of ${fmtKcal(targetKcal ?? 0)} kcal · ${m}`;
};

/** A logged row re-expressed as log_meal input (undo, duplicate, copy yesterday). */
function rowToInput(it: MealLogItemRow, id?: string): LogMealItemInput | null {
  const base = { id, name: it.display_name, snapshot: it.snapshot };
  if (it.kind === "food" && it.food_id) {
    return { ...base, kind: "food", food_id: it.food_id, grams: it.grams, serving_id: it.serving_id, serving_qty: it.serving_qty };
  }
  if (it.kind === "recipe" && it.recipe_id) {
    return { ...base, kind: "recipe", recipe_id: it.recipe_id, serving_qty: it.serving_qty ?? 1, grams: it.grams };
  }
  if (it.kind === "quick") {
    const s = it.snapshot;
    return { ...base, kind: "quick", grams: it.grams, quick: { kcal: s.kcal ?? 0, protein_g: s.protein_g ?? 0, carbs_g: s.carbs_g ?? 0, fat_g: s.fat_g ?? 0 } };
  }
  return null;
}

/** A portion the user just confirmed as log_meal input; the snapshot is the same scaling the server will do. */
function portionToInput(food: Food, c: PortionCommit, id?: string): LogMealItemInput {
  const snapshot = scale(food.per100g, c.grams);
  if (food.source === "recipe") {
    const perServing = food.servings[0]?.grams ?? null;
    const serving_qty = c.servingQty ?? (perServing && perServing > 0 ? roundTo(c.grams / perServing, 3) : 1);
    return { id, kind: "recipe", recipe_id: food.id, serving_qty, grams: c.grams, name: food.name, snapshot };
  }
  return { id, kind: "food", food_id: food.id, grams: c.grams, serving_id: c.portion.servingId, serving_qty: c.servingQty, name: food.name, snapshot };
}

/** The portion picker's starting state for an existing row: its serving when the food still has it, else grams. */
function initialPortion(food: Food, it: MealLogItemRow): PortionState {
  const serving = it.serving_id ? food.servings.find((s) => s.id === it.serving_id) : food.source === "recipe" ? food.servings[0] : undefined;
  if (serving && serving.grams != null && it.serving_qty != null && it.serving_qty > 0) {
    return { qty: String(it.serving_qty), unit: serving.unit, servingId: serving.id, customGrams: "" };
  }
  return { qty: String(roundTo(it.grams, 1)), unit: "g", servingId: null, customGrams: "" };
}

/** A recipe as a Food for the portion panel: per-serving vector from the server, per-100 g derived from the serving weight. */
async function recipeAsPortionFood(id: string, name: string, gramsPerServing: number): Promise<Food> {
  const perServing = await recipePerServing(supabase, id);
  return {
    id,
    name,
    source: "recipe",
    per100g: scale(perServing, 10_000 / gramsPerServing),
    servings: [{ id: `${id}:serving`, unit: "serving", label: "serving", grams: roundTo(gramsPerServing, 3) }],
    defaultServingId: `${id}:serving`,
  };
}

const useOnline = () => {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
};

const BodySkeleton = () => (
  <div className="animate-fade-in" aria-busy="true" aria-label="Loading your diary">
    <Block height={28} className="w-3/4 !rounded-lg" />
    <Block height={96} delay={40} className="mt-4" />
    {Array.from({ length: 4 }).map((_, i) => (
      <Block key={i} height={72} delay={100 + i * 40} className="mt-4" />
    ))}
  </div>
);

const NutritionDiary = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const uid = user?.id;
  const online = useOnline();
  const [params, setParams] = useSearchParams();

  // ── Day ──────────────────────────────────────────────────────────────
  const [date, setDateState] = useState(() => validDate(params.get("date")));
  const setDate = (next: string) => {
    const d = validDate(next);
    setDateState(d);
    setParams(d === localDateKey() ? {} : { date: d }, { replace: true });
  };
  const { meals, items, itemsByMeal, pendingIds, isLoading: dayLoading, error: dayError, refetch } = useNutritionDay(date);
  const { day, isLoading: totalsLoading } = useNutritionTotals(date);
  const { targets, isLoading: targetsLoading } = useNutritionTargets();
  const { defs } = useNutrientDefinitions();
  const { logMeal, updateItem, deleteItem, deleteMeal, pending } = useLogMeal();

  // ── Sheet state machine (search → portion / miss; row → edit) ─────────
  // Deep links (`?add=1`, `?add=<foodId>`, `&slot=`) open the sheet on mount
  // and are then stripped, so a refresh or back-swipe never re-opens it.
  const [sheet, setSheet] = useState<Sheet | null>(() => {
    const add = params.get("add");
    if (!add) return null;
    const slotParam = params.get("slot");
    const slot = isSlot(slotParam) ? slotParam : nowSlot();
    return add === "1" ? { view: "search", slot } : { view: "portion", slot, foodId: add, food: null, source: "manual", item: null };
  });
  useEffect(() => {
    if (!params.has("add") && !params.has("slot")) return;
    const d = validDate(params.get("date"));
    setParams(d === localDateKey() ? {} : { date: d }, { replace: true });
  }, [params, setParams]);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [onlineState, setOnlineState] = useState<OnlineState>("idle");
  const [manualCode, setManualCode] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [newItemId, setNewItemId] = useState<string | null>(null);
  const [clearSlot, setClearSlot] = useState<MealSlot | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => setOnlineState("idle"), [query]);
  useEffect(() => {
    if (!newItemId) return;
    const t = setTimeout(() => setNewItemId(null), 1200);
    return () => clearTimeout(t);
  }, [newItemId]);

  const region = useMemo(country, []);
  const searchOpen = sheet?.view === "search";
  const { results, isSearching, localResults } = useFoodSearch(searchOpen ? query : "", { country: region, filter });
  const favorites = useFoodFavorites();
  const { supported: barcodeSupported, scan, openSettings } = useBarcodeScan();
  const portionFoodId = sheet?.view === "portion" && !sheet.food ? sheet.foodId : null;
  const { food: fetchedFood, isLoading: foodLoading } = useFood(portionFoodId);
  const food = sheet?.view === "portion" ? (sheet.food ?? fetchedFood) : null;

  const sourcesQ = useQuery({
    queryKey: ["food-sources"],
    enabled: infoOpen,
    staleTime: Infinity,
    queryFn: async (): Promise<FoodSourceInfo[]> => {
      const { data, error } = await supabase
        .from("food_sources")
        .select("code, name, licence, attribution_text, attribution_url, licence_url")
        .order("priority");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Derived day ──────────────────────────────────────────────────────
  const snapshotSum = useMemo(() => sumVectors(items.map((i) => i.snapshot)), [items]);
  const totals: NutrientVector = day?.totals ?? snapshotSum.totals;
  const effTargets: NutritionTargetsRow | null = day?.targets ?? targets;
  const targetVals: Targets | null = effTargets
    ? { kcal: effTargets.kcal, protein_g: effTargets.protein_g, carbs_g: effTargets.carbs_g, fat_g: effTargets.fat_g }
    : null;
  const state = dayState(totals, targetVals);
  const consumed = macroSummary(totals);
  const kcal = consumed.calories;
  const beat = beatFor(state, kcal, targetVals?.kcal ?? null);
  const sub = subFor(state, kcal, targetVals?.kcal ?? null, day?.meal_count ?? meals.length);

  const slots = useMemo(
    () =>
      MEAL_SLOTS.map((s) => {
        const slotMeals = meals.filter((m) => m.meal_slot === s.key);
        const slotItems = slotMeals.flatMap((m) => itemsByMeal.get(m.id) ?? []);
        const fromSlot = day?.by_slot[s.key]?.kcal;
        const kcalOf = fromSlot ?? sumVectors(slotItems.map((i) => i.snapshot)).totals.kcal ?? 0;
        return { ...s, meals: slotMeals, items: slotItems, kcal: kcalOf };
      }),
    [meals, itemsByMeal, day],
  );

  const microRows = useMemo((): MicroRow[] => {
    if (items.length === 0) return [];
    const rows: MicroRow[] = [];
    for (const d of defs) {
      const key = d.key;
      if (!isNutrientKey(key) || MACRO_SET.has(key)) continue;
      const target = key === "fiber_g" ? (effTargets?.fiber_g ?? effTargets?.micro_targets[key]) : effTargets?.micro_targets[key];
      rows.push({ key, label: d.name_en, unit: d.unit, value: totals[key] ?? null, target: target ?? null, missingCount: snapshotSum.missing[key] ?? 0 });
    }
    return rows;
  }, [defs, items.length, totals, effTargets, snapshotSum]);

  // ── Search sheet ─────────────────────────────────────────────────────
  const localViews = useMemo(
    (): FoodResultView[] =>
      localResults.map((f) => ({
        id: f.id,
        name: f.name,
        brand: f.brand,
        kcal: f.per100g.kcal ?? null,
        protein: f.per100g.protein_g ?? null,
        source: f.source,
        isFavorite: favorites.ids.has(f.id),
        isRecipe: f.source === "recipe",
      })),
    [localResults, favorites.ids],
  );
  const serverViews = useMemo(
    (): FoodResultView[] =>
      results
        .filter((r) => (filter === "all" ? true : filter === "favorites" ? r.is_favorite || favorites.ids.has(r.id) : r.source === "user"))
        .map((r) => ({
          id: r.id,
          name: r.name,
          brand: r.brand,
          kcal: r.kcal,
          protein: r.protein_g,
          source: r.kind === "recipe" ? "recipe" : r.source,
          isFavorite: r.is_favorite || favorites.ids.has(r.id),
          isRecipe: r.kind === "recipe",
        })),
    [results, filter, favorites.ids],
  );

  const openPortion = (slot: MealSlot, foodId: string, source: MealSource) =>
    setSheet({ view: "portion", slot, foodId, food: null, source, item: null });

  const pick = async (v: FoodResultView) => {
    if (!sheet) return;
    const slot = sheet.slot;
    if (!v.isRecipe) return openPortion(slot, v.id, "manual");
    const cached = localResults.find((f) => f.id === v.id);
    if (cached) return setSheet({ view: "portion", slot, foodId: null, food: cached, source: "recipe", item: null });
    const grams = results.find((r) => r.id === v.id)?.default_serving_grams ?? null;
    if (!grams || grams <= 0) return navigate(`/nutrition/recipes/${v.id}`);
    setLookingUp(true);
    try {
      const built = await recipeAsPortionFood(v.id, v.name, grams);
      setSheet({ view: "portion", slot, foodId: null, food: built, source: "recipe", item: null });
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setLookingUp(false);
    }
  };

  const runOnlineSearch = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setOnlineState("loading");
    const r = await searchOnline(supabase, { query: q, country: region });
    if (r.status === "membership_required") {
      setOnlineState("error");
      toast.error("Membership required for online lookups");
      return;
    }
    if (r.status === "rate_limited") return setOnlineState("rate_limited");
    if (r.status === "error") return setOnlineState("error");
    await qc.invalidateQueries({ queryKey: ["food-search"] });
    setOnlineState("done");
  };

  const createFood = (slot: MealSlot, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ slot, date, ...extra });
    setSheet(null);
    navigate(`/nutrition/foods/new?${p.toString()}`);
  };

  // ── Barcode ──────────────────────────────────────────────────────────
  const lookup = async (code: string, slot: MealSlot) => {
    setLookingUp(true);
    try {
      const r = await lookupBarcode(supabase, { code, country: region });
      if (r.status === "hit" && r.row) return openPortion(slot, r.row.id, "barcode");
      if (r.status === "membership_required") return toast.error("Membership required for online lookups");
      setSheet({ view: "miss", slot, code, rateLimited: r.status === "rate_limited" });
    } finally {
      setLookingUp(false);
    }
  };
  const scanBarcode = async (slot: MealSlot) => {
    const o = await scan();
    if (o.kind === "code") return lookup(o.code, slot);
    if (o.kind === "denied") {
      toast("Camera is off", {
        description: "Allow camera access in Settings to scan barcodes.",
        action: { label: "Settings", onClick: () => void openSettings() },
      });
    } else if (o.kind === "unreadable") {
      toast("Couldn't read that barcode", { description: "Try again in better light, or search by name." });
    } else if (o.kind === "unsupported") {
      toast("Barcode scanning isn't available on this device");
    }
  };
  const submitManualCode = (slot: MealSlot) => {
    const digits = manualCode.replace(/\D/g, "");
    const format = digits.length === 8 ? "EAN_8" : digits.length === 12 ? "UPC_A" : "EAN_13";
    const n = normalizeBarcode(digits, format);
    if (!n.ok) return toast("That doesn't look like a valid barcode");
    void lookup(n.code, slot);
  };

  // ── Writes ───────────────────────────────────────────────────────────
  const commitAdd = async (f: Food, c: PortionCommit, slot: MealSlot, source: MealSource) => {
    const id = crypto.randomUUID();
    if (uid) touchFood(uid, f);
    setSheet(null);
    setNewItemId(id);
    try {
      const res = await logMeal({ date, slot, source, items: [portionToInput(f, c, id)] });
      if (!res.queued) {
        void hapticNotification("success");
        toast(`Added to ${slotLabel(slot)}`);
      }
    } catch {
      /* the hook already rolled back and toasted */
    }
  };
  const commitEdit = async (f: Food, c: PortionCommit, item: MealLogItemRow, slot: MealSlot) => {
    const fromSlot = meals.find((m) => m.id === item.meal_log_id)?.meal_slot;
    setSheet(null);
    try {
      if (fromSlot && slot !== fromSlot) {
        const id = crypto.randomUUID();
        setNewItemId(id);
        await logMeal({ date, slot, items: [portionToInput(f, c, id)] });
        await deleteItem(item.id, date);
        toast(`Moved to ${slotLabel(slot)}`);
      } else {
        await updateItem(item.id, { grams: c.grams, serving_id: c.portion.servingId ?? undefined, serving_qty: c.servingQty ?? undefined }, date);
        toast("Saved");
      }
    } catch {
      /* toasted by the hook */
    }
  };
  const removeItem = async (item: MealLogItemRow) => {
    const meal = meals.find((m) => m.id === item.meal_log_id);
    const input = rowToInput(item, item.id);
    setSheet(null);
    try {
      await deleteItem(item.id, date);
    } catch {
      return;
    }
    toast("Removed", meal && input ? { action: { label: "Undo", onClick: () => void logMeal({ date, slot: meal.meal_slot, items: [input] }).catch(() => {}) } } : undefined);
  };
  const duplicateItem = async (item: MealLogItemRow, slot: MealSlot) => {
    const input = rowToInput(item);
    if (!input) return;
    setSheet(null);
    try {
      await logMeal({ date, slot, source: "duplicate", items: [input] });
      toast(`Duplicated in ${slotLabel(slot)}`);
    } catch {
      /* toasted by the hook */
    }
  };
  const copyYesterday = async (slot: MealSlot) => {
    if (!uid) return;
    const y = localDateKey(addDays(parseISO(date), -1));
    const label = slotLabel(slot).toLowerCase();
    let inputs: LogMealItemInput[];
    try {
      const d = await qc.fetchQuery({ queryKey: dayKey(y, uid), queryFn: () => fetchDay(supabase, uid, y), staleTime: 30_000 });
      const mealIds = new Set(d.meals.filter((m) => m.meal_slot === slot).map((m) => m.id));
      inputs = d.items.filter((i) => mealIds.has(i.meal_log_id)).map((i) => rowToInput(i)).filter((i): i is LogMealItemInput => i !== null);
    } catch (e) {
      toast.error(friendlyError(e));
      return;
    }
    if (inputs.length === 0) return toast(`Nothing logged yesterday for ${label}`);
    try {
      await logMeal({ date, slot, source: "duplicate", items: inputs });
      void hapticNotification("success");
      toast(`Copied yesterday's ${label}`);
    } catch {
      /* toasted by the hook */
    }
  };
  const confirmClear = async () => {
    const slot = clearSlot;
    setClearSlot(null);
    if (!slot) return;
    const ids = meals.filter((m) => m.meal_slot === slot).map((m) => m.id);
    try {
      await Promise.all(ids.map((id) => deleteMeal(id, date)));
      toast(`Cleared ${slotLabel(slot).toLowerCase()}`);
    } catch {
      /* toasted by the hook */
    }
  };
  const openItem = (item: MealLogItemRow) => {
    const slot = meals.find((m) => m.id === item.meal_log_id)?.meal_slot ?? nowSlot();
    if (item.kind === "quick") return setSheet({ view: "quick", slot, item });
    if (item.kind === "recipe" && item.recipe_id) {
      const perServing = item.serving_qty && item.serving_qty > 0 ? item.grams / item.serving_qty : null;
      if (!perServing) return navigate(`/nutrition/recipes/${item.recipe_id}`);
      setLookingUp(true);
      void recipeAsPortionFood(item.recipe_id, item.display_name, perServing)
        .then((built) => setSheet({ view: "portion", slot, foodId: null, food: built, source: "recipe", item }))
        .catch((e) => toast.error(friendlyError(e)))
        .finally(() => setLookingUp(false));
      return;
    }
    setSheet({ view: "portion", slot, foodId: item.food_id, food: null, source: "manual", item });
  };

  // ── Chrome ───────────────────────────────────────────────────────────
  const loading = dayLoading || totalsLoading || targetsLoading;
  const failed = !!dayError && meals.length === 0;
  const sheetTitle = !sheet
    ? ""
    : sheet.view === "search"
      ? `Add to ${slotLabel(sheet.slot)}`
      : sheet.view === "barcode"
        ? "Enter a barcode"
        : sheet.view === "miss"
          ? "Barcode"
          : sheet.view === "quick"
            ? "Quick add"
            : sheet.item
              ? "Edit"
              : `Add to ${slotLabel(sheet.slot)}`;
  const sheetBack = !sheet || sheet.view === "search" || sheet.view === "quick" || (sheet.view === "portion" && sheet.item)
    ? undefined
    : () => setSheet({ view: "search", slot: sheet.slot });

  return (
    <div className="flex flex-col min-h-full">
      <header className="page-header-premium px-2 pt-3 pb-1 flex items-center gap-0.5">
        <Button variant="ghost" size="icon" aria-label="Back to Home" className="min-h-11 min-w-11" onClick={() => navigate("/")}>
          <ArrowLeft size={18} />
        </Button>
        <DateBar date={date} onChange={setDate} className="flex-1" />
        <Button variant="ghost" size="icon" aria-label="Nutrition targets" className="min-h-11 min-w-11" onClick={() => navigate("/nutrition/targets")}>
          <Target size={18} />
        </Button>
        <Button variant="ghost" size="icon" aria-label="How estimates work" className="min-h-11 min-w-11" onClick={() => setInfoOpen(true)}>
          <Info size={18} />
        </Button>
      </header>

      {!online && (
        <p role="status" className="px-4 pt-2.5 text-[12px] text-muted-foreground inline-flex items-center gap-1.5">
          <WifiOff size={12} aria-hidden /> Offline — showing what's synced
        </p>
      )}

      <div className="px-4 pt-4 pb-28">
        {loading ? (
          <BodySkeleton />
        ) : failed ? (
          <EmptyState
            title="Couldn't load this day"
            description={friendlyError(dayError)}
            action={
              <Button variant="outline" onClick={() => void refetch()}>
                Retry
              </Button>
            }
          />
        ) : (
          <>
            {/* ── OPENING BEAT — the day's verdict, one line. The hero is a
                   sentence with a number in it, not a metric tile. ── */}
            <div className="home-rise">
              <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">
                {state === "no_targets" ? (
                  <button type="button" onClick={() => navigate("/nutrition/targets")} className="text-left min-h-11 active:opacity-70 transition-opacity">
                    {beat}
                  </button>
                ) : (
                  beat
                )}
              </h1>
              <p className="text-[13px] text-muted-foreground mt-1.5 tabular-nums">{sub}</p>
            </div>

            <div className="home-rise home-rise-1 mt-5">
              <MacroBars consumed={consumed} targets={targetsToMacros(effTargets)} />
            </div>

            {/* ── SLOTS — four sections read as one day; hairline rows, no cards. ── */}
            <div className="mt-2">
              {slots.map((s, i) => (
                <div key={s.key} className={cn("home-rise", RISE[i])}>
                  <DiarySlot
                    label={s.label}
                    kcal={s.kcal}
                    hasItems={s.items.length > 0}
                    onAdd={() => setSheet({ view: "search", slot: s.key })}
                    onCopyYesterday={() => void copyYesterday(s.key)}
                    onClear={() => setTimeout(() => setClearSlot(s.key), 0)}
                    className="[content-visibility:auto]"
                  >
                    {s.items.map((it) => (
                      <MealItemRow
                        key={it.id}
                        item={itemToDisplay(it, { pending: pendingIds.has(it.meal_log_id), isNew: it.id === newItemId })}
                        onPress={() => openItem(it)}
                      />
                    ))}
                  </DiarySlot>
                </div>
              ))}
            </div>

            <MoreSection label="Micros" className="mt-4">
              <MicrosPanel rows={microRows} />
            </MoreSection>
          </>
        )}
      </div>

      <ConfirmDialog
        open={clearSlot !== null}
        onOpenChange={(o) => !o && setClearSlot(null)}
        title={`Clear ${clearSlot ? slotLabel(clearSlot).toLowerCase() : "this meal"}?`}
        description="Every item logged in this slot today will be removed."
        actionLabel="Clear"
        onConfirm={() => void confirmClear()}
      />

      <NutritionSheet open={infoOpen} onClose={() => setInfoOpen(false)} title="How this works" label="How estimates work">
        <NutritionInfoSheet sources={sourcesQ.data} />
      </NutritionSheet>

      <NutritionSheet open={sheet !== null} onClose={() => setSheet(null)} title={sheetTitle} label={sheetTitle || "Diary"} onBack={sheetBack}>
        {sheet?.view === "search" && (
          <>
            {lookingUp && (
              <p role="status" className="mb-2 text-[12px] text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" aria-hidden /> Looking it up…
              </p>
            )}
            <FoodSearchPanel
              query={query}
              onQueryChange={setQuery}
              filter={filter}
              onFilterChange={setFilter}
              localResults={localViews}
              results={serverViews}
              loading={isSearching}
              onlineState={onlineState}
              onPick={(v) => void pick(v)}
              onToggleFavorite={(v) => favorites.toggle(v.id)}
              barcodeSupported={barcodeSupported}
              onScanBarcode={() => void scanBarcode(sheet.slot)}
              onEnterBarcode={() => setSheet({ view: "barcode", slot: sheet.slot })}
              onScanPhoto={() => {
                setSheet(null);
                navigate(`/nutrition/photo?date=${date}&slot=${sheet.slot}`);
              }}
              onOpenRecipes={() => {
                setSheet(null);
                navigate("/nutrition/recipes");
              }}
              onCreateFood={() => createFood(sheet.slot, { name: query.trim() })}
              onSearchOnline={() => void runOnlineSearch()}
            />
          </>
        )}

        {sheet?.view === "barcode" && (
          <form
            className="space-y-3 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              submitManualCode(sheet.slot);
            }}
          >
            <p className="text-[13px] text-muted-foreground">The digits under the bars — EAN-8, EAN-13 or UPC.</p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              aria-label="Barcode"
              placeholder="6412345678901"
              className="w-full surface-inset rounded-xl h-11 px-3 text-[15px] tabular-nums outline-none focus:border-gold/50 transition-colors"
            />
            <Button type="submit" size="lg" className="w-full" disabled={manualCode.replace(/\D/g, "").length < 8} loading={lookingUp}>
              Look up
            </Button>
          </form>
        )}

        {sheet?.view === "miss" && (
          <BarcodeMiss
            barcode={sheet.code}
            rateLimited={sheet.rateLimited}
            onCreate={() => createFood(sheet.slot, { barcode: sheet.code })}
            onSearch={() => setSheet({ view: "search", slot: sheet.slot })}
          />
        )}

        {sheet?.view === "portion" &&
          (food ? (
            <PortionPanel
              key={`${food.id}:${sheet.item?.id ?? "add"}`}
              food={food}
              mode={sheet.item ? "edit" : "add"}
              slot={sheet.slot}
              onSlotChange={(slot) => setSheet({ ...sheet, slot })}
              initial={sheet.item ? initialPortion(food, sheet.item) : undefined}
              onCommit={(c) => void (sheet.item ? commitEdit(food, c, sheet.item, sheet.slot) : commitAdd(food, c, sheet.slot, sheet.source))}
              onDelete={sheet.item ? () => void removeItem(sheet.item as MealLogItemRow) : undefined}
              onDuplicate={sheet.item ? () => void duplicateItem(sheet.item as MealLogItemRow, sheet.slot) : undefined}
              busy={pending}
            />
          ) : foodLoading ? (
            <div className="space-y-4 pt-1" aria-busy="true" aria-label="Loading food">
              <Block height={24} className="w-2/3 !rounded-lg" />
              <Block height={44} delay={40} />
              <Block height={88} delay={80} />
            </div>
          ) : (
            <EmptyState
              size="compact"
              title="This food isn't available"
              description="It may have been removed from the catalog."
              action={
                <Button variant="outline" onClick={() => setSheet({ view: "search", slot: sheet.slot })}>
                  Search instead
                </Button>
              }
            />
          ))}

        {sheet?.view === "quick" && (
          <div className="space-y-5 pt-1">
            <p className="font-display text-[20px] font-black tracking-tight leading-tight">{sheet.item.display_name}</p>
            <MacroRow nutrition={macroSummary(sheet.item.snapshot)} />
            <p className="text-[12px] text-muted-foreground leading-snug">A quick add carries only the macros you typed. To change them, remove it and add again.</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="flex-1 min-h-11" onClick={() => void duplicateItem(sheet.item, sheet.slot)} disabled={pending}>
                Duplicate
              </Button>
              <Button variant="destructive" className="flex-1 min-h-11" onClick={() => void removeItem(sheet.item)} disabled={pending}>
                Remove
              </Button>
            </div>
          </div>
        )}
      </NutritionSheet>
    </div>
  );
};

export default NutritionDiary;
