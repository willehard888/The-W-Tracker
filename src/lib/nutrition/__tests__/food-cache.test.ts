// The local food cache is the "instant results" layer and the offline
// fallback. It must rank favorites → frequent → recent, respect both caps
// without ever evicting a favorite, and survive a broken localStorage.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  touchFood,
  toggleFavorite,
  isFavorite,
  getCachedFood,
  localSearch,
  readFoodCache,
  FOOD_CACHE_MAX_FOODS,
  FOOD_CACHE_MAX_CHARS,
} from "../food-cache";
import type { Food } from "../types";

const UID = "user-1";
const KEY = `nutrition_food_cache_v1:${UID}`;

const food = (id: string, over: Partial<Food> = {}): Food => ({
  id,
  name: `Food ${id}`,
  source: "fineli",
  per100g: { kcal: 100 },
  servings: [],
  ...over,
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("touchFood / getCachedFood", () => {
  it("upserts the food and bumps count + recency", () => {
    touchFood(UID, food("a"), 1000);
    touchFood(UID, food("a", { name: "Renamed" }), 2000);
    const c = readFoodCache(UID);
    expect(c.foods.a.name).toBe("Renamed");
    expect(c.counts.a).toBe(2);
    expect(c.recents.a).toBe(2000);
    expect(getCachedFood(UID, "a")?.name).toBe("Renamed");
    expect(getCachedFood(UID, "zzz")).toBeNull();
  });

  it("is per user", () => {
    touchFood(UID, food("a"));
    expect(getCachedFood("user-2", "a")).toBeNull();
  });
});

describe("favorites", () => {
  it("toggle flips and reports the new state; isFavorite reads it", () => {
    expect(isFavorite(UID, "a")).toBe(false);
    expect(toggleFavorite(UID, "a")).toBe(true);
    expect(isFavorite(UID, "a")).toBe(true);
    expect(toggleFavorite(UID, "a")).toBe(false);
    expect(isFavorite(UID, "a")).toBe(false);
  });
});

describe("localSearch", () => {
  beforeEach(() => {
    touchFood(UID, food("recent", { name: "Kanan rinta" }), 3000);
    touchFood(UID, food("frequent", { name: "Kanankoipi" }), 1000);
    touchFood(UID, food("frequent", { name: "Kanankoipi" }), 1500);
    touchFood(UID, food("fav", { name: "Kana curry" }), 500);
    touchFood(UID, food("mine", { name: "Oma kana", ownerId: UID }), 100);
    touchFood(UID, food("other", { name: "Leipä", brand: "Fazer Kana" }), 200);
    toggleFavorite(UID, "fav");
  });

  it("ranks favorites → use count → recency", () => {
    expect(localSearch(UID, "kana").map((f) => f.id)).toEqual(["fav", "frequent", "recent", "other", "mine"]);
  });

  it("matches name or brand after normalisation (diacritics, case, spacing)", () => {
    expect(localSearch(UID, "  LEIPÄ ").map((f) => f.id)).toEqual(["other"]);
    expect(localSearch(UID, "leipa").map((f) => f.id)).toEqual(["other"]);
    expect(localSearch(UID, "fazer").map((f) => f.id)).toEqual(["other"]);
    expect(localSearch(UID, "nothing")).toEqual([]);
  });

  it("empty query lists everything (recents mode); limit applies", () => {
    expect(localSearch(UID, "")).toHaveLength(5);
    expect(localSearch(UID, "", "all", 2)).toHaveLength(2);
  });

  it("filters: favorites and mine", () => {
    expect(localSearch(UID, "", "favorites").map((f) => f.id)).toEqual(["fav"]);
    expect(localSearch(UID, "", "mine").map((f) => f.id)).toEqual(["mine"]);
  });
});

describe("eviction", () => {
  it(`keeps at most ${FOOD_CACHE_MAX_FOODS} foods, dropping the least recently used but never favorites`, () => {
    touchFood(UID, food("fav-old"), 0);
    toggleFavorite(UID, "fav-old");
    for (let i = 1; i <= FOOD_CACHE_MAX_FOODS + 5; i++) touchFood(UID, food(`f${i}`), i);
    const c = readFoodCache(UID);
    expect(Object.keys(c.foods)).toHaveLength(FOOD_CACHE_MAX_FOODS);
    expect(c.foods["fav-old"]).toBeDefined();
    // the oldest non-favorites (f1..f6) are gone, the newest survive
    for (const id of ["f1", "f2", "f6"]) expect(c.foods[id]).toBeUndefined();
    expect(c.foods[`f${FOOD_CACHE_MAX_FOODS + 5}`]).toBeDefined();
    expect(c.counts.f1).toBeUndefined();
    expect(c.recents.f1).toBeUndefined();
  });

  it(`keeps the serialized cache under ${FOOD_CACHE_MAX_CHARS} chars`, () => {
    const big = "x".repeat(60 * 1024);
    for (let i = 1; i <= 6; i++) touchFood(UID, food(`b${i}`, { name: big }), i);
    const raw = localStorage.getItem(KEY) ?? "";
    expect(raw.length).toBeLessThanOrEqual(FOOD_CACHE_MAX_CHARS);
    const c = readFoodCache(UID);
    expect(c.foods.b1).toBeUndefined();
    expect(c.foods.b6).toBeDefined();
  });

  it("stops evicting when only favorites remain, even if still over the byte cap", () => {
    const big = "x".repeat(120 * 1024);
    toggleFavorite(UID, "p");
    toggleFavorite(UID, "q");
    touchFood(UID, food("p", { name: big }), 1);
    touchFood(UID, food("q", { name: big }), 2);
    expect((localStorage.getItem(KEY) ?? "").length).toBeGreaterThan(FOOD_CACHE_MAX_CHARS);
    const c = readFoodCache(UID);
    expect(Object.keys(c.foods).sort()).toEqual(["p", "q"]);
  });
});

describe("resilience", () => {
  it("corrupt or partial JSON yields sane defaults", () => {
    localStorage.setItem(KEY, "{not json");
    expect(readFoodCache(UID)).toEqual({ foods: {}, recents: {}, counts: {}, favorites: [] });
    localStorage.setItem(KEY, JSON.stringify({ foods: null, favorites: ["a", 3] }));
    expect(readFoodCache(UID)).toEqual({ foods: {}, recents: {}, counts: {}, favorites: ["a"] });
    localStorage.setItem(KEY, "null");
    expect(readFoodCache(UID).favorites).toEqual([]);
  });

  it("foods without counts/recents (partial cache) still rank and evict deterministically", () => {
    localStorage.setItem(KEY, JSON.stringify({ foods: { a: food("a"), b: food("b") }, recents: null, counts: "x", favorites: ["b"] }));
    expect(readFoodCache(UID)).toMatchObject({ recents: {}, counts: {} });
    expect(localSearch(UID, "food").map((f) => f.id)).toEqual(["b", "a"]);
    touchFood(UID, food("c"), 5);
    expect(localSearch(UID, "").map((f) => f.id)).toEqual(["b", "c", "a"]);
  });

  it("a throwing localStorage never throws out of the API", () => {
    const boom = () => { throw new Error("SecurityError"); };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom, removeItem: boom, clear: boom });
    expect(() => touchFood(UID, food("a"))).not.toThrow();
    expect(toggleFavorite(UID, "a")).toBe(true);
    expect(isFavorite(UID, "a")).toBe(false);
    expect(getCachedFood(UID, "a")).toBeNull();
    expect(localSearch(UID, "a")).toEqual([]);
  });
});
