import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dumbbell, HeartPulse, Brain, Repeat, Flame, Check, RotateCw,
} from "lucide-react";
import type { useDailyPlan, Mission, MissionKind } from "@/hooks/use-daily-plan";
import { Button } from "@/components/ui/button";
import { hapticImpact } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import { useOnboardingTrigger, useSpotlightTarget } from "@/components/onboarding/onboarding-context";

/**
 * TodaysPlanCard: the coach's read of the day (push/hold/deload/swap) and its
 * reminders. A quiet card under the hero: the readiness number itself lives up
 * there.
 *
 * The rows are reminders, not tasks. They used to be buttons the member ticked
 * — a second check-in, with a "Done" toast, for things the evening check-in
 * records anyway. Now each row says why it matters today, and the check-in
 * (or a finished session, reflection or recovery routine) settles it.
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

/** One reminder row. Covered = the day's data already shows it happened. */
const ReminderRow = ({
  mission, covered, spotlightRef,
}: {
  mission: Mission;
  covered: boolean;
  spotlightRef?: React.Ref<HTMLDivElement>;
}) => {
  const Icon = KIND_ICON[mission.kind] ?? Repeat;
  const why = mission.why || mission.detail;

  return (
    <div ref={spotlightRef} className="flex items-start gap-3 py-2.5">
      <Icon size={14} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-dense font-bold leading-tight", covered && "text-muted-foreground")}>
          {mission.title}
        </span>
        {why && (
          <span className="block text-meta text-muted-foreground leading-snug mt-0.5">{why}</span>
        )}
      </span>
      <span
        className={cn(
          "mt-0.5 shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center",
          covered ? "border-gold bg-gold text-primary-foreground" : "border-muted-foreground/35",
        )}
        role="img"
        aria-label={covered ? "Covered by today's check-in" : "Not yet recorded"}
      >
        {covered && <Check aria-hidden size={12} strokeWidth={3} />}
      </span>
    </div>
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
  const { plan, isLoading, completedIds, done, total, checkedIn, generate } = daily;
  const navigate = useNavigate();
  // Contextual onboarding: the first time a reminder row exists, spotlight it.
  const missionTargetRef = useSpotlightTarget("COACH_MISSION_INTRO");
  useOnboardingTrigger("COACH_MISSION_INTRO", (plan?.missions?.length ?? 0) > 0);
  const [generating, setGenerating] = useState(false);
  const [needsMembership, setNeedsMembership] = useState(false);
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
        // Never show the raw "Edge Function returned a non-2xx…" string — nor
        // the server's machine codes, which is what a declined AI consent
        // arrives as.
        toast.error(friendlyError(e, "Couldn't refresh the reminders — try again in a moment."));
      }
    } finally {
      setGenerating(false);
    }
  };

  // Loading / first-generation state.
  if ((isLoading || generating) && !plan) {
    return (
      // In the loaded card's silhouette: as two lines of text it was ~70 pt
      // against a ~400 pt plan, so everything below jumped down mid-tap the
      // moment the missions arrived.
      <div className="surface-card surface-card-quiet p-4">
        <p className="text-dense font-bold">Reading your day…</p>
        <p className="text-meta text-muted-foreground mt-0.5">Your recent check-ins, recovery and training.</p>
        <div className="mt-3 divide-y divide-border/35" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="py-3.5">
              <div className="h-4 w-2/5 rounded bg-card/40 skeleton-block" />
              <div className="h-3 w-4/5 rounded bg-card/40 skeleton-block mt-2" />
              <div className="h-3 w-3/5 rounded bg-card/40 skeleton-block mt-1.5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Membership-gated — show the value + route to the paywall, never a dead CTA.
  if (!plan && needsMembership) {
    return (
      <button type="button" onClick={() => navigate("/paywall")} className="press w-full min-h-11 text-left surface-card surface-card-quiet p-4">
        <p className="text-dense font-bold">The coach's daily read is a member feature</p>
        <p className="text-meta text-muted-foreground leading-snug mt-0.5">
          A readiness score and 3–5 reminders fitted to how you're actually recovering,
          rebuilt every morning. Unlock full access.
        </p>
      </button>
    );
  }

  // No plan and generation failed — offer a manual build.
  if (!plan) {
    return (
      <button type="button" onClick={regenerate} className="press w-full min-h-11 text-left surface-card surface-card-quiet p-4">
        <p className="text-dense font-bold">Get today's read</p>
        <p className="text-meta text-muted-foreground leading-snug mt-0.5">
          A readiness read and 3–5 reminders fitted to how you're actually recovering.
        </p>
      </button>
    );
  }

  const adjust = ADJUST[plan.adjustment] ?? ADJUST.hold;
  const complete = total > 0 && done >= total;
  // Before the day's check-in the rows are pending, not failed; a covered row
  // then is one the app saw itself (a session, a routine, the reflection).
  const footer = complete
    ? "All covered. You showed up."
    : !checkedIn
      ? done > 0 ? `${done} of ${total} covered · your check-in tonight settles the rest.` : "Your check-in tonight settles these."
      : `${done} of ${total} covered · from today's check-in`;

  return (
    <div className="surface-card surface-card-quiet p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("text-read font-black leading-tight", adjust.tone)}>{adjust.label}</p>
          {plan.headline && (
            <p className="text-meta text-foreground/85 leading-snug mt-0.5">{plan.headline}</p>
          )}
          <p className="text-meta text-muted-foreground leading-snug mt-1">{whyLine(plan)}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 shrink-0 text-muted-foreground"
          onClick={regenerate}
          disabled={generating}
          aria-label="Regenerate reminders"
        >
          <RotateCw size={14} className={cn(generating && "animate-spin")} aria-hidden />
        </Button>
      </div>

      <div className="mt-2 divide-y divide-border/35 border-t border-border/35">
        {plan.missions.map((m, mi) => (
          <ReminderRow
            key={m.id}
            mission={m}
            covered={completedIds.has(m.id)}
            spotlightRef={mi === 0 ? missionTargetRef : undefined}
          />
        ))}
      </div>

      {total > 0 && (
        <p className={cn("mt-2 text-meta tabular-nums", complete ? "font-bold text-gold" : "text-muted-foreground")}>
          {footer}
        </p>
      )}
    </div>
  );
};

export default TodaysPlanCard;
