import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getTierConfig } from "@/lib/status-tiers";
import { useMyRank } from "@/hooks/use-my-rank";

/**
 * Elite tier requirements (must match SQL `update_status_tier`):
 *  - rank percentile ≥ 80 (top 20%)
 *  - OR 20 distinct active days in the last 30 days + current streak ≥ 21 days
 */
export const ELITE_REQUIREMENTS = {
  PERCENTILE: 80,
  ACTIVITY_DAYS: 20,
  STREAK: 21,
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
  const { data: rankData, isLoading: rankLoading } = useMyRank(userId);

  const { data: activityDays = 0, isLoading: activityLoading } = useQuery({
    queryKey: ["road-to-elite-activity", userId],
    queryFn: async () => {
      if (!userId) return 0;

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
      return dayKeys.size;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const tier = profile?.status_tier ?? "recruit";
  const tierRank = getTierConfig(tier).rank;
  const isElite = tierRank >= 4; // elite/apex/legend

  if (!rankData || !profile) {
    return {
      loading: rankLoading || activityLoading,
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
  const percentileProgress = Math.min(1, rankData.percentile / ELITE_REQUIREMENTS.PERCENTILE);
  const activityProgress = Math.min(1, activityDays / ELITE_REQUIREMENTS.ACTIVITY_DAYS);
  const streakProgress = Math.min(1, streak / ELITE_REQUIREMENTS.STREAK);
  const consistencyProgress = (activityProgress + streakProgress) / 2;
  const rankPathMet = rankData.percentile >= ELITE_REQUIREMENTS.PERCENTILE;
  const consistencyPathMet =
    activityDays >= ELITE_REQUIREMENTS.ACTIVITY_DAYS &&
    streak >= ELITE_REQUIREMENTS.STREAK;

  const overallPercent = Math.round(
    Math.max(percentileProgress, consistencyProgress) * 100,
  );

  const metCount = (rankPathMet ? 1 : 0) + (consistencyPathMet ? 1 : 0);

  return {
    loading: rankLoading || activityLoading,
    isElite,
    hasData: true,
    percentile: rankData.percentile,
    rank: rankData.rank,
    totalUsers: rankData.totalUsers,
    activityDays,
    streak,
    percentileProgress,
    activityProgress,
    streakProgress,
    overallPercent,
    metCount,
  };
};
