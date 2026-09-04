// The shared engine fixture — the same cases are asserted against SQL
// nutrition_for_grams. A change that breaks this file breaks snapshot parity.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scale } from "../scale";
import type { NutrientVector } from "../types";

interface ContractCase {
  label: string;
  per100g: NutrientVector;
  grams: number;
  expected: NutrientVector;
}

const cases = JSON.parse(
  readFileSync(join(__dirname, "../__fixtures__/contract.json"), "utf8"),
) as ContractCase[];

describe("scale() ↔ nutrition_for_grams contract fixture", () => {
  it("has at least 12 cases", () => {
    expect(cases.length).toBeGreaterThanOrEqual(12);
  });

  for (const c of cases) {
    it(c.label, () => {
      expect(scale(c.per100g, c.grams)).toEqual(c.expected);
    });
  }
});
