import { useState, useEffect } from "react";

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [phase, setPhase] = useState<"logo" | "text" | "exit">("logo");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("text"), 600);
    const t2 = setTimeout(() => setPhase("exit"), 1800);
    const t3 = setTimeout(onComplete, 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${
        phase === "exit" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ background: "hsl(260 18% 4%)" }}
    >
      {/* Radial gold light */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, hsl(42 78% 54% / 0.15) 0%, transparent 60%)",
          animation: "splash-pulse 2s ease-in-out infinite",
        }}
      />

      {/* Logo */}
      <div
        className={`relative transition-all duration-700 ease-out ${
          phase === "logo"
            ? "scale-110 opacity-0 translate-y-4"
            : "scale-100 opacity-100 translate-y-0"
        }`}
      >
        <div
          className="absolute -inset-4 rounded-3xl blur-2xl opacity-60"
          style={{ background: "radial-gradient(circle, hsl(42 78% 54% / 0.4), transparent 70%)" }}
        />
        <img
          src="/app-icon.png"
          alt="The W Tracker"
          className="relative h-28 w-28 rounded-2xl"
          style={{
            boxShadow: "0 0 40px hsl(42 78% 54% / 0.3), 0 0 80px hsl(42 78% 54% / 0.1)",
          }}
        />
      </div>

      {/* Title */}
      <div
        className={`mt-8 text-center transition-all duration-700 delay-200 ease-out ${
          phase === "text" || phase === "exit"
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-6"
        }`}
      >
        <h1
          className="font-display text-3xl font-black tracking-tight"
          style={{
            background: "linear-gradient(135deg, hsl(42 85% 70%), hsl(42 78% 54%), hsl(42 60% 36%))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          The W Tracker
        </h1>
        <p
          className={`mt-3 text-[11px] font-bold tracking-[0.25em] uppercase transition-all duration-500 delay-500 ${
            phase === "text" || phase === "exit"
              ? "opacity-60 translate-y-0"
              : "opacity-0 translate-y-3"
          }`}
          style={{ color: "hsl(42 78% 54% / 0.6)" }}
        >
          Earn Your Status
        </p>
      </div>

      <style>{`
        @keyframes splash-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
