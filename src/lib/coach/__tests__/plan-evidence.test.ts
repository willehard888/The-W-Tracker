import { describe, it, expect } from "vitest";
import { PROTOCOL_HABIT, habitFor, habitCovered, settledMissions, type PlanEvidence } from "@/lib/coach/plan-evidence";
import { CHECKIN_HABITS } from "@/lib/checkin-habits";

// The plan function's catalog ids (supabase/functions/coach-daily-plan/index.ts
// PROTOCOL_CATALOG). A new protocol there needs a row here, or its reminder can
// never be covered.
const CATALOG_IDS = [
  "sleep-7-9h", "morning-light-10min", "caffeine-cutoff-8h", "alcohol-zero-on-training",
  "zone-2-cardio", "strength-2-3x", "vo2-intervals-1x", "strength-progressive-overload", "walk-after-meals-10min",
  "protein-1-6g-per-kg", "log-meals-3x", "fiber-30g", "hydration-30ml-kg", "fasted-cardio",
  "breath-box-5min", "breath-physiological-sigh", "mindfulness-10min", "nsdr-yoga-nidra-10min", "nature-2h-week",
  "journaling-5min", "deep-work-90min", "no-phone-first-60min",
  "mobility-10min", "sauna-20min-4x", "cold-2-3min", "sun-vitd-15min", "cwt-contrast", "heart-rate-variability-track",
  "weekly-social-2x", "gratitude-3x",
];

const none: PlanEvidence = { checkin: null, trainedToday: false, reflectionToday: false, recoveryHabits: new Set() };

describe("PROTOCOL_HABIT", () => {
  it("covers every catalog id and nothing else", () => {
    expect(Object.keys(PROTOCOL_HABIT).sort()).toEqual([...CATALOG_IDS].sort());
  });

  it("only points at real check-in habits", () => {
    const keys = new Set(CHECKIN_HABITS.map((h) => h.key));
    for (const habit of Object.values(PROTOCOL_HABIT)) {
      if (habit !== null) expect(keys.has(habit)).toBe(true);
    }
  });

  it("returns null for unknown or missing protocols", () => {
    expect(habitFor(undefined)).toBeNull();
    expect(habitFor("made-up")).toBeNull();
    expect(habitFor("log-meals-3x")).toBeNull();
  });
});

describe("habitCovered", () => {
  it("reads the check-in row: columns, jsonb, and the sleep window", () => {
    const row = { sleep_hours: 8, hydration_liters: 2, cold_shower: true, habits: { sunlight: true } };
    const e = { ...none, checkin: row };
    expect(habitCovered("sleep", e)).toBe(true);
    expect(habitCovered("hydration", e)).toBe(false);
    expect(habitCovered("cold_shower", e)).toBe(true);
    expect(habitCovered("sunlight", e)).toBe(true);
    expect(habitCovered("zone2", e)).toBe(false);
  });

  it("is never covered before the check-in unless the app saw it itself", () => {
    expect(habitCovered("workout", none)).toBe(false);
    expect(habitCovered("workout", { ...none, trainedToday: true })).toBe(true);
    expect(habitCovered("journaling", { ...none, reflectionToday: true })).toBe(true);
    expect(habitCovered("gratitude", { ...none, reflectionToday: true })).toBe(true);
    expect(habitCovered("breathwork", { ...none, recoveryHabits: new Set(["breathwork"]) })).toBe(true);
    expect(habitCovered("mobility", { ...none, recoveryHabits: new Set(["breathwork"]) })).toBe(false);
  });
});

describe("settledMissions", () => {
  const missions = [
    { id: "lift", protocol_id: "strength-2-3x" },
    { id: "light", protocol_id: "morning-light-10min" },
    { id: "meals", protocol_id: "log-meals-3x" },
    { id: "old" }, // a plan written before protocol ids
  ];

  it("settles by evidence and leaves plain reminders alone", () => {
    const e: PlanEvidence = { ...none, trainedToday: true, checkin: { habits: { sunlight: true } } };
    expect([...settledMissions(missions, e)].sort()).toEqual(["lift", "light"]);
  });

  it("settles nothing on an empty day", () => {
    expect(settledMissions(missions, none).size).toBe(0);
  });
});
