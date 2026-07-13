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
 * Robinhood / Duolingo all do it). Rolls from the previous value to the new
 * one with an ease-out curve. Reduced-motion users get the final value
 * instantly (honors the OS setting + our global MotionConfig).
 */
const AnimatedNumber = ({ value, className, duration = 1000, format }: AnimatedNumberProps) => {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (reduce) { setDisplay(value); fromRef.current = value; return; }
    const from = fromRef.current;
    const diff = value - from;
    if (diff === 0) { setDisplay(value); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setDisplay(Math.round(from + diff * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, reduce]);

  return (
    <span className={cn("tabular-nums", className)}>
      {format ? format(display) : display.toLocaleString()}
    </span>
  );
};

export default AnimatedNumber;
