import { ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { getPerfClass } from "@/lib/perf-class";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** ms delay applied via inline style for staggered entry */
  delay?: number;
}

/**
 * Wraps a section with scroll-triggered reveal (IntersectionObserver).
 * Uses CSS class `.reveal-on-scroll` defined in index.css.
 *
 * Low-perf devices (reduced-motion / low-RAM / few cores) skip the
 * IntersectionObserver and the entrance animation entirely — children
 * render instantly. The home page chains 5+ Reveal blocks with staggered
 * delays which causes a cumulative reflow burst at first paint; on a
 * mid-tier phone that translates directly into scroll-jank.
 */
const Reveal = ({ children, className, delay = 0 }: RevealProps) => {
  const isLowPerf = useMemo(() => getPerfClass() === "low", []);
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
  if (isLowPerf) {
    // Render plain div — no observer, no animation, no transition delay.
    return <div className={className}>{children}</div>;
  }
  return (
    <div
      ref={ref}
      className={cn("reveal-on-scroll", visible && "is-visible", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
};

export default Reveal;
