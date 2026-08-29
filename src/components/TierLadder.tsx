import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Check, ChevronRight, Crown, TrendingUp, Sparkles, Zap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/Portal";
import { TIER_CONFIG, TIER_ORDER, getTierConfig, type StatusTier } from "@/lib/status-tiers";
import { RedeemLegendInviteDialog } from "@/components/RedeemLegendInviteDialog";
interface TierLadderProps {
  currentTier: string;
  /** @deprecated Apex is earned-only — kept for backwards compatibility, not used. */
  className?: string;
}

/**
 * Per-tier visual escalation classes — intensity grows with rank.
 * Light cleanup: kept colors + heights; replaced animated borders/shimmer
 * on the top tiers with strong static gradient borders + glow shadows.
 */
const TIER_ROW_STYLE: Record<number, { base: string; accent: string; height: string }> = {
  0: { base: "border-border/40 bg-secondary/30", accent: "bg-muted/40 text-muted-foreground", height: "min-h-[60px]" },
  1: { base: "border-[hsl(var(--teal))]/30 bg-[hsl(var(--teal))]/[0.04] shadow-[0_0_10px_hsl(var(--teal)/0.08)]", accent: "bg-[hsl(var(--teal))]/15 text-[hsl(var(--teal))]", height: "min-h-[62px]" },
  2: { base: "border-[hsl(210_90%_56%)]/35 bg-gradient-to-r from-[hsl(210_90%_56%)]/[0.06] to-transparent shadow-[0_0_14px_hsl(210_90%_56%/0.12)]", accent: "bg-[hsl(210_90%_56%)]/15 text-[hsl(210_90%_56%)]", height: "min-h-[64px]" },
  3: { base: "border-[hsl(var(--purple))]/40 bg-[hsl(var(--purple))]/[0.06] shadow-[0_0_18px_hsl(var(--purple)/0.18)]", accent: "bg-[hsl(var(--purple))]/15 text-[hsl(var(--purple))]", height: "min-h-[66px]" },
  4: { base: "border-gold/50 bg-gold/[0.06] shadow-[0_0_22px_hsl(var(--gold)/0.22)]", accent: "gradient-gold text-primary-foreground", height: "min-h-[70px]" },
  5: { base: "border-[hsl(var(--ember))]/60 bg-gradient-to-br from-[hsl(var(--ember))]/[0.10] to-gold/[0.08] shadow-[0_0_22px_hsl(var(--ember)/0.25)]", accent: "bg-gradient-to-br from-[hsl(var(--ember))] to-gold text-background", height: "min-h-[76px]" },
  6: { base: "border-[hsl(280_70%_60%)]/55 bg-gradient-to-br from-[hsl(280_70%_55%)]/[0.12] via-gold/[0.08] to-[hsl(350_80%_55%)]/[0.12] shadow-[0_0_26px_hsl(280_70%_60%/0.28)]", accent: "bg-gradient-to-br from-[hsl(280_70%_55%)] via-gold to-[hsl(350_80%_55%)] text-background", height: "min-h-[80px]" },
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
    <div id="tier-ladder-anchor" className={cn("rounded-2xl glass-card p-4 relative overflow-hidden scroll-mt-20", className)}>
      {/* Ambient gold corner glows */}
      <div className="pointer-events-none absolute -top-16 -right-12 w-48 h-48 rounded-full bg-gold/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 w-48 h-48 rounded-full bg-[hsl(280_70%_55%)]/10 blur-3xl" />

      {/* Header — premium gold treatment */}
      <div className="relative flex items-center justify-between mb-2">
        <div className="relative">
          <p className="font-display font-black text-base uppercase tracking-widest bg-gradient-to-r from-gold-light via-gold to-gold-light bg-clip-text text-transparent drop-shadow-[0_0_12px_hsl(var(--gold)/0.35)]">
            Your Ascension
          </p>
          <p className="text-[11px] text-gold/85 mt-0.5 font-bold tracking-[0.22em] uppercase flex items-center gap-1">
            <Sparkles size={11} className="text-gold" strokeWidth={3} />
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
                  cfg.rank === 5 && "shadow-[0_0_28px_hsl(var(--ember)/0.30),inset_0_1px_0_hsl(var(--gold)/0.30)]",
                  // Legend — jewel gradient + heavy glow
                  cfg.rank === 6 && "shadow-[0_0_34px_hsl(280_70%_60%/0.40),inset_0_1px_0_hsl(var(--gold)/0.45)]",
                  isLocked && "opacity-95",
                )}
              >
                {/* Apex / Legend — diagonal gold sheen overlay */}
                {(cfg.rank === 5 || cfg.rank === 6) && (
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,hsl(var(--gold)/0.18)_50%,transparent_70%)] opacity-60" />
                )}
                {/* Apex — 2 rising amber embers on the right edge */}
                {cfg.rank === 5 && (
                  <div aria-hidden className="pointer-events-none absolute inset-y-0 right-2 w-6 overflow-hidden">
                    <span
                      className="absolute bottom-0 right-1 w-[2px] h-[2px] rounded-full status-ember-rise"
                      style={{
                        background: "hsl(var(--ember))",
                        boxShadow: "0 0 4px hsl(var(--ember)), 0 0 8px hsl(var(--gold))",
                        animationDuration: "4.2s",
                      }}
                    />
                    <span
                      className="absolute bottom-0 right-3 w-[2px] h-[2px] rounded-full status-ember-rise"
                      style={{
                        background: "hsl(var(--gold))",
                        boxShadow: "0 0 4px hsl(var(--gold)), 0 0 8px hsl(var(--ember))",
                        animationDelay: "2.1s",
                        animationDuration: "4.2s",
                      }}
                    />
                  </div>
                )}
                {/* Legend — extra corner sparkle + 1 amber cinder */}
                {cfg.rank === 6 && (
                  <>
                    <Sparkles size={12} className="absolute top-1.5 right-1.5 text-gold-light drop-shadow-[0_0_4px_hsl(var(--gold)/0.8)]" strokeWidth={2.6} />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute bottom-0 right-6 w-[2.5px] h-[2.5px] rounded-full status-ember-rise"
                      style={{
                        background: "hsl(280 70% 70%)",
                        boxShadow: "0 0 5px hsl(280 70% 70%), 0 0 10px hsl(var(--gold))",
                        animationDuration: "6.5s",
                      }}
                    />
                  </>
                )}

                {/* Tier icon block */}
                <div
                  className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center font-black text-[13px] shrink-0 relative z-10 transition-transform group-hover:scale-105",
                    isCurrent
                      ? style.accent
                      : isUnlocked
                      ? "bg-xp-green/15 text-xp-green border border-xp-green/25"
                      : cn("bg-background/40 border border-gold/25", cfg.textClass),
                    cfg.rank === 5 && !isCurrent && !isUnlocked && "border-[hsl(var(--ember))]/55 shadow-[0_0_10px_hsl(var(--ember)/0.35)]",
                    cfg.rank === 6 && !isCurrent && !isUnlocked && "border-[hsl(280_70%_60%)]/55 shadow-[0_0_12px_hsl(280_70%_60%/0.45)]",
                  )}
                >
                  {isCurrent ? (
                    cfg.shortLabel
                  ) : isUnlocked ? (
                    <Check size={17} strokeWidth={3} />
                  ) : isLocked && cfg.rank >= 5 ? (
                    <span className="opacity-85 drop-shadow-[0_0_6px_hsl(var(--gold)/0.5)]">{cfg.shortLabel}</span>
                  ) : (
                    <Lock size={14} className="opacity-70" />
                  )}
                </div>

                {/* Label + percentile */}
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className={cn(
                        "font-display font-black text-[17px] leading-tight tracking-tight",
                        isCurrent ? cfg.textClass : isUnlocked ? "text-foreground" : "text-foreground/90",
                        cfg.rank === 5 && !isCurrent && "bg-gradient-to-r from-[hsl(18_95%_62%)] via-gold to-[hsl(18_95%_62%)] bg-clip-text text-transparent",
                        cfg.rank === 6 && !isCurrent && "bg-gradient-to-r from-[hsl(280_70%_70%)] via-gold to-[hsl(350_80%_65%)] bg-clip-text text-transparent",
                      )}
                    >
                      {cfg.label}
                    </p>
                    {isCurrent && (
                      <span className="relative text-[10px] uppercase tracking-[0.22em] font-black text-background bg-gradient-to-r from-gold to-gold-light px-1.5 py-[2px] rounded-sm shadow-[0_0_8px_hsl(var(--gold)/0.5)]">
                        Current
                        <span
                          aria-hidden
                          className="pointer-events-none absolute -inset-[2px] rounded-sm border border-gold/60 status-amber-ring-breathe"
                        />
                      </span>
                    )}
                    {!isCurrent && isLocked && cfg.rank === 5 && (
                      <Crown size={11} className="text-gold drop-shadow-[0_0_4px_hsl(var(--gold)/0.7)]" strokeWidth={2.8} />
                    )}
                    {!isCurrent && isLocked && cfg.rank === 6 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-[0.22em] font-black px-1.5 py-[2px] rounded-sm bg-gradient-to-r from-[hsl(280_70%_55%)] via-gold to-[hsl(350_80%_55%)] text-background shadow-[0_0_8px_hsl(280_70%_60%/0.55)]">
                        <Crown size={11} strokeWidth={3} /> Founder
                      </span>
                    )}
                  </div>
                  <p className={cn("text-[12px] font-semibold tracking-wide truncate mt-0.5", isLocked ? "text-muted-foreground/85" : "text-muted-foreground")}>
                    {cfg.requirements.percentile > 0
                      ? `Top ${(100 - cfg.requirements.percentile).toFixed(cfg.requirements.percentile >= 99 ? 1 : 0)}%`
                      : cfg.percentile}
                  </p>
                </div>

                {/* Right side: locked hint OR chevron */}
                {isLocked ? (
                  <div className="flex items-center gap-1.5 shrink-0 relative z-10">
                    {cfg.rank === 6 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-black px-2.5 py-1 rounded-md text-background bg-gradient-to-r from-[hsl(280_70%_55%)] via-gold to-[hsl(350_80%_55%)] border border-gold/60 shadow-[0_0_14px_hsl(280_70%_60%/0.55),inset_0_1px_0_hsl(var(--gold-light)/0.4)]">
                        <Crown size={11} strokeWidth={3.2} fill="currentColor" /> Invite
                      </span>
                    ) : cfg.rank === 5 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-black px-2.5 py-1 rounded-md text-background bg-gradient-to-r from-[hsl(var(--ember))] via-gold to-[hsl(var(--ember))] border border-gold shadow-[0_0_14px_hsl(var(--ember)/0.55),inset_0_1px_0_hsl(var(--gold-light)/0.5)]">
                        <Zap size={11} strokeWidth={3.2} fill="currentColor" /> Earn
                      </span>
                    ) : (
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-black px-2 py-1 rounded-md",
                        cfg.rank >= 4
                          ? "text-gold border border-gold/55 bg-gradient-to-r from-gold/15 to-gold/5 shadow-[0_0_8px_hsl(var(--gold)/0.35)]"
                          : "text-foreground/80 border border-border/60 bg-background/30",
                      )}>
                        <TrendingUp size={12} strokeWidth={3} />
                        {stepsAway === 1 ? "Next" : `+${stepsAway}`}
                      </span>
                    )}
                  </div>
                ) : (
                  <ChevronRight size={14} className="text-muted-foreground/50 shrink-0 relative z-10 group-hover:translate-x-0.5 transition-transform" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ─────── Detail dialog — premium tier-themed ─────── */}
      {openTier && (() => {
        const cfg = TIER_CONFIG[openTier];
        const unlocked = cfg.rank <= currentRank;
        const isLegend = openTier === "legend";
        const isApex = openTier === "apex";
        const rowStyle = TIER_ROW_STYLE[cfg.rank];

        const heroGlow = isLegend
          ? "radial-gradient(ellipse at top, hsl(280 70% 55% / 0.45), transparent 65%)"
          : isApex
          ? "radial-gradient(ellipse at top, hsl(var(--ember) / 0.45), hsl(var(--gold) / 0.25) 40%, transparent 70%)"
          : cfg.rank === 4
          ? "radial-gradient(ellipse at top, hsl(var(--gold) / 0.40), transparent 70%)"
          : cfg.rank === 3
          ? "radial-gradient(ellipse at top, hsl(270 60% 58% / 0.35), transparent 70%)"
          : cfg.rank === 2
          ? "radial-gradient(ellipse at top, hsl(210 90% 56% / 0.32), transparent 70%)"
          : cfg.rank === 1
          ? "radial-gradient(ellipse at top, hsl(var(--teal) / 0.30), transparent 70%)"
          : "radial-gradient(ellipse at top, hsl(var(--muted) / 0.25), transparent 70%)";

        return (
          <Portal>
            <div
              className="fixed inset-0 z-40 bg-black/[0.78] backdrop-blur-md"
              onClick={() => setOpenTier(null)}
              aria-hidden="true"
            />

            <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 pb-4 sm:top-6">
              <div
                className={cn(
                  "relative w-full max-w-sm rounded-2xl overflow-hidden border bg-card flex flex-col max-h-[calc(100dvh-2rem)] shadow-4",
                  rowStyle.base,
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenTier(null)}
                  aria-label="Close tier details"
                  className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-[background,color,box-shadow] duration-200 hover:bg-[hsl(0_0%_100%/0.06)] hover:text-foreground hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),inset_0_-1px_0_hsl(var(--border-strong)/0.7)] focus:outline-none"
                >
                  <X className="h-4 w-4" />
                </button>

                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 -top-12 h-48 opacity-90"
                  style={{ background: heroGlow }}
                />
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-foreground/25 to-transparent" />

                <div className="relative px-5 pt-6 pb-4 space-y-0 shrink-0">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={cn(
                        "h-14 w-14 rounded-2xl flex items-center justify-center font-display font-black text-base shadow-lg",
                        rowStyle.accent,
                      )}
                    >
                      {cfg.shortLabel}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className={cn("font-display font-black text-2xl leading-none", cfg.textClass)}>
                        {cfg.label}
                      </h2>
                      <p className="text-[12px] uppercase tracking-[0.22em] font-bold mt-1.5 text-muted-foreground">
                        {cfg.percentile} · Rank {cfg.rank}
                      </p>
                    </div>
                    {unlocked ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-xp-green/15 border border-xp-green/40 text-xp-green text-[10px] font-black uppercase tracking-wider">
                        <Check size={12} strokeWidth={3.5} /> Held
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background/40 border border-border text-muted-foreground text-[10px] font-black uppercase tracking-wider">
                        <Lock size={11} strokeWidth={3} /> Locked
                      </span>
                    )}
                  </div>

                  <p className="relative text-[12px] text-foreground/75 italic font-medium mt-3 leading-snug">
                    "{cfg.message}"
                  </p>
                </div>

                <div className="relative px-5 pb-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                  <div>
                    {/* Legend is invite-only — the rank/streak "requirements"
                        are unreachable and misleading, so hide them and show
                        only the Founders Circle banner below. */}
                    {!isLegend && (
                      <>
                    <p className="text-[11px] uppercase tracking-[0.22em] font-black text-muted-foreground mb-2 flex items-center gap-1.5">
                      <TrendingUp size={11} /> Requirements
                    </p>
                    <div className="space-y-1.5">
                      {cfg.requirements.percentile > 0 && (
                        <div className="flex items-center gap-2.5 px-3 py-2 surface-inset rounded-lg">
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", unlocked ? "bg-xp-green" : "bg-foreground/40")} />
                          <span className="text-[12px] font-semibold flex-1">
                            Top <span className={cn("font-black tabular-nums", cfg.textClass)}>{(100 - cfg.requirements.percentile).toFixed(cfg.requirements.percentile >= 99 ? 1 : 0)}%</span> in rank score
                          </span>
                        </div>
                      )}
                      {/* OR-path tiers (High Performer, Elite) are earned by
                          rank OR the grind path — surface that so the rank
                          requirement doesn't read as mandatory. */}
                      {cfg.requirements.orPath && cfg.requirements.percentile > 0 && (cfg.requirements.activeDays > 0 || cfg.requirements.streak > 0) && (
                        <div className="flex items-center gap-2 py-0.5">
                          <span className="h-px flex-1 bg-border/50" />
                          <span className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">or</span>
                          <span className="h-px flex-1 bg-border/50" />
                        </div>
                      )}
                      {cfg.requirements.activeDays > 0 && (
                        <div className="flex items-center gap-2.5 px-3 py-2 surface-inset rounded-lg">
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", unlocked ? "bg-xp-green" : "bg-foreground/40")} />
                          <span className="text-[12px] font-semibold flex-1">
                            <span className={cn("font-black tabular-nums", cfg.textClass)}>{cfg.requirements.activeDays}</span> active days in last 30
                          </span>
                        </div>
                      )}
                      {cfg.requirements.streak > 0 && (
                        <div className="flex items-center gap-2.5 px-3 py-2 surface-inset rounded-lg">
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", unlocked ? "bg-xp-green" : "bg-foreground/40")} />
                          <span className="text-[12px] font-semibold flex-1">
                            <span className={cn("font-black tabular-nums", cfg.textClass)}>{cfg.requirements.streak}-day</span> current streak
                          </span>
                        </div>
                      )}
                      {cfg.requirements.percentile === 0 && (
                        <div className="px-3 py-2 surface-inset rounded-lg text-[12px] text-muted-foreground font-medium">
                          Default starting tier
                        </div>
                      )}
                    </div>
                      </>
                    )}

                    {isLegend && (
                      <div className="mt-2.5 flex items-center gap-2 px-3 py-2 rounded-lg border border-gold/45 bg-gradient-to-r from-[hsl(280_70%_55%)]/15 via-gold/10 to-[hsl(350_80%_55%)]/15 shadow-[0_0_18px_hsl(var(--gold)/0.20)]">
                        <Crown size={13} className="text-gold shrink-0" strokeWidth={2.6} />
                        <span className="font-black text-gold uppercase tracking-[0.22em] text-[11px]">Founders Circle</span>
                        <span className="text-foreground/60 text-[11px] font-semibold ml-auto">— invite only</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] font-black text-gold mb-2 flex items-center gap-1.5">
                      <Sparkles size={11} className="text-gold" /> Unlocks
                    </p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {cfg.unlocks.map((u) => (
                        <div
                          key={u}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gold/30 bg-gradient-to-r from-gold/8 to-transparent"
                        >
                          <div className="h-6 w-6 rounded-md bg-gold/15 border border-gold/40 flex items-center justify-center shrink-0">
                            <Sparkles size={11} className="text-gold" strokeWidth={2.6} />
                          </div>
                          <span className="text-[12px] font-semibold text-foreground/90">{u}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {unlocked ? (
                    <div className="rounded-lg p-3 text-center text-[12px] font-black bg-xp-green/12 text-xp-green border border-xp-green/30 uppercase tracking-wider flex items-center justify-center gap-2">
                      <Check size={13} strokeWidth={3.5} /> Achieved
                    </div>
                  ) : isLegend ? (
                    <div className="space-y-2">
                      <div className="rounded-lg p-3 text-center text-[12px] font-black bg-gradient-to-r from-[hsl(280_70%_55%)]/12 via-gold/12 to-[hsl(350_80%_55%)]/12 border border-gold/40 text-gold uppercase tracking-[0.22em]">
                        🔱 Invite only
                      </div>
                      <RedeemLegendInviteDialog
                        trigger={
                          <button className="w-full rounded-lg p-3 text-[12px] font-black bg-gradient-to-r from-[hsl(280_70%_55%)] via-gold to-[hsl(350_80%_55%)] text-background uppercase tracking-[0.22em] shadow-[0_0_22px_hsl(var(--gold)/0.35)] hover:brightness-110 transition inline-flex items-center justify-center gap-2">
                            <Crown size={13} fill="currentColor" /> Redeem invite code
                          </button>
                        }
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg p-3 text-center text-[12px] font-bold bg-muted/20 text-muted-foreground border border-border/50 uppercase tracking-wider flex items-center justify-center gap-2">
                      <Lock size={11} strokeWidth={3} /> Not yet earned
                    </div>
                  )}
                </div>

                <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
              </div>
            </div>
          </Portal>
        );
      })()}
    </div>
  );
};

export default TierLadder;
