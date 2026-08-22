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
  /**
   * When true, the tier is earned by EITHER the rank percentile OR the
   * (activeDays + streak) grind path — matching the server's
   * `percentile >= X OR (streak AND activeDays)` rule. This is what makes
   * Elite reachable by a solo user with a long streak, without ever placing
   * in a rank percentile (which is impossible in a tiny user base). When
   * false/omitted, all listed thresholds are required together (AND).
   */
  orPath?: boolean;
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
    pressureMessage: "Your first week sets your tier",
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
    pressureMessage: "Your first week sets your tier",
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
    percentile: "Top 75%",
    message: "You showed up. Most never do.",
    pressureMessage: "One missed week drops you",
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
    pressureMessage: "Ahead, for now",
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
    pressureMessage: "Others are closing",
    color: "purple",
    borderClass: "border-[hsl(var(--purple))]/40",
    bgClass: "bg-[hsl(var(--purple))]/5",
    textClass: "text-[hsl(var(--purple))]",
    glowClass: "shadow-[0_0_16px_hsl(var(--purple)/0.2)]",
    auraSize: 'small',
    badgeVariant: "purple",
    rank: 3,
    requirements: { percentile: 70, activeDays: 15, streak: 14, orPath: true },
    unlocks: ["Purple glow aura", "Profile spotlight"],
  },
  elite: {
    label: "Elite",
    shortLabel: "ELT",
    emoji: "👑",
    percentile: "Top 20%",
    message: "You did what 80% couldn't. Stay there.",
    pressureMessage: "Elite is held, not owned",
    color: "gold",
    borderClass: "border-gold/50",
    bgClass: "bg-gold/5",
    textClass: "text-gold",
    glowClass: "shadow-[0_0_20px_hsl(var(--gold)/0.25)]",
    auraSize: 'medium',
    badgeVariant: "gold",
    rank: 4,
    requirements: { percentile: 80, activeDays: 20, streak: 30, orPath: true },
    unlocks: ["Feed posting", "Crown aura", "Elite badge"],
  },
  apex: {
    label: "Apex",
    shortLabel: "APX",
    emoji: "⚡",
    percentile: "Top 10%",
    message: "Top 10%. The rest are watching.",
    pressureMessage: "Every day counts here",
    color: "apex",
    borderClass: "border-[hsl(var(--ember))]/60",
    bgClass: "bg-gradient-to-br from-[hsl(var(--ember))]/12 to-gold/8",
    textClass: "text-[hsl(var(--ember))]",
    // Stronger double-glow: inner gold + outer flame
    glowClass: "shadow-[0_0_24px_hsl(var(--gold)/0.35),0_0_48px_hsl(var(--ember)/0.35)]",
    auraSize: 'large',
    badgeVariant: "apex",
    rank: 5,
    requirements: { percentile: 90, activeDays: 30, streak: 30 },
    unlocks: ["Apex flame aura", "Top 10% status", "Tribes — create communities", "Priority visibility"],
  },
  legend: {
    label: "Legend",
    shortLabel: "LGD",
    emoji: "🔱",
    percentile: "Top 1%",
    message: "Untouchable. Your name lives forever here.",
    pressureMessage: "Legend is earned daily",
    color: "legend",
    borderClass: "border-[hsl(280_70%_60%)]/50",
    bgClass: "bg-gradient-to-br from-[hsl(280_70%_55%)]/10 via-gold/5 to-[hsl(350_80%_55%)]/5",
    textClass: "text-transparent bg-clip-text bg-gradient-to-r from-[hsl(280_70%_65%)] via-gold to-[hsl(350_80%_60%)]",
    glowClass: "shadow-[0_0_32px_hsl(280_70%_60%/0.4)]",
    auraSize: 'huge',
    badgeVariant: "legend",
    rank: 6,
    requirements: { percentile: 99, activeDays: 30, streak: 45 },
    unlocks: ["Legend rainbow aura", "Hall of Fame", "Tribes — create communities", "Mythic status"],
  },
};

/**
 * Canonical tier id. 'normal' is a legacy DB alias of recruit that is NOT in
 * TIER_ORDER — raw indexOf() on it returned -1 and quietly broke ladder math
 * (the header's next-tier chip told a recruit "→ Legend"). Every ladder
 * lookup below normalizes through this.
 */
export const canonicalTier = (tier?: string | null): StatusTier =>
  !tier || tier === "normal" || !(tier in TIER_CONFIG) ? "recruit" : (tier as StatusTier);

export const getTierConfig = (tier: string): TierConfig => {
  return TIER_CONFIG[canonicalTier(tier)];
};

// ── Divisions (Phase 2) ───────────────────────────────────────────────────────
// tier_division: 0 = none (recruit/legend, singular); 1 = III (bottom of tier),
// 2 = II, 3 = I (top of tier, closest to promotion). Higher number = higher rung.
const DIVISION_ROMAN: Record<number, string> = { 3: "I", 2: "II", 1: "III" };

/** "II" / "III" / "I" for a division 1..3; "" for 0 or singular tiers. */
export const divisionRoman = (division?: number | null): string =>
  division && DIVISION_ROMAN[division] ? DIVISION_ROMAN[division] : "";

/** Tiers that carry III/II/I divisions (recruit + legend are singular). */
const DIVISIONED = new Set<StatusTier>(["operator", "performer", "high_performer", "elite", "apex"]);

/** "Elite II" (or just "Legend" / "Recruit" for singular tiers). */
export const formatTier = (tier: string, division?: number | null): string => {
  const label = getTierConfig(tier).label;
  const roman = DIVISIONED.has(tier as StatusTier) ? divisionRoman(division) : "";
  return roman ? `${label} ${roman}` : label;
};

/** "ELT II" — compact form for tight chips. */
export const formatTierShort = (tier: string, division?: number | null): string => {
  const short = getTierConfig(tier).shortLabel;
  const roman = DIVISIONED.has(tier as StatusTier) ? divisionRoman(division) : "";
  return roman ? `${short} ${roman}` : short;
};

/**
 * Single monotonic rank value across tier × division, so a promotion detector can
 * compare rungs (Elite II > Elite III > High Performer I). rank = tierIndex*4 + division.
 * Decode back with `tierFromLadder` / `divisionFromLadder`.
 */
export const ladderRankValue = (tier: string, division?: number | null): number => {
  const idx = Math.max(0, TIER_ORDER.indexOf(canonicalTier(tier)));
  return idx * 4 + (division ?? 0);
};
export const tierFromLadder = (v: number): StatusTier => TIER_ORDER[Math.min(TIER_ORDER.length - 1, Math.floor(v / 4))];
export const divisionFromLadder = (v: number): number => v % 4;

export const TIER_ORDER: StatusTier[] = ['recruit', 'operator', 'performer', 'high_performer', 'elite', 'apex', 'legend'];

export const getNextTier = (current: string): TierConfig | null => {
  const idx = TIER_ORDER.indexOf(canonicalTier(current));
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_CONFIG[TIER_ORDER[idx + 1]];
};

export const getPreviousTier = (current: string): TierConfig | null => {
  const idx = TIER_ORDER.indexOf(canonicalTier(current));
  if (idx <= 0) return null;
  return TIER_CONFIG[TIER_ORDER[idx - 1]];
};

// ── Consistency (the user-facing name for rank_score) ────────────────────────
// rank_score decides #N, Top% and tier, yet it was never named in the UI — a
// bare "Score: 4.7" in 9px. Shown as "Consistency" everywhere, with its
// three inputs (mirrors calculate_rank_score in SQL: 0.55 / 0.25 / 0.20).
export const CONSISTENCY_WEIGHTS = [
  { key: "activeDays", weight: 0.55, label: "Days active (last 30)", hint: "Logged days out of 30" },
  { key: "dailyXp", weight: 0.25, label: "Daily XP vs the field (last 7 days)", hint: "Your 7-day average against the top average" },
  { key: "streak", weight: 0.20, label: "Streak", hint: "Consecutive days, diminishing returns" },
] as const;

/** The tier's band as a plain label, derived from its percentile requirement
 *  (one source — the static strings drifted: operator said Top 50% but
 *  requires Top 75%). recruit → "Entry". */
export const tierBandLabel = (tier: string): string => {
  const r = getTierConfig(tier).requirements.percentile;
  if (r <= 0) return "Entry";
  return `Top ${Math.max(1, Math.round(100 - r))}%`;
};

export interface NextTierInfo {
  key: StatusTier;
  label: string;
  requirements: TierRequirements;
}

/** The next rung and what it takes (null at the top). */
export const nextTierRequirements = (current: string): NextTierInfo | null => {
  const idx = TIER_ORDER.indexOf(canonicalTier(current));
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  const key = TIER_ORDER[idx + 1];
  return { key, label: TIER_CONFIG[key].label, requirements: TIER_CONFIG[key].requirements };
};

// ── Live "Top N%" label (one derivation for every surface) ──────────────────
// The header once showed the tier's STATIC band ("Top 0.1%") while the
// nameplate computed the LIVE share ("Top 50%" at #1 of 2) — two numbers for
// the same user on the same screen. Every surface must derive the label here.

export interface LiveRankData {
  rank?: number | null;
  totalUsers?: number;
  percentile?: number;
  hasRank?: boolean;
}

/**
 * The percentile label to show next to a tier:
 * - unranked (hasRank === false) → "Unranked"
 * - live data → "Top N%" (never rounded down to "Top 0%")
 * - no data at all (e.g. anon/public surfaces) → the tier band description
 */
export const topShareLabel = (tier: string, rankData?: LiveRankData | null): string => {
  if (rankData?.hasRank === false) return "Unranked";
  const live = (() => {
    if (rankData?.percentile !== undefined) return 100 - rankData.percentile;
    const { rank, totalUsers } = rankData ?? {};
    if (rank != null && totalUsers && totalUsers > 0 && rank >= 1 && rank <= totalUsers) {
      return (rank / totalUsers) * 100;
    }
    return null;
  })();
  return live !== null ? `Top ${Math.max(1, Math.round(live))}%` : getTierConfig(tier).percentile;
};

// ── Hero surface (one tier ladder for every profile hero) ────────────────────
// Profile (/profile), UserProfile (/user/:id) and PublicProfile (/u/:name)
// each hand-rolled this gradient with drifting hues. This is the single
// source: bgClass paints the hero card/section, glowStyle is the blurred
// top vignette. Pages own the container shape (card vs full-bleed).

export interface TierHeroSurface {
  /** Border + radial-gradient background classes for the hero container. */
  bgClass: string;
  /** CSS background for the blurred top-glow element. */
  glowStyle: string;
}

export const getTierHeroSurface = (tier: string): TierHeroSurface => {
  switch (tier as StatusTier) {
    case "legend":
      return {
        bgClass: "border-[hsl(280_70%_60%)]/35 bg-[radial-gradient(120%_90%_at_50%_-10%,hsl(280_60%_18%/0.7),hsl(255_14%_6%)_55%,hsl(350_50%_12%/0.5)_100%)]",
        glowStyle: "radial-gradient(ellipse at center, hsl(280 70% 60% / 0.4), transparent 70%)",
      };
    case "apex":
      return {
        bgClass: "border-[hsl(var(--ember))]/35 bg-[radial-gradient(120%_90%_at_50%_-10%,hsl(18_75%_18%/0.65),hsl(255_14%_6%)_60%)]",
        glowStyle: "radial-gradient(ellipse at center, hsl(var(--ember) / 0.4), transparent 70%)",
      };
    case "elite":
      return {
        bgClass: "border-gold/25 bg-[radial-gradient(120%_90%_at_50%_-10%,hsl(42_70%_18%/0.55),hsl(255_14%_6%)_60%)]",
        glowStyle: "radial-gradient(ellipse at center, hsl(var(--gold) / 0.35), transparent 70%)",
      };
    case "high_performer":
      return {
        bgClass: "border-[hsl(var(--purple))]/30 bg-[radial-gradient(120%_90%_at_50%_-10%,hsl(270_50%_18%/0.55),hsl(255_14%_6%)_60%)]",
        glowStyle: "radial-gradient(ellipse at center, hsl(var(--purple) / 0.35), transparent 70%)",
      };
    default:
      return {
        bgClass: "border-border/40 bg-[radial-gradient(120%_90%_at_50%_-10%,hsl(255_14%_11%),hsl(255_14%_5%)_60%)]",
        glowStyle: "radial-gradient(ellipse at center, hsl(var(--gold) / 0.35), transparent 70%)",
      };
  }
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
      // Glowing molten gold — animated shimmer sweep + strong halo. Distinct
      // from Elite's static gold: Apex visibly *glows*.
      return "text-transparent bg-clip-text bg-[linear-gradient(100deg,hsl(42_100%_72%)_0%,hsl(36_100%_58%)_35%,hsl(48_100%_74%)_50%,hsl(36_100%_58%)_65%,hsl(42_100%_72%)_100%)] [background-size:200%_100%] [animation:shimmer-slide_4s_linear_infinite] drop-shadow-[0_2px_22px_hsl(42_100%_60%/0.7)]";
    case "elite":
      // Solid gold gradient — the golden username earned at Elite.
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
