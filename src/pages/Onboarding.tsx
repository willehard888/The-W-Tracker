import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Flame, Trophy, Swords, Shield, ArrowRight, ChevronRight } from "lucide-react";

const SLIDES = [
  {
    icon: Flame,
    title: "Track Your Discipline",
    description: "Check in daily, build streaks, and earn XP for every habit you crush. Your consistency becomes your currency.",
    accent: "from-[hsl(var(--streak-orange))] to-[hsl(var(--gold))]",
  },
  {
    icon: Trophy,
    title: "Rise Through the Ranks",
    description: "Earn status tiers from Rising to Elite. The leaderboard shows the world who's putting in the work.",
    accent: "from-[hsl(var(--gold))] to-[hsl(var(--gold-light))]",
  },
  {
    icon: Swords,
    title: "Battle Your Friends",
    description: "Challenge others to 1v1 discipline battles. Prove your grind is real. Winners earn legendary badges.",
    accent: "from-[hsl(var(--purple))] to-[hsl(var(--purple-light))]",
  },
  {
    icon: Shield,
    title: "Collect Rare Badges",
    description: "Unlock badges for milestones, streaks, and social achievements. Build a vault that shows your legacy.",
    accent: "from-[hsl(var(--xp-green))] to-[hsl(var(--gold))]",
  },
];

const Onboarding = () => {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  const finish = () => {
    localStorage.setItem("w_onboarding_done", "true");
    navigate("/", { replace: true });
  };

  const next = () => {
    if (current < SLIDES.length - 1) {
      setCurrent(current + 1);
    } else {
      finish();
    }
  };

  const slide = SLIDES[current];
  const Icon = slide.icon;

  return (
    <div className="min-h-screen gradient-dark flex flex-col items-center justify-between px-6 py-10 safe-top safe-bottom">
      {/* Skip */}
      <div className="w-full flex justify-end">
        <button
          onClick={finish}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
        {/* Icon */}
        <div
          className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${slide.accent} flex items-center justify-center mb-10 shadow-lg animate-reveal`}
          key={`icon-${current}`}
        >
          <Icon size={44} className="text-primary-foreground" />
        </div>

        {/* Title */}
        <h1
          className="font-display text-3xl sm:text-4xl font-black tracking-tight mb-4 animate-reveal"
          key={`title-${current}`}
        >
          {slide.title}
        </h1>

        {/* Description */}
        <p
          className="text-muted-foreground text-base leading-relaxed animate-reveal animate-reveal-delay-1"
          key={`desc-${current}`}
        >
          {slide.description}
        </p>
      </div>

      {/* Bottom: dots + button */}
      <div className="w-full flex flex-col items-center gap-8">
        {/* Dots */}
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current
                  ? "w-8 bg-gold"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>

        {/* Button */}
        <Button
          variant="gold"
          size="xl"
          onClick={next}
          className="w-full max-w-xs group"
        >
          {current < SLIDES.length - 1 ? (
            <>
              Next
              <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
            </>
          ) : (
            <>
              Let's Go
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
