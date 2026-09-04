import { describe, it, expect } from "vitest";
import * as api from "../index";

describe("nutrition public API", () => {
  it("re-exports the engine surface", () => {
    for (const name of [
      "NUTRIENT_KEYS", "scale", "resolveGrams", "sumVectors", "dayState", "recipeAsFood",
      "computeTargets", "normalizeBarcode", "fmtQty", "defaultSlotForHour", "localSearch",
      "flushPendingMeals", "takePendingPhoto",
    ]) {
      expect(api).toHaveProperty(name);
    }
  });
});
