import { describe, it, expect } from "vitest";
import { sessionsBySport, type HealthSession } from "@/hooks/use-health-workouts";

const s = (o: Partial<HealthSession>): HealthSession => ({ date: "2026-09-22", sport: "tennis", duration_min: 60, kcal: null, avg_hr: null, source: "Polar Flow", ...o });

describe("sessionsBySport", () => {
  it("sums minutes per sport, longest first, with a minutes-weighted average HR", () => {
    const out = sessionsBySport(
      [s({ sport: "gym", duration_min: 45, avg_hr: 120 }), s({ duration_min: 62, avg_hr: 142 }), s({ date: "2026-09-20", duration_min: 30, avg_hr: 160 })],
      (id) => id.toUpperCase(),
    );
    expect(out.map((x) => [x.label, x.minutes, x.count, x.avgHr])).toEqual([
      ["TENNIS", 92, 2, Math.round((142 * 62 + 160 * 30) / 92)],
      ["GYM", 45, 1, 120],
    ]);
  });

  it("leaves avgHr null when no session carried a heart rate", () => {
    expect(sessionsBySport([s({})], (id) => id)[0].avgHr).toBeNull();
  });
});
