import { supabase } from "@/integrations/supabase/client";

interface BadgeCheckResult {
  badge: any;
  isNew: boolean;
}

/**
 * Compute extended stats for tribe / tier / phoenix badges.
 * Server-side `award_badge_if_earned` re-validates these against the DB,
 * so the client only needs to identify *candidates*.
 */
/**
 * Profile-derived badge stats — pure computation, no queries.
 */
const profileDerivedStats = (profile: any): Record<string, number> => {
  const apexStart = profile.apex_subscription_started_at
    ? new Date(profile.apex_subscription_started_at).getTime()
    : null;
  const heldDays = apexStart
    ? Math.floor((Date.now() - apexStart) / (1000 * 60 * 60 * 24))
    : 0;
  const isApexOrAbove =
    profile.status_tier === "apex" || profile.status_tier === "legend";
  const isLegend = profile.status_tier === "legend" || profile.legend_pinned;

  // Phoenix recovery: longest_streak ≥30, current ≥30, longest > current (proves a break)
  const phoenix =
    profile.longest_streak >= 30 &&
    profile.streak >= 30 &&
    profile.longest_streak > profile.streak
      ? 1
      : 0;

  return {
    personal_streak: profile.longest_streak ?? 0,
    phoenix_recovery: phoenix,
    apex_reached: isApexOrAbove ? 1 : 0,
    legend_reached: isLegend ? 1 : 0,
    apex_founding:
      profile.is_apex_subscriber && profile.apex_subscription_started_at ? 1 : 0,
    apex_held_days: isApexOrAbove ? heldDays : 0,
    legend_held_days: isLegend ? heldDays : 0,
  };
};

/**
 * All query-derived badge stats in ONE round trip via the user_badge_stats()
 * RPC (SECURITY INVOKER — same RLS visibility the old per-criterion count
 * queries had). Replaces ~45 REST requests per Profile open.
 */
const fetchQueryStats = async (): Promise<Record<string, number>> => {
  const { data, error } = await supabase.rpc("user_badge_stats" as never);
  if (error || !data) return {};
  return data as unknown as Record<string, number>;
};

/**
 * Check and award all applicable badges after a check-in.
 * Returns the first newly unlocked badge (for modal display).
 */
export const checkAndAwardBadges = async (userId: string): Promise<BadgeCheckResult | null> => {
  const [{ data: allBadges }, { data: earnedBadges }, { data: profile }] = await Promise.all([
    supabase.from("badges").select("*"),
    supabase.from("user_badges").select("badge_id").eq("user_id", userId),
    supabase
      .from("profiles")
      .select(
        "xp, level, streak, longest_streak, is_elite, status_tier, is_apex_subscriber, apex_subscription_started_at, legend_pinned",
      )
      .eq("user_id", userId)
      .single(),
  ]);

  if (!allBadges || !profile) return null;

  const earnedIds = new Set((earnedBadges || []).map((b) => b.badge_id));

  const q = await fetchQueryStats();
  const extended = profileDerivedStats(profile);

  const stats: Record<string, number> = {
    ...q,
    xp: profile.xp,
    level: profile.level,
    streak: profile.streak,
    longest_streak: profile.longest_streak,
    is_elite: profile.is_elite ? 1 : 0,
    ...extended,
  };

  // Map ALL requirement_types to stat keys (including aliases)
  const typeToStat: Record<string, string> = {
    checkins: "checkins",
    workouts: "workouts",
    cold_shower: "cold_shower",
    cold_showers: "cold_shower",
    healthy_food: "healthy_food",
    protein: "protein",
    hydration: "hydration",
    no_phone_morning: "no_phone_morning",
    no_phone_evening: "no_phone_evening",
    reading: "reading",
    battles_won: "battles_won",
    referrals: "referrals",
    double_workout: "double_workout",
    meditation: "meditation",
    meditation_streak: "meditation",
    proofs: "proofs",
    perfect_day: "perfect_day",
    elite_member: "is_elite",
    combat_workouts: "workouts",
    run_workouts: "workouts",
    xp: "xp",
    total_xp: "xp",
    level: "level",
    streak: "longest_streak",
    // New types
    personal_streak: "personal_streak",
    phoenix_recovery: "phoenix_recovery",
    apex_reached: "apex_reached",
    legend_reached: "legend_reached",
    apex_founding: "apex_founding",
    apex_held_days: "apex_held_days",
    legend_held_days: "legend_held_days",
    tribe_battles_won: "tribe_battles_won",
    tribe_collective_streak: "tribe_collective_streak",
    tribe_founder_streak: "tribe_founder_streak",
  };

  // Social + special badges handled by triggers — skip
  const TRIGGER_TYPES = new Set([
    "total_likes", "total_comments", "single_post_likes",
    "total_kudos", "season_champion",
    "leaderboard_percentile", "percentile",
  ]);

  let firstNewBadge: BadgeCheckResult | null = null;

  for (const badge of allBadges) {
    if (earnedIds.has(badge.id)) continue;
    if (!badge.requirement_type || !badge.requirement_value) continue;
    if (TRIGGER_TYPES.has(badge.requirement_type)) continue;

    const statKey = typeToStat[badge.requirement_type];
    if (!statKey) continue;

    const currentValue = stats[statKey] || 0;
    if (currentValue >= badge.requirement_value) {
      const { data: awarded, error } = await supabase.rpc("award_badge_if_earned", {
        p_user_id: userId,
        p_badge_id: badge.id,
      });

      if (!error && awarded && !firstNewBadge) {
        firstNewBadge = { badge, isNew: true };
      }
    }
  }

  return firstNewBadge;
};

/**
 * Get progress data for all badges for a user
 */
export const getBadgeProgress = async (userId: string): Promise<Record<string, { current: number; target: number; percent: number }>> => {
  const [{ data: profile }, q] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "xp, level, streak, longest_streak, is_elite, status_tier, is_apex_subscriber, apex_subscription_started_at, legend_pinned",
      )
      .eq("user_id", userId)
      .single(),
    fetchQueryStats(),
  ]);

  const extended = profile
    ? profileDerivedStats(profile)
    : {
        personal_streak: 0,
        phoenix_recovery: 0,
        apex_reached: 0,
        legend_reached: 0,
        apex_founding: 0,
        apex_held_days: 0,
        legend_held_days: 0,
      };

  const stats: Record<string, number> = {
    ...q,
    xp: profile?.xp || 0,
    level: profile?.level || 1,
    streak: profile?.longest_streak || 0,
    is_elite: profile?.is_elite ? 1 : 0,
    ...extended,
  };

  const typeToStat: Record<string, string> = {
    checkins: "checkins",
    workouts: "workouts",
    cold_shower: "cold_shower",
    cold_showers: "cold_shower",
    healthy_food: "healthy_food",
    protein: "protein",
    hydration: "hydration",
    no_phone_morning: "no_phone_morning",
    no_phone_evening: "no_phone_evening",
    reading: "reading",
    battles_won: "battles_won",
    referrals: "referrals",
    double_workout: "double_workout",
    meditation: "meditation",
    meditation_streak: "meditation",
    proofs: "proofs",
    perfect_day: "perfect_day",
    elite_member: "is_elite",
    combat_workouts: "workouts",
    run_workouts: "workouts",
    xp: "xp",
    total_xp: "xp",
    level: "level",
    streak: "streak",
    // New types
    personal_streak: "personal_streak",
    phoenix_recovery: "phoenix_recovery",
    apex_reached: "apex_reached",
    legend_reached: "legend_reached",
    apex_founding: "apex_founding",
    apex_held_days: "apex_held_days",
    legend_held_days: "legend_held_days",
    tribe_battles_won: "tribe_battles_won",
    tribe_collective_streak: "tribe_collective_streak",
    tribe_founder_streak: "tribe_founder_streak",
  };

  const progress: Record<string, { current: number; target: number; percent: number }> = {};
  
  const { data: allBadges } = await supabase.from("badges").select("id, requirement_type, requirement_value");
  for (const badge of allBadges || []) {
    if (!badge.requirement_type || !badge.requirement_value) continue;
    const statKey = typeToStat[badge.requirement_type];
    if (!statKey) continue;
    const current = stats[statKey] || 0;
    const target = badge.requirement_value;
    progress[badge.id] = {
      current: Math.min(current, target),
      target,
      percent: Math.min(Math.round((current / target) * 100), 100),
    };
  }

  return progress;
};
