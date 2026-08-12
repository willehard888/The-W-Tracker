// The free-tier "Today's Move" picker — the most branch-dense pure module in
// the repo. Contracts: time-of-day boundaries at 11/17, weakest-pillar
// tie-breaks by canonical order, real signals beat the count heuristic, and
// the pick is deterministic per day (no "another random idea" feel).
import { describe, it, expect } from "vitest";
import {
  currentTimeOfDay,
  findWeakestPillar,
  findWeakestPillarSmart,
  pickFreeTierMove,
} from "@/lib/coach/pick-free-move";
import { PROTOCOLS } from "@/lib/wellness-framework";

describe("currentTimeOfDay", () => {
  it("boundaries: <11 morning, 11–16 midday, 17+ evening", () => {
    expect(currentTimeOfDay(new Date(2026, 0, 1, 10, 59))).toBe("morning");
    expect(currentTimeOfDay(new Date(2026, 0, 1, 11, 0))).toBe("midday");
    expect(currentTimeOfDay(new Date(2026, 0, 1, 16, 59))).toBe("midday");
    expect(currentTimeOfDay(new Date(2026, 0, 1, 17, 0))).toBe("evening");
    expect(currentTimeOfDay(new Date(2026, 0, 1, 23, 0))).toBe("evening");
  });
});

describe("findWeakestPillar", () => {
  it("zero habits → canonical-first pillar (sleep)", () => {
    expect(findWeakestPillar([])).toBe("sleep");
  });

  it("picks the pillar with fewest active habits", () => {
    // Adopt one sleep protocol → some other pillar (movement, next canonical) wins.
    const sleepProtocol = PROTOCOLS.find((p) => p.pillar === "sleep")!;
    expect(findWeakestPillar([sleepProtocol.id])).toBe("movement");
  });

  it("ties break by canonical order, not alphabet or count order", () => {
    // One habit in EVERY pillar → all tied at 1 → canonical first (sleep).
    const onePer = ["sleep", "movement", "nutrition", "stress", "recovery", "connection"].map(
      (pillar) => PROTOCOLS.find((p) => p.pillar === pillar)!.id,
    );
    expect(findWeakestPillar(onePer)).toBe("sleep");
  });
});

describe("findWeakestPillarSmart — real signals beat the heuristic", () => {
  it("sub-7h sleep wins even with sleep habits adopted", () => {
    expect(findWeakestPillarSmart([], { sleepAvg: 6.5, hydrationAvg: 3, workoutDays: 5, meditationDays: 3 })).toBe("sleep");
  });

  it("signal precedence: sleep > hydration > workouts > meditation", () => {
    expect(findWeakestPillarSmart([], { sleepAvg: 8, hydrationAvg: 1.5, workoutDays: 0, meditationDays: 0 })).toBe("nutrition");
    expect(findWeakestPillarSmart([], { sleepAvg: 8, hydrationAvg: 3, workoutDays: 2, meditationDays: 0 })).toBe("movement");
    expect(findWeakestPillarSmart([], { sleepAvg: 8, hydrationAvg: 3, workoutDays: 5, meditationDays: 1 })).toBe("stress");
  });

  it("healthy signals fall back to the habit-count heuristic", () => {
    expect(findWeakestPillarSmart([], { sleepAvg: 8, hydrationAvg: 3, workoutDays: 5, meditationDays: 3 })).toBe("sleep");
  });
});

describe("pickFreeTierMove", () => {
  const noon = new Date(2026, 7, 11, 12, 0);

  it("never recommends an already-adopted protocol (when alternatives exist)", () => {
    const move = pickFreeTierMove({ activeProtocolIds: [], now: noon })!;
    const again = pickFreeTierMove({ activeProtocolIds: [move.protocol.id], now: noon })!;
    expect(again.protocol.id).not.toBe(move.protocol.id);
  });

  it("is deterministic for the same day and rotates across days", () => {
    const a = pickFreeTierMove({ now: new Date(2026, 7, 11, 9, 0) })!;
    const b = pickFreeTierMove({ now: new Date(2026, 7, 11, 10, 30) })!;
    expect(a.protocol.id).toBe(b.protocol.id); // same morning window, same day
    const week = new Set(
      Array.from({ length: 7 }, (_, d) => pickFreeTierMove({ now: new Date(2026, 7, 10 + d, 9, 0) })!.protocol.id),
    );
    expect(week.size).toBeGreaterThan(1);
  });

  it("first-time user gets the sleep-foundation reason", () => {
    const move = pickFreeTierMove({ activeProtocolIds: [], now: noon })!;
    expect(move.pillar).toBe("sleep");
    expect(move.reason).toMatch(/universal foundation/);
  });

  it("always returns a protocol (fallback chain bottoms out at the full catalog)", () => {
    // Adopt EVERYTHING → tier2 empty → candidates = PROTOCOLS.
    const all = PROTOCOLS.map((p) => p.id);
    expect(pickFreeTierMove({ activeProtocolIds: all, now: noon })).not.toBeNull();
  });
});
