import { fmtUnit } from "@/lib/format";
import { cn } from "@/lib/utils";
import AnimatedNumber from "@/components/AnimatedNumber";

interface XpCounterProps {
  value: number;
  className?: string;
  duration?: number;
}

/**
 * The big "+N XP" count-up on the check-in summary.
 *
 * Now a thin wrapper over AnimatedNumber rather than a second RAF loop. The
 * duplicate had two stale-closure bugs that the shared one already solves:
 * its effect read `reduce` and `display` but listed neither in its deps, so
 * (a) toggling Reduce Motion mid-session never took effect, and (b) a value
 * change during an in-flight count resumed from the last *rendered* number
 * instead of the live one, making the total visibly jump backwards.
 * AnimatedNumber tracks the live value in a ref precisely for this.
 */
const XpCounter = ({ value, className, duration = 1200 }: XpCounterProps) => (
  <AnimatedNumber
    value={value}
    duration={duration}
    className={cn("text-3xl", className)}
    format={(n) => fmtUnit(n, "XP")}
  />
);

export default XpCounter;
