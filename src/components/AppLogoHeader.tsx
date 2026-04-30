import BrandLogo from "./BrandLogo";

const AppLogoHeader = () => (
  <div className="flex flex-col items-center justify-center gap-2 mb-6 pt-2">
    <div className="relative">
      {/* Outer ambient glow */}
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2rem] opacity-60 blur-2xl pointer-events-none"
        style={{
          background: "radial-gradient(circle, hsl(42 78% 54% / 0.55), transparent 70%)",
        }}
      />
      {/* Inner tight glow — slow, premium pulse */}
      <div
        aria-hidden
        className="absolute -inset-2 rounded-3xl opacity-70 blur-lg pointer-events-none"
        style={{
          background: "radial-gradient(circle, hsl(42 85% 60% / 0.45), transparent 65%)",
          animation: "aura-breathe 6s ease-in-out infinite",
        }}
      />
      <BrandLogo
        size={64}
        priority
        className="relative rounded-2xl shadow-[0_8px_32px_hsl(42_78%_54%/0.35),0_2px_8px_hsl(0_0%_0%/0.4)]"
      />
    </div>
    <span className="font-display text-xl font-bold tracking-tight text-gradient-gold">
      Whealth Factory
    </span>
  </div>
);

export default AppLogoHeader;
