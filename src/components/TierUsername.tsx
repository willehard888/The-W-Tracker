import { forwardRef, type ElementType } from "react";
import { cn } from "@/lib/utils";
import { getTierUsernameClass } from "@/lib/status-tiers";

interface TierUsernameProps {
  username?: string | null;
  tier?: string | null;
  /** Show the leading @ */
  showAt?: boolean;
  /** Override / extend className (size, weight, truncate, etc.) */
  className?: string;
  /** Render as <span> by default. Use 'p' or 'h1' for headings */
  as?: "span" | "p" | "h1" | "h2" | "div";
  /** Fallback text when username is missing */
  fallback?: string;
}

/**
 * Renders a username with tier-specific gradient/glow styling.
 * forwardRef so framer-motion / wrappers can attach refs.
 */
const TierUsername = forwardRef<HTMLElement, TierUsernameProps>(
  (
    { username, tier, showAt = true, className, as: Tag = "span", fallback = "unknown" },
    ref,
  ) => {
    const name = username || fallback;
    const tierClass = getTierUsernameClass(tier || "recruit");
    const Component = Tag as ElementType;
    return (
      <Component ref={ref} className={cn(tierClass, className)}>
        {showAt ? "@" : ""}
        {name}
      </Component>
    );
  },
);

TierUsername.displayName = "TierUsername";

export default TierUsername;
