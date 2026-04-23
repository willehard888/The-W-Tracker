/**
 * FireSpark — drop-in micro ember.
 *
 * Renders a small rising ember (3px, warm gold-orange) using the global
 * `fire-spark` keyframe utility from index.css. GPU-only, reduced-motion safe.
 *
 * Usage:
 *   <div className="relative">
 *     ...content...
 *     <FireSpark left="20%" delay="0s" />
 *     <FireSpark left="60%" delay="1.4s" />
 *   </div>
 *
 * Parent must be `position: relative`.
 */
import { cn } from "@/lib/utils";

interface FireSparkProps {
  /** CSS left position, e.g. "20%", "12px". Default: "50%". */
  left?: string;
  /** CSS bottom position. Default: "0px". */
  bottom?: string;
  /** Animation delay (e.g. "0s", "1.2s"). Default: "0s". */
  delay?: string;
  /** Animation duration (e.g. "3.2s"). Default: "3.4s". */
  duration?: string;
  className?: string;
}

const FireSpark = ({
  left = "50%",
  bottom = "0px",
  delay = "0s",
  duration = "3.4s",
  className,
}: FireSparkProps) => {
  return (
    <span
      aria-hidden
      className={cn("fire-spark", className)}
      style={{
        left,
        bottom,
        animationDelay: delay,
        animationDuration: duration,
      }}
    />
  );
};

export default FireSpark;
