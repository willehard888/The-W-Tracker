import { cn } from "@/lib/utils";
import { getTierConfig, formatTier } from "@/lib/status-tiers";
import { Crown, Shield, Sparkles, Flame, Zap, Star } from "lucide-react";

interface StatusBadgeProps {
  tier: string;
  /** Division within the tier (0=none, 1=III..3=I). Shows "Elite II" when set. */
  division?: number | null;
  size?: "sm" | "md" | "lg";
  showAura?: boolean;
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

const StatusBadge = ({ tier, division = 0, size = "md", showAura = true, className }: StatusBadgeProps) => {
  const config = getTierConfig(tier);
  const Icon = tierIcons[tier] || Shield;
  
  const sizeClasses = {
    sm: "px-2.5 py-0.5 text-[10px] gap-1",
    md: "px-3.5 py-1 text-xs gap-1.5",
    lg: "px-4 py-1.5 text-sm gap-2",
  };

  const iconSizes = { sm: 10, md: 12, lg: 14 };

  const isHighTier = ['elite', 'apex', 'legend'].includes(tier);
  const isLegend = tier === 'legend';
  const isApex = tier === 'apex';

  return (
    <div className={cn("relative", className)}>
      {/* Aura glow for high tiers */}
      {showAura && isHighTier && (
        <div
          className={cn(
            "absolute -inset-1 rounded-full blur-md pointer-events-none",
            (isLegend || isApex) ? "status-amber-ring-breathe" : "animate-pulse",
            isLegend && "opacity-50",
            isApex && "opacity-40",
            !isLegend && !isApex && "opacity-30"
          )}
          style={{
            background: isLegend
              ? "linear-gradient(135deg, hsl(280 70% 58%), hsl(42 90% 55%), hsl(350 80% 55%))"
              : isApex
              ? "linear-gradient(135deg, hsl(var(--ember)), hsl(42 90% 55%))"
              : "linear-gradient(135deg, hsl(var(--gold)), hsl(42 90% 65%))",
          }}
        />
      )}
      
      <div
        className={cn(
          "relative flex items-center rounded-full border font-black uppercase tracking-wider",
          sizeClasses[size],
          config.borderClass,
          isLegend && "border-[hsl(280_70%_60%)]/50 bg-gradient-to-r from-[hsl(280_70%_55%)]/12 via-gold/8 to-[hsl(350_80%_55%)]/8",
          isApex && "border-[hsl(var(--ember))]/40 bg-gradient-to-r from-[hsl(var(--ember))]/10 to-gold/8",
          tier === 'elite' && "border-gold/40 bg-gold/8",
          tier === 'high_performer' && "border-[hsl(var(--purple))]/30 bg-[hsl(var(--purple))]/5",
          tier === 'performer' && "border-[hsl(210_90%_56%)]/25 bg-[hsl(210_90%_56%)]/5",
          tier === 'operator' && "border-[hsl(var(--teal))]/25 bg-[hsl(var(--teal))]/5",
          ['recruit', 'normal'].includes(tier) && "border-border bg-secondary/50",
        )}
      >
        <Icon
          size={iconSizes[size]}
          className={cn(
            isLegend && "text-[hsl(280_70%_65%)] drop-shadow-[0_0_4px_hsl(280_70%_60%/0.5)]",
            isApex && "text-[hsl(var(--ember))] drop-shadow-[0_0_4px_hsl(var(--ember)/0.4)] status-flame-flicker",
            tier === 'elite' && "text-gold drop-shadow-[0_0_4px_hsl(var(--gold)/0.4)]",
            tier === 'elite' && size === 'lg' && "status-flame-flicker",
            tier === 'high_performer' && "text-[hsl(var(--purple))]",
            tier === 'performer' && "text-[hsl(210_90%_56%)]",
            tier === 'operator' && "text-[hsl(var(--teal))]",
            ['recruit', 'normal'].includes(tier) && "text-muted-foreground",
          )}
        />
        <span
          className={cn(
            isLegend && "bg-gradient-to-r from-[hsl(280_70%_65%)] via-gold to-[hsl(350_80%_60%)] bg-clip-text text-transparent",
            isApex && "bg-gradient-to-r from-[hsl(var(--ember))] to-gold bg-clip-text text-transparent",
            tier === 'elite' && "text-gold",
            tier === 'high_performer' && "text-[hsl(var(--purple))]",
            tier === 'performer' && "text-[hsl(210_90%_56%)]",
            tier === 'operator' && "text-[hsl(var(--teal))]",
            ['recruit', 'normal'].includes(tier) && "text-muted-foreground",
          )}
        >
          {formatTier(tier, division)}
        </span>
      </div>
    </div>
  );
};

export default StatusBadge;
