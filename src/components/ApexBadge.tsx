import { Zap, Flame, Crown, Sparkle } from "lucide-react";
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
 *  - Founding Apex (paid, premium credit-card vibe — Crown+Zap, shimmer, sparkle accent)
 *  - Earned Apex (top 10%, hillitty 🔥)
 *  - Founder (Legend, top 0.1%, Crown)
 *
 * Founding Apex is intentionally larger + flashier than Earned Apex
 * to make the commercial tier visually aspirational.
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

  // ── Legend / Founder ──────────────────────────────────────────────
  if (tier === "legend") {
    return (
      <span
        title="Legend — Top 0.1%, Founders Circle"
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

  // ── Founding Apex — simple, premium, readable ────────────────────
  if (isFounding) {
    return (
      <span
        title="Founding Apex — Day-One Member"
        className={cn(
          "inline-flex items-center rounded-full font-black uppercase tracking-wider",
          "bg-gradient-to-r from-gold via-[hsl(42_90%_70%)] to-gold text-[hsl(260_18%_4%)]",
          "border border-gold shadow-[0_0_14px_hsl(var(--gold)/0.55)]",
          s.wrap,
          className,
        )}
      >
        <Crown size={s.icon} strokeWidth={3} />
        Funding Apex
      </span>
    );
  }

  // ── Earned Apex — hillitty top 10% ────────────────────────────────
  return (
    <span
      title="Earned Apex — Top 10%"
      className={cn(
        "inline-flex items-center rounded-full font-black uppercase tracking-wider",
        "bg-gradient-to-r from-[hsl(var(--ember))] to-[hsl(var(--gold))]",
        "text-background border border-[hsl(var(--ember))]/60",
        "shadow-[0_0_8px_hsl(var(--ember)/0.4)]",
        s.wrap,
        className,
      )}
    >
      <Flame size={s.icon} strokeWidth={2.6} />
      Earned Apex
    </span>
  );
};

export default ApexBadge;
