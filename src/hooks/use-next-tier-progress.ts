import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { nextTierRequirements, type NextTierInfo, type TierRequirements } from "@/lib/status-tiers";
import { useMyRank } from "@/hooks/use-my-rank";
import { useLastCheckin } from "@/hooks/use-last-checkin";
import { getEffectiveStreak } from "@/lib/streak";

/**
 * Live progress towards the next earned status tier.
 *
 * The thresholds are NOT restated here. They come from status-tiers, which is
 * what the ladder sheet renders and what SQL `update_status_tier` promotes on.
 * A local copy of them (ELITE_REQUIREMENTS) had drifted to a 21-day streak
 * while both of the others said 30, so this card filled its bar and ticked the
 * requirement for a user the server then refused to promote.
 */

export interface TierProgress {
  /** 0..1 per requirement — a requirement the rung doesn't ask for reads 1. */
  percentileProgress: number;
  activityProgress: number;
  streakProgress: number;
  /** 0..100 along the easiest path that actually leads to the rung. */
  overallPercent: number;
  /** Paths fully met, out of `pathCount`. */
  metCount: number;
  /** 2 for an OR rung (rank or grind), 1 when every threshold is required. */
  pathCount: number;
}

const share = (v: number, target: number) => (target > 0 ? Math.min(1, v / target) : 1);

/**
 * Progress against ONE rung's thresholds. Pure, so the promotion rule is
 * testable without a rank query — the hook only feeds it live numbers.
 */
export function tierProgress(
  req: TierRequirements,
  live: { percentile: number; activityDays: number; streak: number },
): TierProgress {
  const percentileProgress = share(live.percentile, req.percentile);
  const activityProgress = share(live.activityDays, req.activeDays);
  const streakProgress = share(live.streak, req.streak);

  // The grind path is whatever the rung asks for beyond rank — operator and
  // performer have no streak requirement at all.
  const grind: number[] = [];
  if (req.activeDays > 0) grind.push(activityProgress);
  if (req.streak > 0) grind.push(streakProgress);
  const grindProgress = grind.length ? grind.reduce((a, b) => a + b, 0) / grind.length : 1;

  const base = { percentileProgress, activityProgress, streakProgress };

  if (req.orPath) {
    return {
      ...base,
      overallPercent: Math.round(Math.max(percentileProgress, grindProgress) * 100),
      metCount: (percentileProgress >= 1 ? 1 : 0) + (grindProgress >= 1 ? 1 : 0),
      pathCount: 2,
    };
  }

  // AND rung: every listed threshold has to land, so the honest progress is
  // the mean of them and the single path is met only when all of them are.
  const required = [percentileProgress, ...grind];
  const all = required.reduce((a, b) => a + b, 0) / required.length;
  return {
    ...base,
    overallPercent: Math.round(all * 100),
    metCount: required.every((p) => p >= 1) ? 1 : 0,
    pathCount: 1,
  };
}

export interface NextTierProgressData extends TierProgress {
  loading: boolean;
  /** The rung being chased. null = top of the ladder, nothing left to show. */
  next: NextTierInfo | null;
  /** True once there's enough data to render meaningfully. */
  hasData: boolean;

  percentile: number;
  rank: number;
  totalUsers: number;
  activityDays: number;
  streak: number;
}

const EMPTY: TierProgress = {
  percentileProgress: 0,
  activityProgress: 0,
  streakProgress: 0,
  overallPercent: 0,
  metCount: 0,
  pathCount: 2,
};

/** Live progress towards the next rung. Used by NextTierProgress on Profile. */
export const useNextTierProgress = (): NextTierProgressData => {
  const { profile } = useAuth();
  const userId = profile?.user_id;
  const { data: rankData, isLoading: rankLoading } = useMyRank(userId);
  const { data: lastCheckin } = useLastCheckin(userId);

  const { data: activityDays = 0, isLoading: activityLoading } = useQuery({
    queryKey: ["next-tier-activity", userId],
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

      // Local calendar days, like every other streak surface — a UTC bucket
      // folded two Helsinki evenings into one day.
      const dayKeys = new Set(
        (checkins ?? []).map((c) =>
          new Date(c.checked_in_at).toLocaleDateString("en-CA"),
        ),
      );
      return dayKeys.size;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const next = nextTierRequirements(profile?.status_tier ?? "recruit");
  // The stored streak goes stale the moment a calendar day is missed, and a
  // broken streak filling this bar is the same lie the thresholds were.
  const streak = getEffectiveStreak(
    profile?.streak ?? 0,
    lastCheckin?.checked_in_at,
    profile?.streak_shields ?? 0,
  );

  if (!rankData || !profile || !next) {
    return {
      ...EMPTY,
      loading: rankLoading || activityLoading,
      next,
      hasData: false,
      percentile: 0,
      rank: 0,
      totalUsers: 0,
      activityDays: 0,
      streak,
    };
  }

  return {
    ...tierProgress(next.requirements, {
      percentile: rankData.percentile,
      activityDays,
      streak,
    }),
    loading: rankLoading || activityLoading,
    next,
    hasData: true,
    percentile: rankData.percentile,
    rank: rankData.rank,
    totalUsers: rankData.totalUsers,
    activityDays,
    streak,
  };
};
