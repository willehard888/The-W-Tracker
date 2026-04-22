import { motion } from "framer-motion";
import { Crown, Flame, Sparkles, Zap, Star, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTierConfig, type StatusTier } from "@/lib/status-tiers";

interface StatusNameplateProps {
  tier: string;
  /** Optional: shows "#N · top X%" when provided */
  rank?: number;
  totalUsers?: number;
  percentile?: number;
  /** Slightly more compact variant for public/user profile */
  size?: "md" | "lg";
  className?: string;
}

const tierIcons: Record<string, typeof Crown> = {
  recruit: Shield,
  normal: Shield,
  operator: Shield,
  performer: Star,
  high_performer: Zap,
  elite: Crown,
  apex: Flame,
  legend: Sparkles,
};

/**
 * Massive, dramatic status nameplate.
 * Bigger than any other element on the profile — makes status FEEL earned.
 * Each tier has its own color, glow, and animation treatment.
 */
const StatusNameplate = ({
  tier,
  rank,
  totalUsers,
  percentile,
  size = "lg",
  className,
}: StatusNameplateProps) => {
  const cfg = getTierConfig(tier);
  const Icon = tierIcons[tier] || Shield;

  const isLegend = tier === "legend";
  const isApex = tier === "apex";
  const isElite = tier === "elite";
  const isHigh = tier === "high_performer";
  const isPerformer = tier === "performer";
  const isOperator = tier === "operator";

  // Per-tier label gradient/color
  const labelClass = isLegend
    ? "text-transparent bg-clip-text bg-gradient-to-r from-[hsl(280_70%_75%)] via-gold to-[hsl(350_80%_70%)] drop-shadow-[0_2px_22px_hsl(280_70%_60%/0.55)]"
    : isApex
    ? "text-transparent bg-clip-text bg-gradient-to-r from-[hsl(18_95%_62%)] via-gold to-[hsl(18_95%_62%)] drop-shadow-[0_2px_22px_hsl(18_95%_58%/0.55)]"
    : isElite
    ? "text-transparent bg-clip-text bg-gradient-to-r from-gold-light via-gold to-gold-dark drop-shadow-[0_2px_18px_hsl(var(--gold)/0.5)]"
    : isHigh
    ? "text-[hsl(var(--purple))] drop-shadow-[0_2px_14px_hsl(var(--purple)/0.5)]"
    : isPerformer
    ? "text-[hsl(210_90%_64%)] drop-shadow-[0_2px_12px_hsl(210_90%_56%/0.45)]"
    : isOperator
    ? "text-[hsl(var(--teal))] drop-shadow-[0_2px_12px_hsl(var(--teal)/0.45)]"
    : "text-foreground/85";

  // Per-tier border + bg
  const wrapperClass = isLegend
    ? "border-[hsl(280_70%_60%)]/45 bg-[radial-gradient(120%_140%_at_50%_0%,hsl(280_70%_55%/0.18),hsl(42_90%_55%/0.08)_45%,hsl(350_80%_55%/0.1)_75%,transparent)]"
    : isApex
    ? "border-[hsl(18_95%_58%)]/55 bg-[radial-gradient(120%_140%_at_50%_0%,hsl(18_95%_58%/0.18),hsl(var(--gold)/0.08)_55%,transparent)]"
    : isElite
    ? "border-gold/45 bg-[radial-gradient(120%_140%_at_50%_0%,hsl(var(--gold)/0.14),transparent_70%)]"
    : isHigh
    ? "border-[hsl(var(--purple))]/40 bg-[radial-gradient(120%_140%_at_50%_0%,hsl(var(--purple)/0.14),transparent_70%)]"
    : isPerformer
    ? "border-[hsl(210_90%_56%)]/35 bg-[radial-gradient(120%_140%_at_50%_0%,hsl(210_90%_56%/0.12),transparent_70%)]"
    : isOperator
    ? "border-[hsl(var(--teal))]/35 bg-[radial-gradient(120%_140%_at_50%_0%,hsl(var(--teal)/0.12),transparent_70%)]"
    : "border-border/60 bg-secondary/30";

  // Glow shadow per tier
  const glowClass = isLegend
    ? "shadow-[0_0_44px_-6px_hsl(280_70%_60%/0.55),0_0_70px_-12px_hsl(var(--gold)/0.3)]"
    : isApex
    ? "shadow-[0_0_40px_-4px_hsl(18_95%_58%/0.5),0_0_60px_-10px_hsl(var(--gold)/0.35)]"
    : isElite
    ? "shadow-[0_0_32px_-4px_hsl(var(--gold)/0.55)]"
    : isHigh
    ? "shadow-[0_0_28px_-4px_hsl(var(--purple)/0.45)]"
    : isPerformer
    ? "shadow-[0_0_22px_-4px_hsl(210_90%_56%/0.35)]"
    : isOperator
    ? "shadow-[0_0_22px_-4px_hsl(var(--teal)/0.35)]"
    : "";

  const iconColor = isLegend
    ? "text-[hsl(280_70%_75%)]"
    : isApex
    ? "text-[hsl(18_95%_62%)]"
    : isElite
    ? "text-gold"
    : isHigh
    ? "text-[hsl(var(--purple))]"
    : isPerformer
    ? "text-[hsl(210_90%_64%)]"
    : isOperator
    ? "text-[hsl(var(--teal))]"
    : "text-muted-foreground";

  const labelSize = size === "lg" ? "text-[40px] sm:text-[44px]" : "text-[34px]";
  const padding = size === "lg" ? "px-5 py-4" : "px-4 py-3.5";

  // Show percentile from profile config (fallback) when no live one provided
  const percentLabel =
    percentile !== undefined
      ? `Top ${percentile <= 1 ? "1" : Math.max(1, Math.round(100 - percentile))}%`
      : cfg.percentile;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className={cn(
        "relative w-full max-w-[420px] mx-auto rounded-2xl border backdrop-blur-sm overflow-hidden",
        padding,
        wrapperClass,
        glowClass,
        className,
      )}
    >
      {/* Sweeping shine for top tiers */}
      {(isLegend || isApex) && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background: isLegend
              ? "conic-gradient(from 200deg at 50% 30%, hsl(280 70% 58%/0.22), hsl(42 90% 55%/0.16), hsl(350 80% 55%/0.2), hsl(280 70% 58%/0.22))"
              : "radial-gradient(ellipse at 30% 20%, hsl(18 95% 58%/0.2), transparent 60%)",
          }}
        />
      )}

      {/* Animated ember dots — apex */}
      {isApex && (
        <>
          <span
            aria-hidden
            className="absolute top-3 right-5 h-1 w-1 rounded-full bg-[hsl(18_95%_58%)] animate-pulse"
          />
          <span
            aria-hidden
            className="absolute bottom-3 left-6 h-0.5 w-0.5 rounded-full bg-gold animate-pulse"
            style={{ animationDelay: "0.6s" }}
          />
        </>
      )}

      {/* Sparkle accents — legend */}
      {isLegend && (
        <>
          <Sparkles
            size={11}
            className="absolute top-2.5 right-3 text-gold/80 animate-pulse"
          />
          <Sparkles
            size={8}
            className="absolute bottom-3 left-3 text-[hsl(280_70%_75%)]/70 animate-pulse"
            style={{ animationDelay: "0.9s" }}
          />
        </>
      )}

      <div className="relative flex flex-col items-center text-center gap-1.5">
        {/* Tiny eyebrow */}
        <p className="text-[9px] font-black uppercase tracking-[0.32em] text-muted-foreground/70">
          Status
        </p>

        {/* The main event — huge tier label with icon */}
        <div className="flex items-center justify-center gap-2.5">
          <Icon
            size={size === "lg" ? 26 : 22}
            strokeWidth={2.6}
            className={cn(iconColor, "drop-shadow-[0_0_8px_currentColor]")}
          />
          <h2
            className={cn(
              "font-display font-black tracking-tight uppercase leading-none",
              labelSize,
              labelClass,
            )}
          >
            {cfg.label}
          </h2>
          <Icon
            size={size === "lg" ? 26 : 22}
            strokeWidth={2.6}
            className={cn(iconColor, "drop-shadow-[0_0_8px_currentColor] scale-x-[-1]")}
          />
        </div>

        {/* Percentile + rank */}
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              "text-[10px] font-black uppercase tracking-[0.22em] px-2.5 py-1 rounded-full border",
              isLegend && "border-[hsl(280_70%_60%)]/40 text-[hsl(280_70%_80%)] bg-[hsl(280_70%_55%)]/10",
              isApex && "border-[hsl(18_95%_58%)]/45 text-[hsl(18_95%_70%)] bg-[hsl(18_95%_58%)]/10",
              isElite && "border-gold/45 text-gold bg-gold/10",
              isHigh && "border-[hsl(var(--purple))]/40 text-[hsl(var(--purple))] bg-[hsl(var(--purple))]/10",
              isPerformer && "border-[hsl(210_90%_56%)]/40 text-[hsl(210_90%_68%)] bg-[hsl(210_90%_56%)]/10",
              isOperator && "border-[hsl(var(--teal))]/40 text-[hsl(var(--teal))] bg-[hsl(var(--teal))]/10",
              ["recruit", "normal"].includes(tier) && "border-border/50 text-muted-foreground bg-secondary/40",
            )}
          >
            {percentLabel}
          </span>
          {rank !== undefined && totalUsers !== undefined && totalUsers > 0 && (
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/80">
              #{rank.toLocaleString()}
              <span className="text-muted-foreground/50 font-bold">
                {" / "}
                {totalUsers.toLocaleString()}
              </span>
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default StatusNameplate;
