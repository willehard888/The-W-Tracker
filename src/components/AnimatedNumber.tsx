import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  className?: string;
  /** ms for the count-up. */
  duration?: number;
  /** Custom formatter (default: locale integer). */
  format?: (n: number) => string;
}

/**
 * Count-up number — the signature "expensive app" reveal (Apple Fitness /
 * Robinhood / Duolingo all do it). Rolls from the currently-displayed value to
 * the new one with an ease-out curve. Reduced-motion users get the final value
 * instantly (honors the OS setting + our global MotionConfig).
 */
const AnimatedNumber = ({ value, className, duration = 1000, format }: AnimatedNumberProps) => {
  const reduce = useReducedMotion();
  // Defensive: callers may pass a not-yet-loaded value (null/NaN) — never render
  // NaN or crash on `.toLocaleString()`; treat non-finite as 0.
  const target = Number.isFinite(value as number) ? (value as number) : 0;

  const [display, setDisplay] = useState(reduce ? target : 0);
  // The live displayed number, so an animation interrupted mid-flight resumes
  // from where it visually is — not from the last *completed* value (which
  // caused a backward jump on a mid-animation value change).
  const displayRef = useRef(reduce ? target : 0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (reduce) { setDisplay(target); displayRef.current = target; return; }
    const from = displayRef.current;
    const diff = target - from;
    if (diff === 0) { setDisplay(target); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      const v = Math.round(from + diff * eased);
      displayRef.current = v;
      setDisplay(v);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, reduce]);

  return (
    <span className={cn("tabular-nums", className)}>
      {format ? format(display) : display.toLocaleString()}
    </span>
  );
};

export default AnimatedNumber;
