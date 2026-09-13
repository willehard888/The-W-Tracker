import { describe, expect, it } from "vitest";
import { assembleDaySnapshot } from "@/lib/health/healthkit";

describe("assembleDaySnapshot", () => {
  it("returns an all-null day with no data and no sources", () => {
    const s = assembleDaySnapshot("2026-09-13", { available: true }, { available: true }, null);
    expect(s).toEqual({
      date: "2026-09-13",
      steps: null, distance_m: null, flights: null,
      workout_count: null, workout_minutes: null, primary_sport: null,
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
