import { describe, it, expect } from "vitest";
import { LOAD_STEP_KG, loadAdvice, parseRange } from "@/lib/training/overload";
import { progressiveWeeks, WEEK_WAVE, isRepeatingWeek } from "@/lib/training/plan-edit";
import type { PlanJson, ProgramWeek } from "@/hooks/use-coach-program";

const set = (logged_on: string, weight: number | null, reps: number | null, rpe: number | null = 8) => ({ logged_on, weight, reps, rpe });

describe("parseRange", () => {
  it("reads a range, a single number and the dashes people type; rejects AMRAP", () => {
    expect(parseRange("6-10")).toEqual({ lo: 6, hi: 10 });
    expect(parseRange("8 – 12")).toEqual({ lo: 8, hi: 12 });
    expect(parseRange(5)).toEqual({ lo: 5, hi: 5 });
    expect(parseRange("10-6")).toEqual({ lo: 6, hi: 10 });
    expect(parseRange("AMRAP")).toBeNull();
    expect(parseRange(null)).toBeNull();
  });
});

describe("loadAdvice — double progression", () => {
  it("steps up one plate when every set of the last session hit the top of the range, reps back to the bottom", () => {
    const a = loadAdvice([set("2026-09-29", 100, 10), set("2026-09-29", 100, 10), set("2026-09-29", 100, 10)], "6-10", 8);
    expect(a).toMatchObject({ move: "up", weight: 102.5, reps: 6, step: LOAD_STEP_KG });
    expect(a.reason).toBe("All 3 sets hit 10 at 100 kg — add 2.5 kg, back to 6.");
    expect(a.last).toMatchObject({ weight: 100, hit: 3, total: 3, date: "2026-09-29" });
  });

  it("holds the weight while some sets are short of the top, and names how many made it", () => {
    const a = loadAdvice([set("2026-09-29", 100, 10), set("2026-09-29", 100, 8), set("2026-09-29", 100, 7)], "6-10", 8);
    expect(a).toMatchObject({ move: "hold", weight: 100, reps: 10, step: 0 });
    expect(a.reason).toBe("1 of 3 sets hit 10 — same weight, finish the range.");
    expect(loadAdvice([set("2026-09-29", 100, 7)], "6-10").reason).toBe("Same 100 kg — chase 10 on every set.");
  });

  it("repeats the weight when a set fell under the range", () => {
    const a = loadAdvice([set("2026-09-29", 100, 10), set("2026-09-29", 100, 5)], "6-10", 8);
    expect(a).toMatchObject({ move: "repeat", weight: 100, reps: 6 });
    expect(a.reason).toBe("A set fell to 5 — repeat 100 kg and own the 6.");
  });

  it("a felt effort well above the prescription turns a step up into one more round", () => {
    const a = loadAdvice([set("2026-09-29", 100, 10, 9.5), set("2026-09-29", 100, 10, 9.5)], "6-10", 8);
    expect(a.move).toBe("hold");
    expect(a.reason).toMatch(/grind/);
    // The runner stores the prescription itself as rpe — never a grind.
    expect(loadAdvice([set("2026-09-29", 100, 10, 8)], "6-10", 8).move).toBe("up");
  });

  it("judges the most recent loaded session only, newest first, and skips bodyweight days", () => {
    const h = [set("2026-09-30", null, 12), set("2026-09-29", 100, 10), set("2026-09-29", 100, 10), set("2026-09-22", 95, 6)];
    expect(loadAdvice(h, "6-10").move).toBe("up");
  });

  it("without a range (AMRAP) it holds; without history it is a first set with the bottom of the range", () => {
    expect(loadAdvice([set("2026-09-29", 100, 15)], "AMRAP")).toMatchObject({ move: "hold", weight: 100, reps: 15 });
    expect(loadAdvice([], "6-10")).toMatchObject({ move: "first", weight: null, reps: 6, last: null });
    expect(loadAdvice(undefined, "AMRAP")).toMatchObject({ move: "first", weight: null, reps: null });
  });

  it("rounds the stepped weight to the half kilo", () => {
    expect(loadAdvice([set("2026-09-29", 17.5, 12)], "8-12").weight).toBe(20);
  });
});

describe("progressiveWeeks — the four-week wave", () => {
  const week = (): ProgramWeek => ({
    week: 1, theme: "Your week",
    days: [
      { day: "Mon", focus: "Push", duration_min: 45, blocks: [{ slug: "Bench", name: "Bench", sets: 3, reps: "6-10", rpe: 8 }, { slug: "Fly", name: "Fly", sets: 2, reps: "10-15", rpe: 7.5 }] },
      { day: "Tue", focus: "Rest", duration_min: 0, blocks: [] },
    ],
    nutrition: { kcal_note: "", protein_g_target: 0, hydration_note: "" } as unknown as ProgramWeek["nutrition"],
    recovery: { sleep_target_h: 7.5, mobility_minutes: 10 } as unknown as ProgramWeek["recovery"],
  });

  it("keeps the lifts and the rep ranges; sets and effort follow base → build → peak → light", () => {
    const w = progressiveWeeks(week());
    expect(w.map((x) => x.week)).toEqual([1, 2, 3, 4]);
    expect(w.map((x) => x.theme)).toEqual(WEEK_WAVE.map((x) => x.theme));
    const bench = w.map((x) => x.days[0].blocks[0]);
    expect(bench.map((b) => b.reps)).toEqual(["6-10", "6-10", "6-10", "6-10"]);
    expect(bench.map((b) => b.sets)).toEqual([3, 3, 4, 2]);
    expect(bench.map((b) => b.rpe)).toEqual([8, 8.5, 8.5, 7]);
    expect(w.every((x) => x.progression_note && x.progression_note.length > 20)).toBe(true);
    // The weeks differ, so the page shows the switcher.
    expect(isRepeatingWeek({ weeks: w, weekly_check_targets: {} as unknown as PlanJson["weekly_check_targets"] })).toBe(false);
  });

  it("stays inside the dose bounds and leaves rest days alone", () => {
    const w = progressiveWeeks({ ...week(), days: [{ day: "Mon", focus: "Legs", duration_min: 30, blocks: [{ name: "Squat", sets: 1, reps: "5", rpe: 10 }] }] });
    expect(w[3].days[0].blocks[0].sets).toBe(1); // never below one set
    expect(w[1].days[0].blocks[0].rpe).toBe(10); // never above 10
    expect(w[3].days[0].blocks[0].rpe).toBe(9);
    expect(progressiveWeeks(week())[2].days[1].blocks).toEqual([]);
  });

  it("does not touch the week it was given", () => {
    const base = week();
    progressiveWeeks(base);
    expect(base.days[0].blocks[0].sets).toBe(3);
    expect(base.theme).toBe("Your week");
  });
});
