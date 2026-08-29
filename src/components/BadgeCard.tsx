import { forwardRef } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

interface BadgeCardProps {
  name: string;
  icon: string;
  rarity: BadgeRarity;
  earned?: boolean;
  description?: string;
  showcase?: boolean;
  /** When true, renders a more compact card optimized for 3-col grids */
  compact?: boolean;
}

const rarityConfig: Record<BadgeRarity, {
  border: string;
  surface: string;
  iconRing: string;
  iconBg: string;
  label: string;
  labelChip: string;
  glow: string;
  conicRim?: string;
}> = {
  common: {
    border: "border-[hsl(var(--badge-common)_/_0.22)]",
    surface: "badge-holo-surface",
    iconRing: "border-[hsl(var(--badge-common)_/_0.3)]",
    iconBg: "bg-[hsl(var(--badge-common)_/_0.1)]",
    label: "text-[hsl(var(--badge-common))]",
    labelChip: "bg-[hsl(var(--badge-common)_/_0.1)] border-[hsl(var(--badge-common)_/_0.25)]",
    glow: "badge-glow-common",
  },
  rare: {
    border: "border-[hsl(var(--badge-rare)_/_0.35)]",
    surface: "badge-holo-surface-rare",
    iconRing: "border-[hsl(var(--badge-rare)_/_0.45)]",
    iconBg: "bg-[hsl(var(--badge-rare)_/_0.14)]",
    label: "text-[hsl(var(--badge-rare))]",
    labelChip: "bg-[hsl(var(--badge-rare)_/_0.12)] border-[hsl(var(--badge-rare)_/_0.3)]",
    glow: "badge-glow-rare",
  },
  epic: {
    border: "border-[hsl(var(--badge-epic)_/_0.4)]",
    surface: "badge-holo-surface-epic",
    iconRing: "border-[hsl(var(--badge-epic)_/_0.55)]",
    iconBg: "bg-[hsl(var(--badge-epic)_/_0.16)]",
    label: "text-[hsl(var(--badge-epic))]",
    labelChip: "bg-[hsl(var(--badge-epic)_/_0.14)] border-[hsl(var(--badge-epic)_/_0.35)]",
    glow: "badge-glow-epic",
    conicRim: "badge-conic-rim-epic",
  },
  legendary: {
    border: "border-gold/45",
    surface: "badge-holo-surface-legendary",
    iconRing: "border-gold/55",
    iconBg: "bg-gold/15",
    label: "text-gold",
    labelChip: "bg-gold/12 border-gold/40",
    glow: "badge-glow-legendary",
    conicRim: "badge-conic-rim-legendary",
  },
};

const BadgeCard = forwardRef<HTMLDivElement, BadgeCardProps>(
  ({ name, icon, rarity, earned = true, description, showcase = false, compact = false }, ref) => {
    const style = rarityConfig[rarity];
    const isLegendary = rarity === "legendary";
    const isEpicPlus = rarity === "epic" || isLegendary;

    if (showcase) {
      return (
        <div
          ref={ref}
          className={cn(
            "relative flex flex-col items-center gap-1",
            !earned && "badge-locked"
          )}
        >
          <div
            className={cn(
              "relative flex h-12 w-12 items-center justify-center rounded-full text-xl border overflow-hidden",
              style.iconRing,
              style.iconBg,
              earned && style.glow,
              earned && isLegendary && "badge-shine animate-badge-float",
              earned && "badge-holo-sweep",
            )}
          >
            <span className="relative z-[2]">{icon}</span>
          </div>
          <p className="text-[10px] font-semibold text-foreground text-center leading-tight truncate w-full max-w-[64px]">
            {name}
          </p>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "group relative flex flex-col items-center gap-2 rounded-2xl border overflow-hidden transition-all duration-500",
          compact ? "p-3" : "p-4",
          style.border,
          style.surface,
          earned && style.glow,
          earned && isEpicPlus && style.conicRim,
          earned && "hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.97]",
          !earned && "badge-locked",
        )}
      >
        {/* Top-right rarity dot */}
        <span
          className={cn(
            "absolute top-2 right-2 h-1.5 w-1.5 rounded-full",
            rarity === "legendary" && "bg-gold shadow-[0_0_8px_hsl(var(--gold)/0.7)]",
            rarity === "epic" && "bg-[hsl(var(--badge-epic))] shadow-[0_0_6px_hsl(var(--badge-epic)/0.7)]",
            rarity === "rare" && "bg-[hsl(var(--badge-rare))] shadow-[0_0_6px_hsl(var(--badge-rare)/0.7)]",
            rarity === "common" && "bg-[hsl(var(--badge-common))]",
          )}
        />

        {/* Icon disc */}
        <div
          className={cn(
            "relative flex items-center justify-center rounded-full border overflow-hidden",
            compact ? "h-12 w-12 text-2xl" : "h-14 w-14 text-2xl",
            style.iconRing,
            style.iconBg,
            earned && "badge-holo-sweep",
            earned && isLegendary && "badge-shine animate-badge-float",
          )}
        >
          <span className="relative z-[2]">{icon}</span>
          {/* Outer halo ring for epic+ */}
          {earned && isEpicPlus && (
            <div
              className={cn(
                "absolute inset-[-3px] rounded-full border opacity-50 pointer-events-none",
                isLegendary ? "border-gold/40" : "border-[hsl(var(--badge-epic)_/_0.35)]"
              )}
            />
          )}
        </div>

        {/* Title */}
        <div className="relative text-center w-full px-1">
          <p
            className={cn(
              "font-bold text-foreground leading-tight line-clamp-2",
              compact ? "text-[12px]" : "text-xs"
            )}
          >
            {name}
          </p>
          <span
            className={cn(
              "inline-block mt-1 px-1.5 py-[1px] rounded-full text-[10px] font-black uppercase tracking-[0.22em] border",
              style.labelChip,
              style.label
            )}
          >
            {rarity}
          </span>
        </div>

        {description && !compact && (
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed line-clamp-2">
            {description}
          </p>
        )}

        {/* Locked overlay */}
        {!earned && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/30 backdrop-blur-[1px]">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background/80 border border-border">
              <Lock size={12} className="text-muted-foreground" />
            </div>
          </div>
        )}
      </div>
    );
  }
);

BadgeCard.displayName = "BadgeCard";

export default BadgeCard;
