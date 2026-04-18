const AppLogoHeader = () => (
  <div className="flex flex-col items-center justify-center gap-2 mb-6 pt-2">
    <div className="relative">
      <div
        className="absolute -inset-3 rounded-3xl opacity-40 blur-xl"
        style={{
          background: "radial-gradient(circle, hsl(42 78% 54% / 0.4), transparent 70%)",
        }}
      />
      <picture>
        <source srcSet="/app-icon.webp 1x, /app-icon@2x.webp 2x" type="image/webp" />
        <img
          src="/app-icon.webp"
          alt="The W Tracker"
          width={64}
          height={64}
          fetchPriority="high"
          decoding="async"
          className="relative h-16 w-16 rounded-2xl shadow-[0_6px_24px_hsl(42_78%_54%/0.2),0_2px_6px_hsl(0_0%_0%/0.3)]"
        />
      </picture>
    </div>
    <span className="font-display text-xl font-bold tracking-tight text-gradient-gold">
      The W Tracker
    </span>
  </div>
);

export default AppLogoHeader;
