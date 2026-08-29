import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";

interface MoreSectionProps {
  /** Header label, e.g. "More". */
  label?: string;
  /** Start expanded? Default collapsed — secondary content stays out of the way. */
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * A calm "More" zone for secondary content. Moderate-declutter primitive:
 * nothing is removed — lower-priority sections live here, collapsed by
 * default, one tap away. Keeps the primary screen focused on its one job.
 */
export const MoreSection = ({ label = "More", defaultOpen = false, children, className }: MoreSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => { hapticImpact("light"); setOpen((o) => !o); }}
        aria-expanded={open}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground/70 active:text-foreground transition-colors"
      >
        {label}
        <ChevronDown aria-hidden size={13} className={cn("transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-5 pt-1 animate-reveal">{children}</div>}
    </div>
  );
};

export default MoreSection;
