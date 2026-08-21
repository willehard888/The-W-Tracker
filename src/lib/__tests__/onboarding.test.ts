// The onboarding→coach handoff contract: answers must land in the SAME draft
// key and patch shape the Coach wizard reads, onboarding keys must win over a
// stale draft, and a full skip must write nothing. Breaking any of these makes
// users answer the same questions twice.
import { describe, it, expect, beforeEach } from "vitest";
import {
  COACH_DRAFT_KEY,
  TRAINING_DAYS_MAP,
  athletePatchFromAnswers,
  mergeIntoCoachDraft,
  strugglePromise,
  GOAL_OPTIONS,
  STRUGGLE_PROMISES,
  STRUGGLE_OPTIONS,
} from "@/lib/onboarding";

beforeEach(() => localStorage.clear());

describe("athletePatchFromAnswers", () => {
  it("maps all four answers into the coach patch shape", () => {
    expect(
      athletePatchFromAnswers({
        primary_goal: "hypertrophy",
        sports: ["gym", "run"],
        training_freq: "3-4",
        struggle: "consistency",
      }),
    ).toEqual({
      primary_goal: "hypertrophy",
      sports: ["gym", "run"],
      training_days_pref: [1, 3, 5],
    });
  });

  it("a full skip produces an empty patch (nothing written)", () => {
    expect(athletePatchFromAnswers({})).toEqual({});
  });

  it("drops empty sports and unknown frequency values", () => {
    expect(athletePatchFromAnswers({ sports: [], training_freq: "sometimes" })).toEqual({});
  });

  it("frequency map covers every offered option and never invents 7 days", () => {
    for (const days of Object.values(TRAINING_DAYS_MAP)) {
      expect(days.length).toBeGreaterThan(0);
      expect(days.length).toBeLessThanOrEqual(5);
    }
    expect(TRAINING_DAYS_MAP["0"].length).toBe(2); // gentle on-ramp, not zero
  });
});

describe("mergeIntoCoachDraft", () => {
  it("merges over an existing draft — onboarding keys win, others survive", () => {
    localStorage.setItem(
      COACH_DRAFT_KEY,
      JSON.stringify({ primary_goal: "endurance", age: 30, tone_pref: "hard" }),
    );
    mergeIntoCoachDraft({ primary_goal: "strength", sports: ["gym"] });
    expect(JSON.parse(localStorage.getItem(COACH_DRAFT_KEY)!)).toEqual({
      primary_goal: "strength",
      sports: ["gym"],
      age: 30,
      tone_pref: "hard",
    });
  });

  it("recovers from a corrupt draft instead of throwing", () => {
    localStorage.setItem(COACH_DRAFT_KEY, "{not json");
    mergeIntoCoachDraft({ primary_goal: "focus" });
    expect(JSON.parse(localStorage.getItem(COACH_DRAFT_KEY)!)).toEqual({ primary_goal: "focus" });
  });

  it("writes nothing on empty answers", () => {
    mergeIntoCoachDraft({});
    expect(localStorage.getItem(COACH_DRAFT_KEY)).toBeNull();
  });
});

describe("strugglePromise", () => {
  it("has a personalized promise for every struggle option", () => {
    for (const opt of STRUGGLE_OPTIONS) {
      expect(STRUGGLE_PROMISES[opt.v]).toBeDefined();
    }
  });

  it("falls back gracefully for unknown/missing struggle", () => {
    expect(strugglePromise(undefined).title).toBeTruthy();
    expect(strugglePromise("garbage").title).toBeTruthy();
  });
});

describe("GOAL_OPTIONS", () => {
  it("uses only valid GoalId values (must match the coach taxonomy)", () => {
    const valid = ["all", "strength", "hypertrophy", "endurance", "fat_loss", "longevity", "focus"];
    for (const g of GOAL_OPTIONS) expect(valid).toContain(g.v);
  });
});
