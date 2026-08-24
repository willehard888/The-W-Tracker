import { describe, it, expect } from "vitest";
import {
  CREDIT_EVERY,
  freeMonthsEarned,
  paidToNextMonth,
  nextMonthAt,
  nextMonthProgress,
  BADGE_MILESTONES,
} from "../referral-rewards";

describe("referral reward math — every 3 paid friends = 1 free month", () => {
  it("freeMonthsEarned floors by threes", () => {
    expect(freeMonthsEarned(0)).toBe(0);
    expect(freeMonthsEarned(2)).toBe(0);
    expect(freeMonthsEarned(3)).toBe(1);
    expect(freeMonthsEarned(5)).toBe(1);
    expect(freeMonthsEarned(6)).toBe(2);
    expect(freeMonthsEarned(35)).toBe(11);
    expect(freeMonthsEarned(-4)).toBe(0);
  });

  it("paidToNextMonth counts down 3→1 and resets", () => {
    expect(paidToNextMonth(0)).toBe(3);
    expect(paidToNextMonth(1)).toBe(2);
    expect(paidToNextMonth(2)).toBe(1);
    expect(paidToNextMonth(3)).toBe(3);
    expect(paidToNextMonth(7)).toBe(2);
  });

  it("nextMonthAt is always the next multiple of CREDIT_EVERY", () => {
    for (const n of [0, 1, 2, 3, 4, 8, 29]) {
      const at = nextMonthAt(n);
      expect(at % CREDIT_EVERY).toBe(0);
      expect(at).toBeGreaterThan(n);
      expect(at - n).toBeLessThanOrEqual(CREDIT_EVERY);
    }
  });

  it("ring progress is 0 at a fresh cycle and rises by thirds", () => {
    expect(nextMonthProgress(0)).toBe(0);
    expect(nextMonthProgress(1)).toBeCloseTo(1 / 3);
    expect(nextMonthProgress(2)).toBeCloseTo(2 / 3);
    expect(nextMonthProgress(3)).toBe(0);
  });

  it("badge milestones are ascending and status-free", () => {
    const counts = BADGE_MILESTONES.map((m) => m.count);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    for (const m of BADGE_MILESTONES) {
      expect(m.detail.toLowerCase()).not.toContain("apex");
      expect(m.detail.toLowerCase()).not.toContain("legend pin");
      expect(m.detail.toLowerCase()).not.toContain("free");
    }
  });
});
