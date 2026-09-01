// Contextual onboarding — context + the two hooks components use.
// Everything is fail-open: no provider mounted → every hook is a no-op,
// nothing renders, nothing crashes (Blueprint §3, the top constraint).
import { createContext, useCallback, useContext, useEffect } from "react";
import type { OnboardingEventId } from "@/lib/onboarding/types";

export interface OnboardingApi {
  /**
   * False until the profile row actually carries onboarding_state — i.e.
   * until the migration has run in this environment. Keeps the whole
   * system inert (no cards for anyone) if app code ships first.
   */
  systemReady: boolean;
  /** Ask to show a card; queued if one is active, ignored if ineligible. */
  requestShow: (id: OnboardingEventId) => void;
  completeActive: () => void;
  skipActive: () => void;
  registerTarget: (id: OnboardingEventId, el: HTMLElement | null) => void;
  getTarget: (id: OnboardingEventId) => HTMLElement | null;
  activeEventId: OnboardingEventId | null;
}

export const OnboardingContext = createContext<OnboardingApi | null>(null);

export const useOnboarding = (): OnboardingApi | null => useContext(OnboardingContext);

/**
 * Opt-in ref for spotlight targets — the system never runs a raw DOM query.
 * Attach to the element a card should highlight:
 *   <button ref={useSpotlightTarget("CHECKIN_INTRO")} …>
 */
export const useSpotlightTarget = (id: OnboardingEventId) => {
  const api = useOnboarding();
  return useCallback(
    (el: HTMLElement | null) => {
      api?.registerTarget(id, el);
    },
    [api, id],
  );
};

/**
 * Declarative trigger: when `ready` turns true (and stays true on later
 * renders), ask once per mount to show the event. Eligibility, queueing,
 * and "already seen" are the provider's problem — callers just describe
 * the moment.
 */
export const useOnboardingTrigger = (id: OnboardingEventId, ready: boolean) => {
  const api = useOnboarding();
  const requestShow = api?.requestShow;
  const systemReady = api?.systemReady === true;
  useEffect(() => {
    // Re-runs when systemReady flips true, so a trigger that fired while the
    // profile was still loading isn't lost. requestShow is idempotent.
    if (ready && systemReady && requestShow) requestShow(id);
  }, [ready, systemReady, requestShow, id]);
};
