import type { PointerEvent } from "react";
import AnimatedNumber from "@/components/AnimatedNumber";
import { cn } from "@/lib/utils";

export type LockState = "armed" | "locking" | "locked";

/**
 * The check-in's lock — luxury metal (the founder's reference: Rolex/Cartier;
 * slow, heavy, light travelling over polished gold, deep shadow, little
 * motion). Three materials, one light, one mechanism:
 *
 *   housing → bezel → face   a dark well, a thin brushed gold bezel ring, and
 *                            2.5 px inside it the polished face: mirror crown,
 *                            a crisp horizon, a warm bounce band, a dark foot,
 *                            a guilloché band across the satin middle.
 *   armed                    a narrow bright line and a wide soft sheen cross
 *                            the bar once every 9 s; nothing else moves.
 *   pressed                  face and bezel sink 3 px, the well's rim light
 *                            doubles, the floor reflection compresses, and the
 *                            light gathers under the finger (--lx).
 *   locking                  the latch: the bar drops and springs back, the
 *                            padlock's shackle closes, one catch of light
 *                            crosses, the metal cools to obsidian (its own
 *                            layer — WebKit will not interpolate gradients of
 *                            different stop counts), the check draws itself.
 *   locked                   "+N XP" rises out of the bar; the page shows the
 *                            summary a beat later (the page's job).
 *   waiting (disabled)       unlit metal: the sheen off, a smoked veil that
 *                            lifts when the athlete answers.
 *
 * Every keyframe and gradient lives in src/index.css (`lock-*`); this file is
 * the anatomy and the state classes. Bloom, ring, floor and the XP pill are
 * siblings of the clipped face so they can leave its radius.
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
  // The finger's x, for the highlight that gathers under it. A keyboard
  // activation never sets it and the light stays at the centre.
  const rememberTouch = (e: PointerEvent<HTMLButtonElement>) => {
    if (!Number.isFinite(e.clientX)) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--lx", `${Math.round(e.clientX - r.left)}px`);
  };
  return (
    <button
      type="button"
      onClick={() => { if (armed && !disabled) onClick(); }}
      onPointerDown={rememberTouch}
      disabled={disabled}
      aria-busy={state === "locking" || undefined}
      aria-live="polite"
      className={cn(
        "lock-bar group relative block w-full h-[62px] min-h-[62px] rounded-2xl text-left disabled:cursor-not-allowed",
        state === "locking" && "is-locking",
        state === "locked" && "is-locked",
        className,
      )}
    >
      <span aria-hidden className="lock-floor" />
      <span aria-hidden className="lock-bloom" />
      <span aria-hidden className="lock-ring" />
      <span aria-hidden className="lock-house" />
      <span aria-hidden className="lock-bezel" />
      <span className="lock-face">
        <span aria-hidden className="lock-guil" />
        <span aria-hidden className="lock-spec lock-spec-soft" />
        <span aria-hidden className="lock-spec" />
        <span aria-hidden className="lock-touch" />
        <span aria-hidden className="lock-obsidian" />
        <span aria-hidden className="lock-catch" />
        <span className="lock-lbl">
          {/* The padlock, in two paths so the shackle can drop closed. */}
          <span aria-hidden className="lock-ico">
            <svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2" /></svg>
            <svg viewBox="0 0 24 24" className="lock-shackle"><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          </span>
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
