import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one sub-page bar: a 44 pt back target, the screen's name, and at most
 * one right-hand action. Owns the safe-area inset (the brand header is hidden
 * on every sub-page) and sticks so the way out never scrolls away. A node
 * `title` (date strip, partner row) renders in the same slot without an h1.
 *
 * Opaque on purpose: at 97 % the rows scrolling underneath still showed
 * through as a ghost on the 1.8 %-lightness ground — nothing blurs, so
 * there was nothing to gain from the 3 %.
 */
const PageBar = ({
  title,
  onBack,
  action,
  sticky = true,
}: {
  title?: ReactNode;
  onBack?: () => void;
  action?: ReactNode;
  sticky?: boolean;
}) => (
  <header
    className={cn(
      "shrink-0 safe-top z-20 bg-background chrome-top-elevated px-2 pt-3 pb-2 flex items-center gap-1",
      sticky && "sticky top-0",
    )}
  >
    {onBack ? (
      <Button variant="ghost" size="icon" aria-label="Back" onClick={onBack}>
        <ArrowLeft aria-hidden size={18} />
      </Button>
    ) : (
      <span className="w-10" aria-hidden />
    )}
    {typeof title === "string" ? (
      <h1 className="flex-1 min-w-0 font-display text-base font-black tracking-tight truncate">{title}</h1>
    ) : (
      <div className="flex-1 min-w-0">{title}</div>
    )}
    {action ?? <span className="w-10" aria-hidden />}
  </header>
);

export default PageBar;
