import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getTierConfig } from "@/lib/status-tiers";
import { Crown, Shield, Sparkles, Flame, Zap, Star } from "lucide-react";

interface StatusAvatarProps {
  src?: string | null;
  name?: string | null;
  tier: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showBadge?: boolean;
  className?: string;
}

const tierIcons: Record<string, any> = {
  recruit: Shield,
  normal: Shield,
  operator: Shield,
  performer: Star,
  high_performer: Zap,
  elite: Crown,
  apex: Flame,
  legend: Sparkles,
};

const sizeMap = {
  xs: { avatar: "h-7 w-7", ring: "p-[2px]", badge: "h-3 w-3", icon: 8 },
  sm: { avatar: "h-9 w-9", ring: "p-[2px]", badge: "h-4 w-4", icon: 9 },
  md: { avatar: "h-12 w-12", ring: "p-[2.5px]", badge: "h-5 w-5", icon: 11 },
  lg: { avatar: "h-16 w-16", ring: "p-[3px]", badge: "h-6 w-6", icon: 13 },
  xl: { avatar: "h-24 w-24", ring: "p-[3.5px]", badge: "h-8 w-8", icon: 16 },
};

const StatusAvatar = forwardRef<HTMLDivElement, StatusAvatarProps>(({
  src,
  name,
  tier,
  size = "md",
  showBadge = true,
  className,
}, ref) => {
  const config = getTierConfig(tier);
  const Icon = tierIcons[tier] || Shield;
  const sizes = sizeMap[size];
  const isLegend = tier === "legend";
  const isApex = tier === "apex";
  const isHighTier = ["elite", "apex", "legend"].includes(tier);

  const ringStyle = isLegend
    ? "bg-[conic-gradient(from_0deg,hsl(280_70%_58%),hsl(42_90%_55%),hsl(350_80%_55%),hsl(280_70%_58%))]"
    : isApex
    ? "bg-gradient-to-tr from-[hsl(18_95%_58%)] via-gold to-[hsl(18_95%_58%)]"
    : tier === "elite"
    ? "bg-gradient-to-tr from-gold via-gold to-gold/70"
    : tier === "high_performer"
    ? "bg-[hsl(var(--purple))]"
    : tier === "performer"
    ? "bg-[hsl(210_90%_56%)]"
    : tier === "operator"
    ? "bg-[hsl(var(--teal))]"
    : "bg-border";

  const initials = (name || "?").slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className={cn("relative inline-flex items-center justify-center align-middle", className)}>
      {/* Apex outer pulsing flame ring */}
      {isApex && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-full pointer-events-none status-amber-ring-breathe"
          style={{
            boxShadow:
              "0 0 0 2px hsl(18 95% 58% / 0.55), 0 0 16px 2px hsl(18 95% 58% / 0.5), 0 0 32px 4px hsl(var(--gold) / 0.35)",
          }}
        />
      )}

      {/* Apex — 2 orbiting embers (CSS-only rotation around the avatar) */}
      {isApex && (size === "lg" || size === "xl" || size === "md") && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 status-legend-conic-spin"
        >
          <span
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-1 h-1 rounded-full bg-[hsl(18_95%_58%)]"
            style={{ boxShadow: "0 0 6px hsl(18 95% 58%), 0 0 12px hsl(var(--gold))" }}
          />
          <span
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-[3px] h-[3px] rounded-full bg-gold"
            style={{ boxShadow: "0 0 5px hsl(var(--gold)), 0 0 10px hsl(18 95% 58%)" }}
          />
        </div>
      )}

      {/* Elite — sykkivä kultareuna (sisäreuna) */}
      {tier === "elite" && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-full pointer-events-none status-amber-ring-breathe"
          style={{
            boxShadow: "0 0 0 1px hsl(var(--gold) / 0.55), 0 0 14px 1px hsl(var(--gold) / 0.4)",
          }}
        />
      )}

      <div
        className={cn(
          "relative rounded-full flex items-center justify-center",
          sizes.ring,
          ringStyle,
          isHighTier && "shadow-[0_0_12px_-2px_currentColor]",
          isApex && "apex-aura-large",
          // High Performer — first hint of warmth
          tier === "high_performer" && "shadow-[0_4px_12px_hsl(42_78%_54%/0.18)]",
        )}
        style={
          isHighTier
            ? {
                color: isLegend
                  ? "hsl(280 70% 60% / 0.5)"
                  : isApex
                  ? "hsl(18 95% 58% / 0.5)"
                  : "hsl(var(--gold) / 0.4)",
                willChange: "transform",
                transform: "translateZ(0)",
                backfaceVisibility: "hidden",
              }
            : undefined
        }
      >
        <Avatar className={cn(sizes.avatar, "ring-2 ring-background block")}>
          {src && <AvatarImage src={src} alt={name || ""} />}
          <AvatarFallback className="text-xs font-bold bg-secondary">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>

      {showBadge && (
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-background flex items-center justify-center",
            sizes.badge,
            isLegend && "bg-[hsl(280_70%_55%)]",
            isApex && "bg-gradient-to-br from-[hsl(18_95%_58%)] to-gold shadow-[0_0_8px_hsl(18_95%_58%/0.7)]",
            tier === "elite" && "bg-gold",
            tier === "high_performer" && "bg-[hsl(var(--purple))]",
            tier === "performer" && "bg-[hsl(210_90%_56%)]",
            tier === "operator" && "bg-[hsl(var(--teal))]",
            ["recruit", "normal"].includes(tier) && "bg-secondary border-border",
          )}
        >
          <Icon
            size={sizes.icon}
            className={cn(
              ["recruit", "normal"].includes(tier)
                ? "text-muted-foreground"
                : "text-background",
              isApex && "status-flame-flicker",
            )}
            strokeWidth={2.5}
          />
        </div>
      )}

      {/* Apex top-right Zap accent — small, animated */}
      {isApex && (
        <div
          aria-hidden
          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gradient-to-br from-[hsl(18_95%_58%)] to-gold border border-background flex items-center justify-center shadow-[0_0_6px_hsl(18_95%_58%/0.8)] status-amber-ring-breathe"
        >
          <Zap size={9} className="text-background status-flame-flicker" strokeWidth={3} fill="currentColor" />
        </div>
      )}
    </div>
  );
});

StatusAvatar.displayName = "StatusAvatar";

export default StatusAvatar;
