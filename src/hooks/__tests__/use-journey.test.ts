import { describe, it, expect } from "vitest";
import { weeklyXp, type JourneyCheckin } from "@/hooks/use-journey";

const ci = (date: string, xp: number): JourneyCheckin => ({ date, xp, sleep: 8 });

describe("weeklyXp — ISO-week bucketing", () => {
  it("returns [] for no check-ins", () => {
    expect(weeklyXp([])).toEqual([]);
  });

  it("sums XP within a single ISO week into one bucket", () => {
    // 2026-06-01 (Mon) … 2026-06-05 (Fri) are the same ISO week.
    const out = weeklyXp([
      ci("2026-06-01", 50),
      ci("2026-06-03", 30),
      ci("2026-06-05", 20),
    ]);
    expect(out).toEqual([100]);
  });

  it("splits consecutive weeks into chronological buckets (oldest → newest)", () => {
    const out = weeklyXp([
      ci("2026-06-05", 40), // week A (Fri)
      ci("2026-06-01", 60), // week A (Mon)
      ci("2026-06-08", 25), // week B (next Mon)
      ci("2026-06-10", 25), // week B
    ]);
    // Week A = 100, Week B = 50, ordered oldest → newest.
    expect(out).toEqual([100, 50]);
  });

  it("is robust to unsorted input", () => {
    const out = weeklyXp([
      ci("2026-06-15", 10),
      ci("2026-06-01", 10),
      ci("2026-06-08", 10),
    ]);
    // Three distinct ISO weeks, each 10, ascending order.
    expect(out).toEqual([10, 10, 10]);
  });
});
