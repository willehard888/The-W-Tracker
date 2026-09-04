// The offline meal queue: a meal logged on the metro must reach the server
// once — and only once — when the network returns. log_meal is idempotent on
// the client meal id, so "duplicate key" is a success; a network error keeps
// the entry; a business error drops it (replaying would fail forever).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  queueMeal,
  getPendingMeals,
  removePendingMeal,
  updatePendingMeal,
  flushPendingMeals,
  isDuplicateError,
  PENDING_MEALS_KEY,
  PENDING_MEALS_MAX,
  PENDING_MEAL_TTL_MS,
  type LogMealArgs,
} from "../offline-meals";

const args = (id: string, over: Partial<LogMealArgs> = {}): LogMealArgs => ({
  p_meal_id: id,
  p_log_date: "2026-09-04",
  p_tz_offset_minutes: 180,
  p_meal_slot: "lunch",
  p_items: [{ id: `${id}-i1`, kind: "food", food_id: "f1", grams: 150 }],
  ...over,
});

const NOW = 1_800_000_000_000;
const netErr = (e: unknown) => e instanceof Error && e.message === "Failed to fetch";
const deps = (over: Partial<Parameters<typeof flushPendingMeals>[0]> = {}) => ({
  getUserId: vi.fn().mockResolvedValue("u1"),
  logMeal: vi.fn().mockResolvedValue(undefined),
  isNetworkError: netErr,
  now: () => NOW,
  ...over,
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("queue basics", () => {
  it("round-trips entries oldest first and removes the key when empty", () => {
    queueMeal(args("m1"), "u1", 1);
    queueMeal(args("m2"), "u1", 2);
    expect(getPendingMeals().map((e) => e.id)).toEqual(["m1", "m2"]);
    expect(getPendingMeals()[0]).toEqual({ id: "m1", args: args("m1"), userId: "u1", queuedAt: 1 });
    removePendingMeal("m1");
    removePendingMeal("m2");
    expect(localStorage.getItem(PENDING_MEALS_KEY)).toBeNull();
  });

  it("re-queuing the same meal id replaces the entry", () => {
    queueMeal(args("m1"), "u1", 1);
    queueMeal(args("m1", { p_meal_slot: "dinner" }), "u1", 2);
    const all = getPendingMeals();
    expect(all).toHaveLength(1);
    expect(all[0].args.p_meal_slot).toBe("dinner");
    expect(all[0].queuedAt).toBe(2);
  });

  it("filters by user when asked", () => {
    queueMeal(args("m1"), "u1", 1);
    queueMeal(args("m2"), "u2", 2);
    expect(getPendingMeals("u2").map((e) => e.id)).toEqual(["m2"]);
  });

  it(`caps the queue at ${PENDING_MEALS_MAX}, dropping the oldest`, () => {
    for (let i = 1; i <= PENDING_MEALS_MAX + 3; i++) queueMeal(args(`m${i}`), "u1", i);
    const ids = getPendingMeals().map((e) => e.id);
    expect(ids).toHaveLength(PENDING_MEALS_MAX);
    expect(ids[0]).toBe("m4");
  });

  it("updatePendingMeal patches args in place but never the meal id", () => {
    queueMeal(args("m1"), "u1", 1);
    expect(updatePendingMeal("m1", { p_note: "hi", p_meal_id: "hijack" })).toBe(true);
    expect(getPendingMeals()[0].args).toMatchObject({ p_note: "hi", p_meal_id: "m1" });
    expect(updatePendingMeal("nope", { p_note: "x" })).toBe(false);
  });

  it("tolerates garbage in storage", () => {
    localStorage.setItem(PENDING_MEALS_KEY, "{oops");
    expect(getPendingMeals()).toEqual([]);
    localStorage.setItem(PENDING_MEALS_KEY, JSON.stringify({ not: "an array" }));
    expect(getPendingMeals()).toEqual([]);
  });
});

describe("isDuplicateError", () => {
  it("matches Postgres 23505 by code or message, nothing else", () => {
    expect(isDuplicateError({ code: "23505", message: "" })).toBe(true);
    expect(isDuplicateError(new Error("duplicate key value violates unique constraint"))).toBe(true);
    expect(isDuplicateError("23505")).toBe(true);
    expect(isDuplicateError(new Error("PREMIUM_REQUIRED"))).toBe(false);
    expect(isDuplicateError(null)).toBe(false);
  });
});

describe("flushPendingMeals", () => {
  it("replays the user's entries in order and clears them", async () => {
    queueMeal(args("m1"), "u1", NOW - 1000);
    queueMeal(args("m2"), "u1", NOW - 500);
    const logMeal = vi.fn<(a: LogMealArgs) => Promise<void>>().mockResolvedValue(undefined);
    expect(await flushPendingMeals(deps({ logMeal }))).toEqual({ synced: 2, failed: 0, dropped: 0 });
    expect(logMeal.mock.calls.map((c) => c[0].p_meal_id)).toEqual(["m1", "m2"]);
    expect(getPendingMeals()).toEqual([]);
  });

  it("duplicate key = already landed = synced", async () => {
    queueMeal(args("m1"), "u1", NOW);
    const d = deps({ logMeal: vi.fn().mockRejectedValue({ code: "23505", message: "duplicate key" }) });
    expect(await flushPendingMeals(d)).toEqual({ synced: 1, failed: 0, dropped: 0 });
    expect(getPendingMeals()).toEqual([]);
  });

  it("a network error keeps the entry and stops trying the rest this round", async () => {
    queueMeal(args("m1"), "u1", NOW - 2);
    queueMeal(args("m2"), "u1", NOW - 1);
    const d = deps({ logMeal: vi.fn().mockRejectedValue(new Error("Failed to fetch")) });
    expect(await flushPendingMeals(d)).toEqual({ synced: 0, failed: 0, dropped: 0 });
    expect(d.logMeal).toHaveBeenCalledTimes(1);
    expect(getPendingMeals().map((e) => e.id)).toEqual(["m1", "m2"]);
  });

  it("any other error drops the entry and counts it as failed", async () => {
    queueMeal(args("m1"), "u1", NOW);
    queueMeal(args("m2"), "u1", NOW);
    const d = deps({
      logMeal: vi.fn().mockRejectedValueOnce(new Error("PREMIUM_REQUIRED")).mockResolvedValueOnce(undefined),
    });
    expect(await flushPendingMeals(d)).toEqual({ synced: 1, failed: 1, dropped: 0 });
    expect(getPendingMeals()).toEqual([]);
  });

  it("never replays another user's entries — they stay queued, untouched", async () => {
    queueMeal(args("mine"), "u1", NOW);
    queueMeal(args("theirs"), "u2", NOW);
    const d = deps();
    expect(await flushPendingMeals(d)).toEqual({ synced: 1, failed: 0, dropped: 0 });
    expect(d.logMeal).toHaveBeenCalledTimes(1);
    expect(getPendingMeals().map((e) => e.id)).toEqual(["theirs"]);
  });

  it("signed out: nothing is sent, everything stays", async () => {
    queueMeal(args("m1"), "u1", NOW);
    const d = deps({ getUserId: vi.fn().mockResolvedValue(null) });
    expect(await flushPendingMeals(d)).toEqual({ synced: 0, failed: 0, dropped: 0 });
    expect(d.logMeal).not.toHaveBeenCalled();
    expect(getPendingMeals()).toHaveLength(1);
  });

  it("empty queue: does not even ask for the user", async () => {
    const d = deps();
    expect(await flushPendingMeals(d)).toEqual({ synced: 0, failed: 0, dropped: 0 });
    expect(d.getUserId).not.toHaveBeenCalled();
  });

  it("drops entries older than 7 days (boundary: exactly 7 days is kept)", async () => {
    queueMeal(args("stale"), "u1", NOW - PENDING_MEAL_TTL_MS - 1);
    queueMeal(args("edge"), "u1", NOW - PENDING_MEAL_TTL_MS);
    const logMeal = vi.fn<(a: LogMealArgs) => Promise<void>>().mockResolvedValue(undefined);
    expect(await flushPendingMeals(deps({ logMeal }))).toEqual({ synced: 1, failed: 0, dropped: 1 });
    expect(logMeal.mock.calls[0][0].p_meal_id).toBe("edge");
  });

  it("uses the shared network heuristic when none is injected", async () => {
    queueMeal(args("m1"), "u1", NOW);
    const d = deps({ isNetworkError: undefined, logMeal: vi.fn().mockRejectedValue(new Error("Failed to fetch")) });
    expect(await flushPendingMeals(d)).toEqual({ synced: 0, failed: 0, dropped: 0 });
    expect(getPendingMeals()).toHaveLength(1);
  });

  it("defaults `now` to the wall clock", async () => {
    queueMeal(args("m1"), "u1");
    const d = deps({ now: undefined });
    expect(await flushPendingMeals(d)).toEqual({ synced: 1, failed: 0, dropped: 0 });
  });

  it("a throwing localStorage never throws out of the API", async () => {
    const boom = () => { throw new Error("SecurityError"); };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom, removeItem: boom, clear: boom });
    expect(() => queueMeal(args("m1"), "u1")).not.toThrow();
    expect(getPendingMeals()).toEqual([]);
    expect(() => removePendingMeal("m1")).not.toThrow();
    expect(updatePendingMeal("m1", {})).toBe(false);
    expect(await flushPendingMeals(deps())).toEqual({ synced: 0, failed: 0, dropped: 0 });
  });
});
