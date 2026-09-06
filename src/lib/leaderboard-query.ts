import { supabase } from "@/integrations/supabase/client";

/**
 * Ranks-tab fetchers, extracted from Leaderboard.tsx so the app-shell
 * TabPrefetcher can warm the exact same cache entries at boot. Query keys
 * live with the callers — these functions ARE the shared queryFns.
 */

export const BOARD_LIMIT = 50;

export interface LeaderRow {
  username: string;
  xp: number;
  level: number;
  streak: number;
  user_id: string;
  avatar_url: string | null;
  status_tier: string | null;
  season_points?: number;
}

export const fetchAllTimeLeaders = async (): Promise<LeaderRow[]> => {
  const { data } = await supabase
    .from("profiles")
    .select("username, xp, level, streak, user_id, avatar_url, status_tier")
    .gt("xp", 0)
    .order("xp", { ascending: false })
    .limit(BOARD_LIMIT);
  return (data || []) as LeaderRow[];
};

export const fetchActiveSeason = async () => {
  await supabase.rpc("finalize_expired_leaderboard_seasons");

  const nowIso = new Date().toISOString();
  const { data: existing } = await supabase
    .from("leaderboard_seasons")
    .select("*")
    .eq("status", "active")
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .order("starts_at", { ascending: false })
    .limit(1);

  if (existing?.length) return existing[0];

  const { data: ensured } = await supabase.rpc("ensure_active_leaderboard_season");
  if (Array.isArray(ensured)) return ensured[0];
  return ensured;
};

/**
 * Season board via the `season_board` RPC: season_points = xp above this
 * season's baseline, only people who competed THIS season are listed (dormant
 * accounts with lifetime XP used to pad the board with "0 SEASON XP" rows),
 * ordered season_points DESC, xp DESC. `myRank` is the caller's position in
 * the FULL ranked set (auth.uid() server-side), `total` its size.
 */
export const fetchSeasonBoard = async (seasonId: string) => {
  const { data, error } = await supabase.rpc("season_board", { p_season_id: seasonId, p_limit: BOARD_LIMIT });
  if (error) throw error;
  const board = (data ?? {}) as { top?: LeaderRow[]; my_rank?: number | null; total?: number };
  return { top: board.top ?? [], myRank: board.my_rank ?? null, total: board.total ?? 0 };
};
