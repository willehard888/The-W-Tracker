// Targets are a PROPOSAL with safety rails: minors get no numbers, kcal never
// drops below the floor, protein never exceeds 40 % of kcal. Every branch and
// constant of Phase 7f is locked at the worked-example level.
import { describe, it, expect } from "vitest";
import {
  computeTargets,
  goalModeFor,
  ACTIVITY_MULT,
  GOAL_KCAL_FACTOR,
  PROTEIN_G_PER_KG,
  FAT_G_PER_KG,
  KCAL_FLOOR,
  type TargetInput,
} from "../targets";

const input = (over: Partial<TargetInput> = {}): TargetInput => ({
  age: 30,
  weight_kg: 80,
  height_cm: 180,
  body_fat_pct: null,
  sex: "male",
  activity_level: "moderate",
  primary_goal: "fat_loss",
  ...over,
});

describe("constants", () => {
  it("match the plan", () => {
    expect(ACTIVITY_MULT).toEqual({ sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 });
    expect(GOAL_KCAL_FACTOR).toEqual({ cut: 0.85, maintain: 1, gain: 1.1 });
    expect(PROTEIN_G_PER_KG).toEqual({ cut: 2.2, maintain: 1.6, gain: 2 });
    expect(FAT_G_PER_KG).toEqual({ cut: 0.8, maintain: 1, gain: 1 });
    expect(KCAL_FLOOR).toEqual({ male: 1500, other: 1200 });
  });
});

describe("goalModeFor", () => {
  it("fat_loss → cut; hypertrophy/strength → gain; anything else → maintain", () => {
    expect(goalModeFor("fat_loss")).toBe("cut");
    expect(goalModeFor("hypertrophy")).toBe("gain");
    expect(goalModeFor("strength")).toBe("gain");
    expect(goalModeFor("endurance")).toBe("maintain");
    expect(goalModeFor(null)).toBe("maintain");
  });
});

describe("computeTargets — refusals", () => {
  it("missing_profile without age or weight", () => {
    expect(computeTargets(input({ age: null }))).toEqual({ ok: false, reason: "missing_profile" });
    expect(computeTargets(input({ weight_kg: null }))).toEqual({ ok: false, reason: "missing_profile" });
    expect(computeTargets(input({ weight_kg: 0 }))).toEqual({ ok: false, reason: "missing_profile" });
    expect(computeTargets(input({ age: NaN }))).toEqual({ ok: false, reason: "missing_profile" });
  });

  it("missing_profile without height unless body fat is known", () => {
    expect(computeTargets(input({ height_cm: null }))).toEqual({ ok: false, reason: "missing_profile" });
    expect(computeTargets(input({ height_cm: null, body_fat_pct: 20 }))).toMatchObject({ ok: true, method: "katch" });
  });

  it("minor below 18 (boundary: 18 is an adult); checked after completeness", () => {
    expect(computeTargets(input({ age: 17 }))).toEqual({ ok: false, reason: "minor" });
    expect(computeTargets(input({ age: 18 }))).toMatchObject({ ok: true });
    expect(computeTargets(input({ age: 17, weight_kg: null }))).toEqual({ ok: false, reason: "missing_profile" });
  });
});

describe("computeTargets — worked examples", () => {
  it("Mifflin male cut, moderate: 1780 BMR → 2759 TDEE → 2350 kcal / 175 P / 265 C / 65 F", () => {
    expect(computeTargets(input())).toEqual({
      ok: true,
      kcal: 2350,
      protein_g: 175,
      carbs_g: 265,
      fat_g: 65,
      method: "mifflin",
      goal: "cut",
      activity_level: "moderate",
      bmr: 1780,
      tdee: 2759,
      floor_applied: false,
      protein_capped: false,
    });
  });

  it("Katch-McArdle when body fat > 0; null activity → light; null goal → maintain", () => {
    const r = computeTargets(input({ weight_kg: 60, body_fat_pct: 25, height_cm: null, age: 28, sex: "female", activity_level: null, primary_goal: null }));
    expect(r).toEqual({
      ok: true,
      kcal: 1850,
      protein_g: 95,
      carbs_g: 235,
      fat_g: 60,
      method: "katch",
      goal: "maintain",
      activity_level: "light",
      bmr: 1342,
      tdee: 1845,
      floor_applied: false,
      protein_capped: false,
    });
  });

  it("body fat ≥ 100 or ≤ 0 is ignored and Mifflin is used", () => {
    expect(computeTargets(input({ body_fat_pct: 100 }))).toMatchObject({ method: "mifflin" });
    expect(computeTargets(input({ body_fat_pct: 0 }))).toMatchObject({ method: "mifflin" });
  });

  it("sex constants: female −161, other/null −78 (the average)", () => {
    const female = computeTargets(input({ sex: "female" }));
    const other = computeTargets(input({ sex: "other" }));
    const unset = computeTargets(input({ sex: null }));
    expect(female).toMatchObject({ bmr: 1780 - 5 - 161 });
    expect(other).toMatchObject({ bmr: 1780 - 5 - 78 });
    expect(unset).toMatchObject({ bmr: 1780 - 5 - 78 });
  });

  it("gain: ×1.10, protein 2.0 g/kg, fat 1.0 g/kg", () => {
    const r = computeTargets(input({ primary_goal: "hypertrophy" }));
    // 2759 × 1.1 = 3034.9 → 3050; protein 160; fat 80; carbs (3050 − 640 − 720)/4 = 422.5 → 425 (half-up to 5)
    expect(r).toMatchObject({ kcal: 3050, protein_g: 160, fat_g: 80, carbs_g: 425, goal: "gain" });
  });
});

describe("computeTargets — safety rails", () => {
  it("kcal floor 1200 for non-male, 1500 for male, with floor_applied", () => {
    const f = computeTargets(input({ weight_kg: 45, height_cm: 155, age: 40, sex: "female", activity_level: "sedentary" }));
    expect(f).toMatchObject({ kcal: 1200, floor_applied: true, protein_g: 100, fat_g: 35, carbs_g: 120 });
    const m = computeTargets(input({ weight_kg: 50, height_cm: 160, age: 60, sex: "male", activity_level: "sedentary" }));
    expect(m).toMatchObject({ kcal: 1500, floor_applied: true });
  });

  it("protein is capped at 40 % of kcal", () => {
    const r = computeTargets(input({ weight_kg: 150, height_cm: 170, age: 50, sex: "female", activity_level: "sedentary" }));
    expect(r).toMatchObject({ kcal: 2200, protein_g: 220, protein_capped: true, fat_g: 120, carbs_g: 60 });
  });

  it("carbs never go negative", () => {
    const r = computeTargets(input({ weight_kg: 200, height_cm: 100, age: 90, sex: "other", activity_level: "sedentary", primary_goal: null }));
    expect(r).toMatchObject({ kcal: 2500, protein_g: 250, fat_g: 200, carbs_g: 0, protein_capped: true });
  });

  it("kcal is a multiple of 50 and macros of 5", () => {
    const r = computeTargets(input({ weight_kg: 73.4, height_cm: 177.2, age: 33 }));
    if (!r.ok) throw new Error("expected ok");
    expect(r.kcal % 50).toBe(0);
    for (const v of [r.protein_g, r.carbs_g, r.fat_g]) expect(v % 5).toBe(0);
  });
});
