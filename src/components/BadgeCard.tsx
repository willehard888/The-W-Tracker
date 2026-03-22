import { cn } from "@/lib/utils";

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

interface BadgeCardProps {
  name: string;
  icon: string;
  rarity: BadgeRarity;
  earned?: boolean;
  description?: string;
}

const rarityStyles: Record<BadgeRarity, { border: string; bg: string; label: string; glow: string }> = {
  common: {
    border: "border-muted-foreground/20",
    bg: "bg-secondary",
    label: "text-muted-foreground",
    glow: "",
  },
  rare: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
    label: "text-blue-400",
    glow: "",
  },
  epic: {
    border: "border-purple-500/30",
    bg: "bg-purple-500/10",
    label: "text-purple-400",
    glow: "shadow-[0_0_15px_hsl(270,60%,50%,0.2)]",
  },
  legendary: {
    border: "border-gold/40",
    bg: "bg-gold/10",
    label: "text-gold",
    glow: "glow-gold-sm",
  },
};

const BadgeCard = ({ name, icon, rarity, earned = true, description }: BadgeCardProps) => {
  const style = rarityStyles[rarity];

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-300",
        style.border,
        style.glow,
        earned ? "opacity-100" : "opacity-30 grayscale"
      )}
    >
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-full text-2xl", style.bg)}>
        {icon}
      </div>
      <p className="text-xs font-semibold text-foreground text-center leading-tight">{name}</p>
      <span className={cn("text-[10px] font-bold uppercase tracking-widest", style.label)}>
        {rarity}
      </span>
      {description && (
        <p className="text-[10px] text-muted-foreground text-center">{description}</p>
      )}
    </div>
  );
};

export default BadgeCard;
