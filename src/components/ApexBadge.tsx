import { Zap, Flame, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApexBadgeProps {
  /** Tier this badge represents. Defaults to "apex". Legend renders the Founder variant. */
  tier?: "apex" | "legend";
  /** True if this Apex tier was achieved via paid Apex Instant subscription. Ignored for legend. */
  isFounding?: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
}

/**
 * Tiny inline badge that distinguishes:
 *  - Founding Apex (paid ⚡)
 *  - Earned Apex (top 1% 🔥)
 *  - Founder (Legend, top 0.1% 🔱 / Crown)
 *
 * Apex variants share the flame/gold gradient — only the icon differs.
 * Legend (Founder) uses the purple/gold/rose gradient to match the tier identity.
 */
const ApexBadge = ({
  tier = "apex",
  isFounding = false,
  size = "sm",
  className,
}: ApexBadgeProps) => {
  const sizes = {
    xs: { wrap: "h-4 px-1.5 text-[8px] gap-0.5", icon: 8 },
    sm: { wrap: "h-5 px-2 text-[9px] gap-0.5", icon: 9 },
    md: { wrap: "h-6 px-2.5 text-[10px] gap-1", icon: 11 },
  };
  const s = sizes[size];

  if (tier === "legend") {
    return (
      <span
        title="Founder — Top 0.1%, Founders Circle"
        className={cn(
          "inline-flex items-center rounded-full font-black uppercase tracking-wider",
          "bg-gradient-to-r from-[hsl(280_70%_55%)] via-[hsl(var(--gold))] to-[hsl(350_80%_55%)]",
          "text-background border border-[hsl(var(--gold))]/60",
          "shadow-[0_0_10px_hsl(280_70%_60%/0.45)]",
          s.wrap,
          className,
        )}
      >
        <Crown size={s.icon} strokeWidth={2.6} />
        Founder
      </span>
    );
  }

  const Icon = isFounding ? Zap : Flame;
  const label = isFounding ? "Founding" : "Earned";
  const tooltip = isFounding
    ? "Founding Apex — Day-One Member"
    : "Earned Apex — Top 1%";

  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex items-center rounded-full font-black uppercase tracking-wider",
        "bg-gradient-to-r from-[hsl(18_95%_58%)] to-[hsl(var(--gold))]",
        "text-background border border-[hsl(18_95%_58%)]/60",
        "shadow-[0_0_8px_hsl(18_95%_58%/0.4)]",
        s.wrap,
        className,
      )}
    >
      <Icon size={s.icon} strokeWidth={2.6} />
      {label} Apex
    </span>
  );
};

export default ApexBadge;
