import { describe, expect, it, vi, beforeEach } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAllTimeLeaders,
  fetchActiveSeason,
  fetchSeasonBoard,
  BOARD_LIMIT,
} from "@/lib/leaderboard-query";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

const chain = (result: unknown) => {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "gt", "lte", "in", "order", "limit"]) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  (b as { then?: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return b;
};

beforeEach(() => vi.clearAllMocks());

describe("fetchAllTimeLeaders", () => {
  it("returns the profile rows capped at BOARD_LIMIT", async () => {
    const rows = [{ user_id: "u1", xp: 100 }];
    const c = chain({ data: rows });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(c);
    expect(await fetchAllTimeLeaders()).toEqual(rows);
    expect(c.limit).toHaveBeenCalledWith(BOARD_LIMIT);
  });
});

describe("fetchActiveSeason", () => {
  it("returns the existing active season without ensuring a new one", async () => {
    const season = { id: "s1", status: "active" };
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain({ data: [season] }));

    expect(await fetchActiveSeason()).toEqual(season);
    expect(supabase.rpc).toHaveBeenCalledWith("finalize_expired_leaderboard_seasons");
    expect(supabase.rpc).not.toHaveBeenCalledWith("ensure_active_leaderboard_season");
  });

  it("falls back to ensure_active_leaderboard_season when none is active", async () => {
    const ensured = { id: "s2" };
    (supabase.rpc as ReturnType<typeof vi.fn>).mockImplementation((name: string) =>
      Promise.resolve(name === "ensure_active_leaderboard_season" ? { data: [ensured] } : { data: null }),
    );
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain({ data: [] }));
    expect(await fetchActiveSeason()).toEqual(ensured);
  });
});

describe("fetchSeasonBoard", () => {
  it("computes season points from baselines, sorts, and finds my rank", async () => {
    const baselines = [
      { user_id: "a", baseline_xp: 100 },
      { user_id: "b", baseline_xp: 500 },
    ];
    const profiles = [
      { user_id: "a", xp: 150, username: "a" },  // 50 season points
      { user_id: "b", xp: 900, username: "b" },  // 400 season points
    ];
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) =>
      table === "leaderboard_season_baselines" ? chain({ data: baselines }) : chain({ data: profiles }),
    );

    const out = await fetchSeasonBoard("s1", "a");
    expect(out.full.map((r) => r.user_id)).toEqual(["b", "a"]);
    expect(out.full[0].season_points).toBe(400);
    expect(out.full[1].season_points).toBe(50);
    expect(out.myRank).toBe(2);
    expect(out.top.length).toBeLessThanOrEqual(BOARD_LIMIT);
  });

  // A season board lists people who competed in THIS season. Dormant accounts
  // with lifetime XP but no season activity used to pad it with "0 SEASON XP"
  // rows — including old test accounts — so a new member's first look at the
  // competition was a list of people who aren't playing.
  it("omits accounts with no season points", async () => {
    const baselines = [{ user_id: "a", baseline_xp: 100 }];
    const profiles = [
      { user_id: "a", xp: 150, username: "a" },   // 50 season points → listed
      { user_id: "idle", xp: 900, username: "idle" }, // no baseline → 0 → hidden
    ];
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) =>
      table === "leaderboard_season_baselines" ? chain({ data: baselines }) : chain({ data: profiles }),
    );

    const out = await fetchSeasonBoard("s1", "a");
    expect(out.full.map((r) => r.user_id)).toEqual(["a"]);
    expect(out.myRank).toBe(1);
  });

  it("returns null rank when the viewer is not on the board", async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain({ data: [] }));
    const out = await fetchSeasonBoard("s1", "ghost");
    expect(out.myRank).toBeNull();
    expect(out.full).toEqual([]);
  });
});
