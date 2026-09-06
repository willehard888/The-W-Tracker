import { describe, it, expect } from "vitest";
import { programWeekState } from "@/lib/training/program-week";

/**
 * The two failures this replaces were both silent: a program that slid past an
 * athlete who missed a week, and a block that pinned to its final week forever
 * so a finished one looked exactly like an abandoned one.
 */

const day = (n: number) => new Date(2026, 0, 1 + n);
const START = "2026-01-01";
const log = (week: number, completed = true) => ({ week, completed });

describe("programWeekState — the calendar", () => {
  it("starts on week 1", () => {
    const s = programWeekState({ startedOn: START, weeks: 4, logs: [], now: day(0) });
    expect(s.currentWeek).toBe(1);
    expect(s.calendarWeek).toBe(1);
  });

  it("stays on week 1 for the whole first week", () => {
    expect(programWeekState({ startedOn: START, weeks: 4, logs: [log(1)], now: day(6) }).currentWeek).toBe(1);
  });

  it("advances when the athlete keeps up", () => {
    const s = programWeekState({ startedOn: START, weeks: 4, logs: [log(1)], now: day(7) });
    expect(s.currentWeek).toBe(2);
    expect(s.weeksBehind).toBe(0);
  });

  it("treats a missing start date as week 1 rather than throwing", () => {
    expect(programWeekState({ weeks: 4, logs: [] }).currentWeek).toBe(1);
    expect(programWeekState({ startedOn: "not a date", weeks: 4, logs: [] }).currentWeek).toBe(1);
  });

  it("never goes below week 1, even with a start date in the future", () => {
    expect(programWeekState({ startedOn: "2027-01-01", weeks: 4, logs: [], now: day(0) }).currentWeek).toBe(1);
  });
});

describe("programWeekState — not sliding past the athlete", () => {
  it("waits for someone who missed a month", () => {
    // Trained week 1, then vanished for four weeks. The old calendar-only rule
    // put them on week 4 with loads built on work they never did.
    const s = programWeekState({ startedOn: START, weeks: 4, logs: [log(1)], now: day(35) });
    expect(s.currentWeek).toBe(2);
    expect(s.calendarWeek).toBe(6);
    expect(s.weeksBehind).toBe(2);
  });

  it("keeps someone who has logged nothing on week 1", () => {
    const s = programWeekState({ startedOn: START, weeks: 4, logs: [], now: day(21) });
    expect(s.currentWeek).toBe(1);
    expect(s.lastWeekTrained).toBe(0);
  });

  it("ignores logs that are not completed", () => {
    // An abandoned in-progress session is not a trained week.
    const s = programWeekState({
      startedOn: START, weeks: 4, logs: [log(1, false), log(2, false)], now: day(21),
    });
    expect(s.currentWeek).toBe(1);
    expect(s.sessionsDone).toBe(0);
  });

  it("lets someone who trained ahead move on", () => {
    // Logged week 2 already; the calendar says week 2 as well.
    const s = programWeekState({ startedOn: START, weeks: 4, logs: [log(1), log(2)], now: day(7) });
    expect(s.currentWeek).toBe(2);
    expect(s.weeksBehind).toBe(0);
  });

  it("never runs past the block, however long the calendar has been", () => {
    const s = programWeekState({ startedOn: START, weeks: 4, logs: [log(1), log(2), log(3), log(4)], now: day(200) });
    expect(s.currentWeek).toBe(4);
  });
});

describe("programWeekState — the end of a block", () => {
  it("is not over while the block is still running", () => {
    expect(programWeekState({ startedOn: START, weeks: 4, logs: [log(1)], now: day(7) }).readyForNext).toBe(false);
  });

  it("is over once the calendar passes the final week", () => {
    const s = programWeekState({ startedOn: START, weeks: 4, logs: [log(1)], now: day(28) });
    expect(s.isPastEnd).toBe(true);
    expect(s.readyForNext).toBe(true);
  });

  it("is over as soon as the final week has been trained, without waiting out the clock", () => {
    // Finishing early should offer what comes next, not sit on "Week 4".
    const s = programWeekState({ startedOn: START, weeks: 4, logs: [log(4)], now: day(22) });
    expect(s.isPastEnd).toBe(false);
    expect(s.readyForNext).toBe(true);
  });

  it("is over for an abandoned block too — the calendar decides that one", () => {
    // No sessions at all, but the four weeks have passed. The block is over;
    // it is the copy's job to tell those two cases apart, not this function's.
    const s = programWeekState({ startedOn: START, weeks: 4, logs: [], now: day(60) });
    expect(s.readyForNext).toBe(true);
    expect(s.sessionsDone).toBe(0);
  });

  it("counts completed sessions across the block", () => {
    const s = programWeekState({
      startedOn: START, weeks: 4,
      logs: [log(1), log(1), log(1), log(2), log(2, false)],
      now: day(10),
    });
    expect(s.sessionsDone).toBe(4);
  });
});
