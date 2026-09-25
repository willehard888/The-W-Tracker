import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import FeedbackSheet, { type FeedbackAnswer } from "./FeedbackSheet";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { usePilotContext, usePromptLog, usePilotSignals, useSubmitFeedback, useMarkPrompt } from "@/hooks/use-pilot";
import { nextPrompt } from "@/lib/pilot/eligibility";
import { FREEFORM_PROMPT_ID, type PilotPrompt } from "@/lib/pilot/prompts";

/**
 * Where a question gets asked, if one may be asked at all.
 *
 * Mounted once, beside OnboardingHost. For anybody who is not a tester it
 * renders null and asks nothing, which is the ordinary case and stays the
 * ordinary case if the migration has not been deployed: pilot_context() fails,
 * rpc.ts returns is_pilot false, and this is inert.
 *
 * The decision itself is not here — it is nextPrompt(), a pure function with 22
 * tests. This file only gathers the arguments and shows what comes back.
 */

/**
 * One question per launch, module-level so it survives a remount and resets on
 * a real relaunch — the same definition of "session" OnboardingProvider uses
 * for SESSION_SHOW_CAP, and for the same reason.
 */
let shownThisLaunch = 0;

/**
 * Whether the app has already explained something this launch. A teaching card
 * and a question in one launch is a stack, not a conversation — so the pilot
 * stands down for the rest of the launch the moment onboarding uses it.
 *
 * Observed rather than imported: OnboardingProvider keeps its own counter
 * module-private, and watching activeEventId sees exactly the same event
 * without reaching into somebody else's file.
 */
let teachingCardShown = false;

/** Opened from Profile — the door that is always there, never triggered. */
let openFreeform: (() => void) | null = null;
export const requestPilotFeedback = () => openFreeform?.();

const PilotHost = () => {
  const location = useLocation();
  const onboarding = useOnboarding();
  const { context } = usePilotContext();
  const active = context.is_pilot && context.in_window;

  const { log } = usePromptLog(active);
  const signals = usePilotSignals(active);
  const submit = useSubmitFeedback();
  const mark = useMarkPrompt();

  const [prompt, setPrompt] = useState<PilotPrompt | null>(null);
  const [freeform, setFreeform] = useState(false);
  const asked = useRef(false);

  // The app is mid-explanation, now or at any point this launch.
  useEffect(() => {
    if (onboarding?.activeEventId) teachingCardShown = true;
  }, [onboarding?.activeEventId]);

  // The freeform door, registered for Profile to call.
  useEffect(() => {
    openFreeform = () => setFreeform(true);
    return () => { openFreeform = null; };
  }, []);

  useEffect(() => {
    if (!active || asked.current || prompt || freeform) return;
    const next = nextPrompt({
      isPilot: context.is_pilot,
      inWindow: context.in_window,
      day: context.day,
      signals,
      log,
      shownThisLaunch,
      teachingCardShown,
      now: Date.now(),
    });
    if (!next) return;
    asked.current = true;
    shownThisLaunch += 1;
    setPrompt(next);
    void mark(next.id, "shown");
    // mark/submit are stable closures over query client + user; re-running this
    // on their identity would ask again inside one launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, context.day, context.in_window, context.is_pilot, log, signals, prompt, freeform]);

  if (!active && !freeform) return null;

  const current = freeform ? null : prompt;
  const open = freeform || !!prompt;
  if (!open) return null;

  const close = () => {
    if (freeform) { setFreeform(false); return; }
    if (prompt) {
      // A dismissal is an answer: it is recorded so the question never returns.
      void mark(prompt.id, "dismissed");
      setPrompt(null);
    }
  };

  const onSubmit = async (answer: FeedbackAnswer): Promise<boolean> => {
    const ok = await submit({
      promptId: freeform ? FREEFORM_PROMPT_ID : prompt!.id,
      kind: freeform ? (answer.choice === "bug" ? "bug" : "volunteered") : prompt!.kind,
      rating: answer.rating,
      choice: answer.choice,
      comment: answer.comment,
      // Which screen they were on, and which door they came through. Nothing
      // else survives sanitizeContext().
      context: { route: location.pathname, surface: freeform ? "settings" : "prompt" },
    });
    if (ok && !freeform) setPrompt(null);
    if (ok && freeform) setFreeform(false);
    return ok;
  };

  return <FeedbackSheet open={open} prompt={current} onDismiss={close} onSubmit={onSubmit} />;
};

export default PilotHost;
