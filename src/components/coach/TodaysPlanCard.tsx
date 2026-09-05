import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dumbbell, HeartPulse, Brain, Repeat, Flame, Check, RotateCw,
} from "lucide-react";
import type { useDailyPlan, Mission, MissionKind } from "@/hooks/use-daily-plan";
import { Button } from "@/components/ui/button";
import ConfettiBurst from "@/components/ConfettiBurst";
import { Portal } from "@/components/ui/Portal";
import { hapticNotification, hapticImpact } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import { useOnboardingTrigger, useSpotlightTarget } from "@/components/onboarding/onboarding-context";
import { useCommitPop } from "@/hooks/use-commit-pop";

/**
 * TodaysPlanCard: the adaptive daily plan (push/hold/deload/swap + missions).
 * A quiet card under the hero: the readiness number itself lives up there.
 * Missions are hairline rows the user ticks; the tick is the commit-pop.
 * `daily` is the page's single useDailyPlan() (one realtime channel).
 */

const ADJUST: Record<string, { label: string; tone: string }> = {
  push:   { label: "Push today",      tone: "text-xp-green" },
  hold:   { label: "Hold steady",     tone: "text-foreground" },
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

/** One mission row: owns a hook, so it lives outside the .map(). */
const MissionRow = ({
  mission, isDone, isBusy, onComplete, spotlightRef,
}: {
  mission: Mission;
  isDone: boolean;
  isBusy: boolean;
  onComplete: (m: Mission) => void;
  spotlightRef?: React.Ref<HTMLButtonElement>;
}) => {
  const Icon = KIND_ICON[mission.kind] ?? Repeat;
  const popping = useCommitPop(isDone);

  return (
    <button
      type="button"
      ref={spotlightRef}
      onClick={() => onComplete(mission)}
      disabled={isDone || isBusy}
      className="press w-full min-h-11 flex items-start gap-3 py-2.5 text-left"
    >
      <Icon size={14} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[13px] font-bold leading-tight", isDone && "text-muted-foreground line-through")}>
          {mission.title}
        </span>
        {mission.detail && (
          <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5">{mission.detail}</span>
        )}
      </span>
      <span
        className={cn(
          "mt-0.5 shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
          isDone ? "border-xp-green bg-xp-green text-primary-foreground" : "border-muted-foreground/35",
          popping && "commit-pop",
        )}
        aria-hidden
      >
        {isDone && <Check size={12} strokeWidth={3} />}
      </span>
    </button>
  );
};

// Data-driven "why": the real readiness components (self-reported sleep,
// last RPE, missed sessions). The score itself is the hero's number.
const whyLine = (plan: { readiness_breakdown: Record<string, number | string> }) => {
  const b = plan.readiness_breakdown ?? {};
  const bits: string[] = [];
  if (b.avg_sleep_h != null) bits.push(`sleep ${b.avg_sleep_h}h avg`);
  if (b.last_rpe != null) bits.push(`last RPE ${b.last_rpe}`);
  if (typeof b.missed_7d === "number" && b.missed_7d > 0) bits.push(`${b.missed_7d} missed this week`);
  return `Read from ${bits.length ? bits.join(" · ") : "your recent check-ins"}.`;
};

const TodaysPlanCard = ({ daily }: { daily: ReturnType<typeof useDailyPlan> }) => {
  const { plan, isLoading, completedIds, done, total, generate, completeMission } = daily;
  const navigate = useNavigate();
  // Contextual onboarding: the first time a mission row exists, spotlight it.
  const missionTargetRef = useSpotlightTarget("COACH_MISSION_INTRO");
  useOnboardingTrigger("COACH_MISSION_INTRO", (plan?.missions?.length ?? 0) > 0);
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
      await completeMission(m.id);
      void hapticNotification("success");
      // Celebrate finishing the whole plan. completedIds.size (not `done` from
      // the render closure) so two quick taps can't both read a stale count
      // and skip the celebration.
      if (total > 0 && completedIds.size + 1 >= total) {
        setConfetti(true);
        setTimeout(() => setConfetti(false), 1600);
      }
      // No XP toast — missions are accountability, not an XP source.
      toast.success("Done ✓");
    } catch (e: any) {
      toast.error(friendlyError(e, "Couldn't log that"));
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(m.id); return n; });
    }
  };

  // Loading / first-generation state.
  if ((isLoading || generating) && !plan) {
    return (
      <div className="surface-card surface-card-quiet p-4">
        <p className="text-[13px] font-bold">Building today's plan…</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">Reading your recent recovery, training and streak.</p>
      </div>
    );
  }

  // Membership-gated — show the value + route to the paywall, never a dead CTA.
  if (!plan && needsMembership) {
    return (
      <button type="button" onClick={() => navigate("/paywall")} className="press w-full min-h-11 text-left surface-card surface-card-quiet p-4">
        <p className="text-[13px] font-bold">Your daily plan is a member feature</p>
        <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
          A readiness score + 3–5 missions fitted to how you're actually recovering —
          rebuilt for you every morning. Unlock full access.
        </p>
      </button>
    );
  }

  // No plan and generation failed — offer a manual build.
  if (!plan) {
    return (
      <button type="button" onClick={regenerate} className="press w-full min-h-11 text-left surface-card surface-card-quiet p-4">
        <p className="text-[13px] font-bold">Build today's plan</p>
        <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
          Get a readiness read and 3–5 missions fitted to how you're actually recovering.
        </p>
      </button>
    );
  }

  const adjust = ADJUST[plan.adjustment] ?? ADJUST.hold;
  const complete = total > 0 && done >= total;

  return (
    <div className="surface-card surface-card-quiet p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("text-[15px] font-black leading-tight", adjust.tone)}>{adjust.label}</p>
          {plan.headline && (
            <p className="text-[12px] text-foreground/85 leading-snug mt-0.5">{plan.headline}</p>
          )}
          <p className="text-[12px] text-muted-foreground leading-snug mt-1">{whyLine(plan)}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 shrink-0 text-muted-foreground"
          onClick={regenerate}
          disabled={generating}
          aria-label="Regenerate plan"
        >
          <RotateCw size={14} className={cn(generating && "animate-spin")} aria-hidden />
        </Button>
      </div>

      <div className="mt-2 divide-y divide-border/35 border-t border-border/35">
        {plan.missions.map((m, mi) => (
          <MissionRow
            key={m.id}
            mission={m}
            isDone={completedIds.has(m.id)}
            isBusy={busy.has(m.id)}
            onComplete={onComplete}
            spotlightRef={mi === 0 ? missionTargetRef : undefined}
          />
        ))}
      </div>

      {total > 0 && (
        <p className={cn("mt-2 text-[12px] tabular-nums", complete ? "font-bold text-xp-green" : "text-muted-foreground")}>
          {complete ? "Plan complete. You showed up." : `${done} of ${total} done`}
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
