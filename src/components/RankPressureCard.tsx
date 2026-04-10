import { cn } from "@/lib/utils";
import { getTierConfig, getNextTier } from "@/lib/status-tiers";
import { TrendingUp, TrendingDown, AlertTriangle, ChevronUp } from "lucide-react";

interface RankPressureCardProps {
  tier: string;
  rank: number | null;
  totalUsers: number;
  percentile: number;
  rankScore?: number;
  className?: string;
}

const RankPressureCard = ({ tier, rank, totalUsers, percentile, rankScore, className }: RankPressureCardProps) => {
  const config = getTierConfig(tier);
  const nextTier = getNextTier(tier);

  const pressureTexts = [
    percentile > 90 ? "You're ahead — for now" : null,
    percentile > 50 && percentile <= 90 ? "Others are catching up" : null,
    percentile <= 50 ? "You're falling behind" : null,
  ].filter(Boolean);

  const isRising = percentile > 75;
  const isFalling = percentile < 30;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 relative overflow-hidden",
        config.borderClass,
        config.glowClass,
        className
      )}
      style={{ background: "linear-gradient(135deg, hsl(255 14% 7% / 0.8), hsl(260 18% 4% / 0.9))" }}
    >
      {/* Ambient tier glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: tier === 'legend'
            ? "linear-gradient(135deg, hsl(280 70% 60% / 0.15), hsl(42 78% 54% / 0.08), transparent 60%)"
            : tier === 'apex'
            ? "linear-gradient(135deg, hsl(18 95% 58% / 0.12), hsl(42 78% 54% / 0.06), transparent 60%)"
            : tier === 'elite'
            ? "linear-gradient(135deg, hsl(42 78% 54% / 0.1), transparent 60%)"
            : "linear-gradient(135deg, hsl(var(--purple) / 0.06), transparent 60%)",
        }}
      />

      <div className="relative">
        {/* Rank position */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg font-display font-black text-lg",
              tier === 'legend' ? "bg-gradient-to-br from-[hsl(280_70%_55%)] to-gold text-white" :
              tier === 'apex' ? "bg-gradient-to-br from-[hsl(18_95%_58%)] to-gold text-white" :
              tier === 'elite' ? "gradient-gold text-primary-foreground" :
              "bg-secondary text-foreground"
            )}>
              #{rank || "?"}
            </div>
            <div>
              <p className="font-display font-bold text-sm">Your Position</p>
              <p className="text-xs text-muted-foreground">
                Ahead of <span className={cn("font-bold", config.textClass)}>{percentile}%</span> of users
              </p>
            </div>
          </div>
          {isRising ? (
            <TrendingUp size={18} className="text-emerald-400" />
          ) : isFalling ? (
            <TrendingDown size={18} className="text-destructive" />
          ) : (
            <TrendingUp size={18} className="text-gold/50" />
          )}
        </div>

        {/* Pressure microcopy */}
        <div className={cn(
          "rounded-lg px-3 py-2 text-xs font-semibold text-center mb-3",
          isFalling ? "bg-destructive/10 text-destructive border border-destructive/20" :
          isRising ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
          "bg-gold/5 text-gold/80 border border-gold/15"
        )}>
          {isFalling && <AlertTriangle size={12} className="inline mr-1" />}
          {pressureTexts[0] || config.pressureMessage}
        </div>

        {/* Next tier progress */}
        {nextTier && (
          <div className="flex items-center gap-2">
            <ChevronUp size={14} className="text-muted-foreground/50" />
            <p className="text-[10px] text-muted-foreground flex-1">
              Next: <span className="font-bold text-foreground">{nextTier.label}</span>
              <span className="text-muted-foreground/60"> ({nextTier.percentile})</span>
            </p>
          </div>
        )}

        {rankScore !== undefined && (
          <p className="text-[9px] text-muted-foreground/40 mt-2 text-right tabular-nums">
            Score: {rankScore.toFixed(1)}
          </p>
        )}
      </div>
    </div>
  );
};

export default RankPressureCard;
