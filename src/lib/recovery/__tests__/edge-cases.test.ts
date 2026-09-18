// The brief's edge-case list (§26), as assertions rather than as intentions.
import { describe, it, expect } from "vitest";
import { areaLoad, areaLoadFromLoggedSets, topAreas, primaryAreaCount } from "../exposure";
import { buildSession, BUDGET_SEC, type RecoveryLength } from "../build-session";
import { recentAreaLoad, restDayAreas } from "../rest-day";
import type { WorkoutSetLog } from "@/hooks/use-workout-log";

const build = (names: string[], opts = {}) => {
  const l = areaLoad(names.map((name) => ({ slug: null, name })));
  return buildSession(topAreas(l), { primaryCount: primaryAreaCount(l), ...opts });
};

const LENGTHS: RecoveryLength[] = ["quick", "standard", "deep"];

const log = (name: string, on: string): WorkoutSetLog => ({
  id: name + on,
  program_id: "p",
  week: 1,
  day_index: 1,
  exercise_slug: null,
  exercise_name: name,
  weight: 100,
  reps: 5,
  rpe: null,
  set_index: 1,
  logged_on: on,
});

describe("a session that was barely a session", () => {
  it("one exercise still produces something usable", () => {
    const session = build(["Bench Press"]);
    expect(session.movements.length).toBeGreaterThanOrEqual(3);
    expect(session.areas).toContain("chest");
    expect(session.general).toBe(false);
  });

  it("an exercise nothing recognises falls back to general, and says so", () => {
    const session = build(["Zercher Good Morning Off Pins"]);
    expect(session.general).toBe(true);
    expect(session.movements.length).toBeGreaterThan(0);
  });
});

describe("a session that was a lot of session", () => {
  const FIFTEEN = [
    "Bench Press", "Dumbbell Incline Bench Press", "Flat Bench Cable Flys",
    "Lateral Dumbbell Raises", "Incline Pushdown with Cable", "Pull Ups",
    "Reverse Grips Bent Over Barbell Rows", "Biceps Curl with Dumbbell",
    "Barbell Squat", "Romanian Dead Lift", "Standing Calf Raises using Machine",
    "Seated Military Press", "Cable Shoulder Shrugs", "Barbell Dead Lifts",
    "Lying Leg Curl Machine",
  ];

  it("fifteen exercises do not produce a fifteen-area session", () => {
    const areas = topAreas(areaLoad(FIFTEEN.map((name) => ({ slug: null, name }))));
    expect(areas.length).toBeLessThanOrEqual(4);
  });

  it("and the session still fits its budget", () => {
    for (const length of LENGTHS) {
      const session = build(FIFTEEN, { length });
      expect(session.totalSec).toBeLessThanOrEqual(BUDGET_SEC[length]);
      expect(session.movements.length).toBeGreaterThan(0);
    }
  });

  it("a full-body session spreads rather than stacking one area", () => {
    const session = build(["Barbell Squat", "Bench Press", "Pull Ups", "Seated Military Press"]);
    expect(session.areas.length).toBeGreaterThanOrEqual(3);
  });
});

describe("half a session", () => {
  it("only the sets that were logged steer it", () => {
    // Prescribed five, logged two. The other three left no rows.
    const logged = areaLoadFromLoggedSets({
      "bench-press": [{ exercise_name: "Bench Press" }],
      "incline-pushdown-with-cable": [{ exercise_name: "Incline Pushdown with Cable" }],
    });
    const areas = topAreas(logged);
    expect(areas).toContain("chest");
    expect(areas).toContain("triceps");
    expect(areas).not.toContain("quadriceps");
  });
});

describe("days, midnights and timezones", () => {
  it("a rest day reads the last two local days, not a 48-hour window", () => {
    const today = new Date(2026, 8, 18, 10, 0);
    const areas = restDayAreas(
      [log("Barbell Squat", "2026-09-17"), log("Bench Press", "2026-09-10")],
      2,
      today,
    );
    expect(areas).toContain("quadriceps");
    expect(areas).not.toContain("chest");
  });

  it("a session logged before the window is ignored", () => {
    const today = new Date(2026, 8, 18, 10, 0);
    expect(recentAreaLoad([log("Bench Press", "2026-09-01")], 2, today)).toEqual([]);
  });

  it("crossing a month boundary still looks back correctly", () => {
    const first = new Date(2026, 9, 1, 8, 0); // 1 October
    const areas = restDayAreas([log("Barbell Squat", "2026-09-30")], 2, first);
    expect(areas).toContain("quadriceps");
  });

  it("no logs at all is an empty answer, never a guessed one", () => {
    expect(restDayAreas([])).toEqual([]);
    expect(buildSession([], { context: "rest_day" }).general).toBe(true);
  });
});

describe("nothing produces a broken session", () => {
  it("every combination of length, context and soreness yields a runnable session", () => {
    const inputs: string[][] = [
      [],
      ["Bench Press"],
      ["Barbell Squat", "Romanian Dead Lift"],
      ["Bench Press", "Pull Ups", "Barbell Squat", "Seated Military Press"],
    ];
    for (const names of inputs) {
      for (const length of LENGTHS) {
        for (const context of ["post_workout", "rest_day"] as const) {
          for (const soreness of [null, "good", "tight", "sore"] as const) {
            const session = build(names, { length, context, soreness });
            expect(session.movements.length, `${names.length}/${length}/${context}/${soreness}`)
              .toBeGreaterThan(0);
            expect(session.totalSec).toBeLessThanOrEqual(BUDGET_SEC[length]);
            // No duplicates: the same stretch twice in one session reads as a bug.
            const ids = session.movements.map((m) => m.id);
            expect(new Set(ids).size).toBe(ids.length);
            // Every movement belongs to the context it was built for.
            for (const m of session.movements) expect(m.contexts).toContain(context);
          }
        }
      }
    }
  });
});
