// The key list IS the schema contract with nutrient_definitions — lock its
// shape so a stray duplicate or a dropped derived key fails loudly.
import { describe, it, expect } from "vitest";
import { NUTRIENT_KEYS, DERIVED_KEYS } from "../types";

describe("NUTRIENT_KEYS", () => {
  it("has no duplicates", () => {
    expect(new Set(NUTRIENT_KEYS).size).toBe(NUTRIENT_KEYS.length);
  });

  it("ends with the three derived keys, after 49 stored keys", () => {
    expect(NUTRIENT_KEYS.slice(-3)).toEqual([...DERIVED_KEYS]);
    expect(NUTRIENT_KEYS.length - DERIVED_KEYS.length).toBe(49);
  });

  it("starts with the four macro keys the diary trigger maintains", () => {
    expect(NUTRIENT_KEYS.slice(0, 4)).toEqual(["kcal", "protein_g", "fat_g", "carbs_g"]);
  });
});
