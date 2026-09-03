import { useEffect, useState } from "react";
import { Bell, Flame, Trophy, X } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { Portal } from "@/components/ui/Portal";
import { Button } from "@/components/ui/button";
import { hapticSelection } from "@/lib/haptics";

interface PushPrimingSheetProps {
  open: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}

/**
 * In-app rationale shown BEFORE the iOS notification prompt. A cold OS prompt
 * that a user reflexively denies is permanent and kills the entire retention
 * push engine — so we explain the value first and only fire the real prompt
 * when they tap "Turn on reminders".
 *
 * Motion matches OnboardingBottomSheet (the sheet reference): iOS curve in,
 * faster plain ease out, everything off under reduced motion. Dismiss plays a
 * 200ms exit instead of teleporting the sheet away.
 */
export default function PushPrimingSheet({ open, onEnable, onDismiss }: PushPrimingSheetProps) {
  const reduced = useReducedMotion();
  const [closing, setClosing] = useState(false);
  useEffect(() => { if (open) setClosing(false); }, [open]);

  if (!open) return null;

  const dismiss = () => {
    hapticSelection();
    if (reduced) { onDismiss(); return; }
    setClosing(true);
  };

  return (
    <Portal>
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center">
      {/* Scrim */}
      <button
        aria-label="Dismiss"
        onClick={dismiss}
        className={
          reduced
            ? "absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            : closing
            ? "absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-out fade-out duration-200"
            : "absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in"
        }
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Turn on reminders"
        onAnimationEnd={() => { if (closing) onDismiss(); }}
        className={
          "relative w-full max-w-md rounded-t-3xl border-t border-gold/25 bg-card px-6 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.6)] " +
          (reduced
            ? ""
            : closing
            ? "animate-out slide-out-to-bottom fade-out duration-200 ease-out"
            : "animate-in slide-in-from-bottom duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]")
        }
      >
        {/* Drag handle — sheet-anatomy spec shared with OnboardingBottomSheet */}
        <div className="flex justify-center pb-2">
          <span className="h-1 w-10 rounded-full bg-foreground/15" aria-hidden />
        </div>
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground transition-colors before:absolute before:-inset-2 before:content-['']"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-gold glow-gold">
          <Bell size={30} className="text-primary-foreground" strokeWidth={2.2} />
        </div>

        <h2 className="text-center font-display text-2xl font-black tracking-tight">
          Never break the chain
        </h2>
        <p className="mx-auto mt-2 mb-5 max-w-[300px] text-center text-sm text-muted-foreground">
          Turn on reminders so a busy day never costs you your streak. You stay in control — only what matters.
        </p>

        <div className="mb-6 space-y-3">
          {[
            { icon: Flame, text: "A nudge in the evening if you haven't checked in yet" },
            { icon: Trophy, text: "Milestones, rank-ups & when a friend passes you" },
            { icon: Bell, text: "Your coach's one-line morning cue" },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/12 text-gold">
                <Icon size={17} />
              </div>
              <p className="text-sm text-foreground/90 leading-snug">{text}</p>
            </div>
          ))}
        </div>

        <Button
          variant="ember"
          size="xl"
          className="w-full"
          onClick={() => { hapticSelection(); onEnable(); }}
        >
          <Bell size={18} /> Turn on reminders
        </Button>
        <button
          onClick={dismiss}
          className="mt-2 w-full py-2 text-center text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
    </Portal>
  );
}
