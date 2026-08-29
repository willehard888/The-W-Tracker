import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIER_CONFIG, TIER_ORDER, canonicalTier, getTierConfig, tierBandLabel } from "@/lib/status-tiers";

/**
 * The 7-rung ladder, compact — one row per tier with its band label and
 * the user's position. Used inside the status explainer (the heavier
 * animated TierLadder stays on its own surface).
 */
const TierLadderRows = ({ currentTier, className }: { currentTier: string; className?: string }) => {
  const currentRank = getTierConfig(currentTier).rank;
  const current = canonicalTier(currentTier);
  return (
    <div className={cn("space-y-1.5", className)}>
      {[...TIER_ORDER].reverse().map((key) => {
        const cfg = TIER_CONFIG[key];
        const isCurrent = key === current;
        const unlocked = cfg.rank <= currentRank;
        return (
          <div
            key={key}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5",
              isCurrent ? "border-gold/50 bg-gold/[0.07] shadow-[0_0_14px_hsl(var(--gold)/0.2)]" : "border-border/40 bg-card/40",
            )}
          >
            <span className="text-base leading-none w-6 text-center">{cfg.emoji}</span>
            <span className={cn("text-sm font-black", cfg.textClass)}>{cfg.label}</span>
            {isCurrent && <span className="text-[11px] font-black uppercase tracking-wider text-gold">You</span>}
            <span className="ml-auto text-[11px] font-black uppercase tracking-wider text-muted-foreground/70">{tierBandLabel(key)}</span>
            {unlocked ? <Check size={12} className="text-gold/70" /> : <Lock size={12} className="text-muted-foreground/40" />}
          </div>
        );
      })}
    </div>
  );
};

export default TierLadderRows;
