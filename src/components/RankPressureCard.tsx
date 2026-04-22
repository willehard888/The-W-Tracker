import { cn } from "@/lib/utils";
import { getTierConfig, getNextTier } from "@/lib/status-tiers";
import { TrendingUp, TrendingDown, AlertTriangle, ChevronRight, Flame, Trophy, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface RankPressureCardProps {
  tier: string;
  rank: number | null;
  totalUsers: number;
  percentile: number;
  hasRank?: boolean;
  rankScore?: number;
  daysAtTier?: number;
  className?: string;
}

const formatPercentile = (p: number) => {
  if (p >= 99) return p.toFixed(1);
  return Math.round(p).toString();
};

const RankPressureCard = ({ tier, rank, totalUsers, percentile, hasRank = true, rankScore, daysAtTier, className }: RankPressureCardProps) => {
  const config = getTierConfig(tier);
  const nextTier = getNextTier(tier);

  const isRising = percentile > 75;
  const isFalling = percentile < 30;
  const isLegend = tier === "legend";
  const isApex = tier === "apex";
  const isElite = tier === "elite";
  const isHighTier = isLegend || isApex || isElite;

  const pressureText =
    isRising
      ? "Others are catching up"
      : isFalling
      ? "You're falling behind"
      : config.pressureMessage;

  // Tier-specific accent gradient for the rank chip + bar fill
  const accentGradient =
    isLegend
      ? "from-[hsl(280_70%_60%)] via-gold to-[hsl(350_80%_60%)]"
      : isApex
      ? "from-[hsl(18_95%_58%)] to-gold"
      : isElite
      ? "from-gold-dark via-gold to-gold-light"
      : tier === "high_performer"
      ? "from-[hsl(var(--purple))] to-[hsl(280_70%_65%)]"
      : tier === "performer"
      ? "from-[hsl(210_90%_56%)] to-[hsl(190_85%_60%)]"
      : tier === "operator"
      ? "from-[hsl(var(--teal))] to-[hsl(170_70%_50%)]"
      : "from-secondary to-muted";

  // Conic glow color for premium tiers
  const conicGlow =
    isLegend
      ? "conic-gradient(from_0deg,hsl(280_70%_58%/0.5),hsl(42_90%_55%/0.4),hsl(350_80%_55%/0.5),hsl(280_70%_58%/0.5))"
      : isApex
      ? "conic-gradient(from_0deg,hsl(18_95%_58%/0.5),hsl(42_90%_55%/0.4),hsl(18_95%_58%/0.5))"
      : isElite
      ? "conic-gradient(from_0deg,hsl(42_90%_55%/0.4),hsl(42_78%_45%/0.2),hsl(42_90%_55%/0.4))"
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={cn("relative", className)}
    >
      {/* Static tier aura — animated spin removed for perf (was causing flicker) */}
      {conicGlow && (
        <div
          className="absolute -inset-[1px] rounded-2xl opacity-60 pointer-events-none"
          style={{ background: conicGlow }}
          aria-hidden
        />
      )}

      <div
        className={cn(
          "relative rounded-2xl border p-4 overflow-hidden",
          isHighTier ? "border-transparent" : config.borderClass,
        )}
        style={{
          background:
            "linear-gradient(135deg, hsl(255 14% 7% / 0.92), hsl(260 18% 4% / 0.96))",
        }}
      >
        {/* Inner ambient tier glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isLegend
              ? "radial-gradient(ellipse at top right, hsl(280 70% 60% / 0.18), transparent 60%)"
              : isApex
              ? "radial-gradient(ellipse at top right, hsl(18 95% 58% / 0.16), transparent 60%)"
              : isElite
              ? "radial-gradient(ellipse at top right, hsl(42 78% 54% / 0.14), transparent 60%)"
              : "radial-gradient(ellipse at top right, hsl(var(--purple) / 0.06), transparent 60%)",
          }}
        />


        <div className="relative">
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.05, rotate: -2 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "relative flex h-12 w-12 items-center justify-center rounded-xl font-display font-black text-xl shadow-lg",
                  `bg-gradient-to-br ${accentGradient}`,
                  isHighTier ? "text-background" : "text-foreground",
                )}
                style={{
                  boxShadow: isHighTier
                    ? "0 4px 20px -4px hsl(var(--gold) / 0.4)"
                    : undefined,
                }}
              >
                {/* Glossy highlight */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                <span className="relative">#{rank || "?"}</span>
              </motion.div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Trophy size={11} className={cn("shrink-0", config.textClass)} />
                  <p className="font-display font-black text-sm uppercase tracking-wider">
                    Your Position
                  </p>
                </div>
                {hasRank ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ahead of{" "}
                    <span className={cn("font-black tabular-nums", config.textClass)}>
                      {formatPercentile(percentile)}%
                    </span>{" "}
                    of users
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Not ranked yet
                  </p>
                )}
              </div>
            </div>

            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full",
                !hasRank
                  ? "bg-muted/30 text-muted-foreground"
                  : isRising
                  ? "bg-emerald-500/15 text-emerald-400"
                  : isFalling
                  ? "bg-destructive/15 text-destructive"
                  : "bg-gold/10 text-gold/70",
              )}
            >
              {!hasRank ? (
                <Sparkles size={16} strokeWidth={2.5} />
              ) : isRising ? (
                <TrendingUp size={16} strokeWidth={2.5} />
              ) : isFalling ? (
                <TrendingDown size={16} strokeWidth={2.5} />
              ) : (
                <TrendingUp size={16} strokeWidth={2.5} />
              )}
            </div>
          </div>

          {/* Animated percentile bar */}
          <div className="mb-3">
            <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full bg-gradient-to-r", accentGradient)}
                initial={{ width: 0 }}
                animate={{ width: hasRank ? `${Math.max(4, percentile)}%` : "0%" }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.15 }}
              />
            </div>
          </div>

          {/* Pressure microcopy */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-bold text-center mb-3 flex items-center justify-center gap-1.5",
              !hasRank
                ? "bg-gold/8 text-gold/85 border border-gold/20"
                : isFalling
                ? "bg-destructive/10 text-destructive border border-destructive/25"
                : isRising
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                : "bg-gold/8 text-gold/85 border border-gold/20",
            )}
          >
            {!hasRank ? (
              <>
                <Sparkles size={12} />
                Make your first check-in to enter the ranks
              </>
            ) : isFalling ? (
              <>
                <AlertTriangle size={12} />
                {pressureText}
              </>
            ) : isRising ? (
              <>
                <Flame size={12} />
                {pressureText}
              </>
            ) : (
              pressureText
            )}
          </motion.div>

          {/* Days at tier */}
          {hasRank && daysAtTier !== undefined && daysAtTier > 0 && tier !== "recruit" && tier !== "normal" && (
            <div className="flex items-center justify-center gap-1.5 mb-2 text-[10px] text-muted-foreground">
              <Trophy size={10} className={cn("shrink-0", config.textClass)} />
              <span>
                <span className={cn("font-black tabular-nums", config.textClass)}>{daysAtTier}d</span>{" "}
                at <span className="font-black">{config.label}</span>
              </span>
            </div>
          )}

          {/* Next tier */}
          {nextTier ? (
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30">
              <div className="flex items-center gap-1.5 min-w-0">
                <ChevronRight size={12} className="text-muted-foreground/60 shrink-0" />
                <p className="text-[10px] text-muted-foreground truncate">
                  Next:{" "}
                  <span className="font-black text-foreground">{nextTier.label}</span>
                  <span className="text-muted-foreground/60"> · {nextTier.percentile}</span>
                </p>
              </div>
              {rankScore !== undefined && (
                <p className="text-[9px] text-muted-foreground/50 tabular-nums shrink-0">
                  Score: <span className="text-muted-foreground">{rankScore.toFixed(1)}</span>
                </p>
              )}
            </div>
          ) : (
            rankScore !== undefined && (
              <p className="text-[9px] text-muted-foreground/50 mt-2 text-right tabular-nums">
                Score: <span className="text-muted-foreground">{rankScore.toFixed(1)}</span>
              </p>
            )
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default RankPressureCard;
