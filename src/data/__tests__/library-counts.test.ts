import { describe, expect, it } from "vitest";
import { RECIPES } from "@/data/recipes";
import { RECIPE_COUNT } from "@/data/library-counts";

describe("library counts", () => {
  it("RECIPE_COUNT matches the recipe catalog", () => {
    expect(RECIPE_COUNT).toBe(RECIPES.length);
  });
});
