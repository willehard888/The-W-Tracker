import { describe, expect, it } from "vitest";
import { assembleDaySnapshot } from "@/lib/health/healthkit";

describe("assembleDaySnapshot", () => {
  it("returns an all-null day with no data and no sources", () => {
    const s = assembleDaySnapshot("2026-09-13", { available: true }, { available: true }, null);
    expect(s).toEqual({
      date: "2026-09-13",
      steps: null, distance_m: null, flights: null,
      workout_count: null, workout_minutes: null, primary_sport: null, workouts: [],
      sleep_hours: null, active_kcal: null, mindful_minutes: null,
      body_mass_kg: null, body_fat_pct: null, vo2max: null,
      sources: [],
    });
  });

  it("picks the LONGEST workout's sport and sums minutes", () => {
    const s = assembleDaySnapshot("2026-09-13", {
      available: true,
      workouts: [
        { type: "walking", duration_s: 600, source: "Apple Watch" },
        { type: "running", duration_s: 2700, source: "Garmin Connect" },
      ],
    }, null, null);
    expect(s.workout_count).toBe(2);
    expect(s.workout_minutes).toBe(55);
    expect(s.primary_sport).toBe("run");
  });

  it("keeps every session as the sport it was, oldest first, with its numbers", () => {
    // A Polar tennis match and a gym session: the day used to leave as
    // "107 minutes, gym" — the match vanished because gym was longer.
    const s = assembleDaySnapshot("2026-09-23", {
      available: true,
      workouts: [
        { type: "traditionalStrengthTraining", duration_s: 2700, kcal: 310, source: "Whealth Factory", start: "2026-09-23T07:00:00Z" },
        { type: "tennis", duration_s: 3720, kcal: 480.4, avg_hr: 142.6, distance_m: 0, source: "Polar Flow", start: "2026-09-23T17:00:00Z" },
        { type: "cooldown", duration_s: 300, source: "Polar Flow", start: "2026-09-23T18:02:00Z" },
        { type: "walking", duration_s: 0, source: "Apple Watch" },
      ],
    }, null, null);
    expect(s.primary_sport).toBe("tennis");
    expect(s.workouts).toEqual([
      { sport: "gym", hk_type: "traditionalStrengthTraining", duration_min: 45, kcal: 310, distance_m: null, avg_hr: null, source: "Whealth Factory", start: "2026-09-23T07:00:00Z", manual: false },
      { sport: "tennis", hk_type: "tennis", duration_min: 62, kcal: 480, distance_m: null, avg_hr: 143, source: "Polar Flow", start: "2026-09-23T17:00:00Z", manual: false },
    ]);
  });

  it("keeps the hand-entered flag so the score can treat the session as a claim", () => {
    const s = assembleDaySnapshot("2026-09-23", {
      available: true,
      workouts: [{ type: "tennis", duration_s: 3600, source: "Health", manual: true }],
    }, null, null);
    expect(s.workouts[0].manual).toBe(true);
  });

  it("caps the list at 20 and survives an old plugin without start dates", () => {
    const many = Array.from({ length: 25 }, () => ({ type: "walking", duration_s: 120 }));
    const s = assembleDaySnapshot("2026-09-23", { available: true, workouts: many }, null, null);
    expect(s.workouts).toHaveLength(20);
    expect(s.workouts[0]).toMatchObject({ sport: "walk", duration_min: 2, start: null, source: null });
  });

  it("falls back to the plugin's primary_type when workouts carry no type", () => {
    const s = assembleDaySnapshot("2026-09-13", {
      available: true,
      workouts: [{ duration_s: 1800 }],
      primary_type: "cycling",
    }, null, null);
    expect(s.primary_sport).toBe("cycling");
  });

  it("adds walking and cycling distance, and rounds", () => {
    const s = assembleDaySnapshot("2026-09-13", { available: true, distance_walk_m: 4321.6, distance_cycle_m: 12000.2 }, null, null);
    expect(s.distance_m).toBe(16322);
  });

  it("clamps negatives, NaN and Infinity to null before they reach the server", () => {
    const s = assembleDaySnapshot("2026-09-13", {
      available: true,
      steps: -12,
      active_kcal: Number.NaN,
      flights: Number.POSITIVE_INFINITY,
      mindful_minutes: 12.4,
    }, { available: true, body_mass_kg: -1, vo2max: 48.26 }, null);
    expect(s.steps).toBeNull();
    expect(s.active_kcal).toBeNull();
    expect(s.flights).toBeNull();
    expect(s.mindful_minutes).toBe(12);
    expect(s.body_mass_kg).toBeNull();
    expect(s.vo2max).toBe(48.3);
  });

  it("de-duplicates and sorts sources, dropping blanks", () => {
    const s = assembleDaySnapshot("2026-09-13", {
      available: true,
      sources: ["Oura", "Garmin Connect", "", "Oura", "Apple Watch"],
    }, null, null);
    expect(s.sources).toEqual(["Apple Watch", "Garmin Connect", "Oura"]);
  });

  it("carries last night's sleep through untouched", () => {
    const s = assembleDaySnapshot("2026-09-13", { available: true }, null, 7.5);
    expect(s.sleep_hours).toBe(7.5);
  });

  it("survives a null body read without blanking the day", () => {
    const s = assembleDaySnapshot("2026-09-13", { available: true, steps: 9000 }, null, null);
    expect(s.steps).toBe(9000);
    expect(s.body_fat_pct).toBeNull();
  });
});
