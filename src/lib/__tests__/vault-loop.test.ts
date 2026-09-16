import { describe, expect, it } from "vitest";
import { hasLoop, loopState, pathProgress, practiceLength, PRACTICE_XP } from "../vault-loop";

describe("loopState", () => {
  it("walks understand → reflect → practice → integrate → done", () => {
    expect(loopState(null, false, false).stage).toBe("understand");
    expect(loopState({ completed_at: "t" }, false, false)).toMatchObject({ stage: "reflect", done: 1 });
    expect(loopState({ completed_at: "t" }, true, false)).toMatchObject({ stage: "practice", done: 2 });
    expect(loopState({ completed_at: "t", practiced_at: "t" }, true, false)).toMatchObject({ stage: "integrate", done: 3 });
    expect(loopState({ completed_at: "t", practiced_at: "t", integrated_at: "t" }, true, false)).toMatchObject({ stage: "done", done: 4 });
    expect(loopState({ completed_at: "t", practiced_at: "t" }, true, true).stage).toBe("done");
  });

  it("a practice recorded before reading still counts (the row carries completed_at)", () => {
    // record_vault_practice inserts the row, so completed_at is set server-side.
    expect(loopState({ completed_at: "t", practiced_at: "t" }, false, false).stage).toBe("reflect");
  });

  it("the stage is not skipped: no reflection means practice is not next", () => {
    expect(loopState({ completed_at: "t", practiced_at: null }, false, false).stage).toBe("reflect");
  });
});

describe("helpers", () => {
  it("hasLoop needs both questions", () => {
    expect(hasLoop({ reflect_prompt: "a?", integrate_prompt: "b?" })).toBe(true);
    expect(hasLoop({ reflect_prompt: "a?", integrate_prompt: null })).toBe(false);
    expect(hasLoop({})).toBe(false);
  });

  it("practiceLength reads as the member would say it", () => {
    expect(practiceLength(5)).toBe("5 min");
    expect(practiceLength(20)).toBe("over the week");
    expect(practiceLength(null)).toBe("a few minutes");
  });

  it("pathProgress finds the next step and completion", () => {
    expect(pathProgress(["a", "b", "c"], new Set(["a"]))).toEqual({ done: 1, total: 3, next: "b", complete: false });
    expect(pathProgress(["a", "b"], new Set(["a", "b"]))).toEqual({ done: 2, total: 2, next: null, complete: true });
  });

  it("the XP is the size of one optional check-in habit", () => {
    expect(PRACTICE_XP).toBe(15);
  });
});
