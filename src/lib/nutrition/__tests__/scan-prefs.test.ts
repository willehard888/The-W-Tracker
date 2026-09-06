import { describe, it, expect } from "vitest";
import { getNutritionPrefs, PLATE_DEFAULT, PLATE_OPTIONS } from "../scan-prefs";

describe("getNutritionPrefs", () => {
  it("defaults to a 26 cm plate for anything malformed", () => {
    expect(getNutritionPrefs(undefined)).toEqual({ plate_cm: 26 });
    expect(getNutritionPrefs(null).plate_cm).toBe(PLATE_DEFAULT);
    expect(getNutritionPrefs("x").plate_cm).toBe(26);
    expect(getNutritionPrefs({ plate_cm: "30" }).plate_cm).toBe(26);
    expect(getNutritionPrefs({ plate_cm: NaN }).plate_cm).toBe(26);
  });

  it("keeps a valid plate, rounds, and clamps to 18–32", () => {
    expect(getNutritionPrefs({ plate_cm: 30 }).plate_cm).toBe(30);
    expect(getNutritionPrefs({ plate_cm: 21.4 }).plate_cm).toBe(21);
    expect(getNutritionPrefs({ plate_cm: 5 }).plate_cm).toBe(18);
    expect(getNutritionPrefs({ plate_cm: 90 }).plate_cm).toBe(32);
  });

  it("offers the three plate classes", () => {
    expect([...PLATE_OPTIONS]).toEqual([21, 26, 30]);
  });
});
