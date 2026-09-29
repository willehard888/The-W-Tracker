import { supabase } from "@/integrations/supabase/client";
import { captureException } from "@/lib/observability";
import type { Tables } from "@/integrations/supabase/types";

// The badge engine lives in SQL (20260929100000_badge_engine.sql): one stat
// computation, badge_stats(), and one award pass, award_earned_badges(), that
// returns exactly the badges the call earned. This file is the door and the
// progress arithmetic — the two mirrors of the server's stats that used to
// live here (and disagree with each other) are gone.

export type Badge = Tables<"badges">;

export interface BadgeProgress { current: number; target: number; percent: number }

/** Run the award pass for the signed-in member; the badges it just earned, best first. */
export const awardEarnedBadges = async (where: string): Promise<Badge[]> => {
  const { data, error } = await supabase.rpc("award_earned_badges");
  if (error) {
    // rpc() resolves with { error } — it never rejects — so this is the one
    // place a failed pass is seen.
    captureException(error, { where });
    return [];
  }
  return (data ?? []) as Badge[];
};

/**
 * "3 of 7", from the member's stats and a badge's requirement. Counts go up
 * to the target; the leaderboard percentile goes down to it (top 10 % is
 * reached at 10 or less).
 */
export const badgeProgress = (
  stats: Record<string, number> | null,
  type: string | null,
  target: number | null,
): BadgeProgress | null => {
  if (!type || !target || !stats || !(type in stats)) return null;
  const value = Number(stats[type]) || 0;
  if (type === "leaderboard_percentile") {
    // 100 = unranked; the bar fills as the percentile falls towards the target.
    const done = value <= target;
    const percent = done ? 100 : Math.max(0, Math.min(99, Math.round(((100 - value) / (100 - target)) * 100)));
    return { current: done ? target : Math.round(value), target, percent };
  }
  return { current: Math.min(value, target), target, percent: Math.min(Math.round((value / target) * 100), 100) };
};

/** Progress for every badge, keyed by badge id — one stats call, one catalogue read. */
export const getBadgeProgress = async (): Promise<Record<string, BadgeProgress>> => {
  const [{ data: stats, error }, { data: badges }] = await Promise.all([
    supabase.rpc("badge_stats"),
    supabase.from("badges").select("id, requirement_type, requirement_value"),
  ]);
  if (error) captureException(error, { where: "badges.progress" });
  const s = (stats ?? null) as Record<string, number> | null;
  const out: Record<string, BadgeProgress> = {};
  for (const b of badges ?? []) {
    const p = badgeProgress(s, b.requirement_type, b.requirement_value);
    if (p) out[b.id] = p;
  }
  return out;
};
