import { Lock } from "lucide-react";
import AnimatedNumber from "@/components/AnimatedNumber";
import { cn } from "@/lib/utils";

export type LockState = "armed" | "locking" | "locked";

/**
 * The check-in's lock — a polished gold bar in a dark housing (the founder's
 * reference: luxury metal, Rolex/Cartier — slow, heavy, light travelling over
 * metal, deep shadow, little motion).
 *
 *   armed    two specular bands cross the bar every 7 s over a brushed
 *            texture; nothing else moves. A press sinks it 3 px into the
 *            housing and holds the light under the finger.
 *   locking  one fast catch of light, a small gold bloom and a hairline ring
 *            leave the bar, the label lifts away, the metal begins to cool.
 *   locked   dark obsidian with a gold hairline and glow; the check draws
 *            itself beside "Locked · Day N" and "+N XP" rises to the top of
 *            the page. The summary takes over a beat later (the page's job).
 *
 * Every keyframe and multi-stop gradient lives in src/index.css (`lock-*`);
 * this file carries the anatomy and the state classes. The bloom, ring and
 * XP pill are siblings of the clipped bar so they can leave its radius.
 */
const LockItIn = ({
  xp,
  day,
  state,
  disabled,
  onClick,
  className,
}: {
  xp: number;
  day: number;
  state: LockState;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) => {
  const armed = state === "armed";
  return (
    <button
      type="button"
      onClick={() => { if (armed && !disabled) onClick(); }}
      disabled={disabled}
      aria-busy={state === "locking" || undefined}
      aria-live="polite"
      className={cn(
        "lock-bar group relative block w-full h-14 min-h-14 rounded-2xl text-left disabled:cursor-not-allowed",
        state === "locking" && "is-locking",
        state === "locked" && "is-locked",
        className,
      )}
    >
      {/* Off the bar, so they escape its radius: the bloom, the ring, the XP. */}
      <span aria-hidden className="lock-bloom" />
      <span aria-hidden className="lock-ring" />
      <span aria-hidden className="lock-house" />
      <span className="lock-face">
        <span aria-hidden className="lock-brush" />
        <span aria-hidden className="lock-spec lock-spec-soft" />
        <span aria-hidden className="lock-spec" />
        <span aria-hidden className="lock-catch" />
        <span className="lock-lbl">
          <Lock aria-hidden size={20} />
          <span className="tabular-nums">
            Lock it in · +<AnimatedNumber value={xp} duration={350} className="inline" /> XP
          </span>
        </span>
        <span className="lock-done">
          <svg aria-hidden className="lock-chk" viewBox="0 0 24 24" width="22" height="22">
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
          <span>Locked · Day {day}</span>
        </span>
      </span>
      <span aria-hidden className="lock-xp">+{xp} XP</span>
    </button>
  );
};

export default LockItIn;
