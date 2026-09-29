import { describe, it, expect, vi } from "vitest";
import { badgeProgress, getBadgeProgress } from "@/lib/badge-awards";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a) } }));
vi.mock("@/lib/observability", () => ({ captureException: vi.fn() }));

describe("badgeProgress — the bar under a badge", () => {
  const stats = { checkins: 12, level: 3, leaderboard_percentile: 12 };

  it("counts up to the target and clamps there", () => {
    expect(badgeProgress(stats, "checkins", 25)).toEqual({ current: 12, target: 25, percent: 48 });
    expect(badgeProgress(stats, "checkins", 10)).toEqual({ current: 10, target: 10, percent: 100 });
    expect(badgeProgress(stats, "level", 3)).toEqual({ current: 3, target: 3, percent: 100 });
  });

  it("has no bar for a key the server does not produce, or a manual badge", () => {
    expect(badgeProgress(stats, "percentile", 10)).toBeNull();
    expect(badgeProgress(stats, null, 1)).toBeNull();
    expect(badgeProgress(null, "checkins", 1)).toBeNull();
  });

  it("the leaderboard percentile fills as the number falls", () => {
    // 12 % towards top 10 %: 88 of the 90 points between unranked and the gate.
    expect(badgeProgress(stats, "leaderboard_percentile", 10)).toEqual({ current: 12, target: 10, percent: 98 });
    expect(badgeProgress({ leaderboard_percentile: 3 }, "leaderboard_percentile", 5)).toEqual({ current: 5, target: 5, percent: 100 });
    expect(badgeProgress({ leaderboard_percentile: 100 }, "leaderboard_percentile", 1)).toEqual({ current: 100, target: 1, percent: 0 });
  });
});

describe("getBadgeProgress — one stats call, one catalogue read", () => {
  it("keys progress by badge id and skips what it cannot measure", async () => {
    rpc.mockResolvedValueOnce({ data: { checkins: 4, "vault_master:jung": 1 }, error: null });
    from.mockReturnValueOnce({ select: () => Promise.resolve({ data: [
      { id: "a", requirement_type: "checkins", requirement_value: 10 },
      { id: "b", requirement_type: "vault_master:jung", requirement_value: 2 },
      { id: "c", requirement_type: null, requirement_value: null },
      { id: "d", requirement_type: "unknown_key", requirement_value: 5 },
    ] }) });
    const out = await getBadgeProgress();
    expect(rpc).toHaveBeenCalledWith("badge_stats");
    expect(out).toEqual({ a: { current: 4, target: 10, percent: 40 }, b: { current: 1, target: 2, percent: 50 } });
  });
});
