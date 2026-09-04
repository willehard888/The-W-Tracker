// Offline meal queue — a meal logged without network is persisted and replayed
// when connectivity returns. `log_meal` is idempotent on the client-generated
// meal id (INSERT … ON CONFLICT DO NOTHING), so a replay can never double-log;
// a "duplicate key" reply therefore counts as synced.

import { isNetworkError as sharedIsNetworkError } from "@/lib/offline-checkin";
import type { MealSlot } from "./types";

export const PENDING_MEALS_KEY = "pending_meals_v1";
export const PENDING_MEALS_MAX = 50;
export const PENDING_MEAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type MealSource = "manual" | "barcode" | "scan" | "recipe" | "quick" | "duplicate";

/** One `log_meal` item — grams are always resolved client-side (see resolve-grams). */
export interface LogMealItem {
  id: string;
  kind: "food" | "recipe" | "quick";
  food_id?: string | null;
  recipe_id?: string | null;
  grams: number;
  serving_id?: string | null;
  serving_qty?: number | null;
  name?: string | null;
  quick?: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null;
}

/** Arguments of the `log_meal` RPC. */
export interface LogMealArgs {
  p_meal_id: string;
  p_log_date: string;
  p_tz_offset_minutes: number;
  p_meal_slot: MealSlot;
  p_items: LogMealItem[];
  p_note?: string | null;
  p_source?: MealSource | null;
}

export interface PendingMeal {
  /** = args.p_meal_id — re-queuing the same meal replaces the entry. */
  id: string;
  args: LogMealArgs;
  userId: string;
  queuedAt: number;
}

export interface FlushDeps {
  getUserId: () => Promise<string | null>;
  logMeal: (args: LogMealArgs) => Promise<void>;
  /** Defaults to the shared offline-checkin heuristic. */
  isNetworkError?: (e: unknown) => boolean;
  now?: () => number;
}

export interface FlushSummary {
  synced: number;
  failed: number;
  dropped: number;
}

const errShape = (e: unknown): { message?: string; code?: string } =>
  e && typeof e === "object" ? (e as { message?: string; code?: string }) : { message: String(e) };

/** Postgres unique-violation (23505) or its message — the meal already landed. */
export const isDuplicateError = (e: unknown): boolean => {
  const { message = "", code } = errShape(e);
  return code === "23505" || /duplicate key|23505/i.test(message);
};

const defaultIsNetworkError = (e: unknown): boolean => sharedIsNetworkError(errShape(e));

function readAll(): PendingMeal[] {
  try {
    const raw = localStorage.getItem(PENDING_MEALS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as PendingMeal[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: PendingMeal[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(PENDING_MEALS_KEY);
    else localStorage.setItem(PENDING_MEALS_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable — nothing we can do */
  }
}

/** Drop entries older than the TTL, then the oldest beyond the cap. */
function prune(list: PendingMeal[], now: number): { list: PendingMeal[]; dropped: number } {
  const fresh = list.filter((e) => now - e.queuedAt <= PENDING_MEAL_TTL_MS);
  const kept = fresh.slice(Math.max(0, fresh.length - PENDING_MEALS_MAX));
  return { list: kept, dropped: list.length - kept.length };
}

/** Persist a failed log_meal call for replay; same meal id replaces the older entry. */
export function queueMeal(args: LogMealArgs, userId: string, now: number = Date.now()): PendingMeal {
  const entry: PendingMeal = { id: args.p_meal_id, args, userId, queuedAt: now };
  const rest = readAll().filter((e) => e.id !== entry.id);
  writeAll(prune([...rest, entry], now).list);
  return entry;
}

/** Queued meals (oldest first), optionally only one user's. */
export function getPendingMeals(userId?: string): PendingMeal[] {
  const all = readAll();
  return userId ? all.filter((e) => e.userId === userId) : all;
}

/** Forget a queued meal (e.g. the user deleted it before it synced). */
export function removePendingMeal(id: string): void {
  writeAll(readAll().filter((e) => e.id !== id));
}

/** Edit a queued meal's args in place; false when no such entry. */
export function updatePendingMeal(id: string, patch: Partial<LogMealArgs>): boolean {
  const all = readAll();
  const entry = all.find((e) => e.id === id);
  if (!entry) return false;
  entry.args = { ...entry.args, ...patch, p_meal_id: entry.args.p_meal_id };
  writeAll(all);
  return true;
}

/** Replay the queue for the signed-in user; other users' entries are left untouched. */
export async function flushPendingMeals(deps: FlushDeps): Promise<FlushSummary> {
  const now = deps.now?.() ?? Date.now();
  const isNet = deps.isNetworkError ?? defaultIsNetworkError;
  const pruned = prune(readAll(), now);
  const summary: FlushSummary = { synced: 0, failed: 0, dropped: pruned.dropped };
  const uid = pruned.list.length ? await deps.getUserId() : null;
  const keep: PendingMeal[] = [];
  let offline = false;
  for (const entry of pruned.list) {
    if (!uid || entry.userId !== uid || offline) { keep.push(entry); continue; }
    try {
      await deps.logMeal(entry.args);
      summary.synced++;
    } catch (e) {
      if (isDuplicateError(e)) summary.synced++;
      else if (isNet(e)) { offline = true; keep.push(entry); }
      else summary.failed++;
    }
  }
  writeAll(keep);
  return summary;
}
