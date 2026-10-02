import type { ReactNode } from "react";
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
    <span className="w-[5.5rem] shrink-0 text-dense font-bold leading-snug">{k}</span>
    <span className="text-dense text-muted-foreground leading-snug">{v}</span>
  </div>
);

/**
 * A door: one 44 pt row that leads somewhere. THE list row — icon or any
 * leading visual · label / sub · an optional trailing value or badge · the
 * chevron. Settings rows, the Coach's doors and the library rows are all
 * this silhouette (SettingsRow is this with a card's side padding).
 */
export const DoorRow = ({
  icon: Icon, leading, label, sub, trailing, onClick, className, disabled,
}: {
  icon?: LucideIcon;
  /** Replaces the icon slot (an avatar, a thumbnail, an emoji). */
  leading?: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  /** A value or badge before the chevron. */
  trailing?: ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn("press-row w-full min-h-11 flex items-center gap-3 py-3 text-left disabled:opacity-50", className)}
  >
    {leading ?? (Icon && <Icon size={16} className="text-muted-foreground shrink-0" aria-hidden />)}
    <span className="flex-1 min-w-0">
      <span className="block text-note font-semibold leading-tight truncate">{label}</span>
      {sub && <span className="block text-meta text-muted-foreground leading-snug mt-0.5 truncate">{sub}</span>}
    </span>
    {trailing}
    <ChevronRight size={16} className="text-muted-foreground/75 shrink-0" aria-hidden />
  </button>
);

/**
 * A ready question: the way to talk to the coach. The same row as a door,
 * but the question wraps (72 characters never fit one phone line) and the
 * chevron is gold — this row is the primary action wherever it stands.
 */
export const QuestionRow = ({ question, onClick, className }: { question: string; onClick: () => void; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn("press-row w-full min-h-11 flex items-center gap-3 py-2.5 text-left", className)}
  >
    <span className="flex-1 min-w-0 text-dense font-semibold text-foreground leading-snug">{question}</span>
    <ChevronRight size={16} className="text-gold shrink-0" aria-hidden />
  </button>
);
