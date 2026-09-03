// Contextual onboarding — the whole-screen / fallback presentation.
// Element-for-element the same premium idiom as PushPrimingSheet (the
// shipped reference): drag handle, gradient-gold icon tile with glow,
// centered display-font title, ember XL CTA. Hand-rolled, not Radix
// Dialog (Blueprint §3). AI_COACH_INTRO is the one card whose backdrop
// tap does NOT dismiss — a compliance-sensitive disclosure; the X still
// always works (never a hard lock).
import { X } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { Portal } from "@/components/ui/Portal";
import { Button } from "@/components/ui/button";
import { hapticSelection } from "@/lib/haptics";
import type { OnboardingEventDef } from "@/lib/onboarding/types";
import { EVENT_ICONS } from "./event-icons";

interface OnboardingBottomSheetProps {
  def: OnboardingEventDef;
  onComplete: () => void;
  onSkip: () => void;
}

export default function OnboardingBottomSheet({ def, onComplete, onSkip }: OnboardingBottomSheetProps) {
  const reduced = useReducedMotion();
  const Icon = EVENT_ICONS[def.id];
  const skip = () => {
    hapticSelection();
    onSkip();
  };
  return (
    <Portal>
      <div className="fixed inset-0 z-[var(--z-onboarding)] flex items-end justify-center">
        {def.backdropDismiss ? (
          <button
            aria-label="Dismiss"
            onClick={skip}
            className={`absolute inset-0 bg-black/60 ${reduced ? "" : "animate-in fade-in"}`}
          />
        ) : (
          <div className={`absolute inset-0 bg-black/60 ${reduced ? "" : "animate-in fade-in"}`} />
        )}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={def.title}
          className={`relative w-full max-w-md rounded-t-3xl border-t border-gold/25 bg-card px-6 pt-2.5 pb-[calc(1.5rem+var(--safe-bottom))] shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.6)] ${
            reduced ? "" : "animate-in slide-in-from-bottom duration-300"
          }`}
        >
          <div className="flex justify-center pb-1">
            <div className="h-1 w-10 rounded-full bg-white/15" />
          </div>
          <button
            onClick={skip}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground transition-colors before:absolute before:-inset-2 before:content-['']"
          >
            <X size={18} />
          </button>

          <div
            className={`mx-auto mt-4 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-gold glow-gold ${
              reduced ? "" : "animate-in zoom-in-50 fade-in duration-500"
            }`}
          >
            <Icon size={30} className="text-primary-foreground" strokeWidth={2.2} />
          </div>

          <h2 className="text-center font-display text-2xl font-black tracking-tight">{def.title}</h2>
          <p className="mx-auto mt-2 mb-6 max-w-[300px] text-center text-sm leading-relaxed text-muted-foreground">
            {def.body}
          </p>

          <Button
            variant="ember"
            size="xl"
            className="w-full"
            onClick={() => {
              hapticSelection();
              onComplete();
            }}
          >
            {def.cta}
          </Button>
        </div>
      </div>
    </Portal>
  );
}
