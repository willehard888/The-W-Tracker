// Contextual onboarding — decides HOW the active card renders (Blueprint §3).
// Spotlight events poll their opt-in target for ~1.5s; found → spotlight on
// the real UI; not found → per-event fallback (bottom sheet) or a silent
// skip into the failed bucket. Every branch fails to "nothing renders this
// tick" — never a crash, never a stuck overlay.
import { useEffect, useState } from "react";
import { ONBOARDING_EVENTS } from "@/lib/onboarding/registry";
import type { OnboardingEventId } from "@/lib/onboarding/types";
import OnboardingBottomSheet from "./OnboardingBottomSheet";
import SpotlightOverlay from "./SpotlightOverlay";

const POLL_MS = 150;
const POLL_ATTEMPTS = 10; // ~1.5s total

interface OnboardingHostProps {
  activeEventId: OnboardingEventId | null;
  getTarget: (id: OnboardingEventId) => HTMLElement | null;
  onComplete: () => void;
  onSkip: () => void;
  onTargetFailed: () => void;
}

export default function OnboardingHost({
  activeEventId,
  getTarget,
  onComplete,
  onSkip,
  onTargetFailed,
}: OnboardingHostProps) {
  const [mode, setMode] = useState<"idle" | "spotlight" | "sheet">("idle");
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMode("idle");
    setTarget(null);
    if (!activeEventId) return;
    const def = ONBOARDING_EVENTS[activeEventId];
    if (!def || def.presentation === "none") return;
    if (def.presentation === "sheet") {
      setMode("sheet");
      return;
    }
    let attempts = 0;
    let timer: number | undefined;
    const poll = () => {
      const el = getTarget(activeEventId);
      if (el && el.isConnected) {
        setTarget(el);
        setMode("spotlight");
        return;
      }
      attempts += 1;
      if (attempts >= POLL_ATTEMPTS) {
        if (def.fallback === "sheet") setMode("sheet");
        else onTargetFailed();
        return;
      }
      timer = window.setTimeout(poll, POLL_MS);
    };
    poll();
    return () => window.clearTimeout(timer);
    // onTargetFailed identity is stable enough (provider useCallback); the
    // poll must restart only when the active event changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEventId, getTarget]);

  // Watchdog: pages stay mounted in the background, so a target element can
  // be REPLACED (its page re-rendered a new node) while the card is open —
  // the overlay then holds a dead element forever. Swap in the freshly
  // registered node when that happens; the overlay remounts its listeners
  // via its [target] effects.
  useEffect(() => {
    if (mode !== "spotlight" || !activeEventId) return;
    const tick = window.setInterval(() => {
      const fresh = getTarget(activeEventId);
      if (fresh && fresh.isConnected && fresh !== target) setTarget(fresh);
    }, 400);
    return () => window.clearInterval(tick);
  }, [mode, activeEventId, getTarget, target]);

  if (!activeEventId || mode === "idle") return null;
  const def = ONBOARDING_EVENTS[activeEventId];
  if (!def) return null;

  if (mode === "sheet") {
    return <OnboardingBottomSheet def={def} onComplete={onComplete} onSkip={onSkip} />;
  }
  if (!target) return null;
  return <SpotlightOverlay def={def} target={target} onComplete={onComplete} onSkip={onSkip} />;
}
