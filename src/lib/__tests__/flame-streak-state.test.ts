// The flame is the user's status mirror — these lock the 8-state ladder, the
// mood windows (18h at-risk / 24h broken) and milestone detection. NOTE the
// documented divergence: this module measures ELAPSED TIME while
// lib/streak.ts measures LOCAL CALENDAR DAYS — the flame can look "broken"
// (25h elapsed) while getEffectiveStreak still returns the streak (1 calendar
// day). That asymmetry is locked here on purpose so a future "fix" of either
// side is a conscious decision, not an accident.
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  stateForStreak,
  moodForStreak,
  computeFlameProfile,
  milestoneCrossed,
  isDailySurge,
  isStreakLost,
  AT_RISK_AFTER_MS,
  BROKEN_AFTER_MS,
  MILESTONES,
} from "@/lib/flame-streak-state";
import { getEffectiveStreak } from "@/lib/streak";

describe("stateForStreak — the 8-state ladder", () => {
  it("maps every boundary exactly", () => {
    expect(stateForStreak(0)).toBe("ember");
    expect(stateForStreak(1)).toBe("kindling");
    expect(stateForStreak(3)).toBe("kindling");
    expect(stateForStreak(4)).toBe("lit");
    expect(stateForStreak(7)).toBe("steady");
    expect(stateForStreak(14)).toBe("strong");
    expect(stateForStreak(30)).toBe("roaring");
    expect(stateForStreak(60)).toBe("elite");
    expect(stateForStreak(100)).toBe("legend");
    expect(stateForStreak(999)).toBe("legend");
  });

  it("clamps garbage input to ember", () => {
    expect(stateForStreak(-5)).toBe("ember");
    expect(stateForStreak(NaN as unknown as number)).toBe("ember");
    expect(stateForStreak(2.9)).toBe("kindling"); // floors, never rounds up
  });
});

describe("moodForStreak — elapsed-time windows", () => {
  const now = Date.parse("2026-08-11T12:00:00Z");

  it("healthy under 18h, at-risk 18–24h, broken past 24h", () => {
    const at = (hoursAgo: number) => now - hoursAgo * 3_600_000;
    expect(moodForStreak({ streak: 5, lastCheckinAt: at(17.9), now })).toBe("healthy");
    expect(moodForStreak({ streak: 5, lastCheckinAt: at(18), now })).toBe("at-risk");
    expect(moodForStreak({ streak: 5, lastCheckinAt: at(23.9), now })).toBe("at-risk");
    expect(moodForStreak({ streak: 5, lastCheckinAt: at(24), now })).toBe("broken");
  });

  it("zero streak is neutral (ember), never broken", () => {
    expect(moodForStreak({ streak: 0, lastCheckinAt: now - 48 * 3_600_000, now })).toBe("healthy");
  });

  it("missing/garbage lastCheckinAt defaults to healthy", () => {
    expect(moodForStreak({ streak: 5, lastCheckinAt: null, now })).toBe("healthy");
    expect(moodForStreak({ streak: 5, lastCheckinAt: "not-a-date", now })).toBe("healthy");
  });

  it("constants stay 18h/24h", () => {
    expect(AT_RISK_AFTER_MS).toBe(18 * 3_600_000);
    expect(BROKEN_AFTER_MS).toBe(24 * 3_600_000);
  });
});

describe("computeFlameProfile — mood modifiers", () => {
  const now = Date.parse("2026-08-11T12:00:00Z");

  it("healthy elite keeps its ambient halo", () => {
    const p = computeFlameProfile({ streak: 60, now });
    expect(p.state).toBe("elite");
    expect(p.ambient).toBe(true);
  });

  it("at-risk inverts the personality: erratic, smaller, no sparks/halo", () => {
    const healthy = computeFlameProfile({ streak: 60, now });
    const risky = computeFlameProfile({ streak: 60, lastCheckinAt: now - 19 * 3_600_000, now });
    expect(risky.mood).toBe("at-risk");
    expect(risky.flicker).toBeGreaterThan(healthy.flicker);
    expect(risky.breath).toBeLessThan(healthy.breath);
    expect(risky.sparkRate).toBe(0);
    expect(risky.ambient).toBe(false);
  });

  it("broken collapses to a dim ember regardless of streak size", () => {
    const p = computeFlameProfile({ streak: 100, lastCheckinAt: now - 25 * 3_600_000, now });
    expect(p.state).toBe("ember");
    expect(p.mood).toBe("broken");
    expect(p.bodyAlpha).toBeLessThan(0.2);
  });
});

describe("documented divergence: flame mood vs calendar-day streak", () => {
  afterEach(() => vi.useRealTimers());

  it("25h elapsed = flame 'broken' while getEffectiveStreak still counts it", () => {
    // Checked in yesterday 10:00, it is now 11:00 the next day (25h elapsed,
    // 1 local calendar day). The flame panics; the streak survives — the
    // check-in window runs to end of the NEXT calendar day.
    const last = new Date(2026, 7, 10, 10, 0, 0);
    const now = new Date(2026, 7, 11, 11, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(moodForStreak({ streak: 5, lastCheckinAt: last.getTime(), now: now.getTime() })).toBe("broken");
    expect(getEffectiveStreak(5, last.toISOString())).toBe(5);
  });
});

describe("milestones", () => {
  it("fires exactly when a milestone is crossed, even by a jump", () => {
    expect(milestoneCrossed(6, 7)).toBe(7);
    expect(milestoneCrossed(29, 30)).toBe(30);
    expect(milestoneCrossed(5, 40)).toBe(7); // first milestone in the jump
    expect(milestoneCrossed(7, 8)).toBeNull();
    expect(milestoneCrossed(7, 7)).toBeNull(); // no increment, no fire
    expect(milestoneCrossed(10, 3)).toBeNull(); // decrement never fires
  });

  it("isDailySurge = increment that is NOT a milestone", () => {
    expect(isDailySurge(7, 8)).toBe(true);
    expect(isDailySurge(6, 7)).toBe(false);
    expect(isDailySurge(8, 8)).toBe(false);
  });

  it("isStreakLost only on positive → zero", () => {
    expect(isStreakLost(5, 0)).toBe(true);
    expect(isStreakLost(0, 0)).toBe(false);
    expect(isStreakLost(5, 1)).toBe(false);
  });

  it("milestone ladder stays 7/30/100/200", () => {
    expect([...MILESTONES]).toEqual([7, 30, 100, 200]);
  });
});
