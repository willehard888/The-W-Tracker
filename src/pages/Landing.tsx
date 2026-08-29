import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { trackAnon } from "@/lib/analytics";
import { ArrowRight, Flame, Trophy, Sparkles, Dumbbell, Utensils, Moon, ShieldCheck } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

// What the app ACTUALLY delivers — names the substance (coach, training,
// nutrition, recovery, the verified-discipline moat), not just the game layer.
const WHAT_YOU_GET = [
  { icon: Sparkles, title: "AI coach", text: "Reads your Apple Health, training & recovery — and holds you to it." },
  { icon: Dumbbell, title: "Train", text: "260+ illustrated exercises + programs with exact sets & progression." },
  { icon: Utensils, title: "Fuel", text: "High-protein recipes, macros & meal-prep templates." },
  { icon: Moon, title: "Recover", text: "Sleep, HRV & recovery protocols to bounce back faster." },
  { icon: ShieldCheck, title: "Verified", text: "Apple Health proves your discipline — unfakeable." },
  { icon: Trophy, title: "Compete", text: "Streaks, ranks, 1v1 battles & the leaderboard." },
] as const;

const Landing = forwardRef<HTMLDivElement>((_props, ref) => {
  const navigate = useNavigate();
  // Anonymous top-of-funnel: the only pre-auth measurement point.
  useEffect(() => { void trackAnon("landing_viewed"); }, []);

  return (
    <div ref={ref} className="min-h-full gradient-dark flex flex-col overflow-hidden relative">
      {/* Single composited atmosphere layer — replaces three stacked gradients */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 70% 45% at 50% 0%, hsl(var(--gold) / 0.2) 0%, transparent 60%)",
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
            <div className="absolute -inset-2 rounded-2xl opacity-50 blur-lg" style={{ background: "hsl(var(--gold) / 0.35)" }} />
            <BrandLogo size={80} priority className="relative rounded-2xl" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-gradient-gold">Whealth Factory</span>
        </div>
      </header>

      {/* Hero */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="animate-reveal max-w-md mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border-gold/30 mb-10">
            <Flame size={14} className="text-gold" />
            <span className="text-[12px] font-bold text-gold tracking-widest uppercase">
              Discipline is the new flex
            </span>
          </div>

          <h1 className="font-display text-[2.75rem] sm:text-6xl font-black tracking-tight leading-[0.92] mb-6">
            You either{" "}
            <span className="text-gradient-gold opacity-100">level up</span>
            <br />
            or fall behind.
          </h1>

          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-sm mx-auto mb-10">
            Turn self-improvement into a visible status game.{" "}
            <span className="text-foreground font-medium">
              Track your discipline. Compete with others. Earn your Status.
            </span>
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs mx-auto animate-reveal animate-reveal-delay-2">
            <Button
              variant="ember"
              size="xl"
              onClick={() => navigate("/auth?mode=signup")}
              className="w-full group text-base"
            >
              Start Your Journey
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </Button>
            <Button variant="gold-outline" size="lg" onClick={() => navigate("/auth?mode=login")} className="text-sm">
              I already have an account
            </Button>
          </div>
        </div>

        {/* What you actually get — one app replaces the whole stack */}
        <div className="w-full max-w-md mx-auto mt-14 animate-reveal animate-reveal-delay-3">
          <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-gold/70 mb-3">
            One app · replaces five
          </p>
          <div className="grid grid-cols-2 gap-2.5 text-left">
            {WHAT_YOU_GET.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="flex gap-2.5 p-3 surface-card backdrop-blur-sm"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold/10">
                  <Icon size={14} className="text-gold" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold leading-tight">{title}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom tagline */}
      <footer className="relative pb-8 pt-4 text-center animate-reveal animate-reveal-delay-4">
        <div className="flex items-center justify-center gap-2">
          <Sparkles size={12} className="text-gold/30" />
          <p className="text-[11px] text-muted-foreground/60 tracking-[0.22em] uppercase font-medium">
            Built for those who refuse to be average
          </p>
          <Sparkles size={12} className="text-gold/30" />
        </div>
      </footer>
    </div>
  );
});
Landing.displayName = "Landing";

export default Landing;
