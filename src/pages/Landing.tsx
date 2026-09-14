import { forwardRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { trackAnon } from "@/lib/analytics";
import { ArrowRight, Trophy, Sparkles, Dumbbell, Utensils, Moon, ShieldCheck } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

// What the app ACTUALLY delivers — names the substance (coach, training,
// nutrition, recovery, the verified-discipline moat), not just the game layer.
const WHAT_YOU_GET = [
  { icon: Sparkles, title: "AI coach", text: "Reads your Apple Health, training & recovery — and holds you to it." },
  { icon: Dumbbell, title: "Train", text: "260+ illustrated exercises + programs with exact sets & progression." },
  { icon: Utensils, title: "Fuel", text: "High-protein recipes, macros & meal-prep templates." },
  { icon: Moon, title: "Recover", text: "Sleep, HRV & recovery protocols to bounce back faster." },
  // "Unfakeable" was an overclaim: verification is iOS-only, covers workouts,
  // sleep, mindfulness and steps — not the self-reported half of a check-in —
  // and photo proof accepts camera-roll images. The accurate version is still
  // the differentiator against every self-report habit tracker.
  { icon: ShieldCheck, title: "Verified", text: "Workouts and sleep checked against your real Apple Health data." },
  { icon: Trophy, title: "Compete", text: "Streaks, ranks, 1v1 battles & the leaderboard." },
] as const;

/**
 * Thesis: the proof. One beat, one spectacle (the lava CTA, framed with air),
 * the six benefits as one hairline list that recedes. Gold lives on the h1
 * span alone — the previous body spent it on twelve elements, six identical
 * tiles and a hand-rolled kicker, and nothing was the hero.
 */
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
      <header className="relative flex items-center gap-3 px-6 pt-6 pb-2 home-rise">
        <BrandLogo size={44} priority className="rounded-xl" />
        <span className="font-display font-bold text-[15px] tracking-tight">Whealth Factory</span>
      </header>

      <main className="relative flex-1 flex flex-col px-6 pt-10">
        {/* Opening beat */}
        <div className="home-rise home-rise-1 max-w-md">
          <p className="eyebrow">Discipline is the new flex</p>
          <h1 className="mt-3 font-display text-[2.75rem] font-black tracking-tight leading-[0.92]">
            You either{" "}
            <span className="text-gold">level up</span>
            <br />
            or fall behind.
          </h1>
          <p className="mt-5 text-muted-foreground text-base leading-relaxed max-w-sm">
            Turn self-improvement into a visible status game.{" "}
            <span className="text-foreground font-medium">
              Track your discipline. Compete with others. Earn your Status.
            </span>
          </p>
        </div>

        {/* The one spectacle: the lava CTA, with air around it. */}
        <div className="home-rise home-rise-2 mt-10 max-w-md">
          <Button
            variant="ember"
            size="xl"
            onClick={() => navigate("/auth?mode=signup")}
            className="w-full group text-base"
          >
            Start Your Journey
            <ArrowRight aria-hidden
              size={18}
              className="transition-transform group-hover:translate-x-1"
            />
          </Button>
          <button
            type="button"
            onClick={() => navigate("/auth?mode=login")}
            className="press mt-2 w-full min-h-11 text-[13px] font-bold text-muted-foreground"
          >
            I already have an account
          </button>
        </div>

        {/* What you actually get — one app replaces the whole stack */}
        <div className="home-rise home-rise-3 mt-14 max-w-md">
          <p className="font-display font-black text-[17px] tracking-tight leading-tight">One app · replaces five</p>
          <ul className="mt-2 divide-y divide-border/35 border-t border-border/35">
            {WHAT_YOU_GET.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3 py-3">
                <Icon size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[14px] font-bold leading-tight">{title}</p>
                  <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>

      {/* Bottom tagline */}
      <footer className="relative px-6 pb-8 pt-10 home-rise home-rise-4">
        <p className="text-[11px] text-muted-foreground/75 tracking-[0.22em] uppercase font-medium">
          Built for those who refuse to be average
        </p>
      </footer>
    </div>
  );
});
Landing.displayName = "Landing";

export default Landing;
