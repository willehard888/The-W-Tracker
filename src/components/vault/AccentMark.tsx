import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The Vault's one progress mark: a 20 px circle in the shelf's accent. Done
 * is filled (a check, or the number on the fill), current is a ring in the
 * accent, idle waits in the border colour. Decorative — the row's text
 * carries the state. Loop stages, path steps, practice steps, the shelf's
 * lesson numbers and the quiz radio all draw this one circle.
 */
const AccentMark = ({
  accent,
  state,
  children,
  className,
}: {
  accent: string;
  state: "done" | "current" | "idle";
  /** A step number. Done shows a check unless a number is given. */
  children?: ReactNode;
  className?: string;
}) => (
  <span
    aria-hidden
    className={cn(
      "h-5 w-5 rounded-full shrink-0 flex items-center justify-center border text-label font-black tabular-nums",
      state === "idle" && "border-border/60 text-muted-foreground",
      className,
    )}
    style={
      state === "done"
        ? { background: accent, borderColor: accent, color: "hsl(var(--background))" }
        : state === "current"
          ? { borderColor: accent, color: accent }
          : undefined
    }
  >
    {state === "done" && children == null ? <Check size={12} strokeWidth={3} aria-hidden /> : children}
  </span>
);

export default AccentMark;
