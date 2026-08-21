import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { track, FUNNEL } from "@/lib/analytics";
import { hapticNotification } from "@/lib/haptics";
import { usePushControls } from "@/hooks/use-push-notifications";
import ConfettiBurst from "@/components/ConfettiBurst";
import OnboardingQuestion from "@/components/onboarding/OnboardingQuestion";
import {
  WelcomeSlide,
  CoreLoopSlide,
  ClimbSlide,
  TrialSlide,
  PushSlide,
  FinaleSlide,
  ONBOARDING_KEYFRAMES,
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
import type { GoalId } from "@/hooks/use-athlete-profile";

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

const Onboarding = () => {
  const navigate = useNavigate();
  const pushControls = usePushControls();

  const [answers, setAnswers] = useState<OnboardingAnswers>({});
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

  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[Math.min(stepIdx, steps.length - 1)];

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
      void supabase.rpc("upsert_athlete_profile" as never, { _patch: patch as never }).then(
        ({ error }) => { if (error) console.warn("onboarding athlete patch failed", error.message); },
      );
    }
    void supabase.rpc("mark_onboarded" as never).then(
      ({ error }) => { if (error) console.warn("mark_onboarded failed", error.message); },
    );
    try { localStorage.setItem("w_onboarding_done", "true"); } catch { /* noop */ }
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
      <style>{ONBOARDING_KEYFRAMES}</style>
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
              <span className="eyebrow shrink-0">{qIndex + 1}/{QUESTION_STEPS.length}</span>
            )}
            <button
              onClick={() => finish(true)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-1 py-1 shrink-0"
            >
              Skip
            </button>
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
