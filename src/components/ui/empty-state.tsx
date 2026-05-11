import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Lucide icon component (rendered ~22 px, gold accent). Optional. */
  icon?: LucideIcon;
  /** Short, bold headline. Sentence case, no period. */
  title: string;
  /** One-line context below the title. Optional. */
  description?: string;
  /** Optional CTA — rendered after the description. Typically a <button>. */
  action?: ReactNode;
  /** Visual density. `default` for full sections, `compact` for inline lists. */
  size?: "default" | "compact";
  className?: string;
}

/**
 * Unified empty-state primitive — single visual language for the ~10
 * scattered "No X yet" placeholders across the app.
 *
 *   <EmptyState
 *     icon={Swords}
 *     title="No battles yet"
 *     description="Challenge someone above your rank to start one."
 *     action={<Button onClick={...}>Find rivals</Button>}
 *   />
 *
 * Variants:
 *   - default: full-width card, ample padding, used for empty pages/sections.
 *   - compact: inline, no card chrome, used inside dense list shells.
 */
export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  size = "default",
  className,
}: EmptyStateProps) => {
  const isCompact = size === "compact";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        isCompact
          ? "py-6 px-4 gap-1.5"
          : "rounded-2xl border border-dashed border-border/50 bg-card/40 px-6 py-8 gap-2",
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            "rounded-full flex items-center justify-center",
            isCompact
              ? "h-9 w-9 mb-1 bg-gold/10"
              : "h-11 w-11 mb-2 bg-gradient-to-br from-gold/15 to-gold/5 border border-gold/20",
          )}
        >
          <Icon
            className={cn("text-gold/80", isCompact ? "h-4 w-4" : "h-5 w-5")}
            strokeWidth={2}
            aria-hidden
          />
        </div>
      )}
      <p
        className={cn(
          "font-semibold text-foreground/90 tracking-tight",
          isCompact ? "text-[13px]" : "text-sm",
        )}
      >
        {title}
      </p>
      {description && (
        <p
          className={cn(
            "text-muted-foreground/70 leading-relaxed max-w-[260px]",
            isCompact ? "text-[11px]" : "text-xs",
          )}
        >
          {description}
        </p>
      )}
      {action && <div className={cn("mt-2", isCompact && "mt-1.5")}>{action}</div>}
    </div>
  );
};

export default EmptyState;
