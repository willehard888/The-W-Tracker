import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticNotification, hapticImpact } from "@/lib/haptics";
import { formatRest } from "@/lib/training/runner";
import { cancelRestDone, scheduleRestDone } from "@/lib/rest-notification";

/**
 * Rest between sets.
 *
 * WHY IT COUNTS FROM A TIMESTAMP, NOT A TICK COUNTER
 *
 * Phones lock, and Safari throttles or suspends timers in a backgrounded tab.
 * A counter that decrements once per interval loses time whenever the screen
 * goes off — which, during rest, is most of the time. So the deadline is a
 * timestamp and the display is derived from the clock; a session left backgrounded
 * for two minutes comes back showing the truth rather than where it paused.
 *
 * It does not block anything. Rest is a suggestion, and the athlete can log the
 * next set whenever they like — the timer is information, never a gate.
 */
const RestTimer = ({
  seconds,
  onDone,
  onDismiss,
}: {
  seconds: number;
  onDone?: () => void;
  onDismiss: () => void;
}) => {
  const [endsAt, setEndsAt] = useState(() => Date.now() + seconds * 1000);
  const [remaining, setRemaining] = useState(seconds);
  const firedRef = useRef(false);
  // The parent passes inline callbacks; reading them through a ref keeps the
  // interval alive across parent renders instead of rebuilding it four times a
  // second.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const tick = () => {
      // Whole seconds: the display cannot show less, and a float re-rendered
      // the row on every 250 ms tick for nothing.
      const left = Math.ceil((endsAt - Date.now()) / 1000);
      setRemaining((prev) => (prev === left ? prev : left));
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        // A buzz is the point: the athlete is not looking at the screen.
        hapticNotification("success");
        onDoneRef.current?.();
      }
    };
    // Hidden mid-rest: the OS says "Rest is up" when the clock would have.
    // Back in front: the screen is the timer again, so the pending one goes
    // and the number is recomputed before the next interval fires.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (endsAt > Date.now()) void scheduleRestDone(new Date(endsAt), window.location.pathname);
      } else {
        void cancelRestDone();
        tick();
      }
    };
    tick();
    // A new deadline while already hidden ("+30 s") re-arms for the new time.
    if (document.visibilityState === "hidden") onVisibility();
    const id = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      // Dismissed, next set logged, or a new deadline: whatever was pending is
      // for a rest that no longer exists.
      void cancelRestDone();
    };
  }, [endsAt]);

  const over = remaining <= 0;
  const pct = Math.max(0, Math.min(1, remaining / seconds));

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 flex items-center gap-3",
        over ? "border-gold/40 bg-gold/[0.06]" : "border-border/50 bg-background/50",
      )}
      role="status"
      aria-live="off"
    >
      <div className="relative shrink-0 h-11 w-11">
        <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90" aria-hidden>
          <circle cx="20" cy="20" r="17" fill="none" strokeWidth="3"
            className="stroke-border/50" />
          <circle
            cx="20" cy="20" r="17" fill="none" strokeWidth="3" strokeLinecap="round"
            className={over ? "stroke-gold" : "stroke-gold/70"}
            strokeDasharray={2 * Math.PI * 17}
            strokeDashoffset={2 * Math.PI * 17 * (1 - pct)}
          />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="eyebrow text-muted-foreground/70 mb-0.5">
          {over ? "Rest is up" : "Resting"}
        </p>
        <p className="text-[17px] font-black tabular-nums leading-none text-foreground">
          {formatRest(remaining)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => { hapticImpact("light"); setEndsAt((e) => e + 30_000); firedRef.current = false; }}
        aria-label="Add 30 seconds"
        className="min-h-11 min-w-11 rounded-xl border border-border/50 inline-flex items-center justify-center text-[12px] font-bold text-foreground/85"
      >
        <Plus size={13} aria-hidden />30s
      </button>
      <button
        type="button"
        onClick={() => { hapticImpact("light"); onDismiss(); }}
        aria-label="Skip rest"
        className="min-h-11 min-w-11 rounded-xl inline-flex items-center justify-center text-muted-foreground"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
};

export default RestTimer;
