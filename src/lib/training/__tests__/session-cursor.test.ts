import { describe, it, expect } from "vitest";
import {
  sessionProgress,
  resolveCursor,
  cursorReleases,
  setRowSeed,
  type SessionExercise,
  type LoggedSet,
} from "../runner";

/**
 * A derived position cannot say "I chose this one".
 *
 * `sessionProgress` returns the first movement with an unlogged set, which is
 * the right default and survives an app kill for free because it is computed
 * from the sets rather than stored. What it has nowhere to put is the
 * athlete's own choice: a superset, a busy rack, or going back to correct set
 * 2 of a movement already finished. Before this, "Next" marked the movement
 * skipped and the only way back was to finish the session and press "Keep
 * training", which cleared every skip at once.
 */

const ex = (slug: string, sets: number): SessionExercise => ({
  slug,
  name: slug,
  sets,
  reps: "8-12",
  rpe: 8,
  restSec: 90,
});

const plan = [ex("bench", 3), ex("row", 3), ex("curl", 3)];
const sets = (...idx: number[]): LoggedSet[] => idx.map((i) => ({ set_index: i, weight: 60, reps: 8 }));

describe("the exercise on stage", () => {
  it("follows the derivation when nothing has been chosen", () => {
    const logged = { bench: sets(1, 2, 3) };
    const p = sessionProgress(plan, logged);
    expect(resolveCursor(plan, p, null), "no cursor is exactly today's behaviour")
      .toBe(p.currentExerciseIndex);
    expect(resolveCursor(plan, p, null)).toBe(1);
  });

  it("puts the athlete's own choice ahead of the derivation", () => {
    const p = sessionProgress(plan, {});
    expect(p.currentExerciseIndex, "the derivation wants the first").toBe(0);
    expect(resolveCursor(plan, p, "curl"), "but they tapped the curl").toBe(2);
  });

  it("keeps a finished movement on stage when it was chosen", () => {
    // Going back to correct set 2 of something already complete is a real
    // thing to do, and the derivation can never point at it.
    const logged = { bench: sets(1, 2, 3) };
    const p = sessionProgress(plan, logged);
    expect(resolveCursor(plan, p, "bench")).toBe(0);
  });

  it("falls back when the chosen movement is no longer in the plan", () => {
    // The runner can swap a movement mid-session. A stored index would then
    // point silently at a different exercise; a slug simply stops resolving.
    const p = sessionProgress(plan, {});
    expect(resolveCursor(plan, p, "squat-that-was-swapped-out")).toBe(p.currentExerciseIndex);
  });

  it("lets go once the chosen movement is finished", () => {
    expect(cursorReleases(plan[0], sets(1, 2, 3)), "three of three").toBe(true);
    expect(cursorReleases(plan[0], sets(1, 2)), "two of three").toBe(false);
    expect(cursorReleases(plan[0], undefined), "nothing logged").toBe(false);
  });

  it("still completes a session with a movement skipped around it", () => {
    const logged = { bench: sets(1, 2, 3), curl: sets(1, 2, 3) };
    const p = sessionProgress(plan, logged, new Set(["row"]));
    expect(p.isComplete, "skipped means the session can still finish").toBe(true);
  });
});

/**
 * Typing survives leaving the exercise.
 *
 * The draft used to live inside the set row, which unmounts on a movement
 * change, so a weight typed and not logged was dropped without a word. That
 * is why there is no "you have unsaved input" dialog on switching: nothing
 * can be lost, so there is nothing to warn about.
 */
describe("what a set row shows", () => {
  const suggestion = { weight: 80, reps: 8 };

  it("shows what the athlete typed, over everything else", () => {
    const seed = setRowSeed({ weight: "82,5", reps: "6" }, undefined, suggestion, true);
    expect(seed).toEqual({ weight: "82,5", reps: "6" });
  });

  it("keeps typing when a late history query would otherwise overwrite it", () => {
    // History lands after first paint and used to replace a half-typed 82.
    const existing = { set_index: 1, weight: 80, reps: 8 };
    const seed = setRowSeed({ weight: "82", reps: "" }, existing, suggestion, true);
    expect(seed.weight, "the number under their thumb").toBe("82");
  });

  it("shows what was logged when there is no draft", () => {
    const seed = setRowSeed(undefined, { set_index: 1, weight: 100, reps: 5 }, suggestion, false);
    expect(seed).toEqual({ weight: "100", reps: "5" });
  });

  it("suggests a load only on the set being worked", () => {
    expect(setRowSeed(undefined, undefined, suggestion, true)).toEqual({ weight: "80", reps: "8" });
  });

  it("shows nothing on a set still ahead", () => {
    // A suggestion on row 4 while they are working row 1 reads as a number
    // they already entered.
    expect(setRowSeed(undefined, undefined, suggestion, false)).toEqual({ weight: "", reps: "" });
  });

  it("shows an empty field rather than the word null", () => {
    const seed = setRowSeed(undefined, { set_index: 1, weight: null, reps: null }, suggestion, false);
    expect(seed).toEqual({ weight: "", reps: "" });
  });
});
