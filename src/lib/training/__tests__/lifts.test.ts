import { describe, it, expect } from "vitest";
import { liftsFrom } from "@/lib/training/lifts";

const top = (slug: string | null, name: string, logged_on: string, weight: number | null, reps: number | null) =>
  ({ exercise_slug: slug, exercise_name: name, weight, reps, logged_on });

describe("liftsFrom — one row per movement for the Progress page", () => {
  const rows = [
    top("Barbell_Squat", "Barbell Squat", "2026-09-29", 105, 5),
    top("Barbell_Squat", "Barbell Squat", "2026-09-15", 100, 5),
    top("Barbell_Squat", "Barbell Squat", "2026-09-22", 102.5, 5),
    top("Pullups", "Pull-up", "2026-09-30", null, 9),
    top("Pullups", "Pull-up", "2026-09-23", null, 7),
    top(null, "Face pull", "2026-09-01", 20, 15),
  ];

  it("groups by slug (name when there is none), orders sessions by date and the lifts by the last session", () => {
    const lifts = liftsFrom(rows, "2026-10-01");
    expect(lifts.map((l) => l.key)).toEqual(["Pullups", "Barbell_Squat", "Face pull"]);
    const squat = lifts[1];
    expect(squat).toMatchObject({ slug: "Barbell_Squat", name: "Barbell Squat", sessions: 3, unit: "kg", delta: 5, daysSince: 2 });
    expect(squat.series).toEqual([100, 102.5, 105]);
    expect(squat.last).toEqual({ weight: 105, reps: 5, logged_on: "2026-09-29" });
  });

  it("charts reps for a movement never loaded, and a single session has no delta", () => {
    const lifts = liftsFrom(rows, "2026-10-01");
    expect(lifts[0]).toMatchObject({ unit: "reps", series: [7, 9], delta: 2, daysSince: 1 });
    expect(lifts[2]).toMatchObject({ slug: null, sessions: 1, delta: 0, daysSince: 30 });
  });

  it("skips rows without a day and returns nothing for nothing", () => {
    expect(liftsFrom([top("x", "x", "", 1, 1)], "2026-10-01")).toEqual([]);
    expect(liftsFrom([], "2026-10-01")).toEqual([]);
  });
});
