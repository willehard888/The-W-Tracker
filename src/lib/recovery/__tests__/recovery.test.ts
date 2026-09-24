import { describe, it, expect, beforeEach } from "vitest";
import { areaLoad, areaLoadFromLoggedSets, topAreas, toArea } from "../exposure";
import { buildSession, BUDGET_SEC } from "../build-session";
import {
  RECOVERY_MOVEMENTS,
  movementSeconds,
  type RecoveryArea,
} from "@/data/recovery";
import { ILLUSTRATED_EXERCISES } from "@/data/exercises-illustrated";
import { markRecoveryDone, recoveryDoneToday, RECOVERY_HABIT_KEY } from "../completion";
import { CHECKIN_HABITS } from "@/lib/checkin-habits";

// Slugs taken from the real illustrated set, not invented — a test that passes
// against a made-up slug proves nothing about the resolver it is exercising.
const slugExists = (slug: string) => ILLUSTRATED_EXERCISES.some((e) => e.slug === slug);

describe("area vocabulary", () => {
  it("folds every upstream spelling that actually occurs, typos included", () => {
    expect(toArea("gluts")).toBe("glutes");
    expect(toArea("glutes")).toBe("glutes");
    expect(toArea("forearm")).toBe("forearms");
    expect(toArea("bicpes")).toBe("biceps");
    expect(toArea("should")).toBe("shoulders");
    expect(toArea("trapezius")).toBe("upper back");
    expect(toArea("middle back")).toBe("upper back");
  });

  it("leaves genuinely ambiguous words unmapped rather than guessing", () => {
    expect(toArea("arms")).toBeNull();
    expect(toArea("nonsense")).toBeNull();
  });

  it("covers every muscle word in the illustrated set except the ambiguous one", () => {
    const unmapped = new Set<string>();
    for (const e of ILLUSTRATED_EXERCISES) {
      for (const m of [...e.primary, ...e.secondary]) {
        if (!toArea(m)) unmapped.add(m.toLowerCase());
      }
    }
    expect([...unmapped].sort()).toEqual(["arms"]);
  });
});

describe("what was trained drives what is recovered", () => {
  it("a push session surfaces chest, shoulders and triceps", () => {
    expect(slugExists("bench-press")).toBe(true);
    const load = areaLoad([
      { slug: null, name: "Bench Press" },
      { slug: null, name: "Seated Military Press" },
      { slug: null, name: "Incline Pushdown with Cable" },
    ]);
    const areas = topAreas(load);
    expect(areas).toContain("chest");
    expect(areas).toContain("shoulders");
    expect(areas).toContain("triceps");
    expect(areas).not.toContain("hamstrings");
  });

  it("a pull session surfaces back and biceps, not chest", () => {
    const load = areaLoad([
      { slug: null, name: "Pull Ups" },
      { slug: null, name: "Reverse Grips Bent Over Barbell Rows" },
      { slug: null, name: "Biceps Curl with Dumbbell" },
    ]);
    const areas = topAreas(load);
    expect(areas.some((a) => a === "lats" || a === "upper back")).toBe(true);
    expect(areas).toContain("biceps");
    expect(areas).not.toContain("chest");
  });

  it("a leg session surfaces lower body only", () => {
    const load = areaLoad([
      { slug: null, name: "Barbell Squat" },
      { slug: null, name: "Romanian Dead Lift" },
      { slug: null, name: "Standing Calf Raises using Machine" },
    ]);
    const areas = topAreas(load);
    const lower: RecoveryArea[] = ["quadriceps", "hamstrings", "glutes", "calves"];
    expect(areas.some((a) => lower.includes(a))).toBe(true);
    expect(areas).not.toContain("chest");
    expect(areas).not.toContain("triceps");
  });

  it("weighs a prime mover above a muscle that came along", () => {
    const load = areaLoad([{ slug: null, name: "Biceps Curl with Dumbbell" }]);
    const biceps = load.find((l) => l.area === "biceps");
    const forearms = load.find((l) => l.area === "forearms");
    expect(biceps).toBeDefined();
    if (biceps && forearms) expect(biceps.weight).toBeGreaterThan(forearms.weight);
  });

  it("is stable: the same input always gives the same order", () => {
    const input = [{ slug: null, name: "Barbell Squat" }, { slug: null, name: "Pull Ups" }];
    expect(areaLoad(input)).toEqual(areaLoad(input));
  });
});

describe("logged sets, not the prescription", () => {
  // The finish screen holds `useDaySets`' shape: slug -> the sets logged for it.
  // A skipped exercise never got a row, so it never gets a key.
  it("a skipped exercise does not steer recovery", () => {
    const withSquat = areaLoadFromLoggedSets({
      "barbell-squat": [{ exercise_name: "Barbell Squat" }],
      "bench-press": [{ exercise_name: "Bench Press" }],
    });
    const squatSkipped = areaLoadFromLoggedSets({
      "bench-press": [{ exercise_name: "Bench Press" }],
    });
    expect(topAreas(withSquat)).toContain("quadriceps");
    expect(topAreas(squatSkipped)).not.toContain("quadriceps");
  });

  it("a swapped-in exercise does steer recovery", () => {
    const swapped = areaLoadFromLoggedSets({
      "standing-calf-raises-using-machine": [{ exercise_name: "Standing Calf Raises using Machine" }],
    });
    expect(topAreas(swapped)).toContain("calves");
  });

  it("an exercise with zero logged sets is not counted", () => {
    const load = areaLoadFromLoggedSets({ "barbell-squat": [] });
    expect(load).toEqual([]);
  });

  it("no training history at all yields no areas rather than a guess", () => {
    expect(areaLoadFromLoggedSets({})).toEqual([]);
    expect(topAreas([])).toEqual([]);
  });
});

describe("session building", () => {
  it("stays inside the budget at every length", () => {
    for (const length of ["quick", "standard", "deep"] as const) {
      const session = buildSession(["quadriceps", "glutes", "hamstrings", "calves"], { length });
      expect(session.totalSec).toBeLessThanOrEqual(BUDGET_SEC[length]);
      expect(session.movements.length).toBeGreaterThan(0);
    }
  });

  it("answers the areas it was given", () => {
    const session = buildSession(["chest", "triceps"]);
    expect(session.areas).toContain("chest");
    expect(session.areas).toContain("triceps");
    expect(session.general).toBe(false);
  });

  it("covers breadth before depth", () => {
    // Four areas in a standard budget should touch all four, not stack one.
    const session = buildSession(["chest", "shoulders", "triceps", "lats"]);
    expect(session.areas.length).toBe(4);
  });

  it("falls back to a general session when nothing is known", () => {
    const session = buildSession([]);
    expect(session.general).toBe(true);
    expect(session.movements.length).toBeGreaterThan(0);
    expect(session.totalSec).toBeLessThanOrEqual(BUDGET_SEC.standard);
  });

  // Found by running it: the general session filled its budget and ended on a
  // calf stretch, while an area session ended on the breath. Every session now
  // closes the same way, at every length and from either branch.
  it("always closes on the breath, general or earned, at any length", () => {
    for (const length of ["quick", "standard", "deep"] as const) {
      for (const areas of [[], ["glutes"], ["chest", "shoulders", "triceps", "lats"]] as const) {
        const session = buildSession([...areas], { length });
        expect(session.movements.at(-1)?.type).toBe("breathing");
        expect(session.totalSec).toBeLessThanOrEqual(BUDGET_SEC[length]);
      }
    }
  });

  it("is deterministic", () => {
    const a = buildSession(["glutes", "hamstrings"]);
    const b = buildSession(["glutes", "hamstrings"]);
    expect(a.movements.map((m) => m.id)).toEqual(b.movements.map((m) => m.id));
  });

  it("never repeats a movement", () => {
    const session = buildSession(["glutes", "glutes", "hamstrings"], { length: "deep" });
    const ids = session.movements.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("closes on the breath even with a full budget", () => {
    const session = buildSession(["quadriceps", "hamstrings", "glutes", "calves"], {
      length: "quick",
    });
    expect(session.movements.at(-1)?.type).toBe("breathing");
  });

  it("respects the context filter", () => {
    const session = buildSession(["chest"], { context: "rest_day" });
    for (const m of session.movements) expect(m.contexts).toContain("rest_day");
  });
});

describe("the library itself", () => {
  it("has a movement for every area, so a session can never come back empty", () => {
    const areas = new Set<RecoveryArea>();
    for (const m of RECOVERY_MOVEMENTS) for (const a of m.areas) areas.add(a);
    const missing = ([
      "chest", "shoulders", "triceps", "biceps", "forearms", "lats", "upper back",
      "lower back", "abdominals", "glutes", "quadriceps", "hamstrings", "calves", "neck",
    ] as RecoveryArea[]).filter((a) => !areas.has(a));
    expect(missing).toEqual([]);
  });

  it("has unique ids", () => {
    const ids = RECOVERY_MOVEMENTS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("prescribes holds, never sets or reps", () => {
    for (const m of RECOVERY_MOVEMENTS) {
      expect(m.holdSec).toBeGreaterThan(0);
      expect(movementSeconds(m)).toBe(m.holdSec * m.sides);
      expect(m.steps.length).toBeGreaterThan(0);
    }
  });

  it("fits a single movement inside the shortest budget", () => {
    for (const m of RECOVERY_MOVEMENTS) {
      expect(movementSeconds(m)).toBeLessThanOrEqual(BUDGET_SEC.quick);
    }
  });

  it("makes no claim about what a stretch does to tissue", () => {
    // The style-guard rule polices source files; this polices the data as data,
    // so a claim cannot arrive through a copy edit that skips the guard.
    const banned = /speeds? recovery|flush(es)? |lactic acid|repairs? muscle|prevents? injur|heals?|detox/i;
    for (const m of RECOVERY_MOVEMENTS) {
      for (const line of [m.name, ...m.steps, m.caution ?? ""]) {
        expect(line).not.toMatch(banned);
      }
    }
  });
});

describe("the bridge to the check-in", () => {
  beforeEach(() => localStorage.clear());

  it("a finished session counts for the day it was finished", () => {
    const evening = new Date(2026, 8, 18, 23, 50);
    markRecoveryDone(evening);
    expect(recoveryDoneToday(evening)).toBe(true);
  });

  it("does not carry into tomorrow — 00:10 is a new check-in", () => {
    markRecoveryDone(new Date(2026, 8, 18, 23, 50));
    expect(recoveryDoneToday(new Date(2026, 8, 19, 0, 10))).toBe(false);
  });

  it("is false when nothing was done", () => {
    expect(recoveryDoneToday()).toBe(false);
  });

  it("names a habit that exists in the check-in library", () => {
    const habit = CHECKIN_HABITS.find((h) => h.key === RECOVERY_HABIT_KEY);
    expect(habit).toBeDefined();
    // A chosen habit, not a core one: recovery is part of training, not a
    // substitute for it — it shares the habits' 25 points, never the
    // training line.
    expect(habit!.core).toBeFalsy();
  });

  it("survives storage being unavailable instead of throwing", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { throw new Error("blocked"); },
    });
    expect(() => markRecoveryDone()).not.toThrow();
    expect(recoveryDoneToday()).toBe(false);
    if (original) Object.defineProperty(window, "localStorage", original);
  });
});
