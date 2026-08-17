import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dumbbell, HeartPulse, Brain, Repeat, Flame, Check, RotateCw, Sparkles,
} from "lucide-react";
import { useDailyPlan, type Mission, type MissionKind } from "@/hooks/use-daily-plan";
import ReadinessRing from "./ReadinessRing";
import ConfettiBurst from "@/components/ConfettiBurst";
import { Portal } from "@/components/ui/Portal";
import { hapticNotification, hapticImpact } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";

/**
 * TodaysPlanCard — surfaces the adaptive daily plan the coach already computes
 * (readiness score + push/hold/deload/swap adjustment + evidence-graded
 * missions) which until now was built end-to-end but never rendered. Missions
 * are tappable and award XP server-side via complete_coach_mission; the realtime
 * sub in useDailyPlan keeps done/total live. Turns the coach from "chat + a
 * one-liner" into "here's your data-driven plan for today — and I'll hold you to it."
 */

const ADJUST: Record<string, { label: string; tone: string }> = {
  push:   { label: "Push today",      tone: "text-xp-green" },
  hold:   { label: "Hold steady",     tone: "text-gold" },
  deload: { label: "Deload · recover", tone: "text-amber-400" },
  swap:   { label: "Recovery swap",   tone: "text-rose-400" },
};

const KIND_ICON: Record<MissionKind, React.ElementType> = {
  primary: Dumbbell,
  recovery: HeartPulse,
  focus: Brain,
  habit: Repeat,
  edge: Flame,
};

// Data-driven "why" — cites the real readiness components (self-reported sleep,
// last RPE, missed sessions). Honest: this engine reads check-in data, so we
// don't claim HealthKit verification here (RecoveryCard owns the verified layer).
const whyLine = (plan: { readiness_score: number; readiness_breakdown: Record<string, number | string> }) => {
  const b = plan.readiness_breakdown ?? {};
  const bits: string[] = [];
  if (b.avg_sleep_h != null) bits.push(`sleep ${b.avg_sleep_h}h avg`);
  if (b.last_rpe != null) bits.push(`last RPE ${b.last_rpe}`);
  if (typeof b.missed_7d === "number" && b.missed_7d > 0) bits.push(`${b.missed_7d} missed this week`);
  const reason = bits.length ? bits.join(" · ") : "your recent check-ins";
  return `Readiness ${plan.readiness_score} · ${reason}`;
};

const TodaysPlanCard = () => {
  const { plan, isLoading, completedIds, done, total, generate, completeMission } = useDailyPlan();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [needsMembership, setNeedsMembership] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [confetti, setConfetti] = useState(false);
  const autoTried = useRef(false);

  // Auto-generate today's plan once if none exists yet (cached per-day in
  // coach_daily_plans; the edge fn falls back to a rule-based plan without AI).
  useEffect(() => {
    if (isLoading || plan || generating || autoTried.current) return;
    autoTried.current = true;
    setGenerating(true);
    generate()
      .catch((e: any) => {
        // 403 = the plan engine is membership-gated while the Coach page
        // itself is open to all — show the upsell, not a dead CTA.
        if (e?.message === "membership_required") setNeedsMembership(true);
      })
      .finally(() => setGenerating(false));
  }, [isLoading, plan, generating, generate]);

  const regenerate = async () => {
    if (generating) return;
    hapticImpact("light");
    setGenerating(true);
    try {
      await generate();
      setNeedsMembership(false);
    } catch (e: any) {
      if (e?.message === "membership_required") {
        setNeedsMembership(true);
      } else {
        // Never show the raw "Edge Function returned a non-2xx…" string.
        toast.error("Couldn't refresh the plan — try again in a moment.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const onComplete = async (m: Mission) => {
    if (completedIds.has(m.id) || busy.has(m.id)) return;
    setBusy((s) => new Set(s).add(m.id));
    try {
      const res = await completeMission(m.id);
      void hapticNotification("success");
      // Celebrate finishing the whole plan. completedIds.size (not `done` from
      // the render closure) so two quick taps can't both read a stale count
      // and skip the celebration.
      if (total > 0 && completedIds.size + 1 >= total) {
        setConfetti(true);
        setTimeout(() => setConfetti(false), 1600);
      }
      toast.success(`+${res.xp_awarded} XP`);
    } catch (e: any) {
      toast.error(friendlyError(e, "Couldn't log that"));
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(m.id); return n; });
    }
  };

  // Loading / first-generation state.
  if ((isLoading || generating) && !plan) {
    return (
      <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] to-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles size={14} className="text-gold animate-pulse" />
          <p className="text-[13px] font-bold">Building today's plan…</p>
        </div>
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          Reading your recent recovery, training and streak.
        </p>
      </div>
    );
  }

  // Membership-gated — show the value + route to the paywall, never a dead CTA.
  if (!plan && needsMembership) {
    return (
      <button
        type="button"
        onClick={() => navigate("/paywall")}
        className="w-full text-left rounded-2xl border border-gold/30 bg-gradient-to-b from-gold/[0.06] to-card p-4 active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} className="text-gold" />
          <p className="text-[13px] font-bold">Your daily plan is a member feature</p>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          A readiness score + 3–5 missions fitted to how you're actually recovering —
          rebuilt for you every morning. Unlock full access.
        </p>
      </button>
    );
  }

  // No plan and generation failed — offer a manual build.
  if (!plan) {
    return (
      <button
        type="button"
        onClick={regenerate}
        className="w-full text-left rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] to-card p-4 active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} className="text-gold" />
          <p className="text-[13px] font-bold">Build today's plan</p>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Get a readiness read and 3–5 missions fitted to how you're actually recovering.
        </p>
      </button>
    );
  }

  const adjust = ADJUST[plan.adjustment] ?? ADJUST.hold;

  return (
    <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] to-card p-4">
      {/* Header — readiness ring + adjustment + why */}
      <div className="flex items-start gap-3">
        <ReadinessRing score={plan.readiness_score} size={58} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold">Today's plan</p>
            <button
              type="button"
              onClick={regenerate}
              disabled={generating}
              className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 active:scale-95 transition disabled:opacity-40"
              aria-label="Regenerate plan"
            >
              <RotateCw size={11} className={cn(generating && "animate-spin")} /> Refresh
            </button>
          </div>
          <p className={cn("text-[15px] font-black leading-tight mt-0.5", adjust.tone)}>{adjust.label}</p>
          {plan.headline && (
            <p className="text-[12px] text-foreground/85 leading-snug mt-0.5">{plan.headline}</p>
          )}
        </div>
      </div>

      {/* Data-driven "why" — the coach's read of the signals behind the call */}
      <p className="mt-2.5 text-[11px] text-muted-foreground/80 leading-snug border-l-2 border-gold/30 pl-2.5">
        {whyLine(plan)}
      </p>

      {/* Progress */}
      {total > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-secondary/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold to-[hsl(42_90%_70%)] transition-[width] duration-500"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
          <span className="text-[11px] font-black tabular-nums text-gold">{done}/{total}</span>
        </div>
      )}

      {/* Missions */}
      <div className="mt-3 space-y-2">
        {plan.missions.map((m) => {
          const Icon = KIND_ICON[m.kind] ?? Repeat;
          const isDone = completedIds.has(m.id);
          const isBusy = busy.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onComplete(m)}
              disabled={isDone || isBusy}
              className={cn(
                "w-full text-left rounded-xl border p-3 flex items-start gap-3 transition-all active:scale-[0.99]",
                isDone
                  ? "border-xp-green/30 bg-xp-green/[0.06]"
                  : "border-border/50 bg-card/50 hover:border-gold/30",
              )}
            >
              <span
                className={cn(
                  "shrink-0 h-7 w-7 rounded-lg flex items-center justify-center border transition-colors",
                  isDone ? "bg-xp-green/15 border-xp-green/40 text-xp-green" : "bg-secondary/50 border-border/50 text-muted-foreground",
                )}
              >
                {isDone ? <Check size={15} strokeWidth={3} /> : <Icon size={14} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13px] font-bold leading-tight", isDone && "text-muted-foreground line-through")}>
                  {m.title}
                </p>
                {m.detail && (
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{m.detail}</p>
                )}
              </div>
              <span className={cn("shrink-0 text-[11px] font-black tabular-nums mt-0.5", isDone ? "text-xp-green" : "text-gold")}>
                +{m.xp}
              </span>
            </button>
          );
        })}
      </div>

      {done > 0 && done >= total && total > 0 && (
        <p className="mt-3 text-center text-[11px] font-black uppercase tracking-widest text-xp-green">
          Plan complete · you showed up
        </p>
      )}

      {confetti && (
        <Portal>
          <div className="fixed inset-0 pointer-events-none z-[var(--z-toast)]">
            <ConfettiBurst active={confetti} />
          </div>
        </Portal>
      )}
    </div>
  );
};

export default TodaysPlanCard;
