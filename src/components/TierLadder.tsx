import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Check, ChevronRight, Crown, TrendingUp, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TIER_CONFIG, TIER_ORDER, getTierConfig, type StatusTier } from "@/lib/status-tiers";

interface TierLadderProps {
  currentTier: string;
  className?: string;
}

/** Per-tier visual escalation classes — intensity grows with rank. */
const TIER_ROW_STYLE: Record<number, { base: string; accent: string; height: string }> = {
  0: { base: "border-border/40 bg-secondary/30", accent: "bg-muted/40 text-muted-foreground", height: "min-h-[52px]" },
  1: { base: "border-[hsl(var(--teal))]/30 bg-[hsl(var(--teal))]/[0.04] shadow-[0_0_10px_hsl(var(--teal)/0.08)]", accent: "bg-[hsl(var(--teal))]/15 text-[hsl(var(--teal))]", height: "min-h-[54px]" },
  2: { base: "border-[hsl(210_90%_56%)]/35 bg-gradient-to-r from-[hsl(210_90%_56%)]/[0.06] to-transparent shadow-[0_0_14px_hsl(210_90%_56%/0.12)]", accent: "bg-[hsl(210_90%_56%)]/15 text-[hsl(210_90%_56%)]", height: "min-h-[56px]" },
  3: { base: "border-[hsl(var(--purple))]/40 bg-[hsl(var(--purple))]/[0.06] shadow-[0_0_18px_hsl(var(--purple)/0.18)]", accent: "bg-[hsl(var(--purple))]/15 text-[hsl(var(--purple))]", height: "min-h-[58px]" },
  4: { base: "border-gold/50 bg-gold/[0.06] shadow-[0_0_22px_hsl(var(--gold)/0.22)]", accent: "gradient-gold text-primary-foreground", height: "min-h-[62px]" },
  5: { base: "apex-conic-border bg-gradient-to-br from-[hsl(18_95%_58%)]/[0.10] to-gold/[0.08] shadow-[0_0_26px_hsl(18_95%_58%/0.28)]", accent: "bg-gradient-to-br from-[hsl(18_95%_58%)] to-gold text-background", height: "min-h-[68px]" },
  6: { base: "apex-conic-border bg-gradient-to-br from-[hsl(280_70%_55%)]/[0.12] via-gold/[0.08] to-[hsl(350_80%_55%)]/[0.12] shadow-[0_0_32px_hsl(280_70%_60%/0.35)]", accent: "bg-gradient-to-br from-[hsl(280_70%_55%)] via-gold to-[hsl(350_80%_55%)] text-background", height: "min-h-[72px]" },
};

const TierLadder = ({ currentTier, className }: TierLadderProps) => {
  const [openTier, setOpenTier] = useState<StatusTier | null>(null);
  const currentRank = getTierConfig(currentTier).rank;

  return (
    <div className={cn("rounded-2xl glass-card p-4 relative overflow-hidden", className)}>
      {/* Header */}
      <div className="relative flex items-center justify-between mb-1">
        <div>
          <p className="font-display font-black text-sm uppercase tracking-widest bg-gradient-to-r from-foreground via-gold to-foreground bg-clip-text text-transparent">
            Your Ascension
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">7 levels of dominance</p>
        </div>
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="text-gold"
        >
          <Crown size={16} strokeWidth={2.4} />
        </motion.div>
      </div>

      {/* Gold divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent mb-4" />

      {/* Ladder with vertical progress track */}
      <div className="relative">
        {/* vertical progress line — left rail */}
        <div className="absolute left-[27px] top-3 bottom-3 w-[2px] pointer-events-none">
          <div className="absolute inset-0 bg-border/40 rounded-full" />
          <div
            className="absolute top-0 left-0 right-0 rounded-full bg-gradient-to-b from-gold via-gold/80 to-gold/30 shadow-[0_0_8px_hsl(var(--gold)/0.5)]"
            style={{ height: `${(currentRank / (TIER_ORDER.length - 1)) * 100}%` }}
          />
        </div>

        <div className="space-y-1.5 relative">
          {TIER_ORDER.map((tierKey, idx) => {
            const cfg = TIER_CONFIG[tierKey];
            const isCurrent = cfg.rank === currentRank;
            const isUnlocked = cfg.rank <= currentRank;
            const isLocked = cfg.rank > currentRank;
            const style = TIER_ROW_STYLE[cfg.rank] ?? TIER_ROW_STYLE[0];
            const stepsAway = cfg.rank - currentRank;

            return (
              <motion.button
                type="button"
                key={tierKey}
                onClick={() => setOpenTier(tierKey)}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className={cn(
                  "group relative w-full flex items-center gap-3 rounded-xl border p-3 text-left active:scale-[0.99] transition-all overflow-hidden",
                  style.height,
                  style.base,
                  isCurrent && "tier-shimmer-sweep ring-1 ring-gold/60",
                  isLocked && "opacity-95",
                )}
              >
                {/* ── Current tier embers (only Apex/Legend rows when current) ── */}
                {isCurrent && cfg.rank >= 5 && <span className="apex-embers absolute inset-0 pointer-events-none" />}

                {/* Pulsing "you are here" dot on the rail */}
                {isCurrent && (
                  <motion.span
                    aria-hidden
                    className="absolute -left-[3px] top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-gold shadow-[0_0_12px_hsl(var(--gold)/0.9)]"
                    animate={{ scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}

                {/* Tier icon block */}
                <div
                  className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center font-black text-xs shrink-0 relative z-10 transition-transform group-hover:scale-105",
                    isCurrent
                      ? style.accent
                      : isUnlocked
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                      : cn("bg-background/40 border border-gold/25", cfg.textClass),
                  )}
                >
                  {isCurrent ? (
                    cfg.shortLabel
                  ) : isUnlocked ? (
                    <Check size={15} strokeWidth={3} />
                  ) : isLocked && cfg.rank >= 5 ? (
                    // Silhouette: keep tier label visible on premium locked rows
                    <span className="opacity-70">{cfg.shortLabel}</span>
                  ) : (
                    <Lock size={13} className="opacity-70" />
                  )}
                </div>

                {/* Label + percentile */}
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className={cn(
                        "font-display font-black text-sm leading-tight",
                        isCurrent ? cfg.textClass : isUnlocked ? "text-foreground" : "text-foreground/85",
                      )}
                    >
                      {cfg.label}
                    </p>
                    {isCurrent && (
                      <span className="text-[8px] uppercase tracking-[0.18em] font-black text-background bg-gradient-to-r from-gold to-gold-light px-1.5 py-[2px] rounded-sm shadow-[0_0_8px_hsl(var(--gold)/0.5)] flex items-center gap-1">
                        <span className="h-1 w-1 rounded-full bg-background animate-pulse" />
                        Current Tier
                      </span>
                    )}
                  </div>
                  <p className={cn("text-[10px] truncate mt-0.5", isLocked ? "text-muted-foreground/80" : "text-muted-foreground")}>
                    {cfg.percentile}
                  </p>
                </div>

                {/* Right side: locked hint OR chevron */}
                {isLocked ? (
                  <div className="flex items-center gap-1.5 shrink-0 relative z-10">
                    <span className={cn(
                      "inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded",
                      cfg.rank >= 5
                        ? "text-gold border border-gold/40 bg-gold/5"
                        : "text-muted-foreground border border-border/50 bg-background/20",
                    )}>
                      <TrendingUp size={9} strokeWidth={3} />
                      {stepsAway === 1 ? "Next" : `+${stepsAway}`}
                    </span>
                  </div>
                ) : (
                  <ChevronRight size={14} className="text-muted-foreground/50 shrink-0 relative z-10 group-hover:translate-x-0.5 transition-transform" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ─────── Detail dialog ─────── */}
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
