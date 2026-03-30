import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

interface BadgeCardProps {
  name: string;
  icon: string;
  rarity: BadgeRarity;
  earned?: boolean;
  description?: string;
  showcase?: boolean;
}

const rarityConfig: Record<BadgeRarity, {
  border: string;
  bg: string;
  iconBg: string;
  label: string;
  glow: string;
  ring: string;
}> = {
  common: {
    border: "border-[hsl(var(--badge-common)_/_0.2)]",
    bg: "gradient-surface",
    iconBg: "bg-[hsl(var(--badge-common)_/_0.1)]",
    label: "text-[hsl(var(--badge-common))]",
    glow: "badge-glow-common",
    ring: "",
  },
  rare: {
    border: "border-[hsl(var(--badge-rare)_/_0.3)]",
    bg: "bg-[hsl(var(--badge-rare)_/_0.04)]",
    iconBg: "bg-[hsl(var(--badge-rare)_/_0.12)]",
    label: "text-[hsl(var(--badge-rare))]",
    glow: "badge-glow-rare",
    ring: "",
  },
  epic: {
    border: "border-[hsl(var(--badge-epic)_/_0.3)]",
    bg: "bg-[hsl(var(--badge-epic)_/_0.04)]",
    iconBg: "bg-[hsl(var(--badge-epic)_/_0.12)]",
    label: "text-[hsl(var(--badge-epic))]",
    glow: "badge-glow-epic",
    ring: "ring-1 ring-[hsl(var(--badge-epic)_/_0.15)]",
  },
  legendary: {
    border: "border-gold/40",
    bg: "bg-gold/[0.04]",
    iconBg: "bg-gold/15",
    label: "text-gold",
    glow: "badge-glow-legendary",
    ring: "ring-1 ring-gold/20",
  },
};

const BadgeCard = forwardRef<HTMLDivElement, BadgeCardProps>(({ name, icon, rarity, earned = true, description, showcase = false }, ref) => {
  const style = rarityConfig[rarity];

  if (showcase) {
    return (
      <div className={cn(
        "relative flex flex-col items-center gap-1",
        !earned && "opacity-20 grayscale"
      )}>
        <div className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full text-xl border",
          style.border,
          style.iconBg,
          earned && rarity === "legendary" && "badge-shine animate-badge-pulse",
          earned && style.glow
        )}>
          {icon}
        </div>
        <p className="text-[9px] font-semibold text-foreground text-center leading-tight truncate w-full max-w-[60px]">
          {name}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col items-center gap-2.5 rounded-xl border p-4 transition-all duration-500",
        style.border,
        style.ring,
        earned ? "opacity-100" : "opacity-20 grayscale",
        earned && style.glow,
        earned && "hover:scale-[1.03] active:scale-[0.97]"
      )}
    >
      {/* Rarity background accent */}
      {earned && rarity !== "common" && (
        <div className={cn(
          "absolute inset-0 rounded-xl opacity-30 pointer-events-none",
          rarity === "legendary" && "bg-gradient-to-b from-gold/[0.08] to-transparent",
          rarity === "epic" && "bg-gradient-to-b from-[hsl(var(--badge-epic)_/_0.06)] to-transparent",
          rarity === "rare" && "bg-gradient-to-b from-[hsl(var(--badge-rare)_/_0.04)] to-transparent",
        )} />
      )}

      <div className={cn(
        "relative flex h-14 w-14 items-center justify-center rounded-full text-2xl border transition-all duration-500",
        style.border,
        style.iconBg,
        earned && rarity === "legendary" && "badge-shine",
      )}>
        {icon}
        {/* Decorative ring for epic+ */}
        {earned && (rarity === "epic" || rarity === "legendary") && (
          <div className={cn(
            "absolute inset-[-3px] rounded-full border opacity-40",
            rarity === "legendary" ? "border-gold/30" : "border-[hsl(var(--badge-epic)_/_0.25)]"
          )} />
        )}
      </div>

      <div className="relative text-center">
        <p className="text-xs font-bold text-foreground leading-tight">{name}</p>
        <span className={cn(
          "text-[9px] font-black uppercase tracking-[0.2em] mt-0.5 block",
          style.label
        )}>
          {rarity}
        </span>
      </div>

      {description && (
        <p className="text-[10px] text-muted-foreground text-center leading-relaxed">{description}</p>
      )}

      {/* Locked overlay */}
      {!earned && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl">
          <span className="text-lg">🔒</span>
        </div>
      )}
    </div>
  );
};

export default BadgeCard;
