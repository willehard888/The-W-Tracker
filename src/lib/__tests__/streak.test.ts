import { describe, it, expect, afterEach, vi } from "vitest";
import {
  personalStreakTier,
  isInferno,
  getEffectiveStreak,
  getStreakDeadlineState,
  isCheckedInToday,
} from "@/lib/streak";

describe("personalStreakTier — ladder boundaries", () => {
  it("maps each streak length to the right tier", () => {
    expect(personalStreakTier(0)).toBe(-1);
    expect(personalStreakTier(2)).toBe(-1);
    expect(personalStreakTier(3)).toBe(0); // Ignited
    expect(personalStreakTier(6)).toBe(0);
    expect(personalStreakTier(7)).toBe(1); // Heating up
    expect(personalStreakTier(13)).toBe(1);
    expect(personalStreakTier(14)).toBe(2); // On fire
    expect(personalStreakTier(29)).toBe(2);
    expect(personalStreakTier(30)).toBe(3); // Blazing
    expect(personalStreakTier(59)).toBe(3);
    expect(personalStreakTier(60)).toBe(4); // Diamond
    expect(personalStreakTier(99)).toBe(4);
    expect(personalStreakTier(100)).toBe(5); // Legendary
    expect(personalStreakTier(199)).toBe(5);
    expect(personalStreakTier(200)).toBe(6); // Inferno
    expect(personalStreakTier(500)).toBe(6);
  });

  it("isInferno only at 200+", () => {
    expect(isInferno(199)).toBe(false);
    expect(isInferno(200)).toBe(true);
  });
});

// Time-sensitive helpers — pin the clock so calendar-day math is deterministic
// regardless of the CI runner's timezone (both "now" and the check-in are built
// in the same local frame).
describe("getEffectiveStreak — calendar-day survival", () => {
  afterEach(() => vi.useRealTimers());

  const pin = (y: number, mo: number, d: number, h = 12) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(y, mo, d, h, 0, 0));
  };
  const localIso = (y: number, mo: number, d: number, h = 12) =>
    new Date(y, mo, d, h, 0, 0).toISOString();

  it("returns 0 when the stored streak is already 0", () => {
    pin(2026, 5, 15);
    expect(getEffectiveStreak(0, localIso(2026, 5, 15))).toBe(0);
  });

  it("keeps the streak when the last check-in was today", () => {
    pin(2026, 5, 15);
    expect(getEffectiveStreak(12, localIso(2026, 5, 15, 8))).toBe(12);
  });

  it("keeps the streak on the grace day (checked in yesterday)", () => {
    pin(2026, 5, 15);
    expect(getEffectiveStreak(12, localIso(2026, 5, 14, 22))).toBe(12);
  });

  it("breaks the streak once a full day is missed (2 days ago)", () => {
    pin(2026, 5, 15);
    expect(getEffectiveStreak(12, localIso(2026, 5, 13, 12))).toBe(0);
  });

  it("returns the stored streak when there is no check-in timestamp", () => {
    pin(2026, 5, 15);
    expect(getEffectiveStreak(9, null)).toBe(9);
  });
});

describe("getStreakDeadlineState — time left to protect", () => {
  afterEach(() => vi.useRealTimers());

  it("is null when there is no live streak", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 12));
    expect(getStreakDeadlineState(0, new Date(2026, 5, 15).toISOString())).toBeNull();
    expect(getStreakDeadlineState(5, null)).toBeNull();
  });

  it("marks urgent in the final hours and expired past the window", () => {
    vi.useFakeTimers();
    // Last check-in on the 14th → loss at local midnight starting the 16th.
    // At 21:00 on the 15th there are ~3h left → urgent (< 6h).
    vi.setSystemTime(new Date(2026, 5, 15, 21, 0, 0));
    const s = getStreakDeadlineState(5, new Date(2026, 5, 14, 12).toISOString());
    expect(s).not.toBeNull();
    expect(s!.expired).toBe(false);
    expect(s!.urgent).toBe(true);
    expect(s!.hours).toBeLessThan(6);

    // Same check-in, but now it's the 16th → the window has passed → expired.
    vi.setSystemTime(new Date(2026, 5, 16, 1, 0, 0));
    const gone = getStreakDeadlineState(5, new Date(2026, 5, 14, 12).toISOString());
    expect(gone!.expired).toBe(true);
    expect(gone!.urgent).toBe(true);
  });
});

describe("isCheckedInToday — today banked means no risk", () => {
  it("true for a check-in earlier today, false for yesterday and null", () => {
    const now = new Date();
    expect(isCheckedInToday(now.toISOString())).toBe(true);
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 0, 0);
    expect(isCheckedInToday(yesterday.toISOString())).toBe(false);
    expect(isCheckedInToday(null)).toBe(false);
    expect(isCheckedInToday(undefined)).toBe(false);
  });
});
