// scale() mirrors SQL nutrition_for_grams byte-for-byte; the fixture test
// covers the numbers, this file covers the guards and rounding rule.
import { describe, it, expect } from "vitest";
import { roundTo, scale, withDerived, BASE_KEYS } from "../scale";
import { NUTRIENT_KEYS } from "../types";

describe("roundTo — half-up for non-negative values", () => {
  it("rounds binary-exact halves up", () => {
    expect(roundTo(0.0625, 3)).toBe(0.063);
    expect(roundTo(2.5, 0)).toBe(3);
  });

  it("nudges the classic 1.005 case up like numeric arithmetic would", () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
  });

  it("keeps already-short values untouched", () => {
    expect(roundTo(0.165, 3)).toBe(0.165);
    expect(roundTo(12, 3)).toBe(12);
  });
});

describe("scale — guards", () => {
  it("throws RangeError for negative, NaN and Infinity grams", () => {
    expect(() => scale({ kcal: 1 }, -1)).toThrow(RangeError);
    expect(() => scale({ kcal: 1 }, NaN)).toThrow(RangeError);
    expect(() => scale({ kcal: 1 }, Infinity)).toThrow(RangeError);
  });

  it("skips non-finite and negative per100g entries instead of propagating them", () => {
    expect(scale({ kcal: NaN, protein_g: Infinity, fat_g: -1, carbs_g: 2 }, 50)).toEqual({
      carbs_g: 1,
      carbs_total_g: 1,
      net_carbs_g: 1,
    });
  });

  it("never scales the derived keys of the input — they are recomputed", () => {
    // A stale carbs_total_g on the input must not survive.
    expect(scale({ carbs_g: 10, carbs_total_g: 999, kj: 999 }, 100)).toEqual({
      carbs_g: 10,
      carbs_total_g: 10,
      net_carbs_g: 10,
    });
  });

  it("does not mutate its input", () => {
    const input = { kcal: 100 };
    scale(input, 50);
    expect(input).toEqual({ kcal: 100 });
  });
});

describe("withDerived", () => {
  it("adds carb keys only when carbs_g is present and kj only when kcal is present", () => {
    expect(withDerived({ fiber_g: 1 })).toEqual({ fiber_g: 1 });
    expect(withDerived({ kcal: 10 })).toEqual({ kcal: 10, kj: 41.84 });
  });

  it("net carbs may go negative (no clamp — same as the server)", () => {
    expect(withDerived({ carbs_g: 1, sugar_alcohol_g: 2 }).net_carbs_g).toBe(-1);
  });
});

describe("BASE_KEYS", () => {
  it("is NUTRIENT_KEYS minus the derived trio", () => {
    expect(BASE_KEYS.length).toBe(NUTRIENT_KEYS.length - 3);
    expect(BASE_KEYS).not.toContain("kj");
  });
});
