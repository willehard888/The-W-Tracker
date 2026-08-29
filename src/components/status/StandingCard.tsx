import { Info, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTierConfig, topShareLabel, type LiveRankData } from "@/lib/status-tiers";
import { useNextTierProgress } from "@/hooks/use-next-tier-progress";
import NextTierProgress from "@/components/status/NextTierProgress";
import EmptyState from "@/components/ui/empty-state";
import { Target } from "lucide-react";

interface StandingCardProps {
  tier: string;
  rankData?: LiveRankData | null;
  /** rank_score — shown as "Consistency". */
  consistency?: number | null;
  onHowItWorks: () => void;
  /** Hero shows next-tier progress + ladder link; compact is the one-row cell. */
  variant?: "hero" | "compact";
  onOpenLadder?: () => void;
  className?: string;
}

/**
 * ONE card for "where do I stand" — replaces RankPressureCard + LiveRivals +
 * RoadToElite + the inline TierLadder entry (four cards about climbing).
 * Tier · #N of M · Top X% · Consistency · what's next.
 */
const StandingCard = ({ tier, rankData, consistency, onHowItWorks, variant = "hero", onOpenLadder, className }: StandingCardProps) => {
  const cfg = getTierConfig(tier);
  const progress = useNextTierProgress();
  const ranked = rankData?.hasRank === true && rankData.rank != null;
  const top = topShareLabel(tier, rankData);

  if (variant === "compact") {
    return (
      <button type="button" onClick={onHowItWorks} className={cn("surface-card p-3.5 text-left w-full active:scale-[0.99] transition-transform", className)}>
        <p className="eyebrow flex items-center gap-1">Standing <Info size={12} className="text-muted-foreground/60" /></p>
        <p className={cn("font-display font-black text-[17px] leading-tight mt-1", cfg.textClass)}>{cfg.label}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5 tabular-nums">
          {ranked ? `#${rankData!.rank!.toLocaleString()} of ${(rankData!.totalUsers ?? 0).toLocaleString()} · ${top}` : "Unranked · check in to enter"}
        </p>
      </button>
    );
  }

  return (
    <div className={cn("surface-card p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <p className="eyebrow">Standing</p>
        <button type="button" onClick={onHowItWorks} className="inline-flex items-center gap-1 text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors">
          <Info size={12} /> How it works
        </button>
      </div>

      {!ranked ? (
        <EmptyState size="compact" icon={Target} title="Unranked" description="Your first check-in puts you on the board." />
      ) : (
        <div className="flex items-end gap-4 mb-4">
          <div>
            <p className="font-display font-black text-[34px] leading-none tabular-nums">#{rankData!.rank!.toLocaleString()}</p>
            <p className="text-[12px] text-muted-foreground mt-1">of {(rankData!.totalUsers ?? 0).toLocaleString()} · {top}</p>
          </div>
          <div className="ml-auto text-right">
            <p className={cn("font-display font-black text-[17px] leading-none", cfg.textClass)}>{cfg.label}</p>
            {consistency != null && (
              <p className="text-[12px] text-muted-foreground mt-1 tabular-nums">Consistency <span className="font-bold text-foreground/85">{Math.round(consistency)}</span>/100</p>
            )}
          </div>
        </div>
      )}

      <NextTierProgress data={progress} />

      {onOpenLadder && (
        <button type="button" onClick={onOpenLadder} className="mt-4 w-full flex items-center justify-between text-[12px] font-bold text-gold">
          See the full ladder <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
};

export default StandingCard;
