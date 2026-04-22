import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Check, ChevronRight, Crown, TrendingUp, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TIER_CONFIG, TIER_ORDER, getTierConfig, type StatusTier } from "@/lib/status-tiers";

interface TierLadderProps {
  currentTier: string;
  className?: string;
}

/**
 * Per-tier visual escalation classes — intensity grows with rank.
 * Light cleanup: kept colors + heights; replaced animated borders/shimmer
 * on the top tiers with strong static gradient borders + glow shadows.
 */
const TIER_ROW_STYLE: Record<number, { base: string; accent: string; height: string }> = {
  0: { base: "border-border/40 bg-secondary/30", accent: "bg-muted/40 text-muted-foreground", height: "min-h-[52px]" },
  1: { base: "border-[hsl(var(--teal))]/30 bg-[hsl(var(--teal))]/[0.04] shadow-[0_0_10px_hsl(var(--teal)/0.08)]", accent: "bg-[hsl(var(--teal))]/15 text-[hsl(var(--teal))]", height: "min-h-[54px]" },
  2: { base: "border-[hsl(210_90%_56%)]/35 bg-gradient-to-r from-[hsl(210_90%_56%)]/[0.06] to-transparent shadow-[0_0_14px_hsl(210_90%_56%/0.12)]", accent: "bg-[hsl(210_90%_56%)]/15 text-[hsl(210_90%_56%)]", height: "min-h-[56px]" },
  3: { base: "border-[hsl(var(--purple))]/40 bg-[hsl(var(--purple))]/[0.06] shadow-[0_0_18px_hsl(var(--purple)/0.18)]", accent: "bg-[hsl(var(--purple))]/15 text-[hsl(var(--purple))]", height: "min-h-[58px]" },
  4: { base: "border-gold/50 bg-gold/[0.06] shadow-[0_0_22px_hsl(var(--gold)/0.22)]", accent: "gradient-gold text-primary-foreground", height: "min-h-[62px]" },
  5: { base: "border-[hsl(18_95%_58%)]/60 bg-gradient-to-br from-[hsl(18_95%_58%)]/[0.10] to-gold/[0.08] shadow-[0_0_22px_hsl(18_95%_58%/0.25)]", accent: "bg-gradient-to-br from-[hsl(18_95%_58%)] to-gold text-background", height: "min-h-[68px]" },
  6: { base: "border-[hsl(280_70%_60%)]/55 bg-gradient-to-br from-[hsl(280_70%_55%)]/[0.12] via-gold/[0.08] to-[hsl(350_80%_55%)]/[0.12] shadow-[0_0_26px_hsl(280_70%_60%/0.28)]", accent: "bg-gradient-to-br from-[hsl(280_70%_55%)] via-gold to-[hsl(350_80%_55%)] text-background", height: "min-h-[72px]" },
};

const TierLadder = ({ currentTier, className }: TierLadderProps) => {
  const [openTier, setOpenTier] = useState<StatusTier | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const currentRank = getTierConfig(currentTier).rank;

  // Open dialog automatically when ?tier=<key> is present in URL
  useEffect(() => {
    const t = searchParams.get("tier");
    if (t && t in TIER_CONFIG) {
      setOpenTier(t as StatusTier);
      // strip the param so reopening requires a fresh navigation
      const next = new URLSearchParams(searchParams);
      next.delete("tier");
      setSearchParams(next, { replace: true });
      // smooth-scroll into view so the user sees the ladder behind the dialog
      setTimeout(() => {
        document.getElementById("tier-ladder-anchor")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className={cn("rounded-2xl glass-card p-4 relative overflow-hidden", className)}>
      {/* Ambient gold corner glows */}
      <div className="pointer-events-none absolute -top-16 -right-12 w-48 h-48 rounded-full bg-gold/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 w-48 h-48 rounded-full bg-[hsl(280_70%_55%)]/10 blur-3xl" />

      {/* Header — premium gold treatment */}
      <div className="relative flex items-center justify-between mb-2">
        <div className="relative">
          <p className="font-display font-black text-base uppercase tracking-widest bg-gradient-to-r from-gold-light via-gold to-gold-light bg-clip-text text-transparent drop-shadow-[0_0_12px_hsl(var(--gold)/0.35)]">
            Your Ascension
          </p>
          <p className="text-[10px] text-gold/85 mt-0.5 font-bold tracking-[0.18em] uppercase flex items-center gap-1">
            <Sparkles size={9} className="text-gold" strokeWidth={3} />
            7 levels of dominance
          </p>
        </div>
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gold/30 blur-md" />
          <div className="relative h-9 w-9 rounded-full bg-gradient-to-br from-gold-light via-gold to-[hsl(35_85%_45%)] flex items-center justify-center shadow-[0_0_14px_hsl(var(--gold)/0.55)] border border-gold-light/60">
            <Crown size={16} strokeWidth={2.6} className="text-background" />
          </div>
        </div>
      </div>

      {/* Gold divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-gold to-transparent mb-4 shadow-[0_0_8px_hsl(var(--gold)/0.5)]" />

      {/* Ladder with vertical progress track */}
      <div className="relative">
        {/* vertical progress line — left rail (static) */}
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
                  // Calm "current" treatment — static gold ring + glow, no shimmer
                  isCurrent && "ring-1 ring-gold/70 shadow-[0_0_18px_hsl(var(--gold)/0.35)]",
                  // Apex — gold sheen + extra glow
                  cfg.rank === 5 && "shadow-[0_0_28px_hsl(18_95%_58%/0.30),inset_0_1px_0_hsl(var(--gold)/0.30)]",
                  // Legend — jewel gradient + heavy glow
                  cfg.rank === 6 && "shadow-[0_0_34px_hsl(280_70%_60%/0.40),inset_0_1px_0_hsl(var(--gold)/0.45)]",
                  isLocked && "opacity-95",
                )}
              >
                {/* Apex / Legend — diagonal gold sheen overlay */}
                {(cfg.rank === 5 || cfg.rank === 6) && (
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,hsl(var(--gold)/0.18)_50%,transparent_70%)] opacity-60" />
                )}
                {/* Legend — extra corner sparkle */}
                {cfg.rank === 6 && (
                  <Sparkles size={10} className="absolute top-1.5 right-1.5 text-gold-light drop-shadow-[0_0_4px_hsl(var(--gold)/0.8)]" strokeWidth={2.6} />
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
                    // Apex / Legend icon block — premium border + glow even when locked
                    cfg.rank === 5 && !isCurrent && !isUnlocked && "border-[hsl(18_95%_58%)]/55 shadow-[0_0_10px_hsl(18_95%_58%/0.35)]",
                    cfg.rank === 6 && !isCurrent && !isUnlocked && "border-[hsl(280_70%_60%)]/55 shadow-[0_0_12px_hsl(280_70%_60%/0.45)]",
                  )}
                >
                  {isCurrent ? (
                    cfg.shortLabel
                  ) : isUnlocked ? (
                    <Check size={15} strokeWidth={3} />
                  ) : isLocked && cfg.rank >= 5 ? (
                    // Silhouette: keep tier label visible on premium locked rows
                    <span className="opacity-80 drop-shadow-[0_0_6px_hsl(var(--gold)/0.5)]">{cfg.shortLabel}</span>
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
                        // Apex — orange→gold gradient text
                        cfg.rank === 5 && !isCurrent && "bg-gradient-to-r from-[hsl(18_95%_62%)] via-gold to-[hsl(18_95%_62%)] bg-clip-text text-transparent",
                        // Legend — jewel gradient text
                        cfg.rank === 6 && !isCurrent && "bg-gradient-to-r from-[hsl(280_70%_70%)] via-gold to-[hsl(350_80%_65%)] bg-clip-text text-transparent",
                      )}
                    >
                      {cfg.label}
                    </p>
                    {isCurrent && (
                      <span className="text-[8px] uppercase tracking-[0.18em] font-black text-background bg-gradient-to-r from-gold to-gold-light px-1.5 py-[2px] rounded-sm shadow-[0_0_8px_hsl(var(--gold)/0.5)]">
                        Current Tier
                      </span>
                    )}
                    {/* Crown marker on Apex/Legend when locked */}
                    {!isCurrent && isLocked && cfg.rank === 5 && (
                      <Crown size={10} className="text-gold drop-shadow-[0_0_4px_hsl(var(--gold)/0.7)]" strokeWidth={2.8} />
                    )}
                    {!isCurrent && isLocked && cfg.rank === 6 && (
                      <span className="inline-flex items-center gap-0.5 text-[8px] uppercase tracking-[0.18em] font-black px-1.5 py-[2px] rounded-sm bg-gradient-to-r from-[hsl(280_70%_55%)] via-gold to-[hsl(350_80%_55%)] text-background shadow-[0_0_8px_hsl(280_70%_60%/0.55)]">
                        <Crown size={9} strokeWidth={3} /> Founder
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
                        ? "text-gold border border-gold/50 bg-gradient-to-r from-gold/10 to-gold/5 shadow-[0_0_6px_hsl(var(--gold)/0.3)]"
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
                      {openTier === 'legend' && (
                        <p className="text-xs flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border/40">
                          <Crown size={11} className="text-gold shrink-0" />
                          <span className="font-black text-gold uppercase tracking-wider text-[10px]">Founders Circle</span>
                          <span className="text-muted-foreground text-[10px]">— invite only</span>
                        </p>
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
