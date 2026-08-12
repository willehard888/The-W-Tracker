import { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** The single H1 — the screen's purpose, in 1–3 words. */
  title: string;
  /** One short line of context. Optional. */
  subtitle?: string;
  /** Back affordance — renders a leading chevron button. */
  onBack?: () => void;
  /** At most ONE action, top-right. Keep screens to a single primary action. */
  action?: ReactNode;
  className?: string;
}

/**
 * The one header every screen uses. Enforces the "2-second clarity" rule:
 * a single H1 (what/where you are) + at most one action (what's next).
 *
 * Uniform type, spacing and back-button so every page reads as the same app.
 */
export const PageHeader = ({ title, subtitle, onBack, action, className }: PageHeaderProps) => (
  <div className={cn("flex items-start justify-between gap-3 mb-5", className)}>
    <div className="flex items-start gap-2 min-w-0">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="shrink-0 -ml-1 mt-0.5 h-10 w-10 rounded-full flex items-center justify-center text-muted-foreground active:scale-90 active:text-foreground transition-transform"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-black tracking-tight leading-none truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] text-muted-foreground mt-1 leading-snug">{subtitle}</p>
        )}
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export default PageHeader;
