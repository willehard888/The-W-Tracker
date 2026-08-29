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

export const fetchActiveSeason = async (): Promise<any> => {
  const db = supabase as any;

  await db.rpc("finalize_expired_leaderboard_seasons");

  const nowIso = new Date().toISOString();
  const { data: existing } = await db
    .from("leaderboard_seasons")
    .select("*")
    .eq("status", "active")
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .order("starts_at", { ascending: false })
    .limit(1);

  if (existing?.length) return existing[0];

  const { data: ensured } = await db.rpc("ensure_active_leaderboard_season");
  if (Array.isArray(ensured)) return ensured[0];
  return ensured;
};

export const fetchSeasonBoard = async (seasonId: string, userId: string | undefined) => {
  const db = supabase as any;
  const [{ data: baselines }, { data: profiles }] = await Promise.all([
    db
      .from("leaderboard_season_baselines")
      .select("user_id, baseline_xp")
      .eq("season_id", seasonId),
    supabase
      .from("profiles")
      .select("username, xp, level, streak, user_id, avatar_url, status_tier")
      .gt("xp", 0)
      // PostgREST silently truncates at 1000 rows with an ARBITRARY subset
      // when unordered. Order by xp so the truncation keeps the top players
      // (season points derive from xp deltas, so high-xp covers the board).
      .order("xp", { ascending: false })
      .limit(2000),
  ]);

  const baselineMap = new Map<string, number>((baselines || []).map((b: any) => [b.user_id, b.baseline_xp]));

  const full = ((profiles || []) as LeaderRow[])
    .map((p) => ({
      ...p,
      season_points: Math.max(p.xp - (baselineMap.get(p.user_id) ?? p.xp), 0),
    }))
    .sort((a, b) => (b.season_points || 0) - (a.season_points || 0) || b.xp - a.xp);

  const myRank = userId ? full.findIndex((u) => u.user_id === userId) + 1 : null;

  return {
    full,
    top: full.slice(0, BOARD_LIMIT),
    myRank: myRank && myRank > 0 ? myRank : null,
  };
};
