import { cn } from "@/lib/utils";
import { Award, Star, Crown, Gem, Sparkles } from "lucide-react";

interface LevelCardProps {
  level: number;
  className?: string;
}

const getLevelTier = (level: number) => {
  if (level >= 50) return { label: "Legendary", icon: Crown, color: "gold", glow: true, pulse: true };
  if (level >= 30) return { label: "Master", icon: Gem, color: "purple", glow: true, pulse: false };
  if (level >= 15) return { label: "Veteran", icon: Star, color: "teal", glow: true, pulse: false };
  if (level >= 5) return { label: "Rising", icon: Sparkles, color: "rose", glow: false, pulse: false };
  return { label: "Rookie", icon: Award, color: "teal", glow: false, pulse: false };
};

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; icon: string; glowClass: string }> = {
  gold: {
    border: "border-gold/40",
    bg: "from-gold/10 to-gold/5",
    text: "text-gold",
    icon: "gradient-gold text-primary-foreground shadow-[0_0_12px_hsl(var(--gold)/0.3)]",
    glowClass: "glow-gold-sm",
  },
  purple: {
    border: "border-[hsl(var(--purple))]/30",
    bg: "from-[hsl(var(--purple))]/10 to-[hsl(var(--purple))]/5",
    text: "text-[hsl(var(--purple))]",
    icon: "bg-[hsl(var(--purple))]/20 text-[hsl(var(--purple))]",
    glowClass: "glow-purple-sm",
  },
  teal: {
    border: "border-[hsl(var(--teal))]/25",
    bg: "from-[hsl(var(--teal))]/8 to-transparent",
    text: "text-[hsl(var(--teal))]",
    icon: "bg-[hsl(var(--teal))]/15 text-[hsl(var(--teal))]",
    glowClass: "glow-teal-sm",
  },
  rose: {
    border: "border-[hsl(var(--rose))]/25",
    bg: "from-[hsl(var(--rose))]/8 to-transparent",
    text: "text-[hsl(var(--rose))]",
    icon: "bg-[hsl(var(--rose))]/15 text-[hsl(var(--rose))]",
    glowClass: "glow-rose-sm",
  },
};

const LevelCard = ({ level, className }: LevelCardProps) => {
  const tier = getLevelTier(level);
  const colors = COLOR_MAP[tier.color];
  const Icon = tier.icon;

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card p-4 card-3d inner-light overflow-hidden",
        colors.border,
        tier.glow && colors.glowClass,
        className
      )}
    >
      {/* Ambient gradient */}
      <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent pointer-events-none", colors.bg)} />

      {/* Legendary pulse glow */}
      {tier.pulse && (
        <div
          className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none opacity-60 blur-xl animate-pulse"
          style={{ background: "radial-gradient(circle, hsl(42 90% 55% / 0.25) 0%, transparent 70%)" }}
        />
      )}

      <div className="relative flex items-start gap-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", colors.icon)}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium tracking-wide uppercase text-base text-primary">Level</p>
          <p className={cn(
            "font-bold font-display tracking-tight leading-tight mt-0.5 text-5xl",
            colors.text,
            tier.pulse && "font-black drop-shadow-[0_0_6px_hsl(var(--gold)/0.4)]"
          )}>
            {level}
          </p>
          <p className={cn("text-[10px] font-bold uppercase tracking-widest mt-1", colors.text, "opacity-60")}>
            {tier.label}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LevelCard;
