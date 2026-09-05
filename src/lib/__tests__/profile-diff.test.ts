import { describe, expect, it } from "vitest";
import { sameProfile } from "@/lib/profile-diff";

const base = { user_id: "u1", xp: 100, streak: 3, updated_at: "2026-09-05T10:00:00Z", last_rank_snapshot: { rank: 4, score: 1.5 }, timezone: "Europe/Helsinki" };

describe("sameProfile", () => {
  it("is true for identical rows", () => {
    expect(sameProfile(base, { ...base })).toBe(true);
  });
  it("ignores heartbeat columns", () => {
    expect(sameProfile(base, { ...base, updated_at: "2026-09-05T11:00:00Z", last_active_at: "x", timezone: "UTC", utc_offset_minutes: 0, rank_score_updated_at: "y" })).toBe(true);
  });
  it("is false when a rendered scalar changes", () => {
    expect(sameProfile(base, { ...base, xp: 150 })).toBe(false);
  });
  it("compares json columns by value", () => {
    expect(sameProfile(base, { ...base, last_rank_snapshot: { rank: 4, score: 1.5 } })).toBe(true);
    expect(sameProfile(base, { ...base, last_rank_snapshot: { rank: 3, score: 1.5 } })).toBe(false);
  });
  it("is false when a key exists on one side only", () => {
    const { streak: _s, ...noStreak } = base;
    expect(sameProfile(base, noStreak)).toBe(false);
    expect(sameProfile(base, { ...base, streak: null })).toBe(false);
  });
});
