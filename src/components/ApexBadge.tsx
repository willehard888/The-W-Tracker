import { Zap, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApexBadgeProps {
  /** True if this Apex tier was achieved via paid Apex Instant subscription. */
  isFounding?: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
}

/**
 * Tiny inline badge that distinguishes Founding Apex (paid)
 * from Earned Apex (top 1% of the leaderboard).
 *
 * Both share the same flame/gold visual identity — the only difference
 * is the icon (⚡ vs 🔥), as a quiet signal of how the tier was achieved.
 */
const ApexBadge = ({ isFounding = false, size = "sm", className }: ApexBadgeProps) => {
  const sizes = {
    xs: { wrap: "h-4 px-1.5 text-[8px] gap-0.5", icon: 8 },
    sm: { wrap: "h-5 px-2 text-[9px] gap-0.5", icon: 9 },
    md: { wrap: "h-6 px-2.5 text-[10px] gap-1", icon: 11 },
  };
  const s = sizes[size];
  const Icon = isFounding ? Zap : Flame;
  const label = isFounding ? "Founding" : "Earned";

  return (
    <span
      title={`${label} Apex`}
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
      Apex
    </span>
  );
};

export default ApexBadge;
