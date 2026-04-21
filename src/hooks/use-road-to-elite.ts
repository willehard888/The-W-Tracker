import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getTierConfig } from "@/lib/status-tiers";

/**
 * Elite tier requirements (must match SQL `update_status_tier`):
 *  - rank percentile ≥ 95 (top 5%)
 *  - 14 distinct active days in the last 30 days
 *  - current streak ≥ 30 days
 */
export const ELITE_REQUIREMENTS = {
  PERCENTILE: 95,
  ACTIVITY_DAYS: 14,
  STREAK: 30,
} as const;

export interface RoadToEliteData {
  loading: boolean;
  /** True once the user's earned status_tier is elite/apex/legend */
  isElite: boolean;
  /** True if there's enough data to render meaningfully */
  hasData: boolean;

  percentile: number;
  rank: number;
  totalUsers: number;

  activityDays: number;
  streak: number;

  /** 0..1 progress per requirement */
  percentileProgress: number;
  activityProgress: number;
  streakProgress: number;

  /** Overall 0..100 (average of the three) */
  overallPercent: number;
  /** Number of requirements fully met (0..3) */
  metCount: number;
}

/**
 * Computes live progress towards earned Elite status_tier.
 * Used by RoadToElite component on Profile + Index.
 */
export const useRoadToElite = (): RoadToEliteData => {
  const { profile } = useAuth();
  const userId = profile?.user_id;

  const { data, isLoading } = useQuery({
    queryKey: ["road-to-elite", userId, profile?.streak, (profile as any)?.rank_score],
    queryFn: async () => {
      if (!userId) return null;

      // Rank position via rank_score (matches SQL percentile calc)
      const myRankScore = Number((profile as any)?.rank_score ?? 0);
      const [{ count: ahead }, { count: total }] = await Promise.all([
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gt("rank_score" as any, myRankScore),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gt("rank_score" as any, 0),
      ]);

      const rank = (ahead ?? 0) + 1;
      const totalUsers = Math.max(1, total ?? 1);
      const percentile =
        totalUsers <= 1 ? 100 : ((totalUsers - rank) / totalUsers) * 100;

      // Distinct active days in last 30
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data: checkins } = await supabase
        .from("daily_checkins")
        .select("checked_in_at")
        .eq("user_id", userId)
        .gte("checked_in_at", thirtyDaysAgo);

      const dayKeys = new Set(
        (checkins ?? []).map((c) =>
          new Date(c.checked_in_at).toISOString().slice(0, 10),
        ),
      );
      const activityDays = dayKeys.size;

      return { percentile, rank, totalUsers, activityDays };
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const tier = profile?.status_tier ?? "recruit";
  const tierRank = getTierConfig(tier).rank;
  const isElite = tierRank >= 4; // elite/apex/legend

  if (!data || !profile) {
    return {
      loading: isLoading,
      isElite,
      hasData: false,
      percentile: 0,
      rank: 0,
      totalUsers: 0,
      activityDays: 0,
      streak: profile?.streak ?? 0,
      percentileProgress: 0,
      activityProgress: 0,
      streakProgress: 0,
      overallPercent: 0,
      metCount: 0,
    };
  }

  const streak = profile.streak ?? 0;
  const percentileProgress = Math.min(1, data.percentile / ELITE_REQUIREMENTS.PERCENTILE);
  const activityProgress = Math.min(1, data.activityDays / ELITE_REQUIREMENTS.ACTIVITY_DAYS);
  const streakProgress = Math.min(1, streak / ELITE_REQUIREMENTS.STREAK);

  const overallPercent = Math.round(
    ((percentileProgress + activityProgress + streakProgress) / 3) * 100,
  );

  const metCount =
    (percentileProgress >= 1 ? 1 : 0) +
    (activityProgress >= 1 ? 1 : 0) +
    (streakProgress >= 1 ? 1 : 0);

  return {
    loading: false,
    isElite,
    hasData: true,
    percentile: data.percentile,
    rank: data.rank,
    totalUsers: data.totalUsers,
    activityDays: data.activityDays,
    streak,
    percentileProgress,
    activityProgress,
    streakProgress,
    overallPercent,
    metCount,
  };
};
