import { motion } from "framer-motion";
import { Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeaturedBadgeHeroProps {
  name: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

const rarityConfig = {
  legendary: {
    border: "border-gold/55",
    surface:
      "bg-[radial-gradient(140%_120%_at_30%_-10%,hsl(42_70%_22%/0.55),transparent_60%)] bg-card",
    text: "text-gold",
    glow: "shadow-[0_0_28px_hsl(var(--gold)/0.4),0_0_72px_hsl(var(--gold)/0.1)]",
    label: "MYTHIC TITLE",
    rim: "badge-conic-rim-legendary",
    icon: Sparkles,
  },
  epic: {
    border: "border-[hsl(var(--badge-epic))]/55",
    surface:
      "bg-[radial-gradient(140%_120%_at_30%_-10%,hsl(275_45%_18%/0.55),transparent_60%)] bg-card",
    text: "text-[hsl(var(--badge-epic))]",
    glow: "shadow-[0_0_24px_hsl(var(--badge-epic)/0.3)]",
    label: "EPIC TITLE",
    rim: "badge-conic-rim-epic",
    icon: Crown,
  },
  rare: {
    border: "border-[hsl(var(--badge-rare))]/45",
    surface:
      "bg-[radial-gradient(140%_120%_at_30%_-10%,hsl(210_50%_18%/0.5),transparent_60%)] bg-card",
    text: "text-[hsl(var(--badge-rare))]",
    glow: "shadow-[0_0_18px_hsl(var(--badge-rare)/0.25)]",
    label: "RARE TITLE",
    rim: "",
    icon: Crown,
  },
  common: {
    border: "border-border",
    surface: "bg-card/80",
    text: "text-foreground",
    glow: "",
    label: "TITLE",
    rim: "",
    icon: Crown,
  },
};

const FeaturedBadgeHero = ({ name, icon, rarity }: FeaturedBadgeHeroProps) => {
  const cfg = rarityConfig[rarity];
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative inline-flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full border overflow-hidden",
        cfg.border,
        cfg.surface,
        cfg.glow,
        cfg.rim,
      )}
    >
      {/* Icon disc */}
      <div
        className={cn(
          "relative flex h-7 w-7 items-center justify-center rounded-full border overflow-hidden badge-holo-sweep",
          cfg.border,
        )}
      >
        <span className="relative z-[2] text-base leading-none">{icon}</span>
      </div>

      <div className="flex flex-col items-start leading-none">
        <span
          className={cn(
            "flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] font-black",
            cfg.text
          )}
        >
          <Icon size={11} strokeWidth={2.5} />
          {cfg.label}
        </span>
        <span className={cn("text-[12px] font-black mt-0.5 leading-none", cfg.text)}>
          {name}
        </span>
      </div>
    </motion.div>
  );
};

export default FeaturedBadgeHero;
