import { useState, useEffect } from "react";

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [phase, setPhase] = useState<"reveal" | "settle" | "exit">("reveal");

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setPhase("settle"), 700),
      window.setTimeout(() => setPhase("exit"), 1500),
      window.setTimeout(onComplete, 1900),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden transition-opacity duration-500 ease-out ${
        phase === "exit" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background:
          "radial-gradient(ellipse at center, hsl(260 22% 8%) 0%, hsl(260 25% 4%) 60%, hsl(260 30% 2%) 100%)",
      }}
    >
      {/* Cinematic light beam */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, hsl(42 90% 55% / 0.18) 0%, hsl(42 80% 45% / 0.05) 30%, transparent 60%)",
          opacity: phase === "exit" ? 0 : 1,
          transition: "opacity 600ms ease-out",
        }}
      />

      {/* Aurora sweep */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "conic-gradient(from 180deg at 50% 50%, transparent 0deg, hsl(42 80% 55% / 0.08) 90deg, transparent 180deg, hsl(270 60% 58% / 0.06) 270deg, transparent 360deg)",
          animation: "splash-spin 6s linear infinite",
          mixBlendMode: "screen",
        }}
      />

      {/* Logo container with 3D scale-in */}
      <div
        className="relative flex flex-col items-center"
        style={{
          transform:
            phase === "reveal"
              ? "scale(0.7) translateY(8px)"
              : phase === "exit"
              ? "scale(1.08) translateY(-4px)"
              : "scale(1) translateY(0)",
          opacity: phase === "reveal" ? 0 : 1,
          transition: "transform 900ms cubic-bezier(0.16, 1, 0.3, 1), opacity 600ms ease-out",
          filter: phase === "exit" ? "blur(2px)" : "blur(0)",
          transitionProperty: "transform, opacity, filter",
        }}
      >
        {/* Soft halo behind logo */}
        <div
          className="absolute -inset-10 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(42 90% 60% / 0.55) 0%, hsl(42 80% 50% / 0.18) 40%, transparent 70%)",
            animation: "splash-breathe 2.4s ease-in-out infinite",
          }}
        />

        {/* Logo card */}
        <div className="relative">
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              background:
                "linear-gradient(135deg, hsl(42 90% 65% / 0.4), transparent 50%, hsl(42 60% 40% / 0.25))",
              filter: "blur(8px)",
            }}
          />
          <BrandLogo
            size={112}
            priority
            className="relative rounded-3xl"
          />

          {/* Shimmer sweep */}
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
            style={{
              opacity: phase === "settle" ? 1 : 0,
              transition: "opacity 400ms ease-out",
            }}
          >
            <div
              className="absolute -inset-y-2 -left-1/2 w-1/2"
              style={{
                background:
                  "linear-gradient(105deg, transparent 30%, hsl(0 0% 100% / 0.55) 50%, transparent 70%)",
                animation: "splash-shimmer 1.4s ease-in-out 0.1s 1",
                transform: "skewX(-18deg)",
              }}
            />
          </div>
        </div>

        {/* Wordmark */}
        <div
          className="mt-7 overflow-hidden"
          style={{
            opacity: phase === "reveal" ? 0 : 1,
            transform: phase === "reveal" ? "translateY(12px)" : "translateY(0)",
            transition: "opacity 600ms ease-out 200ms, transform 700ms cubic-bezier(0.16, 1, 0.3, 1) 200ms",
          }}
        >
          <h1
            className="font-display text-3xl font-black tracking-tight text-center"
            style={{
              background:
                "linear-gradient(135deg, hsl(42 95% 80%) 0%, hsl(42 85% 60%) 45%, hsl(42 65% 38%) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 2px 12px hsl(42 90% 50% / 0.35))",
            }}
          >
            The W Tracker
          </h1>
        </div>

        {/* Hairline divider */}
        <div
          className="mt-3 h-px w-24"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(42 80% 55% / 0.6), transparent)",
            opacity: phase === "settle" ? 1 : 0,
            transition: "opacity 500ms ease-out 350ms",
          }}
        />

        {/* Tagline */}
        <p
          className="mt-3 text-[10px] font-bold tracking-[0.42em] uppercase"
          style={{
            color: "hsl(42 70% 70% / 0.75)",
            opacity: phase === "settle" ? 1 : 0,
            transform: phase === "settle" ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 500ms ease-out 400ms, transform 500ms ease-out 400ms",
          }}
        >
          Join The Movement
        </p>
      </div>

      {/* Bottom vignette */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
        style={{
          background:
            "linear-gradient(to top, hsl(260 35% 2% / 0.85), transparent)",
        }}
      />

      <style>{`
        @keyframes splash-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes splash-breathe {
          0%, 100% { transform: scale(0.95); opacity: 0.7; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes splash-shimmer {
          0% { transform: translateX(0) skewX(-18deg); }
          100% { transform: translateX(420%) skewX(-18deg); }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
