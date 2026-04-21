import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Check, ChevronRight, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TIER_CONFIG, TIER_ORDER, getTierConfig, type StatusTier } from "@/lib/status-tiers";

interface TierLadderProps {
  currentTier: string;
  className?: string;
}

const TierLadder = ({ currentTier, className }: TierLadderProps) => {
  const [openTier, setOpenTier] = useState<StatusTier | null>(null);
  const currentRank = getTierConfig(currentTier).rank;

  return (
    <div className={cn("rounded-2xl glass-card p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-display font-black text-sm uppercase tracking-widest">Status Ladder</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">All 7 tiers · Tap to view rewards</p>
        </div>
        <Sparkles size={14} className="text-gold/70" />
      </div>

      <div className="space-y-1.5">
        {TIER_ORDER.map((tierKey, idx) => {
          const cfg = TIER_CONFIG[tierKey];
          const isCurrent = cfg.rank === currentRank;
          const isUnlocked = cfg.rank <= currentRank;
          const isLocked = cfg.rank > currentRank;

          return (
            <motion.button
              type="button"
              key={tierKey}
              onClick={() => setOpenTier(tierKey)}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.04 }}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border p-3 text-left active:scale-[0.99] transition-all",
                isCurrent
                  ? "border-gold/60 bg-gold/8 shadow-[0_0_20px_hsl(var(--gold)/0.25)]"
                  : isUnlocked
                  ? "border-border/50 bg-card/50"
                  : "border-border/30 bg-secondary/20 opacity-70",
              )}
            >
              <div
                className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center font-black text-xs shrink-0",
                  isCurrent
                    ? "gradient-gold text-primary-foreground"
                    : isUnlocked
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-muted/30 text-muted-foreground",
                )}
              >
                {isCurrent ? cfg.shortLabel : isUnlocked ? <Check size={14} /> : <Lock size={12} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn("font-display font-black text-sm", isCurrent ? "text-gold" : isUnlocked ? "text-foreground" : "text-muted-foreground")}>
                    {cfg.label}
                  </p>
                  {isCurrent && (
                    <span className="text-[9px] uppercase tracking-widest font-black text-gold/70 bg-gold/10 px-1.5 py-0.5 rounded">
                      You
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{cfg.percentile}</p>
              </div>

              <ChevronRight size={14} className="text-muted-foreground/50 shrink-0" />
            </motion.button>
          );
        })}
      </div>

      <Dialog open={!!openTier} onOpenChange={(o) => !o && setOpenTier(null)}>
        <DialogContent className="max-w-sm bg-background border-border/60">
          {openTier && (() => {
            const cfg = TIER_CONFIG[openTier];
            const unlocked = cfg.rank <= currentRank;
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center font-black", cfg.bgClass, cfg.textClass)}>
                      {cfg.shortLabel}
                    </div>
                    <div>
                      <DialogTitle className="font-display font-black text-xl">{cfg.label}</DialogTitle>
                      <DialogDescription className="text-xs">{cfg.percentile}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-1.5">
                      Requirements
                    </p>
                    <div className="space-y-1">
                      {cfg.requirements.percentile > 0 && (
                        <p className="text-xs">• Top {(100 - cfg.requirements.percentile).toFixed(cfg.requirements.percentile >= 99 ? 1 : 0)}% in rank score</p>
                      )}
                      {cfg.requirements.activeDays > 0 && (
                        <p className="text-xs">• {cfg.requirements.activeDays} active days in last 30</p>
                      )}
                      {cfg.requirements.streak > 0 && (
                        <p className="text-xs">• {cfg.requirements.streak}-day current streak</p>
                      )}
                      {cfg.requirements.percentile === 0 && (
                        <p className="text-xs text-muted-foreground">Default starting tier</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-gold mb-1.5">
                      Unlocks
                    </p>
                    <div className="space-y-1">
                      {cfg.unlocks.map((u) => (
                        <p key={u} className="text-xs flex items-center gap-1.5">
                          <Sparkles size={10} className="text-gold shrink-0" /> {u}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className={cn("rounded-lg p-2.5 text-center text-[11px] font-bold", unlocked ? "bg-emerald-500/10 text-emerald-400" : "bg-muted/20 text-muted-foreground")}>
                    {unlocked ? "✓ Achieved" : "🔒 Not yet earned"}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TierLadder;
