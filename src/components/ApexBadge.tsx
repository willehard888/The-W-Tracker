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
 *  - Earned Apex (top 1%, hillitty 🔥)
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

  // ── Founding Apex — premium, commercial, day-one member ──────────
  if (isFounding) {
    // bump up one size visually for commercial tier
    const upWrap =
      size === "xs"
        ? "h-5 pl-1.5 pr-2 text-[9px] gap-1"
        : size === "sm"
        ? "h-6 pl-2 pr-2.5 text-[10px] gap-1"
        : "h-7 pl-2.5 pr-3 text-[11px] gap-1.5";
    const upIcon = size === "xs" ? 9 : size === "sm" ? 11 : 13;

    return (
      <span
        title="Founding Apex — €15.99/mo · Day-One Member · Tier locked at Apex"
        className={cn(
          "founding-premium-shimmer relative inline-flex items-center rounded-full font-black uppercase tracking-wider",
          // Conic premium-credit-card feel
          "border border-[hsl(var(--gold))]/80 text-background",
          "shadow-[0_2px_10px_hsl(18_95%_58%/0.45),0_0_22px_hsl(var(--gold)/0.45)]",
          upWrap,
          className,
        )}
      >
        {/* Crown over Zap stack — denotes "purchased + instant" */}
        <span className="relative inline-flex items-center justify-center">
          <Crown
            size={upIcon}
            strokeWidth={2.8}
            className="drop-shadow-[0_0_3px_hsl(var(--gold)/0.9)]"
          />
          <Zap
            size={Math.round(upIcon * 0.55)}
            strokeWidth={3}
            className="absolute -bottom-0.5 -right-1 text-background fill-background"
          />
        </span>
        <span className="relative z-10 leading-none">Founding</span>
        <Sparkle
          size={Math.round(upIcon * 0.7)}
          strokeWidth={2.6}
          className="relative z-10 animate-pulse drop-shadow-[0_0_3px_hsl(var(--gold))]"
        />
      </span>
    );
  }

  // ── Earned Apex — hillitty top 1% ────────────────────────────────
  return (
    <span
      title="Earned Apex — Top 1%"
      className={cn(
        "inline-flex items-center rounded-full font-black uppercase tracking-wider",
        "bg-gradient-to-r from-[hsl(18_95%_58%)] to-[hsl(var(--gold))]",
        "text-background border border-[hsl(18_95%_58%)]/60",
        "shadow-[0_0_8px_hsl(18_95%_58%/0.4)]",
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
