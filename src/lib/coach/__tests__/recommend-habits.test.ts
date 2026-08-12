// Goal → habit recommendations feed both onboarding and the AI prompt.
// Contracts: anchors always surface first, adopted habits are excluded,
// unknown goals degrade to the "all" profile instead of crashing.
import { describe, it, expect } from "vitest";
import { recommendHabitsForGoal, goalLabel } from "@/lib/coach/recommend-habits";
import { expandEquipmentPresets, presetLabel } from "@/lib/coach/equipment-presets";

describe("recommendHabitsForGoal", () => {
  it("respects the limit and default (8)", () => {
    expect(recommendHabitsForGoal("build_muscle").length).toBeLessThanOrEqual(8);
    expect(recommendHabitsForGoal("build_muscle", { limit: 3 })).toHaveLength(3);
  });

  it("excludes already-adopted protocols", () => {
    const first = recommendHabitsForGoal("build_muscle", { limit: 1 })[0];
    const next = recommendHabitsForGoal("build_muscle", { excludeProtocolIds: [first.id] });
    expect(next.map((p) => p.id)).not.toContain(first.id);
  });

  it("unknown/null goal degrades to the 'all' profile, never throws", () => {
    expect(recommendHabitsForGoal("no_such_goal").length).toBeGreaterThan(0);
    expect(recommendHabitsForGoal(null).length).toBeGreaterThan(0);
    expect(recommendHabitsForGoal(undefined).length).toBeGreaterThan(0);
  });

  it("recommendations are unique", () => {
    const recs = recommendHabitsForGoal("build_muscle");
    expect(new Set(recs.map((p) => p.id)).size).toBe(recs.length);
  });

  it("goalLabel is human copy, with a fallback", () => {
    expect(goalLabel("build_muscle")).not.toBe("build_muscle");
    expect(goalLabel(null)).toBeTruthy();
  });
});

describe("expandEquipmentPresets", () => {
  it("empty/null → bodyweight-only baseline", () => {
    expect(expandEquipmentPresets(null)).toEqual(["Bodyweight only"]);
    expect(expandEquipmentPresets([])).toEqual(["Bodyweight only"]);
  });

  it("expands presets and dedupes overlapping items", () => {
    const out = expandEquipmentPresets(["home_minimal", "outdoor"]);
    expect(out).toContain("Resistance bands");
    expect(out.filter((x) => x === "Bodyweight only")).toHaveLength(1); // in both presets → deduped
  });

  it("legacy and freeform items pass through verbatim", () => {
    const out = expandEquipmentPresets(["Barbell", "My weird kettlebell"]);
    expect(out).toContain("Barbell");
    expect(out).toContain("My weird kettlebell");
  });

  it("presetLabel falls back to the raw id", () => {
    expect(presetLabel("full_gym")).toBe("Full gym");
    expect(presetLabel("custom-thing")).toBe("custom-thing");
  });
});
