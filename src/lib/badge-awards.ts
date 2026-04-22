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
const fetchExtendedStats = async (
  userId: string,
  profile: any,
): Promise<Record<string, number>> => {
  const [tribeBattlesWonRes, userTribesRes, ownedTribesRes] = await Promise.all([
    // Tribe battles won — count battles where user is active member of winning tribe
    supabase
      .from("tribe_battles")
      .select("id, winner_tribe_id, status")
      .eq("status", "completed")
      .not("winner_tribe_id", "is", null),
    // User's active tribe memberships (for collective streak)
    supabase
      .from("tribe_members")
      .select("tribe_id")
      .eq("user_id", userId)
      .eq("status", "active"),
    // Tribes the user owns (for founder streak)
    supabase.from("tribes").select("id").eq("owner_id", userId),
  ]);

  // Compute tribe_battles_won — only battles user's tribes won where they're an active member
  let tribeBattlesWon = 0;
  if (tribeBattlesWonRes.data && userTribesRes.data) {
    const userTribeIds = new Set(userTribesRes.data.map((t) => t.tribe_id));
    tribeBattlesWon = tribeBattlesWonRes.data.filter(
      (b) => b.winner_tribe_id && userTribeIds.has(b.winner_tribe_id),
    ).length;
  }

  // Compute collective streaks: for each user-tribe, get min streak of active members
  const computeCollective = async (tribeIds: string[]): Promise<number> => {
    if (tribeIds.length === 0) return 0;
    let best = 0;
    for (const tribeId of tribeIds) {
      const { data: members } = await supabase
        .from("tribe_members")
        .select("user_id")
        .eq("tribe_id", tribeId)
        .eq("status", "active");
      if (!members || members.length === 0) continue;
      const ids = members.map((m) => m.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("streak")
        .in("user_id", ids);
      if (!profs || profs.length === 0) continue;
      const minStreak = Math.min(...profs.map((p) => p.streak ?? 0));
      if (minStreak > best) best = minStreak;
    }
    return best;
  };

  const tribeCollectiveStreak = await computeCollective(
    (userTribesRes.data || []).map((t) => t.tribe_id),
  );
  const tribeFounderStreak = await computeCollective(
    (ownedTribesRes.data || []).map((t) => t.id),
  );

  // Apex / Legend held days — based on apex_subscription_started_at
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
    tribe_battles_won: tribeBattlesWon,
    tribe_collective_streak: tribeCollectiveStreak,
    tribe_founder_streak: tribeFounderStreak,
  };
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

  // Fetch all stats in parallel
  const [
    checkinStats, workoutStats, coldShowerStats, healthyFoodStats,
    proteinStats, hydrationStats, noPhoneMorningStats, noPhoneEveningStats,
    readingStats, battleStats, referralStats, doubleWorkoutStats,
    meditationMorningStats, meditationEveningStats, proofStats,
  ] = await Promise.all([
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("workout", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("cold_shower", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("healthy_food", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("protein_intake", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("hydration_liters", 3),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("no_phone_morning", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("no_phone_evening", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("reading", true),
    supabase.from("battles").select("id", { count: "exact", head: true }).eq("winner_id", userId),
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", userId),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("extra_workout", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("meditation_morning", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("meditation_evening", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).not("proof_photo_url", "is", "null"),
  ]);

  // Count "perfect days" (all main habits done)
  const perfectDayResult = await supabase
    .from("daily_checkins")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("workout", true)
    .eq("cold_shower", true)
    .eq("healthy_food", true)
    .eq("protein_intake", true)
    .gte("hydration_liters", 3)
    .eq("reading", true)
    .eq("no_phone_morning", true)
    .eq("no_phone_evening", true);

  const meditationTotal = (meditationMorningStats.count || 0) + (meditationEveningStats.count || 0);

  // Extended stats for the new badge families
  const extended = await fetchExtendedStats(userId, profile);

  const stats: Record<string, number> = {
    checkins: checkinStats.count || 0,
    workouts: workoutStats.count || 0,
    cold_shower: coldShowerStats.count || 0,
    healthy_food: healthyFoodStats.count || 0,
    protein: proteinStats.count || 0,
    hydration: hydrationStats.count || 0,
    no_phone_morning: noPhoneMorningStats.count || 0,
    no_phone_evening: noPhoneEveningStats.count || 0,
    reading: readingStats.count || 0,
    battles_won: battleStats.count || 0,
    referrals: referralStats.count || 0,
    double_workout: doubleWorkoutStats.count || 0,
    meditation: meditationTotal,
    proofs: proofStats.count || 0,
    perfect_day: perfectDayResult.count || 0,
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
  const [
    { data: profile }, checkins, workouts, coldShowers, healthyFood,
    protein, hydration, noPhoneMorning, noPhoneEvening, reading,
    battlesWon, referrals, doubleWorkouts, medMorning, medEvening, proofs,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "xp, level, streak, longest_streak, is_elite, status_tier, is_apex_subscriber, apex_subscription_started_at, legend_pinned",
      )
      .eq("user_id", userId)
      .single(),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("workout", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("cold_shower", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("healthy_food", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("protein_intake", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("hydration_liters", 3),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("no_phone_morning", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("no_phone_evening", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("reading", true),
    supabase.from("battles").select("id", { count: "exact", head: true }).eq("winner_id", userId),
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", userId),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("extra_workout", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("meditation_morning", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("meditation_evening", true),
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).not("proof_photo_url", "is", "null"),
  ]);

  const { count: perfectDayCount } = await supabase
    .from("daily_checkins")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("workout", true)
    .eq("cold_shower", true)
    .eq("healthy_food", true)
    .eq("protein_intake", true)
    .gte("hydration_liters", 3)
    .eq("reading", true)
    .eq("no_phone_morning", true)
    .eq("no_phone_evening", true);

  const meditationTotal = (medMorning.count || 0) + (medEvening.count || 0);

  const extended = profile
    ? await fetchExtendedStats(userId, profile)
    : {
        personal_streak: 0,
        phoenix_recovery: 0,
        apex_reached: 0,
        legend_reached: 0,
        apex_founding: 0,
        apex_held_days: 0,
        legend_held_days: 0,
        tribe_battles_won: 0,
        tribe_collective_streak: 0,
        tribe_founder_streak: 0,
      };

  const stats: Record<string, number> = {
    checkins: checkins.count || 0,
    workouts: workouts.count || 0,
    cold_shower: coldShowers.count || 0,
    healthy_food: healthyFood.count || 0,
    protein: protein.count || 0,
    hydration: hydration.count || 0,
    no_phone_morning: noPhoneMorning.count || 0,
    no_phone_evening: noPhoneEvening.count || 0,
    reading: reading.count || 0,
    battles_won: battlesWon.count || 0,
    referrals: referrals.count || 0,
    double_workout: doubleWorkouts.count || 0,
    meditation: meditationTotal,
    proofs: proofs.count || 0,
    perfect_day: perfectDayCount || 0,
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
