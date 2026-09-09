import { describe, expect, it } from "vitest";
import { beatFor, kcalLeft, kcalProgress, subFor } from "@/lib/nutrition/day-copy";

/**
 * Home and the diary read their sentences from here. The bug this file exists
 * to prevent already happened once: Home printed an ungrouped "2200" where the
 * diary printed "2 200", because the same five sentences lived in two files.
 */
describe("beatFor", () => {
  it("names every state, and groups its numbers", () => {
    expect(beatFor("no_targets", 300, null)).toBe("Set your targets.");
    expect(beatFor("empty", 0, 2200)).toBe("Nothing logged yet.");
    expect(beatFor("complete", 2410, 2400)).toBe("Fueled.");
    // NBSP-grouped, like every other number in the app.
    expect(beatFor("over", 3600, 2400)).toBe("1 200 over today.");
    expect(beatFor("in_progress", 1160, 2400)).toBe("1 240 kcal to go.");
  });
});

describe("subFor", () => {
  it("counts meals in the singular when there is one", () => {
    expect(subFor("in_progress", 1160, 2400, 1)).toContain("1 meal");
    expect(subFor("in_progress", 1160, 2400, 3)).toContain("3 meals");
  });

  it("says what targets are for when there are none", () => {
    expect(subFor("no_targets", 0, null, 0)).toBe("Targets turn the diary into a plan.");
    expect(subFor("no_targets", 300, null, 1)).toContain("300 kcal logged");
    expect(subFor("empty", 0, 2200, 0)).toBe("Your target is 2 200 kcal.");
  });
});

describe("kcalLeft", () => {
  it("is what remains, or how far past", () => {
    expect(kcalLeft(1160, 2400)).toEqual({ value: 1240, over: false });
    expect(kcalLeft(2600, 2400)).toEqual({ value: 200, over: true });
    expect(kcalLeft(2400, 2400)).toEqual({ value: 0, over: false });
  });

  it("refuses to invent a number without a target", () => {
    expect(kcalLeft(1160, null)).toBeNull();
    expect(kcalLeft(1160, 0)).toBeNull();
  });
});

describe("kcalProgress", () => {
  it("clamps to the bar's ends", () => {
    expect(kcalProgress(1200, 2400)).toBe(0.5);
    expect(kcalProgress(3000, 2400)).toBe(1);
    expect(kcalProgress(-10, 2400)).toBe(0);
    expect(kcalProgress(1200, null)).toBeNull();
  });
});
