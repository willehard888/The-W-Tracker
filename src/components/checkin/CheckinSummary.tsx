import { motion } from "framer-motion";
import { Zap, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import XpCounter from "@/components/XpCounter";
import { Button } from "@/components/ui/button";
import CoachLine from "@/components/coach/CoachLine";
import StreakFlameInline from "@/components/StreakFlameInline";
import { useCoachObservation } from "@/hooks/use-coach-observation";
import { useAuth } from "@/contexts/AuthContext";
import { checkinReactionKey, fetchCheckinReaction } from "@/lib/checkin-reaction";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export interface CheckinSummaryData {
  xpEarned: number;
  newStreak: number;
  streakBroken: boolean;
  coreDone: number;
  coreTotal: number;
  extrasDone: number;
  /** Quiet one-liners: shield used/earned, streak reset, Health verified… */
  notes: string[];
}

interface CheckinSummaryProps {
  summary: CheckinSummaryData;
  /** Optional standing line from the status layer, e.g. "Standing: #12 · Top 4%". */
  standingLine?: string | null;
  onDone: () => void;
  onAskCoach?: (seedText: string) => void;
}

/**
 * Post-check-in recap — three numbers, one coach line, one CTA. The old
 * screen stacked eight numbers, a tier ribbon, two modals and five toasts.
 */
const CheckinSummary = ({ summary, standingLine, onDone, onAskCoach }: CheckinSummaryProps) => {
  const perfect = summary.coreDone === summary.coreTotal && summary.coreTotal > 0;
  const headline = summary.streakBroken ? "Day 1 of the new streak" : perfect ? "Core 4 logged" : "Day locked in";
  const subline = summary.streakBroken
    ? "The streak reset — today starts the next one."
    : perfect
    ? "All four core habits, logged."
    : `Day ${summary.newStreak}. Same time tomorrow.`;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-5 py-6 text-center relative overflow-hidden safe-top">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 28%, hsl(var(--gold) / 0.12) 0%, transparent 60%)" }} />

      <div className="relative w-full max-w-sm">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 18 }}
          className="h-16 w-16 rounded-full gradient-gold text-primary-foreground flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_hsl(var(--gold)/0.45)]"
        >
          <Zap size={30} strokeWidth={2.4} fill="currentColor" />
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="font-display text-[26px] font-black tracking-tight leading-none mb-1">
          {headline}
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="text-xs text-muted-foreground font-semibold mb-5">
          {subline}
        </motion.p>

        {/* 1 · XP earned */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="rounded-2xl border border-gold/35 bg-gold/[0.06] p-4 mb-3">
          <p className="eyebrow text-gold/80 mb-1">XP earned</p>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-gold font-display text-5xl font-black">+</span>
            <XpCounter value={summary.xpEarned} className="text-gold font-display text-5xl font-black" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 tabular-nums">
            Core <span className="font-bold text-foreground/80">{summary.coreDone}/{summary.coreTotal}</span>
            {" · "}Extras <span className="font-bold text-foreground/80">{summary.extrasDone}</span>
          </p>
        </motion.div>

        {/* 2 · Streak (+ 3 · optional standing) */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className={cn("grid gap-2 mb-3", standingLine ? "grid-cols-2" : "grid-cols-1")}>
          <div className="surface-card p-3.5 flex flex-col items-center">
            <StreakFlameInline streak={summary.newStreak} suffix=" days" className="text-[22px]" />
            <span className="eyebrow mt-1">Streak</span>
          </div>
          {standingLine && (
            <div className="surface-card p-3.5 flex flex-col items-center justify-center">
              <span className="font-display font-black text-[15px] leading-tight">{standingLine}</span>
              <span className="eyebrow mt-1">Standing</span>
            </div>
          )}
        </motion.div>

        {summary.notes.length > 0 && (
          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mb-3 space-y-1">
            {summary.notes.map((n) => (
              <li key={n} className="text-[11px] text-muted-foreground">{n}</li>
            ))}
          </motion.ul>
        )}

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-4 text-left">
          <ErrorBoundary fallback={<></>}>
            <PostCheckinCoachLine summary={summary} onAskCoach={onAskCoach} />
          </ErrorBoundary>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <Button variant="ember" size="xl" className="w-full group" onClick={onDone}>
            Back to Today
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

/** Coach reaction — instant template, AI upgrade in place (see checkin-reaction.ts). */
const PostCheckinCoachLine = ({ summary, onAskCoach }: { summary: CheckinSummaryData; onAskCoach?: (seed: string) => void }) => {
  const { user } = useAuth();
  const { text: fallback } = useCoachObservation({ context: "post-checkin" });
  const { data: aiText } = useQuery({
    queryKey: checkinReactionKey(user?.id ?? ""),
    enabled: !!user?.id,
    staleTime: Infinity,
    gcTime: 60 * 60_000,
    retry: false,
    queryFn: () =>
      fetchCheckinReaction({
        xp_earned: summary.xpEarned,
        tasks_done: summary.coreDone + summary.extrasDone,
        tasks_total: summary.coreTotal + summary.extrasDone,
        streak: summary.newStreak,
      }),
  });
  const text = aiText || fallback;
  if (!text) return null;
  const canContinue = !!onAskCoach;
  return (
    <div className="space-y-1">
      <motion.div key={text} initial={{ opacity: 0.55 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
        <CoachLine text={text} tone="celebration" onClick={canContinue ? () => onAskCoach!(text) : undefined} />
      </motion.div>
      {canContinue && (
        <p className="text-[11px] font-bold text-xp-green/80 pl-3.5">Tap to ask the Coach how to improve →</p>
      )}
    </div>
  );
};

export default CheckinSummary;
