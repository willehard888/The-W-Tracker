import { useState, useEffect, useMemo } from "react";
import BrandLogo from "./BrandLogo";
import RealisticFlame from "./home/RealisticFlame";

/**
 * SplashScreen — cinematic ignition sequence.
 *
 * Reveal pipeline (≈1.65s total):
 *   0ms       : dark vignette + dim halo
 *   ~120ms    : ignition flash + heat shockwave ring + 12 radial sparks fan out
 *   ~200ms    : flame begins growing from ember to full size (with overshoot)
 *   ~250ms    : logo ignition flash (brightness pulse)
 *   ~600ms    : embers begin rising past the logo (continuous loop)
 *   1300ms    : exit (scale up, fade out)
 *
 * GPU-only: every animated property is transform/opacity/filter.
 */
const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [phase, setPhase] = useState<"reveal" | "settle" | "exit">("reveal");

  useEffect(() => {
    // Tightened timing — native iOS splash already shows before this React splash mounts,
    // so we keep it short to avoid double-splash feel. Total ~950 ms.
    const timers = [
      window.setTimeout(() => setPhase("settle"), 280),
      window.setTimeout(() => setPhase("exit"), 720),
      window.setTimeout(onComplete, 950),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  // 12 radial sparks fanning out at ignition — pre-computed once.
  const sparks = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 360 + (Math.random() * 18 - 9);
        const distance = -(70 + Math.random() * 60); // upward (negative Y)
        const delay = 120 + Math.random() * 80;
        const duration = 650 + Math.random() * 350;
        return { angle, distance, delay, duration, id: i };
      }),
    [],
  );

  // 8 slow rising embers — start after flame catches.
  const embers = useMemo(
    () =>
      Array.from({ length: 8 }).map((_, i) => {
        const left = 38 + Math.random() * 24; // % across logo
        const drift = (Math.random() - 0.5) * 30; // px horizontal drift
        const delay = 600 + Math.random() * 900;
        const duration = 2200 + Math.random() * 1400;
        const size = 2 + Math.random() * 3;
        return { left, drift, delay, duration, size, id: i };
      }),
    [],
  );

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
      {/* Static gold glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, hsl(42 90% 55% / 0.20) 0%, hsl(42 80% 45% / 0.06) 35%, transparent 65%)",
        }}
      />

      {/* Logo container */}
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
        {/* Static halo */}
        <div
          className="absolute -inset-8 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, hsl(42 90% 60% / 0.45) 0%, hsl(42 80% 50% / 0.15) 45%, transparent 75%)",
            filter: "blur(24px)",
          }}
          aria-hidden
        />

        {/* === IGNITION STAGE — flame, sparks, embers, shockwave === */}
        <div className="relative">
          {/* Ignition flash — single white-hot burst at flame base */}
          <div
            className="absolute left-1/2 -bottom-2 pointer-events-none rounded-full"
            style={{
              width: 60,
              height: 60,
              background:
                "radial-gradient(circle, hsl(42 100% 90% / 0.95) 0%, hsl(42 95% 65% / 0.55) 35%, transparent 70%)",
              animation:
                phase === "reveal"
                  ? undefined
                  : "splash-flash 700ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both",
              willChange: "transform, opacity",
              mixBlendMode: "screen",
              zIndex: 3,
            }}
            aria-hidden
          />

          {/* Heat shockwave — expanding ring at ignition */}
          <div
            className="absolute left-1/2 -bottom-2 pointer-events-none rounded-full"
            style={{
              width: 80,
              height: 80,
              border: "2px solid hsl(42 95% 65% / 0.7)",
              boxShadow:
                "0 0 24px hsl(42 95% 60% / 0.55), inset 0 0 16px hsl(42 95% 70% / 0.4)",
              animation:
                phase === "reveal"
                  ? undefined
                  : "splash-shockwave 950ms cubic-bezier(0.22, 1, 0.36, 1) 140ms both",
              willChange: "transform, opacity",
              zIndex: 2,
            }}
            aria-hidden
          />

          {/* Second softer shockwave — staggered for layered depth */}
          <div
            className="absolute left-1/2 -bottom-2 pointer-events-none rounded-full"
            style={{
              width: 80,
              height: 80,
              border: "1px solid hsl(28 95% 60% / 0.5)",
              animation:
                phase === "reveal"
                  ? undefined
                  : "splash-shockwave 1100ms cubic-bezier(0.22, 1, 0.36, 1) 280ms both",
              willChange: "transform, opacity",
              zIndex: 2,
            }}
            aria-hidden
          />

          {/* 12 radial sparks fanning out — bright pinpoints with trails */}
          <div
            className="absolute left-1/2 -bottom-2 pointer-events-none"
            style={{ width: 0, height: 0, zIndex: 4 }}
            aria-hidden
          >
            {sparks.map((s) => (
              <span
                key={s.id}
                className="absolute"
                style={{
                  left: 0,
                  top: 0,
                  width: 3,
                  height: 10,
                  marginLeft: -1.5,
                  marginTop: -5,
                  borderRadius: 2,
                  background:
                    "linear-gradient(to top, transparent, hsl(42 100% 80%) 40%, hsl(42 100% 95%))",
                  boxShadow:
                    "0 0 8px hsl(42 100% 70%), 0 0 16px hsl(42 95% 60% / 0.6)",
                  // CSS vars consumed by the keyframe
                  ["--spark-angle" as any]: `${s.angle}deg`,
                  ["--spark-distance" as any]: `${s.distance}px`,
                  animation:
                    phase === "reveal"
                      ? undefined
                      : `splash-spark ${s.duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${s.delay}ms both`,
                  willChange: "transform, opacity",
                  mixBlendMode: "screen",
                }}
              />
            ))}
          </div>

          {/* Real cinematic flame — bigger and igniting under the logo */}
          <div
            className="absolute left-1/2 -bottom-4 pointer-events-none"
            style={{
              width: 120,
              height: 140,
              transform: "translateX(-50%)",
              opacity: phase === "reveal" ? 0 : 1,
              transition: "opacity 500ms ease-out 200ms",
              zIndex: 1,
            }}
            aria-hidden
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                animation:
                  phase === "reveal"
                    ? undefined
                    : "splash-flame-grow 1100ms cubic-bezier(0.34, 1.4, 0.4, 1) 200ms both",
                transformOrigin: "center bottom",
              }}
            >
              <RealisticFlame tier={5} accent="hsl(42 95% 60%)" size={120} />
            </div>
          </div>

          {/* Rising embers — slow drifting particles past the logo */}
          <div
            className="absolute inset-0 pointer-events-none overflow-visible"
            style={{ zIndex: 5 }}
            aria-hidden
          >
            {embers.map((e) => (
              <span
                key={e.id}
                className="absolute rounded-full"
                style={{
                  left: `${e.left}%`,
                  bottom: -6,
                  width: e.size,
                  height: e.size,
                  background: "hsl(42 95% 70%)",
                  boxShadow:
                    "0 0 6px hsl(42 95% 65%), 0 0 12px hsl(42 90% 55% / 0.6)",
                  ["--ember-drift" as any]: `${e.drift}px`,
                  animation:
                    phase === "reveal"
                      ? undefined
                      : `splash-ember ${e.duration}ms ease-out ${e.delay}ms infinite`,
                  willChange: "transform, opacity",
                  mixBlendMode: "screen",
                }}
              />
            ))}
          </div>

          {/* Logo — gets a brightness pulse the moment fire catches */}
          {/* Logo + ignition layers (afterglow → logo flash → heat shimmer) */}
          <div className="relative">
            {/* Afterglow halo — soft warm bloom that swells then lingers behind the logo */}
            <div
              className="absolute left-1/2 top-1/2 pointer-events-none rounded-full"
              style={{
                width: 180,
                height: 180,
                background:
                  "radial-gradient(circle, hsl(42 100% 75% / 0.7) 0%, hsl(28 95% 55% / 0.3) 35%, hsl(18 90% 45% / 0.08) 60%, transparent 75%)",
                filter: "blur(14px)",
                animation:
                  phase === "reveal"
                    ? undefined
                    : "splash-logo-afterglow 1800ms cubic-bezier(0.16, 1, 0.3, 1) 280ms both",
                willChange: "transform, opacity",
                mixBlendMode: "screen",
                zIndex: 0,
              }}
              aria-hidden
            />

            {/* The logo itself — gets a brighter, longer ignite pulse with subtle blur shimmer */}
            <div
              className="relative"
              style={{
                animation:
                  phase === "reveal"
                    ? undefined
                    : "splash-logo-ignite 1300ms cubic-bezier(0.16, 1, 0.3, 1) 250ms both",
                willChange: "filter",
                zIndex: 1,
              }}
            >
              <BrandLogo size={112} priority className="relative rounded-3xl" />
            </div>

            {/* Heat-shimmer band — thin hot-air ripple sweeping up across the logo once */}
            <div
              className="absolute left-1/2 bottom-0 pointer-events-none"
              style={{
                width: 130,
                height: 28,
                background:
                  "radial-gradient(ellipse at center, hsl(42 100% 80% / 0.35) 0%, hsl(42 90% 55% / 0.18) 45%, transparent 75%)",
                filter: "blur(6px)",
                animation:
                  phase === "reveal"
                    ? undefined
                    : "splash-heat-shimmer 1100ms cubic-bezier(0.22, 1, 0.36, 1) 320ms both",
                willChange: "transform, opacity",
                mixBlendMode: "screen",
                zIndex: 2,
              }}
              aria-hidden
            />
          </div>
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
              "opacity 450ms ease-out 250ms, transform 550ms cubic-bezier(0.16, 1, 0.3, 1) 250ms",
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
            transition: "opacity 400ms ease-out 350ms",
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
              "opacity 400ms ease-out 400ms, transform 400ms ease-out 400ms",
            willChange: "transform, opacity",
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
        aria-hidden
      />
    </div>
  );
};

export default SplashScreen;
