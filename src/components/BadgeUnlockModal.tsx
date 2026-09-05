import { useEffect, useState } from "react";
import { Portal } from "@/components/ui/Portal";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface BadgeUnlockModalProps {
  badge: { name: string; icon: string; rarity: string; description?: string } | null;
  onClose: () => void;
}

const rarityConfig: Record<string, {
  glow: string;
  text: string;
  ring: string;
  gradient: string;
  particleColor: string;
}> = {
  common: {
    glow: "badge-glow-common",
    text: "text-[hsl(var(--badge-common))]",
    ring: "border-[hsl(var(--badge-common)_/_0.3)]",
    gradient: "from-[hsl(var(--badge-common)_/_0.1)] to-transparent",
    particleColor: "bg-[hsl(var(--badge-common)_/_0.5)]",
  },
  rare: {
    glow: "badge-glow-rare",
    text: "text-[hsl(var(--badge-rare))]",
    ring: "border-[hsl(var(--badge-rare)_/_0.4)]",
    gradient: "from-[hsl(var(--badge-rare)_/_0.1)] to-transparent",
    particleColor: "bg-[hsl(var(--badge-rare)_/_0.6)]",
  },
  epic: {
    glow: "badge-glow-epic",
    text: "text-[hsl(var(--badge-epic))]",
    ring: "border-[hsl(var(--badge-epic)_/_0.4)]",
    gradient: "from-[hsl(var(--badge-epic)_/_0.12)] to-transparent",
    particleColor: "bg-[hsl(var(--badge-epic)_/_0.6)]",
  },
  legendary: {
    glow: "badge-glow-legendary",
    text: "text-gold",
    ring: "border-gold/50",
    gradient: "from-gold/[0.12] to-transparent",
    particleColor: "bg-gold/60",
  },
};

const BadgeUnlockModal = ({ badge, onClose }: BadgeUnlockModalProps) => {
  const [phase, setPhase] = useState<"enter" | "burst" | "reveal" | "details">("enter");

  useEffect(() => {
    if (!badge) return;
    setPhase("enter");
    // Felt reward: a success buzz on unlock, plus a heavy thud at the burst
    // for the rarer badges so their weight is physical, not just visual.
    void hapticNotification("success");
    const isRare = badge.rarity === "epic" || badge.rarity === "legendary";
    const tHaptic = isRare ? setTimeout(() => void hapticImpact("heavy"), 300) : undefined;
    const t1 = setTimeout(() => setPhase("burst"), 300);
    const t2 = setTimeout(() => setPhase("reveal"), 800);
    const t3 = setTimeout(() => setPhase("details"), 1500);
    return () => { if (tHaptic) clearTimeout(tHaptic); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [badge]);

  if (!badge) return null;

  const style = rarityConfig[badge.rarity] || rarityConfig.common;
  const isLegendary = badge.rarity === "legendary";
  const isEpicPlus = badge.rarity === "epic" || isLegendary;

  return (
    <Portal>
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/95 backdrop-blur-xl transition-opacity duration-700"
        style={{ opacity: phase === "enter" ? 0 : 1 }}
      />

      {/* Radial burst */}
      {phase !== "enter" && (
        <div
          className={cn(
            "absolute w-64 h-64 rounded-full bg-gradient-radial",
            style.gradient,
            "pointer-events-none"
          )}
          style={{
            animation: "badge-unlock-burst 1.2s ease-out forwards",
            background: `radial-gradient(circle, ${
              isLegendary ? "hsl(var(--gold) / 0.15)" :
              badge.rarity === "epic" ? "hsl(275 80% 60% / 0.12)" :
              badge.rarity === "rare" ? "hsl(210 90% 56% / 0.1)" :
              "hsl(225 10% 52% / 0.08)"
            }, transparent 70%)`,
          }}
        />
      )}

      {/* Content */}
      <div className="relative flex flex-col items-center gap-6 p-8">
        {/* Expanding rings for epic+ */}
        {isEpicPlus && phase !== "enter" && (
          <>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "absolute w-32 h-32 rounded-full border",
                  isLegendary ? "border-gold/20" : "border-[hsl(var(--badge-epic)_/_0.15)]"
                )}
                style={{
                  animation: "badge-ring-expand 2s ease-out infinite",
                  animationDelay: `${i * 0.6}s`,
                }}
              />
            ))}
          </>
        )}

        {/* Particles */}
        {phase !== "enter" && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 16 }).map((_, i) => {
              const angle = (i * 22.5 * Math.PI) / 180;
              const distance = 35 + Math.random() * 25;
              return (
                <div
                  key={i}
                  className={cn("absolute rounded-full", style.particleColor)}
                  style={{
                    width: `${2 + Math.random() * 3}px`,
                    height: `${2 + Math.random() * 3}px`,
                    left: `${50 + Math.cos(angle) * distance}%`,
                    top: `${50 + Math.sin(angle) * distance}%`,
                    animation: `float ${1.5 + Math.random() * 1.5}s ease-in-out infinite`,
                    animationDelay: `${i * 0.08}s`,
                    opacity: phase === "details" || phase === "reveal" ? 1 : 0,
                    transition: "opacity 0.6s ease-out",
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Badge Icon */}
        <div
          className={cn(
            "transition-all ease-out",
            phase === "enter" && "scale-0 opacity-0 duration-300",
            phase === "burst" && "scale-[2] opacity-80 duration-500",
            phase === "reveal" && "scale-110 opacity-100 duration-600",
            phase === "details" && "scale-100 opacity-100 duration-500"
          )}
        >
          <div
            className={cn(
              "relative h-32 w-32 rounded-full border-2 flex items-center justify-center text-6xl transition-all duration-700",
              style.ring,
              style.glow,
              isLegendary && "badge-shine"
            )}
            style={{
              background: isLegendary
                ? "linear-gradient(135deg, hsl(42,50%,12%), hsl(42,60%,22%), hsl(42,50%,12%))"
                : badge.rarity === "epic"
                ? "linear-gradient(135deg, hsl(275,25%,10%), hsl(275,35%,18%), hsl(275,25%,10%))"
                : badge.rarity === "rare"
                ? "linear-gradient(135deg, hsl(210,25%,10%), hsl(210,35%,18%), hsl(210,25%,10%))"
                : "hsl(225, 16%, 10%)",
            }}
          >
            {badge.icon}
            {/* Decorative outer ring */}
            {isEpicPlus && (
              <div className={cn(
                "absolute inset-[-5px] rounded-full border-2 opacity-30",
                isLegendary ? "border-gold/40" : "border-[hsl(var(--badge-epic)_/_0.3)]"
              )} />
            )}
          </div>
        </div>

        {/* Title */}
        <div
          className={cn(
            "text-center transition-all duration-600",
            phase === "details" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
        >
          <p className={cn(
            "text-[11px] font-black uppercase tracking-[0.22em] mb-3",
            isLegendary ? "text-gold" : "text-muted-foreground"
          )}>
            {isLegendary ? "⚡ Legendary Badge Unlocked ⚡" : "Badge Unlocked"}
          </p>
          <h2 className="font-display text-3xl font-black tracking-tight mb-2">{badge.name}</h2>
          <div className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border",
            style.ring,
            isLegendary ? "bg-gold/[0.08]" : "bg-card"
          )}>
            <span className={cn("text-[11px] font-black uppercase tracking-[0.22em]", style.text)}>
              {badge.rarity}
            </span>
          </div>
          {badge.description && (
            <p className="text-sm text-muted-foreground mt-3 max-w-[260px] leading-relaxed">{badge.description}</p>
          )}
        </div>

        {/* Tap to dismiss */}
        <p
          className={cn(
            "text-xs text-muted-foreground transition-all duration-500 mt-2",
            phase === "details" ? "opacity-50" : "opacity-0"
          )}
        >
          Tap anywhere to continue
        </p>
      </div>
    </div>
    </Portal>
  );
};

export default BadgeUnlockModal;
