import { motion } from "framer-motion";
import { Zap, Flame, Trophy, ArrowUp, Crown, Target, TrendingUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTierConfig } from "@/lib/status-tiers";
import XpCounter from "@/components/XpCounter";
import { Button } from "@/components/ui/button";
import CoachLine from "@/components/coach/CoachLine";
import { useCoachObservation } from "@/hooks/use-coach-observation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AnimatedNumber from "@/components/AnimatedNumber";

interface CheckinTierSummaryProps {
  tier: string;
  summary: {
    xpEarned: number;
    newTotalXp: number;
    oldLevel: number;
    newLevel: number;
    xpToNextLevel: number;
    levelProgressPct: number;
    newStreak: number;
    streakBroken: boolean;
    completedCount: number;
    maxCount: number;
  };
  onProfile: () => void;
  onDashboard: () => void;
  /** Open W Coach primed with the day's feedback so the user can go deeper. */
  onAskCoach?: (seedText: string) => void;
}

/**
 * Bold, tier-specific post-submit recap.
 * Replaces the generic gold card with a full premium hero per tier.
 */
const CheckinTierSummary = ({ tier, summary, onProfile, onDashboard, onAskCoach }: CheckinTierSummaryProps) => {
  const cfg = getTierConfig(tier);
  const leveledUp = summary.newLevel > summary.oldLevel;
  const perfPct = Math.round((summary.completedCount / summary.maxCount) * 100);
  const isPerfect = perfPct >= 80;

  // Tier-specific styling
  const tierBg: Record<number, string> = {
    0: "from-secondary/30 via-background to-background",
    1: "from-[hsl(var(--teal))]/15 via-background to-background",
    2: "from-[hsl(210_90%_56%)]/15 via-background to-background",
    3: "from-[hsl(var(--purple))]/18 via-background to-background",
    4: "from-gold/20 via-background to-background",
    5: "from-[hsl(var(--ember))]/25 via-gold/10 to-background",
    6: "from-[hsl(280_70%_55%)]/22 via-gold/10 to-[hsl(350_80%_55%)]/15",
  };
  const tierAccent: Record<number, { ring: string; glow: string; iconBg: string }> = {
    0: { ring: "ring-border/40", glow: "", iconBg: "bg-secondary text-muted-foreground" },
    1: { ring: "ring-[hsl(var(--teal))]/50", glow: "shadow-[0_0_24px_hsl(var(--teal)/0.30)]", iconBg: "bg-[hsl(var(--teal))]/20 text-[hsl(var(--teal))]" },
    2: { ring: "ring-[hsl(210_90%_56%)]/50", glow: "shadow-[0_0_24px_hsl(210_90%_56%/0.30)]", iconBg: "bg-[hsl(210_90%_56%)]/20 text-[hsl(210_90%_56%)]" },
    3: { ring: "ring-[hsl(var(--purple))]/55", glow: "shadow-[0_0_28px_hsl(var(--purple)/0.35)]", iconBg: "bg-[hsl(var(--purple))]/20 text-[hsl(var(--purple))]" },
    4: { ring: "ring-gold/55", glow: "shadow-[0_0_30px_hsl(var(--gold)/0.45)]", iconBg: "gradient-gold text-primary-foreground" },
    5: { ring: "ring-[hsl(var(--ember))]/65", glow: "shadow-[0_0_38px_hsl(var(--ember)/0.5),0_0_60px_hsl(var(--gold)/0.30)]", iconBg: "bg-gradient-to-br from-[hsl(var(--ember))] to-gold text-background" },
    6: { ring: "ring-[hsl(280_70%_60%)]/65", glow: "shadow-[0_0_42px_hsl(280_70%_60%/0.55)]", iconBg: "bg-gradient-to-br from-[hsl(280_70%_55%)] via-gold to-[hsl(350_80%_55%)] text-background" },
  };

  const bg = tierBg[cfg.rank] ?? tierBg[0];
  const accent = tierAccent[cfg.rank] ?? tierAccent[0];

  // Aggressive headline depending on result
  const headline = leveledUp
    ? "LEVEL UNLOCKED"
    : isPerfect
    ? "PERFECT DAY LOGGED"
    : summary.streakBroken
    ? "STREAK RESET — REBUILD"
    : "DAY LOCKED IN";

  const subline = leveledUp
    ? `Welcome to Level ${summary.newLevel}. Don't waste it.`
    : isPerfect
    ? "Top operators stack days like this."
    : summary.streakBroken
    ? "Start the new chain. Today is day 1."
    : `Day ${summary.newStreak} of your chain. Keep building.`;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-5 py-5 text-center relative overflow-hidden safe-top">
      {/* Tier-specific radial glow */}
      <div className={cn("absolute inset-0 pointer-events-none bg-gradient-to-br", bg)} />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            cfg.rank >= 5
              ? "radial-gradient(circle at 50% 30%, hsl(var(--ember) / 0.18) 0%, transparent 60%)"
              : cfg.rank >= 4
              ? "radial-gradient(circle at 50% 30%, hsl(var(--gold) / 0.15) 0%, transparent 60%)"
              : "radial-gradient(circle at 50% 30%, hsl(var(--gold) / 0.08) 0%, transparent 60%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Tier ribbon */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-1.5 mb-3"
        >
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] uppercase tracking-[0.22em] font-black ring-1",
              accent.ring,
              cfg.rank >= 5
                ? "bg-background/60 text-foreground"
                : "bg-background/60 text-foreground/80",
            )}
          >
            {cfg.rank >= 5 && <Flame size={10} strokeWidth={3} fill="currentColor" className="text-[hsl(var(--ember))]" />}
            {cfg.rank === 6 && <Sparkles size={10} strokeWidth={3} className="text-gold" />}
            {cfg.label} Tier
          </span>
        </motion.div>

        {/* Hero icon */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.15 }}
          className={cn(
            "h-[72px] w-[72px] rounded-full flex items-center justify-center mx-auto mb-3 relative",
            accent.iconBg,
            accent.glow,
          )}
        >
          {leveledUp ? (
            <Trophy size={34} strokeWidth={2.4} />
          ) : cfg.rank >= 5 ? (
            <Flame size={34} strokeWidth={2.4} fill="currentColor" />
          ) : (
            <Zap size={34} strokeWidth={2.4} fill="currentColor" />
          )}
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="font-display text-[26px] font-black tracking-tight uppercase leading-none mb-1"
        >
          {headline}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-xs text-muted-foreground font-bold mb-4"
        >
          {subline}
        </motion.p>

        {/* XP earned hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className={cn(
            "rounded-2xl border-2 p-4 mb-3 inner-light relative overflow-hidden",
            cfg.rank >= 5
              ? "border-gold/50 bg-gradient-to-br from-[hsl(var(--ember))]/10 via-gold/8 to-transparent"
              : cfg.rank === 4
              ? "border-gold/40 bg-gold/8"
              : "border-gold/30 bg-gold/5",
          )}
        >
          {/* Shimmer for premium tiers */}
          {cfg.rank >= 4 && (
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(115deg,transparent_30%,hsl(var(--gold)/0.18)_50%,transparent_70%)] [background-size:200%_100%] [animation:shimmer-slide_3.5s_linear_infinite]" />
          )}
          <p className="relative text-[10px] uppercase tracking-[0.22em] text-gold/80 font-black mb-1">
            Experience earned
          </p>
          <div className="relative flex items-baseline justify-center gap-1">
            <span className="text-gold font-display text-5xl font-black glow-gold-text">+</span>
            <XpCounter value={summary.xpEarned} className="text-gold font-display text-5xl font-black glow-gold-text" />
          </div>
          <p className="relative text-[11px] text-muted-foreground mt-2">
            <span className="font-bold text-foreground/80 tabular-nums">{summary.completedCount}/{summary.maxCount}</span> tasks · <span className={cn("font-bold tabular-nums", isPerfect ? "text-gold" : "text-foreground/70")}>{perfPct}%</span> output
          </p>
        </motion.div>

        {/* Level + Streak grid */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-2 gap-2 mb-3"
        >
          {/* Level */}
          <div
            className={cn(
              "rounded-xl border-2 p-3 text-left transition-all relative overflow-hidden",
              leveledUp
                ? "border-gold/60 bg-gold/12 shadow-[0_0_18px_hsl(var(--gold)/0.4)]"
                : "border-border bg-card",
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy size={12} className={leveledUp ? "text-gold" : "text-muted-foreground"} />
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-black">Level</p>
              {leveledUp && (
                <motion.span
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className="ml-auto flex items-center gap-0.5 text-[9px] font-black text-gold"
                >
                  <ArrowUp size={10} strokeWidth={3} />UP
                </motion.span>
              )}
            </div>
            <AnimatedNumber
              value={summary.newLevel}
              duration={700}
              className={cn("font-display text-3xl font-black leading-none block", leveledUp ? "text-gold" : "text-foreground")}
            />
            <div className="mt-2 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${summary.levelProgressPct}%` }}
                transition={{ delay: 0.7, duration: 0.8 }}
                className={cn("h-full rounded-full", leveledUp ? "bg-gradient-to-r from-gold to-gold-light" : "bg-foreground/40")}
              />
            </div>
            <p className="text-[9px] text-muted-foreground mt-1 tabular-nums font-bold">
              {summary.xpToNextLevel} XP to next
            </p>
          </div>

          {/* Streak */}
          <div
            className={cn(
              "rounded-xl border-2 p-3 text-left transition-all relative overflow-hidden",
              summary.streakBroken
                ? "border-destructive/50 bg-destructive/12"
                : summary.newStreak >= 30
                ? "border-gold/60 bg-gold/12 shadow-[0_0_18px_hsl(var(--gold)/0.4)]"
                : summary.newStreak >= 14
                ? "border-[hsl(var(--ember))]/55 bg-[hsl(var(--ember))]/10 shadow-[0_0_14px_hsl(var(--ember)/0.3)]"
                : "border-streak-orange/40 bg-streak-orange/8",
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Flame
                size={12}
                fill="currentColor"
                className={
                  summary.streakBroken
                    ? "text-destructive"
                    : summary.newStreak >= 30
                    ? "text-gold"
                    : summary.newStreak >= 14
                    ? "text-[hsl(var(--ember))]"
                    : "text-streak-orange"
                }
              />
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-black">Streak</p>
            </div>
            <p
              className={cn(
                "font-display text-3xl font-black tabular-nums leading-none",
                summary.streakBroken
                  ? "text-destructive"
                  : summary.newStreak >= 30
                  ? "text-gold"
                  : summary.newStreak >= 14
                  ? "text-[hsl(var(--ember))]"
                  : "text-streak-orange",
              )}
            >
              <AnimatedNumber value={summary.newStreak} duration={800} />
              <span className="text-base font-bold opacity-60">d</span>
            </p>
            <p className="text-[9px] text-muted-foreground mt-2 font-bold uppercase tracking-wider">
              {summary.streakBroken
                ? "Reset · Day 1"
                : summary.newStreak >= 30
                ? "Legendary chain"
                : summary.newStreak >= 14
                ? "On fire 🔥"
                : "Hold the chain"}
            </p>
          </div>
        </motion.div>

        {/* Total XP bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className={cn(
            "rounded-xl border bg-card/60 p-3 mb-4 flex items-center justify-between",
            cfg.rank >= 5 ? "border-gold/30" : "border-border",
          )}
        >
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-black">
            <Target size={11} strokeWidth={3} />
            Total XP
          </span>
          <span className="font-display text-xl font-black tabular-nums">
            {summary.newTotalXp.toLocaleString()}
          </span>
        </motion.div>

        {/* Coach reaction — one short line in the user's tone right above
            the CTAs. Pure derivation from cached LifeOS brief data, no
            extra AI call. Wrapped in ErrorBoundary so a hook fault can
            never break the post-checkin celebration screen. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mb-3"
        >
          <ErrorBoundary fallback={<></>}>
            <PostCheckinCoachLine summary={summary} onAskCoach={onAskCoach} />
          </ErrorBoundary>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="grid grid-cols-2 gap-2"
        >
          <Button variant="gold-outline" size="lg" onClick={onProfile}>
            View Profile
          </Button>
          <Button variant="ember" size="lg" onClick={onDashboard}>
            Dashboard
          </Button>
        </motion.div>

        {/* Apex/Legend extra crown */}
        {cfg.rank >= 5 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-4 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.22em] font-black text-gold"
          >
            <Crown size={11} strokeWidth={3} />
            {cfg.rank === 6 ? "Founders Circle is watching" : "Apex doesn't skip days"}
            <Crown size={11} strokeWidth={3} />
          </motion.p>
        )}
      </div>
    </div>
  );
};

/** Scoped Coach line for the post-checkin celebration screen.
 *
 * Tries a REAL personalized reaction first (coach-reaction edge fn — the
 * user's tone + today's actual numbers + their authored "why"), and falls
 * back to the deterministic template while loading or on ANY failure
 * (offline / non-member / provider down), so the celebration never breaks. */
const PostCheckinCoachLine = ({
  summary,
  onAskCoach,
}: {
  summary: CheckinTierSummaryProps["summary"];
  onAskCoach?: (seedText: string) => void;
}) => {
  const { text: fallback, isLoading } = useCoachObservation({ context: "post-checkin" });

  const { data: aiText } = useQuery({
    // Keyed on the day's totals so a re-render never re-invokes; one AI call
    // per check-in.
    queryKey: ["checkin-reaction", summary.newTotalXp, summary.newStreak],
    staleTime: Infinity,
    gcTime: 60 * 60_000,
    retry: false,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.functions.invoke("coach-reaction", {
        body: {
          xp_earned: summary.xpEarned,
          tasks_done: summary.completedCount,
          tasks_total: summary.maxCount,
          streak: summary.newStreak,
        },
      });
      if (error) return null;
      const t = (data as { text?: string } | null)?.text;
      return typeof t === "string" && t.trim() ? t.trim() : null;
    },
  });

  const text = aiText || fallback;
  if ((isLoading && !aiText) || !text) return null;
  // Only make it a chat entry point when a REAL coach reaction rendered (aiText).
  // The deterministic fallback means no coach access, so opening chat would 403.
  const canContinue = !!aiText && !!onAskCoach;
  return (
    <div className="space-y-1">
      <CoachLine
        text={text}
        tone="celebration"
        onClick={canContinue ? () => onAskCoach!(aiText!) : undefined}
      />
      {canContinue && (
        <p className="text-[10px] font-bold text-xp-green/80 pl-3.5 flex items-center gap-1">
          Tap to ask the Coach how to improve →
        </p>
      )}
    </div>
  );
};

export default CheckinTierSummary;
