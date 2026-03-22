import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface XpCounterProps {
  value: number;
  className?: string;
  duration?: number;
}

const XpCounter = ({ value, className, duration = 1200 }: XpCounterProps) => {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = performance.now();
    startRef.current = display;
    const from = startRef.current;
    const diff = value - from;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + diff * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return (
    <span className={cn("tabular-nums", className)}>
      {display.toLocaleString()}
    </span>
  );
};

export default XpCounter;
