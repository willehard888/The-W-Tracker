import { Sparkles, AlertTriangle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * CoachLine — the missing primitive that lets us drop Coach voice into
 * any surface (home, profile, post-checkin, banners) without rebuilding
 * the visual treatment each time.
 *
 * Same gold accent + Sparkles icon + italicised body as YourBlueprintCard
 * so users recognise the Coach voice instantly wherever it shows up.
 *
 * Tones are visual, not semantic — the *text* drives meaning. The tone
 * just nudges the icon + accent colour so a warning reads urgent and a
 * celebration reads bright.
 */

export type CoachLineTone = "default" | "warning" | "celebration";

export interface CoachLineProps {
  text: string;
  tone?: CoachLineTone;
  /** Override the default icon for the chosen tone. */
  icon?: React.ReactNode;
  /** Optional tap target — usually `/coach` so the line is an entry point. */
  onClick?: () => void;
  className?: string;
  /** Prefix the line with the literal word "Coach:" — defaults to true. */
  withPrefix?: boolean;
  /** Cap visible text length so cards stay one line on tight viewports. */
  maxChars?: number;
}

const TONE_STYLES: Record<CoachLineTone, { border: string; bg: string; iconColor: string }> = {
  default: {
    border: "border-gold/40",
    bg: "bg-gradient-to-r from-gold/10 via-gold/5 to-transparent",
    iconColor: "text-gold",
  },
  warning: {
    border: "border-rose-400/45",
    bg: "bg-gradient-to-r from-rose-400/12 via-rose-400/6 to-transparent",
    iconColor: "text-rose-300",
  },
  celebration: {
    border: "border-xp-green/45",
    bg: "bg-gradient-to-r from-xp-green/12 via-xp-green/6 to-transparent",
    iconColor: "text-xp-green",
  },
};

const DEFAULT_ICON: Record<CoachLineTone, React.ReactNode> = {
  default: <Sparkles size={13} aria-hidden />,
  warning: <AlertTriangle size={13} aria-hidden />,
  celebration: <Trophy size={13} aria-hidden />,
};

const CoachLine = ({
  text,
  tone = "default",
  icon,
  onClick,
  className,
  withPrefix = true,
  maxChars = 180,
}: CoachLineProps) => {
  if (!text || !text.trim()) return null;

  const styles = TONE_STYLES[tone] ?? TONE_STYLES.default;
  const resolvedIcon = icon ?? DEFAULT_ICON[tone];
  // Trim long copy so the pill stays compact. Edge-function or templated
  // text could exceed the budget; we cut to maxChars and add an ellipsis.
  const body = text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text;

  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl border-l-2 px-3.5 py-2.5",
        "flex items-start gap-2.5",
        styles.border,
        styles.bg,
        onClick && "transition-transform",
        className,
      )}
      aria-label={onClick ? "Open AI Coach" : undefined}
    >
      <span className={cn("shrink-0 mt-0.5", styles.iconColor)}>{resolvedIcon}</span>
      <p className="text-[12px] italic leading-snug text-foreground/90">
        {withPrefix && (
          <span className={cn("not-italic font-black mr-1.5", styles.iconColor)}>Coach:</span>
        )}
        {body}
      </p>
    </Component>
  );
};

export default CoachLine;
