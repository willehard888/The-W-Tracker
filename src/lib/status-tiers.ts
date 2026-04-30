/**
 * Status Tier Configuration — the core hierarchy of Whealth Factory
 * 
 * Status is earned, visible, competitive, and fragile.
 */

export type StatusTier = 'recruit' | 'normal' | 'operator' | 'performer' | 'high_performer' | 'elite' | 'apex' | 'legend';

export interface TierRequirements {
  percentile: number;
  activeDays: number;
  streak: number;
}

export interface TierConfig {
  label: string;
  shortLabel: string;
  emoji: string;
  percentile: string;
  message: string;
  pressureMessage: string;
  color: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  glowClass: string;
  auraSize: 'none' | 'small' | 'medium' | 'large' | 'huge';
  badgeVariant: string;
  rank: number; // 0=lowest
  requirements: TierRequirements; // numeric thresholds for risk calc
  unlocks: string[];
}

export const TIER_CONFIG: Record<StatusTier, TierConfig> = {
  recruit: {
    label: "Recruit",
    shortLabel: "REC",
    emoji: "⬛",
    percentile: "Bottom 50%",
    message: "Nobody knows your name yet. Change that.",
    pressureMessage: "Others are moving ahead of you",
    color: "muted",
    borderClass: "border-border",
    bgClass: "bg-secondary/30",
    textClass: "text-muted-foreground",
    glowClass: "",
    auraSize: 'none',
    badgeVariant: "default",
    rank: 0,
    requirements: { percentile: 0, activeDays: 0, streak: 0 },
    unlocks: ["Daily check-ins", "XP & levels", "Badge collection"],
  },
  normal: {
    label: "Recruit",
    shortLabel: "REC",
    emoji: "⬛",
    percentile: "Bottom 50%",
    message: "Nobody knows your name yet. Change that.",
    pressureMessage: "Others are moving ahead of you",
    color: "muted",
    borderClass: "border-border",
    bgClass: "bg-secondary/30",
    textClass: "text-muted-foreground",
    glowClass: "",
    auraSize: 'none',
    badgeVariant: "default",
    rank: 0,
    requirements: { percentile: 0, activeDays: 0, streak: 0 },
    unlocks: ["Daily check-ins", "XP & levels", "Badge collection"],
  },
  operator: {
    label: "Operator",
    shortLabel: "OPR",
    emoji: "🟢",
    percentile: "Top 50%",
    message: "You showed up. Most never do.",
    pressureMessage: "Don't lose your position",
    color: "teal",
    borderClass: "border-[hsl(var(--teal))]/30",
    bgClass: "bg-[hsl(var(--teal))]/5",
    textClass: "text-[hsl(var(--teal))]",
    glowClass: "",
    auraSize: 'none',
    badgeVariant: "teal",
    rank: 1,
    requirements: { percentile: 25, activeDays: 5, streak: 0 },
    unlocks: ["Operator badge", "Public rank visible"],
  },
  performer: {
    label: "Performer",
    shortLabel: "PRF",
    emoji: "🔵",
    percentile: "Top 50%",
    message: "You're outworking half the field.",
    pressureMessage: "You're ahead — for now",
    color: "blue",
    borderClass: "border-[hsl(210_90%_56%)]/30",
    bgClass: "bg-[hsl(210_90%_56%)]/5",
    textClass: "text-[hsl(210_90%_56%)]",
    glowClass: "shadow-[0_0_12px_hsl(210_90%_56%/0.15)]",
    auraSize: 'none',
    badgeVariant: "blue",
    rank: 2,
    requirements: { percentile: 50, activeDays: 7, streak: 0 },
    unlocks: ["Performer aura", "Leaderboard highlight"],
  },
  high_performer: {
    label: "High Performer",
    shortLabel: "HPR",
    emoji: "🟣",
    percentile: "Top 30%",
    message: "They see you climbing. They're nervous.",
    pressureMessage: "Others are catching up",
    color: "purple",
    borderClass: "border-[hsl(var(--purple))]/40",
    bgClass: "bg-[hsl(var(--purple))]/5",
    textClass: "text-[hsl(var(--purple))]",
    glowClass: "shadow-[0_0_16px_hsl(var(--purple)/0.2)]",
    auraSize: 'small',
    badgeVariant: "purple",
    rank: 3,
    requirements: { percentile: 70, activeDays: 15, streak: 14 },
    unlocks: ["Purple glow aura", "Profile spotlight"],
  },
  elite: {
    label: "Elite",
    shortLabel: "ELT",
    emoji: "👑",
    percentile: "Top 20%",
    message: "You did what 80% couldn't. Stay there.",
    pressureMessage: "Don't lose your status",
    color: "gold",
    borderClass: "border-gold/50",
    bgClass: "bg-gold/5",
    textClass: "text-gold",
    glowClass: "shadow-[0_0_20px_hsl(var(--gold)/0.25)]",
    auraSize: 'medium',
    badgeVariant: "gold",
    rank: 4,
    requirements: { percentile: 80, activeDays: 20, streak: 21 },
    unlocks: ["Elite Feed posting", "Crown aura", "Elite badge"],
  },
  apex: {
    label: "Apex",
    shortLabel: "APX",
    emoji: "⚡",
    percentile: "Top 10%",
    message: "Top 10%. The rest are watching.",
    pressureMessage: "Every day matters at this level",
    color: "apex",
    borderClass: "border-[hsl(18_95%_58%)]/60",
    bgClass: "bg-gradient-to-br from-[hsl(18_95%_58%)]/12 to-gold/8",
    textClass: "text-[hsl(18_95%_58%)]",
    // Stronger double-glow: inner gold + outer flame
    glowClass: "shadow-[0_0_24px_hsl(var(--gold)/0.35),0_0_48px_hsl(18_95%_58%/0.35)]",
    auraSize: 'large',
    badgeVariant: "apex",
    rank: 5,
    requirements: { percentile: 99, activeDays: 30, streak: 30 },
    unlocks: ["Apex flame aura", "Top 1% status", "Tribes — create communities", "Priority visibility"],
  },
  legend: {
    label: "Legend",
    shortLabel: "LGD",
    emoji: "🔱",
    percentile: "Top 0.1%",
    message: "Untouchable. Your name lives forever here.",
    pressureMessage: "The Founders Circle is watching",
    color: "legend",
    borderClass: "border-[hsl(280_70%_60%)]/50",
    bgClass: "bg-gradient-to-br from-[hsl(280_70%_55%)]/10 via-gold/5 to-[hsl(350_80%_55%)]/5",
    textClass: "text-transparent bg-clip-text bg-gradient-to-r from-[hsl(280_70%_65%)] via-gold to-[hsl(350_80%_60%)]",
    glowClass: "shadow-[0_0_32px_hsl(280_70%_60%/0.4)]",
    auraSize: 'huge',
    badgeVariant: "legend",
    rank: 6,
    requirements: { percentile: 99.9, activeDays: 30, streak: 30 },
    unlocks: ["Legend rainbow aura", "Hall of Fame", "Tribes — create communities", "Mythic status"],
  },
};

export const getTierConfig = (tier: string): TierConfig => {
  return TIER_CONFIG[tier as StatusTier] || TIER_CONFIG.recruit;
};

export const TIER_ORDER: StatusTier[] = ['recruit', 'operator', 'performer', 'high_performer', 'elite', 'apex', 'legend'];

export const getNextTier = (current: string): TierConfig | null => {
  const idx = TIER_ORDER.indexOf(current as StatusTier);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_CONFIG[TIER_ORDER[idx + 1]];
};

export const getPreviousTier = (current: string): TierConfig | null => {
  const idx = TIER_ORDER.indexOf(current as StatusTier);
  if (idx <= 0) return null;
  return TIER_CONFIG[TIER_ORDER[idx - 1]];
};

/**
 * Tailwind class string that colors the @username text according to the
 * user's status tier. Higher tiers use richer gradients; lower tiers use
 * a flat tier color or fall back to neutral foreground.
 *
 * Use on a heading/text element: `<h1 className={getTierUsernameClass(tier)}>...`
 */
export const getTierUsernameClass = (tier: string): string => {
  switch (tier as StatusTier) {
    case "legend":
      // Brighter, more saturated rainbow with stronger glow + animated shimmer — unmistakably Legend
      return "text-transparent bg-clip-text bg-[linear-gradient(100deg,hsl(280_95%_78%)_0%,hsl(320_90%_72%)_25%,hsl(42_100%_65%)_50%,hsl(350_95%_70%)_75%,hsl(280_95%_78%)_100%)] [background-size:200%_100%] [animation:shimmer-slide_5s_linear_infinite] drop-shadow-[0_2px_24px_hsl(280_85%_65%/0.65)]";
    case "apex":
      return "text-transparent bg-clip-text bg-gradient-to-r from-[hsl(18_100%_65%)] via-[hsl(42_100%_65%)] to-[hsl(18_100%_65%)] drop-shadow-[0_2px_18px_hsl(18_95%_58%/0.55)]";
    case "elite":
      return "text-transparent bg-clip-text bg-gradient-to-r from-gold-light via-gold to-gold-dark drop-shadow-[0_2px_16px_hsl(var(--gold)/0.5)]";
    case "high_performer":
      return "text-[hsl(280_85%_72%)] drop-shadow-[0_2px_14px_hsl(var(--purple)/0.5)]";
    case "performer":
      return "text-[hsl(210_95%_68%)] drop-shadow-[0_2px_12px_hsl(210_90%_56%/0.4)]";
    case "operator":
      return "text-[hsl(170_75%_55%)] drop-shadow-[0_2px_12px_hsl(var(--teal)/0.4)]";
    default:
      return "text-foreground/95";
  }
};
