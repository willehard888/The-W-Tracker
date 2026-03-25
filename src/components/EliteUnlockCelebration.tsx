import { useEffect, useState, useCallback } from "react";
import { Crown, Trophy, Swords, Flame, Zap, Shield, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EliteUnlockCelebrationProps {
  onComplete: () => void;
}

const FEATURES = [
  { icon: Trophy, text: "Leaderboard" },
  { icon: Swords, text: "1v1 Battles" },
  { icon: Flame, text: "Elite Feed" },
  { icon: Zap, text: "2× XP" },
  { icon: Shield, text: "Elite Badges" },
  { icon: Crown, text: "Elite Status" },
];

const EliteUnlockCelebration = ({ onComplete }: EliteUnlockCelebrationProps) => {
  const [phase, setPhase] = useState(0);
  // 0: black enter, 1: crown reveal, 2: ring explode, 3: features cascade, 4: final CTA

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2200),
      setTimeout(() => setPhase(4), 3800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden">
      <style>{`
        @keyframes elitePulseRing {
          0% { transform: translate(-50%,-50%) scale(0); opacity: 0.8; }
          100% { transform: translate(-50%,-50%) scale(4); opacity: 0; }
        }
        @keyframes eliteGoldRay {
          0% { opacity: 0; transform: rotate(var(--ray-angle)) scaleY(0); }
          50% { opacity: 0.6; transform: rotate(var(--ray-angle)) scaleY(1); }
          100% { opacity: 0; transform: rotate(var(--ray-angle)) scaleY(1.2); }
        }
        @keyframes eliteCrownBounce {
          0% { transform: scale(0) rotate(-20deg); opacity: 0; }
          50% { transform: scale(1.3) rotate(5deg); opacity: 1; }
          70% { transform: scale(0.9) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes eliteSparkle {
          0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
          50% { opacity: 1; transform: scale(1) rotate(180deg); }
        }
        @keyframes eliteFeatureSlide {
          0% { opacity: 0; transform: translateY(20px) scale(0.8); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes eliteShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes eliteParticleFloat {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--px), var(--py)) scale(0); opacity: 0; }
        }
      `}</style>

      {/* Dark backdrop with gold tint */}
      <div className={cn(
        "absolute inset-0 transition-all duration-700",
        phase >= 1 ? "opacity-100" : "opacity-0"
      )} style={{ background: "radial-gradient(ellipse at center, hsl(42 30% 8% / 0.98) 0%, hsl(0 0% 3% / 0.99) 100%)" }} />

      {/* Pulse rings on crown reveal */}
      {phase >= 2 && Array.from({ length: 3 }).map((_, i) => (
        <div
          key={`ring-${i}`}
          className="absolute top-1/2 left-1/2 rounded-full border-2 pointer-events-none"
          style={{
            width: "120px", height: "120px",
            borderColor: `hsl(42 78% 54% / ${0.4 - i * 0.1})`,
            animation: `elitePulseRing 1.5s ease-out ${i * 0.3}s both`,
          }}
        />
      ))}

      {/* Gold rays */}
      {phase >= 2 && Array.from({ length: 8 }).map((_, i) => (
        <div
          key={`ray-${i}`}
          className="absolute top-1/2 left-1/2 origin-bottom pointer-events-none"
          style={{
            width: "3px", height: "200px",
            marginLeft: "-1.5px",
            marginTop: "-200px",
            background: `linear-gradient(to top, hsl(42 78% 54% / 0.5), transparent)`,
            "--ray-angle": `${i * 45}deg`,
            transformOrigin: "bottom center",
            animation: `eliteGoldRay 1.2s ease-out ${0.1 + i * 0.08}s both`,
          } as React.CSSProperties}
        />
      ))}

      {/* Floating particles */}
      {phase >= 2 && Array.from({ length: 24 }).map((_, i) => {
        const angle = (i / 24) * Math.PI * 2;
        const dist = 100 + Math.random() * 180;
        return (
          <div
            key={`particle-${i}`}
            className="absolute top-1/2 left-1/2 rounded-full pointer-events-none"
            style={{
              width: `${3 + Math.random() * 5}px`,
              height: `${3 + Math.random() * 5}px`,
              background: i % 3 === 0 ? "hsl(42 78% 54%)" : i % 3 === 1 ? "hsl(42 85% 70%)" : "hsl(270 60% 58%)",
              "--px": `${Math.cos(angle) * dist}px`,
              "--py": `${Math.sin(angle) * dist - 50}px`,
              animation: `eliteParticleFloat 1.5s ease-out ${Math.random() * 0.5}s both`,
            } as React.CSSProperties}
          />
        );
      })}

      {/* Sparkle stars */}
      {phase >= 2 && Array.from({ length: 8 }).map((_, i) => (
        <Star
          key={`star-${i}`}
          size={10 + Math.random() * 8}
          className="absolute text-gold pointer-events-none"
          style={{
            top: `${20 + Math.random() * 60}%`,
            left: `${10 + Math.random() * 80}%`,
            animation: `eliteSparkle ${1 + Math.random()}s ease-in-out ${0.5 + i * 0.2}s infinite`,
          }}
          fill="currentColor"
        />
      ))}

      {/* Main content */}
      <div className="relative flex flex-col items-center z-10 px-6">
        {/* Crown icon */}
        <div className={cn("relative mb-6", phase >= 1 ? "opacity-100" : "opacity-0")}>
          {/* Glow behind crown */}
          <div className="absolute -inset-8 rounded-full opacity-40 blur-2xl"
            style={{ background: "radial-gradient(circle, hsl(42 78% 54%), hsl(270 60% 58% / 0.3), transparent)" }}
          />
          <div
            className="relative h-28 w-28 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, hsl(42 78% 54%), hsl(42 60% 40%))",
              boxShadow: "0 0 60px hsl(42 78% 54% / 0.5), 0 0 120px hsl(42 78% 54% / 0.2), inset 0 -4px 8px hsl(42 60% 30% / 0.5)",
              animation: phase >= 1 ? "eliteCrownBounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both" : undefined,
            }}
          >
            <Crown size={52} className="text-primary-foreground drop-shadow-lg" />
          </div>
        </div>

        {/* Title text */}
        <div className={cn(
          "text-center transition-all duration-700",
          phase >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        )}>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold/60 font-bold mb-2">
            Status Upgraded
          </p>
          <h1
            className="font-display text-4xl font-black tracking-tight mb-2"
            style={{
              background: "linear-gradient(90deg, hsl(42 78% 54%), hsl(42 85% 75%), hsl(42 78% 54%)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: phase >= 2 ? "eliteShimmer 3s linear infinite" : undefined,
            }}
          >
            YOU'RE ELITE
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome to the top. Every feature is yours.
          </p>
        </div>

        {/* Features cascade */}
        {phase >= 3 && (
          <div className="grid grid-cols-3 gap-3 mt-8 max-w-xs">
            {FEATURES.map(({ icon: Icon, text }, i) => (
              <div
                key={text}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gold/20 bg-gold/5"
                style={{
                  animation: `eliteFeatureSlide 0.5s ease-out ${i * 0.12}s both`,
                }}
              >
                <Icon size={20} className="text-gold" />
                <span className="text-[10px] font-semibold text-foreground text-center leading-tight">{text}</span>
              </div>
            ))}
          </div>
        )}

        {/* CTA button */}
        <div className={cn(
          "mt-8 w-full max-w-xs transition-all duration-500",
          phase >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}>
          <Button
            variant="gold"
            size="xl"
            className="w-full"
            onClick={onComplete}
          >
            <Crown size={18} />
            Let's Go
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EliteUnlockCelebration;
