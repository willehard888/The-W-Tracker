import { supabase } from "@/integrations/supabase/client";

interface BadgeCheckResult {
  badge: any;
  isNew: boolean;
}

/**
 * Check and award all applicable badges after a check-in.
 * Returns the first newly unlocked badge (for modal display).
 */
export const checkAndAwardBadges = async (userId: string): Promise<BadgeCheckResult | null> => {
  // Fetch all badges and user's earned badges
  const [{ data: allBadges }, { data: earnedBadges }, { data: profile }] = await Promise.all([
    supabase.from("badges").select("*"),
    supabase.from("user_badges").select("badge_id").eq("user_id", userId),
    supabase.from("profiles").select("xp, level, streak, longest_streak").eq("user_id", userId).single(),
  ]);

  if (!allBadges || !profile) return null;

  const earnedIds = new Set((earnedBadges || []).map((b) => b.badge_id));

  // Fetch aggregated stats
  const [checkinStats, workoutStats, coldShowerStats, healthyFoodStats, proteinStats, hydrationStats, noPhoneMorningStats, noPhoneEveningStats, readingStats, battleStats, referralStats] = await Promise.all([
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
  ]);

  // Check for double workout days
  const { count: doubleWorkoutCount } = await supabase
    .from("daily_checkins")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("extra_workout", true);

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
    double_workout: doubleWorkoutCount || 0,
    xp: profile.xp,
    level: profile.level,
    streak: profile.streak,
    longest_streak: profile.longest_streak,
  };

  // Map requirement_type to stat key
  const typeToStat: Record<string, string> = {
    checkins: "checkins",
    workouts: "workouts",
    cold_shower: "cold_shower",
    healthy_food: "healthy_food",
    protein: "protein",
    hydration: "hydration",
    no_phone_morning: "no_phone_morning",
    no_phone_evening: "no_phone_evening",
    reading: "reading",
    battles_won: "battles_won",
    referrals: "referrals",
    double_workout: "double_workout",
    xp: "xp",
    level: "level",
    streak: "longest_streak",
  };

  let firstNewBadge: BadgeCheckResult | null = null;

  for (const badge of allBadges) {
    if (earnedIds.has(badge.id)) continue;
    if (!badge.requirement_type || !badge.requirement_value) continue;

    // Skip social badges (handled by triggers)
    if (["total_likes", "total_comments", "single_post_likes", "total_kudos", "season_champion"].includes(badge.requirement_type)) continue;

    const statKey = typeToStat[badge.requirement_type];
    if (!statKey) continue;

    const currentValue = stats[statKey] || 0;
    if (currentValue >= badge.requirement_value) {
      const { error } = await supabase.from("user_badges").insert({
        user_id: userId,
        badge_id: badge.id,
      });

      if (!error && !firstNewBadge) {
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
  const [{ data: profile }, checkins, workouts, coldShowers, healthyFood, protein, hydration, noPhoneMorning, noPhoneEvening, reading, battlesWon, referrals] = await Promise.all([
    supabase.from("profiles").select("xp, level, streak, longest_streak").eq("user_id", userId).single(),
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
  ]);

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
    xp: profile?.xp || 0,
    level: profile?.level || 1,
    streak: profile?.longest_streak || 0,
  };

  const typeToStat: Record<string, string> = {
    checkins: "checkins",
    workouts: "workouts",
    cold_shower: "cold_shower",
    healthy_food: "healthy_food",
    protein: "protein",
    hydration: "hydration",
    no_phone_morning: "no_phone_morning",
    no_phone_evening: "no_phone_evening",
    reading: "reading",
    battles_won: "battles_won",
    referrals: "referrals",
    xp: "xp",
    level: "level",
    streak: "streak",
    double_workout: "workouts", // approximate
  };

  const progress: Record<string, { current: number; target: number; percent: number }> = {};
  
  // Build progress for each requirement_type + value combination
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
