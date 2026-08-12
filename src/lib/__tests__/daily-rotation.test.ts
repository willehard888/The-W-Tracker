// pickDaily drives two visible Home surfaces (header quote + Daily Insight).
// Contract: same item all day for everyone, rotates at local midnight, and
// salts decorrelate independent surfaces so they don't move in lockstep.
import { describe, it, expect, vi, afterEach } from "vitest";
import { pickDaily } from "@/lib/daily-rotation";

const ITEMS = Array.from({ length: 20 }, (_, i) => `item-${i}`);

afterEach(() => vi.useRealTimers());

describe("pickDaily", () => {
  it("is deterministic within a single day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 11, 9, 0));
    const morning = pickDaily(ITEMS);
    vi.setSystemTime(new Date(2026, 7, 11, 23, 59));
    expect(pickDaily(ITEMS)).toBe(morning);
  });

  it("rotates at local midnight (over a week, picks are not all identical)", () => {
    vi.useFakeTimers();
    const picks = new Set<string>();
    for (let d = 1; d <= 7; d++) {
      vi.setSystemTime(new Date(2026, 7, d, 12, 0));
      picks.add(pickDaily(ITEMS));
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  it("salt decorrelates surfaces (differs for at least one day of a week)", () => {
    vi.useFakeTimers();
    let differed = false;
    for (let d = 1; d <= 7; d++) {
      vi.setSystemTime(new Date(2026, 7, d, 12, 0));
      if (pickDaily(ITEMS) !== pickDaily(ITEMS, "insight")) differed = true;
    }
    expect(differed).toBe(true);
  });

  it("single-item list always returns that item", () => {
    expect(pickDaily(["only"])).toBe("only");
  });
});
