const AppLogoHeader = () => (
  <div className="flex flex-col items-center justify-center gap-2 mb-6 pt-2">
    <div className="relative">
      <div
        className="absolute -inset-3 rounded-3xl opacity-40 blur-xl"
        style={{
          background: "radial-gradient(circle, hsl(42 78% 54% / 0.4), transparent 70%)",
        }}
      />
      <img
        src="/app-icon.png"
        alt="The W Tracker"
        className="relative h-24 w-24 rounded-2xl shadow-[0_8px_32px_hsl(42_78%_54%/0.25),0_2px_8px_hsl(0_0%_0%/0.4)]"
      />
    </div>
    <span className="font-display text-2xl font-bold tracking-tight text-gradient-gold">
      The W Tracker
    </span>
  </div>
);

export default AppLogoHeader;
