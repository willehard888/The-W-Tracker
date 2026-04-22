/**
 * Status Tier Configuration — the core hierarchy of The W Tracker
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
    message: "You haven't earned your place yet",
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
    message: "You haven't earned your place yet",
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
    message: "You're in the game",
    pressureMessage: "Don't lose your position",
    color: "teal",
    borderClass: "border-[hsl(var(--teal))]/30",
    bgClass: "bg-[hsl(var(--teal))]/5",
    textClass: "text-[hsl(var(--teal))]",
    glowClass: "",
    auraSize: 'none',
    badgeVariant: "teal",
    rank: 1,
    requirements: { percentile: 50, activeDays: 7, streak: 0 },
    unlocks: ["Operator badge", "Public rank visible"],
  },
  performer: {
    label: "Performer",
    shortLabel: "PRF",
    emoji: "🔵",
    percentile: "Top 25%",
    message: "Rising through the ranks",
    pressureMessage: "You're ahead — for now",
    color: "blue",
    borderClass: "border-[hsl(210_90%_56%)]/30",
    bgClass: "bg-[hsl(210_90%_56%)]/5",
    textClass: "text-[hsl(210_90%_56%)]",
    glowClass: "shadow-[0_0_12px_hsl(210_90%_56%/0.15)]",
    auraSize: 'none',
    badgeVariant: "blue",
    rank: 2,
    requirements: { percentile: 75, activeDays: 7, streak: 0 },
    unlocks: ["Performer aura", "Leaderboard highlight"],
  },
  high_performer: {
    label: "High Performer",
    shortLabel: "HPR",
    emoji: "🟣",
    percentile: "Top 10%",
    message: "The top notice you now",
    pressureMessage: "Others are catching up",
    color: "purple",
    borderClass: "border-[hsl(var(--purple))]/40",
    bgClass: "bg-[hsl(var(--purple))]/5",
    textClass: "text-[hsl(var(--purple))]",
    glowClass: "shadow-[0_0_16px_hsl(var(--purple)/0.2)]",
    auraSize: 'small',
    badgeVariant: "purple",
    rank: 3,
    requirements: { percentile: 90, activeDays: 14, streak: 14 },
    unlocks: ["Purple glow aura", "Profile spotlight"],
  },
  elite: {
    label: "Elite",
    shortLabel: "ELT",
    emoji: "👑",
    percentile: "Top 5%",
    message: "You are now visible",
    pressureMessage: "Don't lose your status",
    color: "gold",
    borderClass: "border-gold/50",
    bgClass: "bg-gold/5",
    textClass: "text-gold",
    glowClass: "shadow-[0_0_20px_hsl(var(--gold)/0.25)]",
    auraSize: 'medium',
    badgeVariant: "gold",
    rank: 4,
    requirements: { percentile: 95, activeDays: 14, streak: 30 },
    unlocks: ["Elite Feed posting", "Crown aura", "Elite badge"],
  },
  apex: {
    label: "Apex",
    shortLabel: "APX",
    emoji: "⚡",
    percentile: "Top 1%",
    message: "Among the elite few",
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
    message: "Legends & Founders only",
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
