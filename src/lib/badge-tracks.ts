// A badge's place on its ladder, and the mask a secret badge wears.
//
// The catalogue (scripts/badge-catalog.py) is flat rows; a track is every
// badge that shares a requirement_type, sorted by value. The detail sheet
// says "Meditation · rung 4 of 7 · next Still Mind at 100" from that alone.

export interface TrackBadge {
  id: string;
  name: string;
  icon: string;
  description?: string | null;
  requirement_type?: string | null;
  requirement_value?: number | null;
  hidden?: boolean | null;
}

/** What a track is called on the sheet. Keys not listed read as their own name. */
const TRACK_LABEL: Record<string, string> = {
  checkins: "Check-ins",
  longest_streak: "Streak",
  meditation: "Meditation",
  meditation_streak: "Meditation streak",
  level: "Level",
  xp: "XP",
  workouts: "Workouts",
  double_workout: "Double days",
  cold_shower: "Cold showers",
  reading: "Reading",
  healthy_food: "Clean days",
  protein: "Protein days",
  hydration: "Water days",
  no_phone_morning: "Phone-free mornings",
  no_phone_evening: "Phone-free evenings",
  proofs: "Proof photos",
  perfect_day: "Perfect days",
  verified_days: "Verified days",
  full_days: "Full days",
  health_days: "150 days",
  max_effort_days: "Max-effort days",
  full_sleep_nights: "Full nights",
  step_days: "Step days",
  vault_practices: "Vault practices",
  battles_won: "Battles won",
  tribe_battles_won: "Tribe battles",
  tribe_collective_streak: "Tribe fire",
  paid_referrals: "Paid friends",
  referrals: "Friends joined",
  leaderboard_percentile: "Rating",
};

export const trackLabel = (type: string): string =>
  TRACK_LABEL[type] ?? type.replace(/^vault_master:.*/, "Vault masters").replace(/_/g, " ");

export interface TrackLine {
  label: string;
  rung: number;
  of: number;
  /** The rung above this one, if any. */
  next: { name: string; value: number } | null;
}

/** The ladder line for a badge, or null when it stands alone. */
export const trackLine = (badge: TrackBadge, all: TrackBadge[]): TrackLine | null => {
  const type = badge.requirement_type;
  if (!type || badge.requirement_value == null) return null;
  const rungs = all
    .filter((b) => b.requirement_type === type && b.requirement_value != null && !b.hidden)
    .sort((a, b) => (a.requirement_value ?? 0) - (b.requirement_value ?? 0));
  if (rungs.length < 2) return null;
  const i = rungs.findIndex((b) => b.id === badge.id);
  if (i < 0) return null;
  const up = rungs[i + 1];
  return {
    label: trackLabel(type),
    rung: i + 1,
    of: rungs.length,
    next: up ? { name: up.name, value: up.requirement_value ?? 0 } : null,
  };
};

export const SECRET_ICON = "?";

/** A secret badge that has not been earned shows nothing of itself. */
export const maskSecret = <T extends TrackBadge>(badge: T, earned: boolean): T =>
  badge.hidden && !earned
    ? { ...badge, name: "Secret", icon: SECRET_ICON, description: "Earn it and it shows itself.", requirement_type: null, requirement_value: null }
    : badge;
