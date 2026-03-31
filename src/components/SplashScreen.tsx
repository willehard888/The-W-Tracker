import { useState, useEffect, useMemo } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  color: string;
}

const COLORS = [
  "hsl(42 78% 54%)",
  "hsl(42 85% 70%)",
  "hsl(270 60% 58%)",
  "hsl(172 66% 50%)",
  "hsl(32 95% 56%)",
];

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [phase, setPhase] = useState<"dark" | "logo" | "text" | "exit">("dark");

  const particles = useMemo<Particle[]>(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 3,
      duration: 2 + Math.random() * 2,
      delay: Math.random() * 0.8,
      opacity: 0.25 + Math.random() * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    })),
  []);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("logo"), 150),
      setTimeout(() => setPhase("text"), 800),
      setTimeout(() => setPhase("exit"), 1800),
      setTimeout(onComplete, 2300),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const show = (from: string) => {
    const order = ["dark", "logo", "text", "exit"];
    return order.indexOf(phase) >= order.indexOf(from);
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-400 ${
        phase === "exit" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ background: "hsl(260 18% 4%)" }}
    >
      {/* Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className={`absolute rounded-full transition-opacity duration-500 ${
            show("logo") ? "opacity-100" : "opacity-0"
          }`}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            opacity: show("logo") ? p.opacity : 0,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            animation: show("logo")
              ? `splash-float ${p.duration}s ease-in-out ${p.delay}s infinite alternate`
              : "none",
          }}
        />
      ))}

      {/* Radial gold pulse */}
      <div
        className={`absolute w-[500px] h-[500px] rounded-full pointer-events-none transition-opacity duration-700 ${
          show("logo") ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background: "radial-gradient(circle, hsl(42 78% 54% / 0.18) 0%, hsl(270 60% 58% / 0.06) 40%, transparent 65%)",
          animation: show("logo") ? "splash-pulse 2s ease-in-out infinite" : "none",
        }}
      />

      {/* Logo */}
      <div
        className={`relative transition-all duration-500 ease-out ${
          show("logo") ? "scale-100 opacity-100 translate-y-0" : "scale-110 opacity-0 translate-y-4"
        }`}
      >
        <div
          className="absolute -inset-5 rounded-3xl blur-2xl"
          style={{
            background: "radial-gradient(circle, hsl(42 78% 54% / 0.45), transparent 70%)",
            opacity: show("logo") ? 0.7 : 0,
            transition: "opacity 0.6s",
          }}
        />
        <img
          src="/app-icon.png"
          alt="The W Tracker"
          className="relative h-28 w-28 rounded-2xl"
          style={{
            boxShadow: "0 0 40px hsl(42 78% 54% / 0.35), 0 0 80px hsl(42 78% 54% / 0.12)",
          }}
        />
      </div>

      {/* Title */}
      <h1
        className={`mt-6 font-display text-3xl font-black tracking-tight transition-all duration-500 ease-out ${
          show("text") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
        }`}
        style={{
          background: "linear-gradient(135deg, hsl(42 85% 70%), hsl(42 78% 54%), hsl(42 60% 36%))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        The W Tracker
      </h1>

      {/* Tagline */}
      <p
        className={`mt-3 text-[10px] font-bold tracking-[0.3em] uppercase transition-all duration-400 ease-out ${
          show("text") ? "opacity-40 translate-y-0" : "opacity-0 translate-y-3"
        }`}
        style={{ color: "hsl(42 78% 54% / 0.7)" }}
      >
        Join The Movement
      </p>

      <style>{`
        @keyframes splash-float {
          0% { transform: translateY(0) scale(1); }
          100% { transform: translateY(-15px) scale(1.2); }
        }
        @keyframes splash-pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
