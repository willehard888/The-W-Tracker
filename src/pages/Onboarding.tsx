import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { track, FUNNEL } from "@/lib/analytics";
import { hapticNotification } from "@/lib/haptics";
import { usePushControls } from "@/hooks/use-push-notifications";
import ConfettiBurst from "@/components/ConfettiBurst";
import { Button } from "@/components/ui/button";
import OnboardingQuestion from "@/components/onboarding/OnboardingQuestion";
import {
  WelcomeSlide,
  CoreLoopSlide,
  ClimbSlide,
  TrialSlide,
  PushSlide,
  FinaleSlide,
} from "@/components/onboarding/OnboardingSlides";
import {
  GOAL_OPTIONS,
  STRUGGLE_OPTIONS,
  FREQUENCY_OPTIONS,
  mergeIntoCoachDraft,
  athletePatchFromAnswers,
  type OnboardingAnswers,
} from "@/lib/onboarding";
import { SPORTS } from "@/lib/sports";
import { readLocal, writeLocal, removeLocal } from "@/lib/storage";
import type { GoalId } from "@/hooks/use-athlete-profile";
import { captureException } from "@/lib/observability";

/**
 * "Initiation" — the new-user onboarding.
 * Arc: invest → personalize (4 questions) → teach (loop + ladder) → commit
 * (14 days) → push → activate (straight into the first check-in).
 *
 * Answers land where the Coach wizard reads them (draft + partial athlete
 * patch WITHOUT onboarded:true) so nothing is ever asked twice; completion is
 * DB-backed via mark_onboarded (localStorage is only a fast-path cache).
 */

type StepKey =
  | "welcome" | "goal" | "sports" | "frequency" | "struggle"
  | "loop" | "climb" | "trial" | "push" | "finale";

const QUESTION_STEPS: StepKey[] = ["goal", "sports", "frequency", "struggle"];

const SPORT_OPTIONS = SPORTS.map((s) => ({ v: s.id, label: s.label, emoji: s.emoji }));

/**
 * A force-quit at question three used to cost every answer given so far —
 * `w_onboarding_done` is only written at the end, so the next launch restarted
 * the flow from step 0 with nothing kept. Same fix the Coach wizard already
 * runs (AthleteProfileOnboarding): answers under one key, the step index under
 * another, both cleared the moment the flow finishes or is skipped.
 */
const DRAFT_KEY = "w_onboarding_draft_v1";
const STEP_KEY = "w_onboarding_step_v1";

const loadAnswers = (): OnboardingAnswers => {
  const raw = readLocal(DRAFT_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as OnboardingAnswers;
  } catch { /* corrupt draft — start clean rather than crash the first run */ }
  return {};
};

// Floored as well as truncated: a junk or negative value would index the step
// list out of bounds and render a blank flow with no way forward but Skip.
const loadStep = (): number => Math.max(0, Math.trunc(Number(readLocal(STEP_KEY))) || 0);

const Onboarding = () => {
  const navigate = useNavigate();
  const pushControls = usePushControls();

  const [answers, setAnswers] = useState<OnboardingAnswers>(loadAnswers);
  const [confetti, setConfetti] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  // Native + permission still 'prompt' → the flow owns the push ask.
  const [includePush, setIncludePush] = useState(false);

  useEffect(() => { void track(FUNNEL.onboardingViewed); }, []);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    PushNotifications.checkPermissions()
      .then((p) => setIncludePush(p.receive === "prompt" || p.receive === "prompt-with-rationale"))
      .catch(() => setIncludePush(false));
  }, []);

  const steps = useMemo<StepKey[]>(() => {
    const base: StepKey[] = ["welcome", "goal", "sports", "frequency", "struggle", "loop", "climb", "trial"];
    if (includePush) base.push("push");
    base.push("finale");
    return base;
  }, [includePush]);

  // Restored so an interrupted run resumes on the question it stopped at, not
  // at the start with the answers silently prefilled. The index is clamped
  // below, so a draft written when the push step was in the list is safe.
  const [stepIdx, setStepIdx] = useState(loadStep);
  const step = steps[Math.min(stepIdx, steps.length - 1)];

  useEffect(() => { writeLocal(DRAFT_KEY, JSON.stringify(answers)); }, [answers]);
  useEffect(() => { writeLocal(STEP_KEY, String(stepIdx)); }, [stepIdx]);

  const finishedRef = useRef(false);
  const finish = (skipped = false) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    // Answers → the Coach wizard's draft + a partial athlete patch, so Coach
    // opens pre-filled instead of re-asking. Both fire-and-forget: completion
    // must never block on the network (the draft alone guarantees prefill).
    mergeIntoCoachDraft(answers);
    const patch = athletePatchFromAnswers(answers);
    if (Object.keys(patch).length > 0) {
      // console.warn is invisible in prod, and these two are not cosmetic: a
      // dropped patch loses the goal/equipment answers the Coach was going to
      // open pre-filled with, and a failed `mark_onboarded` can re-run the whole
      // flow on the next install.
      void supabase.rpc("upsert_athlete_profile", { _patch: patch as Json }).then(
        ({ error }) => { if (error) captureException(error, { where: "onboarding.athletePatch" }); },
      );
    }
    void supabase.rpc("mark_onboarded").then(
      ({ error }) => { if (error) captureException(error, { where: "onboarding.markOnboarded" }); },
    );
    // The flow is over (finished or skipped) — the resume draft has done its
    // job and must not survive into the next run on this device.
    removeLocal(DRAFT_KEY);
    removeLocal(STEP_KEY);
    writeLocal("w_onboarding_done", "true");
    void track(skipped ? FUNNEL.onboardingSkipped : FUNNEL.onboardingDone, {
      step: stepIdx,
      key: step,
      answers: answers as Record<string, unknown>,
      native: Capacitor.isNativePlatform(),
    });
    navigate(skipped ? "/" : "/checkin", { replace: true });
  };

  const advance = (key: StepKey, answer?: unknown) => {
    void track(FUNNEL.onboardingStep, { step: stepIdx, key, answer: answer ?? null });
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  };

  const answerAndAdvance = (key: StepKey, patch: Partial<OnboardingAnswers>, answer: unknown) => {
    setAnswers((a) => ({ ...a, ...patch }));
    advance(key, answer);
  };

  const enterTrialCommit = () => {
    setConfetti(true);
    hapticNotification("success");
    advance("trial");
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    try { await pushControls?.enablePush(); } catch { /* denial is a valid outcome */ }
    setPushBusy(false);
    advance("push", "enabled");
  };
  const handleSkipPush = () => {
    pushControls?.dismissPriming();
    advance("push", "skipped");
  };

  // Question progress: only the 4 questions fill the bar; teach/commit screens
  // keep it full so the flow never appears to move backwards.
  const qIndex = QUESTION_STEPS.indexOf(step);
  const progress =
    step === "welcome" ? 0
    : qIndex >= 0 ? qIndex
    : QUESTION_STEPS.length;

  return (
    <div className="min-h-full gradient-dark flex flex-col px-6 py-6 safe-top safe-bottom overflow-hidden">
      <ConfettiBurst active={confetti} />

      {/* Top chrome: progress + skip (hidden on welcome & finale) */}
      <div className="w-full max-w-sm mx-auto flex items-center gap-3 min-h-[28px]">
        {step !== "welcome" && step !== "finale" ? (
          <>
            <div className="flex-1 flex gap-1.5">
              {QUESTION_STEPS.map((q, i) => (
                <div
                  key={q}
                  className={`flex-1 h-1 rounded-full transition-colors duration-300 ${
                    i < progress || qIndex === -1 ? "bg-[hsl(var(--gold))]"
                    : i === progress ? "bg-[hsl(var(--gold))]/45"
                    : "bg-border/40"
                  }`}
                />
              ))}
            </div>
            {qIndex >= 0 && (
              <span className="text-[11px] font-bold text-muted-foreground shrink-0">{qIndex + 1}/{QUESTION_STEPS.length}</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => finish(true)}
              className="min-h-11 -mr-3 text-xs font-medium text-muted-foreground shrink-0"
            >
              Skip
            </Button>
          </>
        ) : null}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ duration: 0.2 }}
          className="flex-1 flex flex-col pt-5 min-h-0"
        >
          {step === "welcome" && <WelcomeSlide onNext={() => advance("welcome")} />}

          {step === "goal" && (
            <OnboardingQuestion
              mode="single"
              title="What are you here to win?"
              sub="Your coach builds around this."
              options={GOAL_OPTIONS}
              value={answers.primary_goal}
              onAnswer={(v) => answerAndAdvance("goal", { primary_goal: v as GoalId }, v)}
            />
          )}

          {step === "sports" && (
            <OnboardingQuestion
              mode="multi"
              dense
              allowEmpty
              title="What do you train?"
              sub="Pick any — or none. Check-ins adapt to you."
              options={SPORT_OPTIONS}
              value={answers.sports}
              onAnswer={(v) => answerAndAdvance("sports", { sports: v }, v)}
            />
          )}

          {step === "frequency" && (
            <OnboardingQuestion
              mode="single"
              title="How often do you train right now?"
              sub="Honest answer — we start where you are."
              options={FREQUENCY_OPTIONS}
              value={answers.training_freq}
              onAnswer={(v) => answerAndAdvance("frequency", { training_freq: v }, v)}
            />
          )}

          {step === "struggle" && (
            <OnboardingQuestion
              mode="single"
              title="What's really held you back?"
              options={STRUGGLE_OPTIONS}
              value={answers.struggle}
              onAnswer={(v) => answerAndAdvance("struggle", { struggle: v }, v)}
            />
          )}

          {step === "loop" && <CoreLoopSlide struggle={answers.struggle} onNext={() => advance("loop")} />}
          {step === "climb" && <ClimbSlide onNext={() => advance("climb")} />}
          {step === "trial" && <TrialSlide onNext={enterTrialCommit} />}
          {step === "push" && <PushSlide onEnable={handleEnablePush} onSkip={handleSkipPush} busy={pushBusy} />}
          {step === "finale" && <FinaleSlide goal={answers.primary_goal} onNext={() => finish(false)} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Onboarding;
