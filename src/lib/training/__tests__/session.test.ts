import { describe, it, expect } from "vitest";
import { dayFocus, isRestDay, blockCount, isTrainingDay, daySummary } from "@/lib/training/session";

/**
 * The bug these lock down: /coach's ProgramCard tested `day.rest === true`,
 * a field no generator writes, so it never once detected a rest day. The other
 * three surfaces tested the focus label. These assert the single answer, and
 * that it survives the shapes plan_json actually arrives in.
 */

describe("dayFocus", () => {
  it("reads the focus label", () => {
    expect(dayFocus({ focus: "Push" })).toBe("Push");
  });

  it("falls back to session_name, which older generated plans used", () => {
    expect(dayFocus({ session_name: "Upper A" })).toBe("Upper A");
    // focus wins when both are present.
    expect(dayFocus({ focus: "Push", session_name: "Upper A" })).toBe("Push");
  });

  it("survives a day with no label at all", () => {
    expect(dayFocus({})).toBe("");
    expect(dayFocus(null)).toBe("");
    expect(dayFocus(undefined)).toBe("");
    expect(dayFocus({ focus: null, session_name: null })).toBe("");
  });

  it("trims, so a padded label still matches", () => {
    expect(dayFocus({ focus: "  Rest  " })).toBe("Rest");
  });
});

describe("isRestDay", () => {
  it("detects the label every generator actually writes", () => {
    // The AI generator and beginner-program.ts both emit exactly this.
    expect(isRestDay({ focus: "Rest", duration_min: 0, blocks: [] })).toBe(true);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isRestDay({ focus: "rest" })).toBe(true);
    expect(isRestDay({ focus: "REST" })).toBe(true);
    expect(isRestDay({ focus: " Rest " })).toBe(true);
  });

  it("does not treat a training day as rest", () => {
    expect(isRestDay({ focus: "Push", blocks: [{}] })).toBe(false);
    // "Active recovery" is a session someone has to turn up for.
    expect(isRestDay({ focus: "Active recovery", blocks: [{}] })).toBe(false);
  });

  it("treats a day with no label as not-rest rather than throwing", () => {
    // The old `day.focus.toLowerCase()` threw here and blanked the screen.
    expect(isRestDay({})).toBe(false);
    expect(isRestDay(null)).toBe(false);
  });
});

describe("blockCount", () => {
  it("counts prescribed exercises", () => {
    expect(blockCount({ blocks: [{}, {}, {}] })).toBe(3);
    expect(blockCount({ blocks: [] })).toBe(0);
  });

  it("returns 0 for anything that is not an array", () => {
    expect(blockCount({})).toBe(0);
    expect(blockCount(null)).toBe(0);
    expect(blockCount({ blocks: "not an array" })).toBe(0);
    expect(blockCount({ blocks: null })).toBe(0);
  });
});

describe("isTrainingDay", () => {
  it("is true only when there is something to actually do", () => {
    expect(isTrainingDay({ focus: "Push", blocks: [{}, {}] })).toBe(true);
  });

  it("is false on a rest day", () => {
    expect(isTrainingDay({ focus: "Rest", blocks: [] })).toBe(false);
  });

  it("is false when a day has a focus but no exercises", () => {
    // A truncated model response. Not a reason to send anyone to the gym.
    expect(isTrainingDay({ focus: "Push", blocks: [] })).toBe(false);
  });

  it("is false for a missing day", () => {
    expect(isTrainingDay(null)).toBe(false);
    expect(isTrainingDay(undefined)).toBe(false);
  });
});

describe("daySummary", () => {
  it("names a rest day plainly", () => {
    expect(daySummary({ focus: "Rest", duration_min: 0, blocks: [] })).toBe("Rest day");
  });

  it("combines duration and exercise count", () => {
    expect(daySummary({ focus: "Push", duration_min: 45, blocks: [{}, {}, {}] }))
      .toBe("45 min · 3 exercises");
  });

  it("singularises one exercise", () => {
    expect(daySummary({ focus: "Push", duration_min: 20, blocks: [{}] })).toBe("20 min · 1 exercise");
  });

  it("omits parts it does not have instead of printing zeros", () => {
    // The old ProgramCard rendered " · " with nothing either side here.
    expect(daySummary({ focus: "Push", blocks: [{}, {}] })).toBe("2 exercises");
    expect(daySummary({ focus: "Push", duration_min: 40 })).toBe("40 min");
    expect(daySummary({ focus: "Push" })).toBe("");
  });

  it("returns nothing for a missing day", () => {
    expect(daySummary(null)).toBe("");
    expect(daySummary(undefined)).toBe("");
  });
});
