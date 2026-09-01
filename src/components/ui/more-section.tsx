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
        className="w-full flex items-center justify-center gap-1.5 py-2.5 eyebrow text-muted-foreground/70 active:text-foreground transition-colors"
      >
        {label}
        <ChevronDown aria-hidden size={13} className={cn("transition-transform duration-200", open && "rotate-180")} />
      </button>
      {/* No space-y here: children carry their own bottom margins, and the two
          compounded into ~36px gaps inside a page laid out on a 16px rhythm. */}
      {open && <div className="pt-1 animate-reveal">{children}</div>}
    </div>
  );
};

export default MoreSection;
