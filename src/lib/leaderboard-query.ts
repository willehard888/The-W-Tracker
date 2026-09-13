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
  // Best-effort housekeeping — a stale season still reads fine below. rpc()
  // resolves with { error } rather than rejecting, so this was never checked.
  const { error: finalizeErr } = await supabase.rpc("finalize_expired_leaderboard_seasons");
  if (finalizeErr) console.warn("[ranks] finalize seasons failed", finalizeErr);

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

  // Not best-effort: there is no season without this. Returning undefined on a
  // failure gave the Ranks tab an empty season header instead of an error
  // state, so throw and let react-query show the retry.
  const { data: ensured, error: ensureErr } = await supabase.rpc("ensure_active_leaderboard_season");
  if (ensureErr) throw ensureErr;
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

export interface RankMark {
  /** Competition rank: everyone in a tie block shares the block's first position. */
  position: number;
  /** True when at least one other row holds the same score. */
  tied: boolean;
}

/**
 * Display positions for an already-ordered board.
 *
 * `season_board` orders by `season_points DESC, xp DESC, user_id` — the last
 * clause is there so the order is stable across refetches, but it means a UUID
 * decided which of two people with identical scores got the third podium card
 * and which got a plain chase row. On screen both read "40 XP", so it looked
 * arbitrary because it was.
 *
 * The fix is not to invent a tiebreak they do not differ on. It is to stop
 * implying a difference: a tie block shares its first position (1, 2, =3, =3, 5)
 * and both rows say so. The SQL order is untouched.
 */
export const rankMarks = (scores: number[]): RankMark[] => {
  let blockStart = 0;
  return scores.map((score, i) => {
    if (i > 0 && score !== scores[i - 1]) blockStart = i;
    return {
      position: blockStart + 1,
      tied:
        (i > 0 && score === scores[i - 1]) ||
        (i + 1 < scores.length && score === scores[i + 1]),
    };
  });
};
