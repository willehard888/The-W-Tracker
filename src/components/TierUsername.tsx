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
 * Centralizes the tier-color treatment so every list, card and feed
 * shows the same visual hierarchy.
 */
const TierUsername = ({
  username,
  tier,
  showAt = true,
  className,
  as: Tag = "span",
  fallback = "unknown",
}: TierUsernameProps) => {
  const name = username || fallback;
  const tierClass = getTierUsernameClass(tier || "recruit");
  return (
    <Tag className={cn(tierClass, className)}>
      {showAt ? "@" : ""}
      {name}
    </Tag>
  );
};

export default TierUsername;
