import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ConfettiBurstProps {
  active: boolean;
  className?: string;
}

const PARTICLE_COUNT = 28;

const colors = [
  "hsl(42, 78%, 54%)",   // gold
  "hsl(42, 85%, 70%)",   // gold-light
  "hsl(42, 60%, 36%)",   // gold-dark
  "hsl(152, 68%, 46%)",  // xp-green
  "hsl(18, 95%, 58%)",   // streak-orange
  "hsl(0, 0%, 100%)",    // white
];

const ConfettiBurst = ({ active, className }: ConfettiBurstProps) => {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    rotation: number;
    scale: number;
    color: string;
    delay: number;
    shape: "circle" | "rect" | "diamond";
  }>>([]);

  useEffect(() => {
    if (!active) { setParticles([]); return; }

    const newParticles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = (i / PARTICLE_COUNT) * 360 + (Math.random() * 30 - 15);
      const distance = 80 + Math.random() * 120;
      const rad = (angle * Math.PI) / 180;
      return {
        id: i,
        x: Math.cos(rad) * distance,
        y: Math.sin(rad) * distance - 40,
        rotation: Math.random() * 720 - 360,
        scale: 0.5 + Math.random() * 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.15,
        shape: (["circle", "rect", "diamond"] as const)[Math.floor(Math.random() * 3)],
      };
    });

    setParticles(newParticles);
  }, [active]);

  if (!active || !particles.length) return null;

  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-hidden z-50", className)}>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute left-1/2 top-1/2"
          style={{
            animation: `confetti-fly 0.9s cubic-bezier(0.2, 0.8, 0.3, 1) ${p.delay}s both`,
            "--end-x": `${p.x}px`,
            "--end-y": `${p.y}px`,
            "--end-rotate": `${p.rotation}deg`,
          } as React.CSSProperties}
        >
          <div
            style={{
              width: p.shape === "circle" ? "8px" : "6px",
              height: p.shape === "circle" ? "8px" : p.shape === "rect" ? "12px" : "8px",
              backgroundColor: p.color,
              borderRadius: p.shape === "circle" ? "50%" : p.shape === "diamond" ? "2px" : "1px",
              transform: `scale(${p.scale})${p.shape === "diamond" ? " rotate(45deg)" : ""}`,
              opacity: 0,
              animation: `confetti-fade 0.9s cubic-bezier(0.2, 0.8, 0.3, 1) ${p.delay}s both`,
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default ConfettiBurst;
