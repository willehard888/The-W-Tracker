// Day arithmetic feeds the Home Fuel zone and the diary beat line; every
// state boundary (95 % / 105 % / protein hit) is locked here.
import { describe, it, expect } from "vitest";
import { sumVectors, remaining, pctOf, netCarbs, macroSummary, dayState, MACRO_KEYS } from "../totals";
import type { Targets } from "../types";

const targets = (over: Partial<Targets> = {}): Targets => ({ kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 70, ...over });

describe("sumVectors", () => {
  it("sums key-wise and reports how many non-empty vectors lacked a key", () => {
    const { totals, missing } = sumVectors([{ kcal: 100, protein_g: 10 }, { kcal: 50 }, {}]);
    expect(totals).toEqual({ kcal: 150, protein_g: 10 });
    expect(missing.protein_g).toBe(1);
    expect(missing.kcal).toBeUndefined();
    // the empty vector does not count as "lacking" anything
    expect(missing.fat_g).toBe(2);
  });

  it("returns empty totals for no input", () => {
    expect(sumVectors([])).toEqual({ totals: {}, missing: {} });
  });

  it("rounds away float noise (0.1 + 0.2)", () => {
    expect(sumVectors([{ fat_g: 0.1 }, { fat_g: 0.2 }]).totals.fat_g).toBe(0.3);
  });

  it("ignores non-finite entries and counts them as missing", () => {
    const { totals, missing } = sumVectors([{ kcal: NaN }, { kcal: 5 }]);
    expect(totals.kcal).toBe(5);
    expect(missing.kcal).toBe(1);
  });
});

describe("remaining", () => {
  it("is target minus logged for the four macros and may go negative", () => {
    expect(remaining({ kcal: 2100, protein_g: 20 }, targets())).toEqual({ kcal: -100, protein_g: 130, carbs_g: 200, fat_g: 70 });
    expect(Object.keys(remaining({}, targets()))).toEqual([...MACRO_KEYS]);
  });
});

describe("pctOf", () => {
  it("is an integer percent clamped to 0–999", () => {
    expect(pctOf({ kcal: 1000, protein_g: 3000 }, targets())).toEqual({ kcal: 50, protein_g: 999, carbs_g: 0, fat_g: 0 });
  });

  it("is undefined for a 0 or missing target", () => {
    expect(pctOf({ kcal: 100 }, targets({ kcal: 0 })).kcal).toBeUndefined();
    expect(pctOf({ kcal: 100 }, targets({ kcal: NaN })).kcal).toBeUndefined();
  });
});

describe("netCarbs", () => {
  it("prefers the server-derived key, else carbs − sugar alcohols, undefined when carbs unknown", () => {
    expect(netCarbs({ net_carbs_g: 7, carbs_g: 10 })).toBe(7);
    expect(netCarbs({ carbs_g: 10, sugar_alcohol_g: 4 })).toBe(6);
    expect(netCarbs({ carbs_g: 10 })).toBe(10);
    expect(netCarbs({ fiber_g: 3 })).toBeUndefined();
  });
});

describe("macroSummary", () => {
  it("rounds to integers and treats absent as 0", () => {
    expect(macroSummary({ kcal: 123.6, protein_g: 9.4 })).toEqual({ calories: 124, protein: 9, carbs: 0, fat: 0 });
  });
});

describe("dayState", () => {
  it("no_targets without targets, empty without kcal", () => {
    expect(dayState({ kcal: 500 }, null)).toBe("no_targets");
    expect(dayState({}, targets())).toBe("empty");
    expect(dayState({ kcal: 0, protein_g: 20 }, targets())).toBe("empty");
  });

  it("over above 105 % kcal (boundary: exactly 105 % is not over)", () => {
    expect(dayState({ kcal: 2100 }, targets())).toBe("in_progress");
    expect(dayState({ kcal: 2100.01 }, targets())).toBe("over");
  });

  it("complete needs ≥ 95 % kcal AND protein at target", () => {
    expect(dayState({ kcal: 1900, protein_g: 150 }, targets())).toBe("complete");
    expect(dayState({ kcal: 1899, protein_g: 150 }, targets())).toBe("in_progress");
    expect(dayState({ kcal: 1900, protein_g: 149 }, targets())).toBe("in_progress");
  });

  it("over wins over complete", () => {
    expect(dayState({ kcal: 2200, protein_g: 200 }, targets())).toBe("over");
  });
});
