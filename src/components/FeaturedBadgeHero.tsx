import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";

interface FeaturedBadgeHeroProps {
  name: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

const rarityConfig = {
  legendary: {
    border: "border-gold/50",
    bg: "bg-gradient-to-br from-gold/10 via-gold/5 to-transparent",
    text: "text-gold",
    glow: "shadow-[0_0_24px_hsl(var(--gold)/0.3)]",
    label: "LEGENDARY",
  },
  epic: {
    border: "border-[hsl(var(--badge-epic))]/50",
    bg: "bg-gradient-to-br from-[hsl(var(--badge-epic))]/10 via-[hsl(var(--badge-epic))]/5 to-transparent",
    text: "text-[hsl(var(--badge-epic))]",
    glow: "shadow-[0_0_20px_hsl(var(--badge-epic)/0.25)]",
    label: "EPIC",
  },
  rare: {
    border: "border-[hsl(var(--badge-rare))]/40",
    bg: "bg-[hsl(var(--badge-rare))]/5",
    text: "text-[hsl(var(--badge-rare))]",
    glow: "shadow-[0_0_16px_hsl(var(--badge-rare)/0.2)]",
    label: "RARE",
  },
  common: {
    border: "border-border",
    bg: "bg-card/50",
    text: "text-foreground",
    glow: "",
    label: "COMMON",
  },
};

const FeaturedBadgeHero = ({ name, icon, rarity }: FeaturedBadgeHeroProps) => {
  const cfg = rarityConfig[rarity];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 }}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border",
        cfg.border,
        cfg.bg,
        cfg.glow,
      )}
    >
      <Crown size={10} className={cfg.text} />
      <span className="text-base leading-none">{icon}</span>
      <div className="flex flex-col items-start">
        <span className={cn("text-[8px] uppercase tracking-[0.2em] font-black leading-none", cfg.text)}>
          {cfg.label} TITLE
        </span>
        <span className={cn("text-[11px] font-black leading-none mt-0.5", cfg.text)}>
          {name}
        </span>
      </div>
    </motion.div>
  );
};

export default FeaturedBadgeHero;
