import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticNotification, hapticImpact } from "@/lib/haptics";
import { formatRest } from "@/lib/training/runner";

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

  useEffect(() => {
    const tick = () => {
      const left = (endsAt - Date.now()) / 1000;
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        // A buzz is the point: the athlete is not looking at the screen.
        hapticNotification("success");
        onDone?.();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    // Recompute the moment the tab is foregrounded again, so the number is
    // right before the next interval fires.
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [endsAt, onDone]);

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
