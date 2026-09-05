import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The Coach family's two quiet silhouettes. Both live inside a
 * `divide-y divide-border/35 border-t border-border/35` list: type on the
 * page, no boxes, so the hero above stays the only card with weight.
 */

/** A fact: bold key, muted line. */
export const FactRow = ({ k, v }: { k: string; v: string }) => (
  <div className="py-3 flex gap-3">
    <span className="w-[5.5rem] shrink-0 text-[13px] font-bold leading-snug">{k}</span>
    <span className="text-[13px] text-muted-foreground leading-snug">{v}</span>
  </div>
);

/** A door: one 44 pt row that leads somewhere. */
export const DoorRow = ({
  icon: Icon, label, sub, onClick, className,
}: {
  icon?: LucideIcon;
  label: string;
  sub?: string;
  onClick: () => void;
  className?: string;
}) => (
  <button type="button" onClick={onClick} className={cn("press w-full min-h-11 flex items-center gap-3 py-3 text-left", className)}>
    {Icon && <Icon size={15} className="text-muted-foreground shrink-0" aria-hidden />}
    <span className="flex-1 min-w-0">
      <span className="block text-[14px] font-semibold leading-tight truncate">{label}</span>
      {sub && <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5">{sub}</span>}
    </span>
    <ChevronRight size={16} className="text-muted-foreground/60 shrink-0" aria-hidden />
  </button>
);
