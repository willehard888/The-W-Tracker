import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface LevelUpCelebrationProps {
  newLevel: number;
  onComplete: () => void;
}

const LevelUpCelebration = ({ newLevel, onComplete }: LevelUpCelebrationProps) => {
  const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("show"), 100);
    const t2 = setTimeout(() => setPhase("exit"), 3000);
    const t3 = setTimeout(() => onComplete(), 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div className={cn(
      "fixed inset-0 z-[100] flex items-center justify-center transition-all duration-500",
      phase === "enter" ? "opacity-0" : phase === "exit" ? "opacity-0 scale-110" : "opacity-100"
    )}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/95 backdrop-blur-md" />

      {/* Radial glow bursts */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(42 78% 54% / 0.15) 0%, hsl(270 60% 58% / 0.08) 40%, transparent 70%)",
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(42 85% 70% / 0.2) 0%, transparent 60%)",
            animation: "pulse 1.5s ease-in-out infinite 0.3s",
          }}
        />
      </div>

      {/* Particle ring */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: i % 2 === 0 ? "hsl(42 78% 54%)" : "hsl(270 60% 58%)",
              transform: `rotate(${i * 30}deg) translateY(-120px)`,
              animation: `levelup-particle 2s ease-out infinite ${i * 0.1}s`,
              opacity: phase === "show" ? 1 : 0,
              transition: "opacity 0.3s",
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className={cn(
        "relative flex flex-col items-center transition-all duration-700",
        phase === "show" ? "scale-100 translate-y-0" : "scale-75 translate-y-4"
      )}>
        {/* Level number */}
        <div className="relative mb-4">
          <div className="absolute -inset-4 rounded-full opacity-30 blur-xl"
            style={{ background: "linear-gradient(135deg, hsl(42 78% 54%), hsl(270 60% 58%))" }}
          />
          <div className="relative h-28 w-28 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, hsl(42 78% 54%), hsl(42 60% 40%))",
              boxShadow: "0 0 40px hsl(42 78% 54% / 0.4), 0 0 80px hsl(42 78% 54% / 0.2)",
            }}
          >
            <span className="font-display text-5xl font-black text-primary-foreground">
              {newLevel}
            </span>
          </div>
        </div>

        {/* Text */}
        <p className="text-[10px] uppercase tracking-[0.3em] text-gold/60 font-bold mb-1"
          style={{ animation: phase === "show" ? "fade-in 0.5s ease-out 0.3s both" : undefined }}
        >
          New Level Reached
        </p>
        <h1 className="font-display text-3xl font-black tracking-tight text-foreground mb-1"
          style={{ animation: phase === "show" ? "fade-in 0.5s ease-out 0.5s both" : undefined }}
        >
          LEVEL UP! 🚀
        </h1>
        <p className="text-sm text-muted-foreground"
          style={{ animation: phase === "show" ? "fade-in 0.5s ease-out 0.7s both" : undefined }}
        >
          You're built different.
        </p>
      </div>
    </div>
  );
};

export default LevelUpCelebration;
