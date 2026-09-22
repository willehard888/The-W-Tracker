import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The RPC boundary is where the sport used to disappear: the snapshot carried
 * `primary_sport` and the call never sent it. This pins the argument list.
 */
const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ data: { ok: true }, error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (name: string, args: Record<string, unknown>) => rpc(name, args) } }));
const snapshot = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/health/healthkit", () => ({
  isHealthKitAvailable: async () => true,
  readTodaySnapshot: async () => snapshot.value,
}));
vi.mock("@/lib/health/night-metrics", () => ({ syncNightMetrics: async () => null }));
vi.mock("@/lib/health/health-consent", () => ({ hasHealthConsent: () => true, markHealthConnected: () => {} }));
vi.mock("@/lib/observability", () => ({ captureException: () => {} }));

import { syncDaySnapshot } from "@/lib/health/background-sync";

const tennis = { sport: "tennis", hk_type: "tennis", duration_min: 62, kcal: 480, distance_m: null, avg_hr: 143, source: "Polar Flow", start: "2026-09-23T17:00:00Z" };

describe("syncDaySnapshot", () => {
  beforeEach(() => rpc.mockClear());

  it("sends the sport and the day's sessions with the numbers", async () => {
    snapshot.value = {
      date: "2026-09-23", steps: 4200, distance_m: null, flights: null,
      workout_count: 1, workout_minutes: 62, primary_sport: "tennis", workouts: [tennis],
      sleep_hours: null, active_kcal: 900, mindful_minutes: null,
      body_mass_kg: null, body_fat_pct: null, vo2max: null, sources: ["Polar Flow"],
    };
    await syncDaySnapshot();
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(name).toBe("upsert_health_snapshot");
    expect(args).toMatchObject({ _date: "2026-09-23", _primary_sport: "tennis", _workouts: [tennis], _sources: ["Polar Flow"] });
  });

  it("omits the list on a day without sessions so an old row is left alone", async () => {
    snapshot.value = {
      date: "2026-09-23", steps: 100, distance_m: null, flights: null,
      workout_count: null, workout_minutes: null, primary_sport: null, workouts: [],
      sleep_hours: null, active_kcal: null, mindful_minutes: null,
      body_mass_kg: null, body_fat_pct: null, vo2max: null, sources: [],
    };
    await syncDaySnapshot();
    const [, args] = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(args._workouts).toBeUndefined();
    expect(args._primary_sport).toBeUndefined();
  });
});
