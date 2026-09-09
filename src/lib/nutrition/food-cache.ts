// Per-user local food cache: instant results (favorites → frequent → recent)
// before the server search answers, and the offline fallback for foods the
// user has already logged. Best-effort: every storage call is guarded.

import { normalizeQuery } from "./format";
import type { Food } from "./types";

const PREFIX = "nutrition_food_cache_v1:"
/** Exposed for the sign-out sweep. */
export const FOOD_CACHE_PREFIX = PREFIX;;
export const FOOD_CACHE_MAX_FOODS = 150;
export const FOOD_CACHE_MAX_CHARS = 200 * 1024;

export type LocalSearchFilter = "all" | "favorites" | "mine";

export interface FoodCache {
  foods: Record<string, Food>;
  /** id → last used (ms epoch). */
  recents: Record<string, number>;
  /** id → times logged. */
  counts: Record<string, number>;
  favorites: string[];
}

const empty = (): FoodCache => ({ foods: {}, recents: {}, counts: {}, favorites: [] });

// Parsed once per distinct stored string: the blob is up to 200 KB and was
// re-parsed on every read, including inside render. The raw string is still
// compared on each read (cheap; getItem is memory-backed after the first
// hit) so a write from anywhere else invalidates it.
const parsedByUid = new Map<string, { raw: string; cache: FoodCache }>();

/** Read the cache for a user; any storage/parse failure yields an empty cache. */
export function readFoodCache(uid: string): FoodCache {
  try {
    const raw = localStorage.getItem(PREFIX + uid);
    if (!raw) return empty();
    const hit = parsedByUid.get(uid);
    if (hit && hit.raw === raw) return hit.cache;
    const parsed = JSON.parse(raw) as Partial<FoodCache> | null;
    if (!parsed || typeof parsed !== "object") return empty();
    const c: FoodCache = {
      foods: parsed.foods && typeof parsed.foods === "object" ? parsed.foods : {},
      recents: parsed.recents && typeof parsed.recents === "object" ? parsed.recents : {},
      counts: parsed.counts && typeof parsed.counts === "object" ? parsed.counts : {},
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter((f): f is string => typeof f === "string") : [],
    };
    parsedByUid.set(uid, { raw, cache: c });
    return c;
  } catch {
    return empty();
  }
}

/** Drop least-recently-used non-favorite foods until both caps hold (favorites are never evicted). */
function evict(c: FoodCache): void {
  const fav = new Set(c.favorites);
  // Serialised once; each eviction subtracts its entry's size instead of
  // re-stringifying the whole cache per check.
  let size = JSON.stringify(c).length;
  const over = () => Object.keys(c.foods).length > FOOD_CACHE_MAX_FOODS || size > FOOD_CACHE_MAX_CHARS;
  const lru = Object.keys(c.foods)
    .filter((id) => !fav.has(id))
    .sort((a, b) => (c.recents[a] ?? 0) - (c.recents[b] ?? 0));
  const drop = (id: string) => {
    delete c.foods[id];
    delete c.recents[id];
    delete c.counts[id];
  };
  for (const id of lru) {
    if (!over()) break;
    size -= JSON.stringify(c.foods[id]).length + 48;
    drop(id);
  }
  // The estimate can land a hair over the byte cap; settle it with the real
  // number — this loop runs zero or one stringify in practice.
  for (const id of lru) {
    if (!(id in c.foods)) continue;
    if (JSON.stringify(c).length <= FOOD_CACHE_MAX_CHARS) break;
    drop(id);
  }
}

function write(uid: string, c: FoodCache): void {
  try {
    evict(c);
    const raw = JSON.stringify(c);
    parsedByUid.set(uid, { raw, cache: c });
    localStorage.setItem(PREFIX + uid, raw);
  } catch {
    /* quota / private mode — the cache is a convenience */
  }
}

/** Record that `food` was just used (upserts the food, bumps count + recency). */
export function touchFood(uid: string, food: Food, now: number = Date.now()): void {
  const c = readFoodCache(uid);
  c.foods[food.id] = food;
  c.recents[food.id] = now;
  c.counts[food.id] = (c.counts[food.id] ?? 0) + 1;
  write(uid, c);
}

/** Flip a food's favorite flag; returns the new state. */
export function toggleFavorite(uid: string, id: string): boolean {
  const c = readFoodCache(uid);
  const on = !c.favorites.includes(id);
  c.favorites = on ? [...c.favorites, id] : c.favorites.filter((f) => f !== id);
  write(uid, c);
  return on;
}

/** Is this food starred by the user (locally)? */
export const isFavorite = (uid: string, id: string): boolean => readFoodCache(uid).favorites.includes(id);

/** A cached food by id, or null. */
export const getCachedFood = (uid: string, id: string): Food | null => readFoodCache(uid).foods[id] ?? null;

/** Instant local matches, ranked favorites → use count → recency; empty query lists everything. */
export function localSearch(uid: string, q: string, filter: LocalSearchFilter = "all", limit = 20): Food[] {
  const c = readFoodCache(uid);
  const nq = normalizeQuery(q);
  const fav = new Set(c.favorites);
  const matches = (f: Food) =>
    nq === "" || normalizeQuery(f.name).includes(nq) || normalizeQuery(f.brand ?? "").includes(nq);
  const passes = (f: Food) =>
    filter === "all" || (filter === "favorites" ? fav.has(f.id) : f.ownerId === uid);
  return Object.values(c.foods)
    .filter((f) => passes(f) && matches(f))
    .sort(
      (a, b) =>
        Number(fav.has(b.id)) - Number(fav.has(a.id)) ||
        (c.counts[b.id] ?? 0) - (c.counts[a.id] ?? 0) ||
        (c.recents[b.id] ?? 0) - (c.recents[a.id] ?? 0),
    )
    .slice(0, limit);
}
