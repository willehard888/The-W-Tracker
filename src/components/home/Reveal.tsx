import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** ms delay applied via inline style for staggered entry */
  delay?: number;
}

/**
 * Wraps a section with scroll-triggered reveal (IntersectionObserver).
 * Uses CSS class `.reveal-on-scroll` defined in index.css.
 */
const Reveal = ({ children, className, delay = 0 }: RevealProps) => {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
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
