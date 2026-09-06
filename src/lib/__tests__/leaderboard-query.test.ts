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
  const rpc = supabase.rpc as ReturnType<typeof vi.fn>;

  it("calls season_board with the season + BOARD_LIMIT and maps {top, my_rank, total}", async () => {
    const top = [
      { user_id: "b", username: "b", xp: 900, season_points: 400 },
      { user_id: "a", username: "a", xp: 150, season_points: 50 },
    ];
    rpc.mockResolvedValue({ data: { top, my_rank: 2, total: 2 }, error: null });

    const out = await fetchSeasonBoard("s1");
    expect(rpc).toHaveBeenCalledWith("season_board", { p_season_id: "s1", p_limit: BOARD_LIMIT });
    expect(out).toEqual({ top, myRank: 2, total: 2 });
  });

  it("returns null rank and an empty board when the viewer is not ranked", async () => {
    rpc.mockResolvedValue({ data: { top: [], my_rank: null, total: 0 }, error: null });
    expect(await fetchSeasonBoard("s1")).toEqual({ top: [], myRank: null, total: 0 });
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await fetchSeasonBoard("s1")).toEqual({ top: [], myRank: null, total: 0 });
  });

  it("throws the rpc error", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(fetchSeasonBoard("s1")).rejects.toThrow("boom");
  });
});
