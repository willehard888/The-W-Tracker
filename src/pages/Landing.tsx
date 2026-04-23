import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Flame, Trophy, Swords, Shield, Sparkles, Star } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

const Landing = forwardRef<HTMLDivElement>((_props, ref) => {
  const navigate = useNavigate();

  return (
    <div ref={ref} className="min-h-screen gradient-dark flex flex-col overflow-hidden relative">
      {/* Single composited atmosphere layer — replaces three stacked gradients */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 70% 45% at 50% 0%, hsl(42 78% 54% / 0.2) 0%, transparent 60%)",
            "radial-gradient(ellipse 55% 35% at 50% 22%, hsl(270 60% 58% / 0.1) 0%, transparent 65%)",
            "radial-gradient(ellipse 120% 100% at 50% 50%, transparent 45%, hsl(260 18% 2% / 0.9) 100%)",
          ].join(","),
          transform: "translateZ(0)",
          willChange: "opacity",
        }}
      />

      {/* Header */}
      <header className="relative flex items-center justify-between px-6 pt-6 pb-4 animate-reveal">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-2 rounded-2xl opacity-50 blur-lg" style={{ background: "hsl(42 78% 54% / 0.35)" }} />
            <BrandLogo size={80} priority className="relative rounded-2xl" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-gradient-gold">The W Tracker</span>
        </div>
      </header>

      {/* Hero */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="animate-reveal max-w-md mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border-gold/30 mb-10">
            <Flame size={14} className="text-gold" />
            <span className="text-[11px] font-bold text-gold tracking-widest uppercase">
              Discipline is the new flex
            </span>
          </div>

          <h1 className="font-display text-[2.75rem] sm:text-6xl font-black tracking-tight leading-[0.92] mb-6">
            You either{" "}
            <span className="text-gradient-gold opacity-100">level up</span>
            <br />
            or fall behind.
          </h1>

          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-sm mx-auto mb-12">
            Turn self-improvement into a visible status game. Track discipline. Compete with others.{" "}
            <span className="text-foreground font-medium">Earn your status.</span>
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs mx-auto animate-reveal animate-reveal-delay-2">
            <Button
              variant="gold"
              size="xl"
              onClick={() => navigate("/auth")}
              className="w-full group text-base"
            >
              Start Your Journey
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </Button>
            <Button variant="gold-outline" size="lg" onClick={() => navigate("/auth")} className="text-sm">
              I already have an account
            </Button>
          </div>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2.5 mt-16 animate-reveal animate-reveal-delay-3">
          {[
            { icon: Flame, text: "Streaks" },
            { icon: Trophy, text: "Ranks" },
            { icon: Swords, text: "1v1 Battles" },
            { icon: Shield, text: "Badges" },
            { icon: Star, text: "Leaderboard" },
          ].map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-border/50 bg-card/40 backdrop-blur-sm"
            >
              <Icon size={13} className="text-gold" />
              <span className="text-[11px] font-semibold text-foreground/80">{text}</span>
            </div>
          ))}
        </div>
      </main>

      {/* Bottom tagline */}
      <footer className="relative pb-8 pt-4 text-center animate-reveal animate-reveal-delay-4">
        <div className="flex items-center justify-center gap-2">
          <Sparkles size={10} className="text-gold/30" />
          <p className="text-[10px] text-muted-foreground/60 tracking-[0.2em] uppercase font-medium">
            Built for those who refuse to be average
          </p>
          <Sparkles size={10} className="text-gold/30" />
        </div>
      </footer>
    </div>
  );
});
Landing.displayName = "Landing";

export default Landing;
