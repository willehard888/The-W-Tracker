import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyError } from "@/lib/error-copy";
import { isNetworkError } from "@/lib/offline-checkin";
import { deleteMealFromHealth, writeMealToHealth } from "@/lib/health/meal-write";
import type { DailyTotalsDay, MealLogItemRow, MealLogRow, MealPayload } from "@/lib/nutrition/api-types";
import {
  getPendingMeals,
  queueMeal,
  removePendingMeal,
  updatePendingMeal,
  type LogMealArgs,
  type LogMealItem,
  type MealSource,
} from "@/lib/nutrition/offline-meals";
import {
  deleteMeal as deleteMealRpc,
  deleteMealItem,
  duplicateMeal as duplicateMealRpc,
  logMeal as logMealRpc,
  updateMealItem,
  type MealItemPatch,
} from "@/lib/nutrition/queries";
import { scale } from "@/lib/nutrition/scale";
import { sumVectors } from "@/lib/nutrition/totals";
import type { MealSlot, NutrientVector } from "@/lib/nutrition/types";
import { dayKey, type DayData } from "./use-nutrition-day";
import { totalsKey } from "./use-nutrition-totals";

export type QuickMacros = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
type ItemBase = {
  id?: string;
  name: string;
  /** Client-side preview (e.g. scale(per100g, grams)) shown until the server snapshot replaces it. */
  snapshot?: NutrientVector;
};
export type LogMealItemInput =
  | (ItemBase & { kind: "food"; food_id: string; grams: number; serving_id?: string | null; serving_qty?: number | null })
  | (ItemBase & { kind: "recipe"; recipe_id: string; serving_qty: number; grams: number })
  | (ItemBase & { kind: "quick"; quick: QuickMacros; grams?: number });

export interface LogMealInput {
  /** Client uuid (idempotent replay); generated when absent. */
  mealId?: string;
  date: string;
  slot: MealSlot;
  items: LogMealItemInput[];
  note?: string | null;
  source?: MealSource;
  photoPath?: string | null;
}
type ItemWithId = LogMealItemInput & { id: string };
type LogResult = { queued: true; mealId: string } | { queued: false; payload: MealPayload };

const tzOffset = () => -new Date().getTimezoneOffset();
const netErr = (e: unknown) => isNetworkError(e instanceof Error ? e : null);
const errorCopy = (e: unknown) =>
  e instanceof Error && /PREMIUM_REQUIRED/.test(e.message) ? "Membership required" : friendlyError(e);
const queued = (uid: string | undefined, mealId: string) => !!uid && getPendingMeals(uid).some((p) => p.id === mealId);
const num = (v: number | undefined) => v ?? 0;

const toRpcItem = (it: ItemWithId): LogMealItem => ({
  id: it.id,
  kind: it.kind,
  name: it.name,
  food_id: it.kind === "food" ? it.food_id : null,
  recipe_id: it.kind === "recipe" ? it.recipe_id : null,
  grams: it.grams ?? 1,
  serving_id: it.kind === "food" ? (it.serving_id ?? null) : null,
  serving_qty: it.kind === "quick" ? null : (it.serving_qty ?? null),
  quick: it.kind === "quick" ? it.quick : null,
});

/** Optimistic rows: the server payload (same ids) replaces them on success. */
function placeholder(uid: string, mealId: string, input: LogMealInput, items: ItemWithId[]): { meal: MealLogRow; items: MealLogItemRow[] } {
  const now = new Date().toISOString();
  const rows = items.map((it, i): MealLogItemRow => ({
    id: it.id,
    meal_log_id: mealId,
    user_id: uid,
    kind: it.kind,
    food_id: it.kind === "food" ? it.food_id : null,
    recipe_id: it.kind === "recipe" ? it.recipe_id : null,
    grams: it.grams ?? 1,
    serving_id: it.kind === "food" ? (it.serving_id ?? null) : null,
    serving_qty: it.kind === "quick" ? null : (it.serving_qty ?? null),
    display_name: it.name,
    snapshot: it.snapshot ?? (it.kind === "quick" ? { ...it.quick } : {}),
    snapshot_version: 1,
    sort_order: i,
    created_at: now,
    updated_at: now,
  }));
  const { totals } = sumVectors(rows.map((r) => r.snapshot));
  const meal: MealLogRow = {
    id: mealId,
    user_id: uid,
    log_date: input.date,
    tz_offset_minutes: tzOffset(),
    meal_slot: input.slot,
    logged_at: now,
    source: input.source ?? "manual",
    note: input.note ?? null,
    photo_path: input.photoPath ?? null,
    kcal: num(totals.kcal),
    protein_g: num(totals.protein_g),
    carbs_g: num(totals.carbs_g),
    fat_g: num(totals.fat_g),
    created_at: now,
    updated_at: now,
  };
  return { meal, items: rows };
}

const EMPTY_DAY: DayData = { meals: [], items: [] };
const putMeal = (d: DayData | undefined, meal: MealLogRow, items: MealLogItemRow[], pending: boolean): DayData => {
  const base = d ?? EMPTY_DAY;
  const others = (base.pendingMealIds ?? []).filter((id) => id !== meal.id);
  return {
    meals: [...base.meals.filter((m) => m.id !== meal.id), meal],
    items: [...base.items.filter((i) => i.meal_log_id !== meal.id), ...items],
    pendingMealIds: pending ? [...others, meal.id] : others,
  };
};
const dropMeal = (d: DayData | undefined, mealId: string): DayData | undefined =>
  d && {
    meals: d.meals.filter((m) => m.id !== mealId),
    items: d.items.filter((i) => i.meal_log_id !== mealId),
    pendingMealIds: d.pendingMealIds?.filter((id) => id !== mealId),
  };
const addToTotals = (t: DailyTotalsDay | null | undefined, slot: MealSlot, vectors: NutrientVector[]) =>
  t && {
    ...t,
    totals: sumVectors([t.totals, ...vectors]).totals,
    by_slot: { ...t.by_slot, [slot]: sumVectors([t.by_slot[slot] ?? {}, ...vectors]).totals },
    meal_count: t.meal_count + 1,
    item_count: t.item_count + vectors.length,
  };
const healthMeal = (meal: MealLogRow, totals: NutrientVector, version: number) => ({
  id: meal.id,
  name: `${meal.meal_slot} · ${meal.log_date}`,
  startIso: meal.logged_at,
  endIso: meal.logged_at,
  version,
  kcal: totals.kcal,
  protein_g: totals.protein_g,
  carbs_g: totals.carbs_g,
  fat_g: totals.fat_g,
  caffeine_mg: totals.caffeine_mg,
  water_ml: totals.water_g,
});

/**
 * Diary writes: logMeal (optimistic; offline → queued for replay), updateItem,
 * deleteItem, deleteMeal (all optimistic with rollback) and duplicateMeal.
 * Apple Health writes are fire-and-forget and never block the diary.
 */
export const useLogMeal = () => {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const day = (date: string) => qc.getQueryData<DayData>(dayKey(date, uid));
  const mealOfItem = (date: string, itemId: string) => day(date)?.items.find((i) => i.id === itemId)?.meal_log_id ?? null;
  const rollback = (date: string, prev: DayData | undefined) => {
    if (prev) qc.setQueryData(dayKey(date, uid), prev);
  };
  const invalidateTotals = (date: string) => qc.invalidateQueries({ queryKey: totalsKey(date, uid) });
  /** After an edit the meal's totals changed — re-write it to Health under a newer version. */
  const resyncHealth = (date: string, mealId: string) => {
    const d = day(date);
    const meal = d?.meals.find((m) => m.id === mealId);
    if (!d || !meal) return;
    const { totals } = sumVectors(d.items.filter((i) => i.meal_log_id === mealId).map((i) => i.snapshot));
    void writeMealToHealth(healthMeal(meal, totals, Date.now()));
  };
  const patchQueued = (mealId: string, edit: (items: LogMealItem[]) => LogMealItem[]) => {
    const entry = getPendingMeals(uid).find((p) => p.id === mealId);
    if (entry) updatePendingMeal(mealId, { p_items: edit(entry.args.p_items) });
  };

  const log = useMutation({
    mutationFn: async ({ args }: { args: LogMealArgs; input: LogMealInput; ph: ReturnType<typeof placeholder> }): Promise<LogResult> => {
      try {
        return { queued: false, payload: await logMealRpc(supabase, args) };
      } catch (e) {
        if (uid && netErr(e)) {
          queueMeal(args, uid);
          return { queued: true, mealId: args.p_meal_id };
        }
        throw e;
      }
    },
    onMutate: async ({ input, ph }) => {
      await qc.cancelQueries({ queryKey: dayKey(input.date, uid) });
      qc.setQueryData<DayData>(dayKey(input.date, uid), (d) => putMeal(d, ph.meal, ph.items, true));
      qc.setQueryData<DailyTotalsDay | null>(totalsKey(input.date, uid), (t) => addToTotals(t, input.slot, ph.items.map((i) => i.snapshot)));
    },
    onSuccess: (res, { input }) => {
      if (res.queued) {
        toast("Saved offline — syncs when you're back", { description: "It's kept on this device until you're online." });
        return;
      }
      qc.setQueryData<DayData>(dayKey(input.date, uid), (d) => putMeal(d, res.payload.meal, res.payload.items, false));
      invalidateTotals(input.date);
      void writeMealToHealth(healthMeal(res.payload.meal, res.payload.totals, 1));
    },
    onError: (e, { input, ph }) => {
      qc.setQueryData<DayData>(dayKey(input.date, uid), (d) => dropMeal(d, ph.meal.id));
      invalidateTotals(input.date);
      toast.error(errorCopy(e));
    },
  });

  const update = useMutation({
    mutationFn: async ({ itemId, patch, mealId }: { itemId: string; patch: MealItemPatch; date: string; mealId: string | null }) => {
      if (mealId && queued(uid, mealId)) {
        patchQueued(mealId, (items) => items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
        return null;
      }
      return updateMealItem(supabase, itemId, patch);
    },
    onMutate: async ({ itemId, patch, date }) => {
      await qc.cancelQueries({ queryKey: dayKey(date, uid) });
      const prev = day(date);
      const g = patch.grams;
      if (g !== undefined) {
        // Snapshots are linear in grams, so the preview is exact until the server re-snapshots.
        qc.setQueryData<DayData>(dayKey(date, uid), (d) =>
          d && {
            ...d,
            items: d.items.map((i) =>
              i.id === itemId && i.kind !== "quick" && i.grams > 0
                ? { ...i, grams: g, serving_qty: patch.serving_qty ?? i.serving_qty, snapshot: scale(i.snapshot, (100 * g) / i.grams) }
                : i,
            ),
          });
      }
      return { prev };
    },
    onSuccess: (res, { date, mealId }) => {
      if (res) {
        qc.setQueryData<DayData>(dayKey(date, uid), (d) =>
          d && {
            ...d,
            meals: d.meals.map((m) => (m.id === res.meal.id ? res.meal : m)),
            items: d.items.map((i) => (i.id === res.item.id ? res.item : i)),
          });
      }
      invalidateTotals(date);
      if (mealId && res) resyncHealth(date, mealId);
    },
    onError: (e, { date }, ctx) => {
      rollback(date, ctx?.prev);
      toast.error(errorCopy(e));
    },
  });

  const del = useMutation({
    mutationFn: async ({ itemId, mealId, date }: { itemId: string; date: string; mealId: string | null }) => {
      if (mealId && queued(uid, mealId)) {
        patchQueued(mealId, (items) => items.filter((i) => i.id !== itemId));
        return;
      }
      await deleteMealItem(supabase, itemId);
      // Last item gone: an empty meal_logs row would linger and still count as a
      // meal in daily totals. onMutate already dropped the item from the cache.
      if (mealId && !day(date)?.items.some((i) => i.meal_log_id === mealId)) {
        await deleteMealRpc(supabase, mealId);
        void deleteMealFromHealth(mealId);
      }
    },
    onMutate: async ({ itemId, mealId, date }) => {
      await qc.cancelQueries({ queryKey: dayKey(date, uid) });
      const prev = day(date);
      qc.setQueryData<DayData>(dayKey(date, uid), (d) => {
        if (!d) return d;
        const items = d.items.filter((i) => i.id !== itemId);
        const next = { ...d, items };
        return mealId && !items.some((i) => i.meal_log_id === mealId) ? dropMeal(next, mealId) : next;
      });
      return { prev };
    },
    onSuccess: (_r, { date, mealId }) => {
      invalidateTotals(date);
      if (mealId) resyncHealth(date, mealId);
    },
    onError: (e, { date }, ctx) => {
      rollback(date, ctx?.prev);
      toast.error(errorCopy(e));
    },
  });

  const delMeal = useMutation({
    mutationFn: async ({ mealId }: { mealId: string; date: string }) => {
      if (queued(uid, mealId)) {
        removePendingMeal(mealId);
        return;
      }
      await deleteMealRpc(supabase, mealId);
    },
    onMutate: async ({ mealId, date }) => {
      await qc.cancelQueries({ queryKey: dayKey(date, uid) });
      const prev = day(date);
      qc.setQueryData<DayData>(dayKey(date, uid), (d) => dropMeal(d, mealId));
      return { prev };
    },
    onSuccess: (_r, { mealId, date }) => {
      invalidateTotals(date);
      void deleteMealFromHealth(mealId);
    },
    onError: (e, { date }, ctx) => {
      rollback(date, ctx?.prev);
      toast.error(errorCopy(e));
    },
  });

  const dup = useMutation({
    mutationFn: ({ sourceMealId, newMealId, date, slot }: { sourceMealId: string; newMealId: string; date: string; slot: MealSlot }) =>
      duplicateMealRpc(supabase, { sourceMealId, newMealId, date, tz: tzOffset(), slot }),
    onSuccess: (payload, { date }) => {
      qc.setQueryData<DayData>(dayKey(date, uid), (d) => putMeal(d, payload.meal, payload.items, false));
      invalidateTotals(date);
      void writeMealToHealth(healthMeal(payload.meal, payload.totals, 1));
    },
    onError: (e) => toast.error(errorCopy(e)),
  });

  return {
    /** Optimistic insert; resolves `{queued: true}` when saved offline for replay. */
    logMeal: (input: LogMealInput): Promise<LogResult> => {
      if (!uid) return Promise.reject(new Error("UNAUTHENTICATED"));
      const mealId = input.mealId ?? crypto.randomUUID();
      const items: ItemWithId[] = input.items.map((it) => ({ ...it, id: it.id ?? crypto.randomUUID() }));
      const args: LogMealArgs = {
        p_meal_id: mealId,
        p_log_date: input.date,
        p_tz_offset_minutes: tzOffset(),
        p_meal_slot: input.slot,
        p_items: items.map(toRpcItem),
        p_note: input.note ?? null,
        p_source: input.source ?? "manual",
        p_photo_path: input.photoPath ?? null,
      };
      return log.mutateAsync({ args, input, ph: placeholder(uid, mealId, input, items) });
    },
    updateItem: (itemId: string, patch: MealItemPatch, date: string) =>
      update.mutateAsync({ itemId, patch, date, mealId: mealOfItem(date, itemId) }),
    deleteItem: (itemId: string, date: string) => del.mutateAsync({ itemId, date, mealId: mealOfItem(date, itemId) }),
    deleteMeal: (mealId: string, date: string) => delMeal.mutateAsync({ mealId, date }),
    duplicateMeal: (sourceMealId: string, target: { date: string; slot: MealSlot }) =>
      dup.mutateAsync({ sourceMealId, newMealId: crypto.randomUUID(), ...target }),
    pending: log.isPending || update.isPending || del.isPending || delMeal.isPending || dup.isPending,
  };
};
