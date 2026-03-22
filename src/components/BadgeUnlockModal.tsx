import { useEffect, useState } from "react";

interface BadgeUnlockModalProps {
  badge: { name: string; icon: string; rarity: string; description?: string } | null;
  onClose: () => void;
}

const rarityColors: Record<string, { glow: string; text: string; ring: string }> = {
  common: { glow: "shadow-[0_0_40px_hsl(220,10%,50%,0.3)]", text: "text-foreground", ring: "border-muted-foreground/30" },
  rare: { glow: "shadow-[0_0_60px_hsl(210,80%,55%,0.4)]", text: "text-blue-400", ring: "border-blue-500/40" },
  epic: { glow: "shadow-[0_0_80px_hsl(270,70%,55%,0.5)]", text: "text-purple-400", ring: "border-purple-500/40" },
  legendary: { glow: "glow-gold", text: "text-gold", ring: "border-gold/50" },
};

const BadgeUnlockModal = ({ badge, onClose }: BadgeUnlockModalProps) => {
  const [phase, setPhase] = useState<"enter" | "reveal" | "details">("enter");

  useEffect(() => {
    if (!badge) return;
    setPhase("enter");
    const t1 = setTimeout(() => setPhase("reveal"), 400);
    const t2 = setTimeout(() => setPhase("details"), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [badge]);

  if (!badge) return null;

  const style = rarityColors[badge.rarity] || rarityColors.common;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-md transition-opacity duration-500"
        style={{ opacity: phase === "enter" ? 0 : 1 }}
      />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-6 p-8">
        {/* Particles */}
        {phase !== "enter" && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full bg-gold/60"
                style={{
                  left: `${50 + Math.cos((i * 30 * Math.PI) / 180) * 40}%`,
                  top: `${50 + Math.sin((i * 30 * Math.PI) / 180) * 40}%`,
                  animation: `float ${1.5 + Math.random()}s ease-in-out infinite`,
                  animationDelay: `${i * 0.1}s`,
                  opacity: phase === "details" ? 1 : 0,
                  transition: "opacity 0.5s ease-out",
                }}
              />
            ))}
          </div>
        )}

        {/* Badge Icon */}
        <div
          className={`transition-all duration-700 ease-out ${
            phase === "enter"
              ? "scale-0 opacity-0"
              : phase === "reveal"
              ? "scale-150 opacity-100"
              : "scale-100 opacity-100"
          }`}
        >
          <div
            className={`h-28 w-28 rounded-full border-2 flex items-center justify-center text-5xl transition-all duration-500 ${style.ring} ${style.glow}`}
            style={{
              background: badge.rarity === "legendary"
                ? "linear-gradient(135deg, hsl(43,50%,15%), hsl(43,60%,25%))"
                : badge.rarity === "epic"
                ? "linear-gradient(135deg, hsl(270,30%,15%), hsl(270,40%,25%))"
                : "hsl(220, 12%, 12%)",
            }}
          >
            {badge.icon}
          </div>
        </div>

        {/* Title */}
        <div
          className={`text-center transition-all duration-500 ${
            phase === "details" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold mb-2">Badge Unlocked</p>
          <h2 className="font-display text-3xl font-black tracking-tight mb-1">{badge.name}</h2>
          <p className={`text-xs font-bold uppercase tracking-widest ${style.text}`}>{badge.rarity}</p>
          {badge.description && (
            <p className="text-sm text-muted-foreground mt-2 max-w-[250px]">{badge.description}</p>
          )}
        </div>

        {/* Tap to dismiss */}
        <p
          className={`text-xs text-muted-foreground transition-all duration-500 ${
            phase === "details" ? "opacity-60" : "opacity-0"
          }`}
        >
          Tap anywhere to continue
        </p>
      </div>
    </div>
  );
};

export default BadgeUnlockModal;
