import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: ReactNode;
  /** Optional right-aligned action, e.g. "View all →". Keep it one word/short. */
  action?: { label: string; onClick: () => void };
  className?: string;
}

/**
 * The single section-heading style for the whole app. Replaces the dozens of
 * ad-hoc `text-[10px] uppercase tracking-...` headers so every list/section
 * reads identically. Small-caps, muted, with one optional inline action.
 */
export const SectionLabel = ({ children, action, className }: SectionLabelProps) => (
  <div className={cn("flex items-center justify-between gap-2 mb-2.5", className)}>
    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/80">
      {children}
    </span>
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className="shrink-0 inline-flex items-center gap-0.5 text-xs font-semibold text-gold active:opacity-70 transition-opacity"
      >
        {action.label} <ChevronRight size={13} />
      </button>
    )}
  </div>
);

export default SectionLabel;
