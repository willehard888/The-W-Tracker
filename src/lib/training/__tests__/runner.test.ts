import { describe, it, expect } from "vitest";
import {
  buildSessionPlan,
  setsDoneFor,
  sessionProgress,
  suggestedLoad,
  formatRest,
  sessionVolume,
  stepWeight,
  stepReps,
  e1rm,
  sessionPRs,
  DEFAULT_REST_SEC,
  type SessionExercise,
  type LoggedSet,
} from "@/lib/training/runner";

const ex = (slug: string, sets: number): SessionExercise => ({
  slug, name: slug, sets, reps: "8", rpe: 7, restSec: 120,
});
const set = (set_index: number, weight: number | null = 60, reps: number | null = 8): LoggedSet =>
  ({ set_index, weight, reps });

describe("buildSessionPlan", () => {
  it("reads a normal plan block", () => {
    const [p] = buildSessionPlan([
      { slug: "Barbell_Squat", name: "Barbell Squat", sets: 3, reps: "8-12", rpe: 7, rest_sec: 150 },
    ]);
    expect(p).toEqual({
      slug: "Barbell_Squat", name: "Barbell Squat", sets: 3, reps: "8-12", rpe: 7, restSec: 150,
    });
  });

  it("drops blocks with no slug", () => {
    // The slug is the logging identity. Offering an exercise whose sets cannot
    // be recorded would take the athlete's input and silently discard it.
    expect(buildSessionPlan([{ name: "Mystery lift", sets: 3 }])).toEqual([]);
    expect(buildSessionPlan([{ slug: "   ", name: "Blank" }])).toEqual([]);
  });

  it("falls back to the slug when a block has no name", () => {
    expect(buildSessionPlan([{ slug: "Leg_Press" }])[0].name).toBe("Leg_Press");
  });

  it("defaults a missing or absurd set count to something sane", () => {
    expect(buildSessionPlan([{ slug: "a" }])[0].sets).toBe(1);
    expect(buildSessionPlan([{ slug: "a", sets: 0 }])[0].sets).toBe(1);
    expect(buildSessionPlan([{ slug: "a", sets: 999 }])[0].sets).toBe(20);
    expect(buildSessionPlan([{ slug: "a", sets: 3.7 }])[0].sets).toBe(3);
  });

  it("defaults rest when the plan does not prescribe it", () => {
    expect(buildSessionPlan([{ slug: "a" }])[0].restSec).toBe(DEFAULT_REST_SEC);
    expect(buildSessionPlan([{ slug: "a", rest_sec: 0 }])[0].restSec).toBe(DEFAULT_REST_SEC);
    expect(buildSessionPlan([{ slug: "a", rest_sec: 99999 }])[0].restSec).toBe(900);
  });

  it("keeps reps as text, because a rep target is a range", () => {
    expect(buildSessionPlan([{ slug: "a", reps: "8-12" }])[0].reps).toBe("8-12");
    expect(buildSessionPlan([{ slug: "a", reps: 10 }])[0].reps).toBe("10");
    expect(buildSessionPlan([{ slug: "a" }])[0].reps).toBe("");
  });

  it("returns nothing for a rest day or a malformed plan", () => {
    expect(buildSessionPlan([])).toEqual([]);
    expect(buildSessionPlan(undefined)).toEqual([]);
    expect(buildSessionPlan("not an array")).toEqual([]);
  });
});

describe("setsDoneFor", () => {
  it("counts logged sets", () => {
    expect(setsDoneFor(ex("a", 3), [set(1), set(2)])).toBe(2);
  });

  it("counts a re-logged set once", () => {
    // Correcting set 2 must not read as two sets done.
    expect(setsDoneFor(ex("a", 3), [set(1), set(2), set(2)])).toBe(2);
  });

  it("ignores sets beyond the prescription", () => {
    // A leftover set 7 from a longer prescription must not push a 3-set
    // exercise past 100 %.
    expect(setsDoneFor(ex("a", 3), [set(1), set(7)])).toBe(1);
    expect(setsDoneFor(ex("a", 3), [set(0)])).toBe(0);
  });

  it("is zero with nothing logged", () => {
    expect(setsDoneFor(ex("a", 3), [])).toBe(0);
    expect(setsDoneFor(ex("a", 3), undefined)).toBe(0);
  });
});

describe("sessionProgress", () => {
  const plan = [ex("a", 3), ex("b", 3), ex("c", 2)];

  it("starts at the first exercise, first set", () => {
    const p = sessionProgress(plan, {});
    expect(p).toMatchObject({
      totalSets: 8, doneSets: 0, exercisesDone: 0, totalExercises: 3,
      currentExerciseIndex: 0, currentSetIndex: 1, isComplete: false,
    });
    expect(p.fraction).toBe(0);
  });

  it("advances through sets, then to the next exercise", () => {
    expect(sessionProgress(plan, { a: [set(1)] })).toMatchObject({
      doneSets: 1, currentExerciseIndex: 0, currentSetIndex: 2,
    });
    expect(sessionProgress(plan, { a: [set(1), set(2), set(3)] })).toMatchObject({
      exercisesDone: 1, currentExerciseIndex: 1, currentSetIndex: 1,
    });
  });

  it("returns the athlete to a gap rather than past it", () => {
    // They jumped to set 3 and came back. The next thing to do is set 2.
    expect(sessionProgress(plan, { a: [set(1), set(3)] })).toMatchObject({
      currentExerciseIndex: 0, currentSetIndex: 2,
    });
  });

  it("points at the first UNFINISHED exercise, not the furthest reached", () => {
    // Skipped a entirely, did all of b. Sending them to c would silently
    // abandon a.
    expect(sessionProgress(plan, { b: [set(1), set(2), set(3)] })).toMatchObject({
      currentExerciseIndex: 0, exercisesDone: 1,
    });
  });

  it("is complete only when every exercise is finished", () => {
    const all = {
      a: [set(1), set(2), set(3)],
      b: [set(1), set(2), set(3)],
      c: [set(1), set(2)],
    };
    const p = sessionProgress(plan, all);
    expect(p.isComplete).toBe(true);
    expect(p.currentExerciseIndex).toBe(-1);
    expect(p.currentSetIndex).toBe(0);
    expect(p.fraction).toBe(1);
  });

  it("is not complete for an empty session", () => {
    // An empty plan must never render as a finished workout.
    const p = sessionProgress([], {});
    expect(p.isComplete).toBe(false);
    expect(p.fraction).toBe(0);
    expect(p.totalSets).toBe(0);
  });
});

describe("suggestedLoad", () => {
  it("offers the same set from last time", () => {
    expect(suggestedLoad([set(1, 60, 8), set(2, 65, 8)], 2, [])).toEqual({ weight: 65, reps: 8 });
  });

  it("falls back to this session's previous set", () => {
    expect(suggestedLoad([], 3, [set(1, 50, 10), set(2, 55, 9)])).toEqual({ weight: 55, reps: 9 });
  });

  it("prefers last time over this session", () => {
    expect(suggestedLoad([set(2, 70, 8)], 2, [set(1, 50, 10)])).toEqual({ weight: 70, reps: 8 });
  });

  it("offers nothing on a first-ever set rather than guessing", () => {
    expect(suggestedLoad([], 1, [])).toEqual({ weight: null, reps: null });
    expect(suggestedLoad(undefined, 1, undefined)).toEqual({ weight: null, reps: null });
  });

  it("ignores history rows with no weight", () => {
    expect(suggestedLoad([set(1, null, 8)], 1, [])).toEqual({ weight: null, reps: null });
  });
});

describe("formatRest", () => {
  it("formats mm:ss", () => {
    expect(formatRest(120)).toBe("2:00");
    expect(formatRest(95)).toBe("1:35");
    expect(formatRest(9)).toBe("0:09");
    expect(formatRest(0)).toBe("0:00");
  });

  it("never shows a negative clock", () => {
    expect(formatRest(-5)).toBe("0:00");
  });

  it("rounds rather than truncating a fractional tick", () => {
    expect(formatRest(59.6)).toBe("1:00");
  });
});

describe("sessionVolume", () => {
  it("sums weight × reps", () => {
    expect(sessionVolume({ a: [set(1, 60, 8), set(2, 60, 8)] })).toBe(960);
  });

  it("ignores sets missing a weight or reps", () => {
    expect(sessionVolume({ a: [set(1, 60, 8), set(2, null, 8), set(3, 60, null)] })).toBe(480);
  });

  it("is zero for an empty session", () => {
    expect(sessionVolume({})).toBe(0);
  });
});

describe("stepWeight / stepReps", () => {
  it("steps weight by a plate pair, from a string or a number", () => {
    expect(stepWeight("60", 1)).toBe(62.5);
    expect(stepWeight(62.5, -1)).toBe(60);
    expect(stepWeight("", 1)).toBe(2.5);
    expect(stepWeight(null, 1)).toBe(2.5);
  });

  it("never steps weight below zero and stays float-clean", () => {
    expect(stepWeight("1", -1)).toBe(0);
    expect(stepWeight(0, -1)).toBe(0);
    expect(stepWeight("0.1", 1)).toBe(2.6);
    expect(stepWeight("abc", 1)).toBe(2.5);
  });

  it("steps reps by one, never below zero, from whole numbers", () => {
    expect(stepReps("8", 1)).toBe(9);
    expect(stepReps("8.7", -1)).toBe(7);
    expect(stepReps("", 1)).toBe(1);
    expect(stepReps(0, -1)).toBe(0);
    expect(stepReps(undefined, -1)).toBe(0);
  });
});

describe("sessionPRs", () => {
  const today = "2026-09-06";
  const row = (slug: string, weight: number | null, reps: number | null, logged_on: string, name?: string) =>
    ({ exercise_slug: slug, exercise_name: name ?? slug, weight, reps, logged_on });

  it("uses Epley", () => {
    expect(e1rm(100, 1)).toBeCloseTo(103.33, 2);
    expect(e1rm(60, 8)).toBe(76);
  });

  it("is not a PR on a first-ever lift", () => {
    // Nothing to beat: a baseline, not a record.
    expect(sessionPRs([], { bench: [set(1, 60, 8)] }, today)).toEqual([]);
    expect(sessionPRs(undefined, { bench: [set(1, 60, 8)] }, today)).toEqual([]);
  });

  it("is not a PR on a tie", () => {
    expect(sessionPRs([row("bench", 60, 8, "2026-09-01")], { bench: [set(1, 60, 8)] }, today)).toEqual([]);
  });

  it("calls the improvement, with the previous best beside it", () => {
    const history = [row("bench", 60, 8, "2026-09-01", "Bench press"), row("bench", 55, 10, "2026-08-25")];
    const prs = sessionPRs(history, { bench: [set(1, 62.5, 8)] }, today);
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({ slug: "bench", name: "Bench press" });
    expect(prs[0].e1rm).toBeCloseTo(e1rm(62.5, 8), 6);
    expect(prs[0].prevBest).toBe(76);
  });

  it("ignores today's own row in the history feed", () => {
    // recent_workout_logs already holds today's top set by summary time; it
    // must not compete with itself.
    const history = [row("bench", 62.5, 8, today), row("bench", 60, 8, "2026-09-01")];
    expect(sessionPRs(history, { bench: [set(1, 62.5, 8)] }, today)).toHaveLength(1);
  });

  it("reports one record per exercise, from the best set of the day", () => {
    const history = [row("bench", 60, 8, "2026-09-01")];
    const prs = sessionPRs(history, { bench: [set(1, 62.5, 8), set(2, 65, 8), set(3, 60, 8)] }, today);
    expect(prs).toHaveLength(1);
    expect(prs[0].e1rm).toBeCloseTo(e1rm(65, 8), 6);
  });

  it("skips sets and rows without a weight, and counts a missing rep count as one", () => {
    expect(sessionPRs([row("bench", 60, 8, "2026-09-01")], { bench: [set(1, null, 8)] }, today)).toEqual([]);
    expect(sessionPRs([row("bench", null, 8, "2026-09-01")], { bench: [set(1, 60, 8)] }, today)).toEqual([]);
    expect(sessionPRs([row("bench", 60, null, "2026-09-01")], { bench: [set(1, 70, null)] }, today)).toHaveLength(1);
  });

  it("falls back to the slug when no row carries a name", () => {
    const history = [{ exercise_slug: "bench", weight: 60, reps: 8, logged_on: "2026-09-01" }];
    expect(sessionPRs(history, { bench: [set(1, 70, 8)] }, today)[0].name).toBe("bench");
  });
});
