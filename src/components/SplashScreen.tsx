import { useState, useEffect } from "react";
import BrandLogo from "./BrandLogo";

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [phase, setPhase] = useState<"reveal" | "settle" | "exit">("reveal");

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setPhase("settle"), 500),
      window.setTimeout(() => setPhase("exit"), 1300),
      window.setTimeout(onComplete, 1650),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden transition-opacity duration-400 ease-out ${
        phase === "exit" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background:
          "radial-gradient(ellipse at center, hsl(260 22% 8%) 0%, hsl(260 25% 4%) 60%, hsl(260 30% 2%) 100%)",
        contain: "layout paint size",
      }}
    >
      {/* Single static gold glow — no animation, no conic spin */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, hsl(42 90% 55% / 0.20) 0%, hsl(42 80% 45% / 0.06) 35%, transparent 65%)",
          willChange: "opacity",
        }}
      />

      {/* Logo container — only transform + opacity (compositor-only) */}
      <div
        className="relative flex flex-col items-center"
        style={{
          transform:
            phase === "reveal"
              ? "scale(0.85) translate3d(0, 6px, 0)"
              : phase === "exit"
              ? "scale(1.05) translate3d(0, -3px, 0)"
              : "scale(1) translate3d(0, 0, 0)",
          opacity: phase === "reveal" ? 0 : 1,
          transition:
            "transform 700ms cubic-bezier(0.16, 1, 0.3, 1), opacity 450ms ease-out",
          willChange: "transform, opacity",
        }}
      >
        {/* Static halo — no breathe animation (was the heaviest filter cost) */}
        <div
          className="absolute -inset-8 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, hsl(42 90% 60% / 0.45) 0%, hsl(42 80% 50% / 0.15) 45%, transparent 75%)",
            filter: "blur(24px)",
          }}
          aria-hidden
        />

        {/* Logo with growing flame underneath */}
        <div className="relative">
          {/* Growing flame — ember → blazing under the logo (cinematic ignite) */}
          <div
            className="absolute left-1/2 -bottom-2 pointer-events-none"
            style={{
              width: 80,
              height: 92,
              transform: "translateX(-50%)",
              opacity: phase === "reveal" ? 0 : 1,
              transition: "opacity 350ms ease-out 200ms",
            }}
            aria-hidden
          >
            {/* Halo / fuel pool */}
            <div
              className="absolute left-1/2 bottom-0 rounded-full"
              style={{
                width: 90,
                height: 38,
                transform: "translateX(-50%)",
                background:
                  "radial-gradient(ellipse at center, hsl(28 95% 58% / 0.55) 0%, hsl(42 95% 60% / 0.25) 45%, transparent 80%)",
                filter: "blur(6px)",
              }}
            />
            {/* Outer flame body — grows in */}
            <div
              className="absolute left-1/2 bottom-0"
              style={{
                width: 60,
                height: 78,
                transform: "translateX(-50%)",
                transformOrigin: "center bottom",
                background:
                  "radial-gradient(ellipse at 50% 80%, hsl(60 100% 92%) 0%, hsl(42 95% 60%) 35%, hsl(28 95% 52%) 70%, transparent 95%)",
                clipPath:
                  "polygon(50% 0%, 95% 35%, 100% 70%, 80% 100%, 20% 100%, 0% 70%, 5% 35%)",
                boxShadow: "0 0 28px hsl(42 95% 60% / 0.55)",
                animation:
                  phase === "reveal"
                    ? undefined
                    : "splash-flame-grow 900ms cubic-bezier(0.16, 1, 0.3, 1) 200ms both, splash-flame-flicker 1.6s ease-in-out 1100ms infinite",
                mixBlendMode: "screen",
              }}
            />
            {/* White-hot inner core */}
            <div
              className="absolute left-1/2 bottom-0"
              style={{
                width: 26,
                height: 50,
                transform: "translateX(-50%)",
                transformOrigin: "center bottom",
                background:
                  "radial-gradient(ellipse at 50% 75%, hsl(60 100% 95%) 0%, hsl(48 100% 78%) 60%, transparent 100%)",
                clipPath:
                  "polygon(50% 0%, 95% 35%, 100% 70%, 80% 100%, 20% 100%, 0% 70%, 5% 35%)",
                animation:
                  phase === "reveal"
                    ? undefined
                    : "splash-flame-grow 900ms cubic-bezier(0.16, 1, 0.3, 1) 350ms both, splash-flame-flicker 1.05s ease-in-out 1250ms infinite",
                mixBlendMode: "screen",
              }}
            />
          </div>

          <BrandLogo size={112} priority className="relative rounded-3xl" />
        </div>

        {/* Wordmark */}
        <div
          className="mt-7"
          style={{
            opacity: phase === "reveal" ? 0 : 1,
            transform:
              phase === "reveal"
                ? "translate3d(0, 8px, 0)"
                : "translate3d(0, 0, 0)",
            transition:
              "opacity 450ms ease-out 150ms, transform 550ms cubic-bezier(0.16, 1, 0.3, 1) 150ms",
            willChange: "transform, opacity",
          }}
        >
          <h1
            className="font-display text-3xl font-black tracking-tight text-center"
            style={{
              background:
                "linear-gradient(135deg, hsl(42 95% 80%) 0%, hsl(42 85% 60%) 45%, hsl(42 65% 38%) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 2px 12px hsl(42 90% 50% / 0.35)",
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
            transition: "opacity 400ms ease-out 250ms",
          }}
        />

        {/* Tagline */}
        <p
          className="mt-3 text-[10px] font-bold tracking-[0.42em] uppercase"
          style={{
            color: "hsl(42 70% 70% / 0.75)",
            opacity: phase === "settle" ? 1 : 0,
            transform:
              phase === "settle"
                ? "translate3d(0, 0, 0)"
                : "translate3d(0, 4px, 0)",
            transition:
              "opacity 400ms ease-out 300ms, transform 400ms ease-out 300ms",
            willChange: "transform, opacity",
          }}
        >
          Join The Movement
        </p>
      </div>

      {/* Bottom vignette — static */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
        style={{
          background:
            "linear-gradient(to top, hsl(260 35% 2% / 0.85), transparent)",
        }}
        aria-hidden
      />
    </div>
  );
};

export default SplashScreen;
