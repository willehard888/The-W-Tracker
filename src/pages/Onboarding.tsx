import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Flame, Trophy, Swords, Shield, ArrowRight, ChevronRight, Zap, Star, Target, Crown } from "lucide-react";

/* ── Animated illustration components ── */

const FloatingOrb = ({ color, size, delay, x, y }: { color: string; size: number; delay: number; x: string; y: string }) => (
  <div
    className="absolute rounded-full blur-sm opacity-60"
    style={{
      width: size,
      height: size,
      background: color,
      left: x,
      top: y,
      animation: `float ${3 + delay}s ease-in-out ${delay}s infinite alternate`,
    }}
  />
);

const StreakAnimation = () => (
  <div className="relative w-56 h-56">
    {/* Pulsing rings */}
    {[0, 1, 2].map(i => (
      <div
        key={i}
        className="absolute inset-0 rounded-full border-2 border-[hsl(var(--streak-orange))]"
        style={{
          animation: `pulseRing 2.5s ease-out ${i * 0.6}s infinite`,
          opacity: 0,
        }}
      />
    ))}
    {/* Center flame */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative" style={{ animation: "flameDance 1.5s ease-in-out infinite" }}>
        <Flame size={72} className="text-[hsl(var(--streak-orange))] drop-shadow-[0_0_20px_hsl(var(--streak-orange))]" />
      </div>
    </div>
    {/* Floating sparks */}
    <FloatingOrb color="hsl(var(--streak-orange))" size={8} delay={0} x="20%" y="30%" />
    <FloatingOrb color="hsl(var(--gold))" size={6} delay={0.5} x="70%" y="20%" />
    <FloatingOrb color="hsl(var(--streak-orange))" size={10} delay={1} x="75%" y="65%" />
    <FloatingOrb color="hsl(var(--gold-light))" size={5} delay={1.5} x="15%" y="70%" />
    {/* Streak counter mockup */}
    <div
      className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-card/80 border border-border backdrop-blur-sm"
      style={{ animation: "fadeSlideUp 0.8s ease-out 0.5s both" }}
    >
      <Zap size={12} className="text-[hsl(var(--streak-orange))]" />
      <span className="text-xs font-bold text-foreground">7 Day Streak!</span>
    </div>
  </div>
);

const RankAnimation = () => (
  <div className="relative w-56 h-56">
    {/* Glow behind */}
    <div
      className="absolute inset-8 rounded-full bg-gold/10 blur-xl"
      style={{ animation: "glowPulse 3s ease-in-out infinite" }}
    />
    {/* Trophy with bounce */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div style={{ animation: "trophyBounce 2s ease-in-out infinite" }}>
        <Trophy size={72} className="text-gold drop-shadow-[0_0_25px_hsl(var(--gold))]" />
      </div>
    </div>
    {/* Stars orbiting */}
    {[0, 1, 2, 3].map(i => (
      <div
        key={i}
        className="absolute"
        style={{
          left: "50%",
          top: "50%",
          animation: `orbit 4s linear ${i * 1}s infinite`,
          transformOrigin: "0 0",
        }}
      >
        <Star
          size={14}
          className="text-gold-light fill-gold-light"
          style={{ transform: "translate(-50%, -80px)" }}
        />
      </div>
    ))}
    {/* Rank badge */}
    <div
      className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full gradient-gold"
      style={{ animation: "fadeSlideUp 0.8s ease-out 0.8s both" }}
    >
      <Crown size={12} className="text-primary-foreground" />
      <span className="text-xs font-black text-primary-foreground">ELITE</span>
    </div>
  </div>
);

const BattleAnimation = () => (
  <div className="relative w-56 h-56">
    {/* VS clash effect */}
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ animation: "clashPulse 2s ease-in-out infinite" }}
    >
      <div className="w-32 h-32 rounded-full bg-[hsl(var(--purple))]/10 blur-lg" />
    </div>
    {/* Left sword */}
    <div
      className="absolute left-6 top-1/2 -translate-y-1/2"
      style={{ animation: "swordLeft 2s ease-in-out infinite" }}
    >
      <Swords size={48} className="text-[hsl(var(--purple))] drop-shadow-[0_0_15px_hsl(var(--purple))] -rotate-45" />
    </div>
    {/* Right sword */}
    <div
      className="absolute right-6 top-1/2 -translate-y-1/2"
      style={{ animation: "swordRight 2s ease-in-out infinite" }}
    >
      <Swords size={48} className="text-gold drop-shadow-[0_0_15px_hsl(var(--gold))] rotate-45 scale-x-[-1]" />
    </div>
    {/* VS text */}
    <div className="absolute inset-0 flex items-center justify-center">
      <span
        className="font-display text-2xl font-black text-foreground"
        style={{ animation: "vsFlash 2s ease-in-out infinite" }}
      >
        VS
      </span>
    </div>
    {/* Sparks */}
    <FloatingOrb color="hsl(var(--purple))" size={6} delay={0} x="30%" y="25%" />
    <FloatingOrb color="hsl(var(--gold))" size={8} delay={0.3} x="65%" y="20%" />
    <FloatingOrb color="hsl(var(--purple-light))" size={5} delay={0.7} x="25%" y="70%" />
    <FloatingOrb color="hsl(var(--gold-light))" size={7} delay={1} x="72%" y="72%" />
  </div>
);

const BadgeAnimation = () => {
  const badges = [
    { icon: Shield, color: "hsl(var(--xp-green))", label: "Epic" },
    { icon: Star, color: "hsl(var(--gold))", label: "Legendary" },
    { icon: Target, color: "hsl(var(--purple))", label: "Rare" },
  ];
  return (
    <div className="relative w-56 h-56 flex items-center justify-center">
      {/* Glow */}
      <div
        className="absolute w-40 h-40 rounded-full bg-[hsl(var(--xp-green))]/10 blur-xl"
        style={{ animation: "glowPulse 3s ease-in-out infinite" }}
      />
      {/* Badge cards fanning */}
      {badges.map((b, i) => {
        const rotation = (i - 1) * 18;
        const yOff = Math.abs(i - 1) * 8;
        return (
          <div
            key={i}
            className="absolute flex flex-col items-center gap-1 px-5 py-4 rounded-2xl bg-card border border-border shadow-xl"
            style={{
              transform: `rotate(${rotation}deg) translateY(${yOff}px)`,
              animation: `badgeFan 3s ease-in-out ${i * 0.2}s infinite alternate`,
              zIndex: 3 - Math.abs(i - 1),
            }}
          >
            <b.icon size={32} style={{ color: b.color, filter: `drop-shadow(0 0 10px ${b.color})` }} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
};

/* ── Slide data ── */

const SLIDES = [
  {
    title: "Track Your Discipline",
    description: "Check in daily, build streaks, and earn XP for every habit you crush. Your consistency becomes your currency.",
    Illustration: StreakAnimation,
  },
  {
    title: "Rise Through the Ranks",
    description: "Earn status tiers from Recruit to Legend. The leaderboard shows the world who's putting in the work.",
    Illustration: RankAnimation,
  },
  {
    title: "Battle Your Friends",
    description: "Challenge others to 1v1 discipline battles. Prove your grind is real. Winners earn legendary badges.",
    Illustration: BattleAnimation,
  },
  {
    title: "Collect Rare Badges",
    description: "Unlock badges for milestones, streaks, and social achievements. Build a vault that shows your legacy.",
    Illustration: BadgeAnimation,
  },
];

/* ── Component ── */

const Onboarding = () => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [animKey, setAnimKey] = useState(0);
  const navigate = useNavigate();

  /**
   * `finish()` is the only place that marks onboarding done. Called from:
   *  - the "Skip" button — user explicitly opts out
   *  - the final slide's "Let's Go" button — happy path
   *
   * The athlete-profile capture is intentionally deferred: Coach prompts for it
   * the first time the user opens it (when `!athlete.onboarded`), so we don't
   * block first-run entry with a long form.
   */
  const finish = () => {
    try {
      localStorage.setItem("w_onboarding_done", "true");
    } catch {}
    navigate("/", { replace: true });
  };

  const goTo = (idx: number) => {
    setDirection(idx > current ? "next" : "prev");
    setCurrent(idx);
    setAnimKey(k => k + 1);
  };

  const next = () => {
    if (current < SLIDES.length - 1) {
      goTo(current + 1);
    } else {
      // End of marketing slides → straight into the app. Athlete profile is
      // captured later (deferred to Coach) to keep first-run friction low.
      finish();
    }
  };

  // Swipe support
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (diff > 60 && current < SLIDES.length - 1) goTo(current + 1);
    if (diff < -60 && current > 0) goTo(current - 1);
    setTouchStart(null);
  };

  const slide = SLIDES[current];
  const Illustration = slide.Illustration;

  return (
    <div
      className="min-h-screen gradient-dark flex flex-col items-center justify-between px-6 py-8 safe-top safe-bottom overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Keyframe styles */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0) scale(1); }
          100% { transform: translateY(-14px) scale(1.15); }
        }
        @keyframes pulseRing {
          0% { transform: scale(0.6); opacity: 0.6; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes flameDance {
          0%, 100% { transform: translateY(0) scale(1); }
          25% { transform: translateY(-6px) scale(1.05) rotate(-3deg); }
          75% { transform: translateY(-3px) scale(1.02) rotate(3deg); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.15); }
        }
        @keyframes trophyBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes orbit {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes swordLeft {
          0%, 100% { transform: translateY(-50%) translateX(0); }
          50% { transform: translateY(-50%) translateX(12px); }
        }
        @keyframes swordRight {
          0%, 100% { transform: translateY(-50%) translateX(0); }
          50% { transform: translateY(-50%) translateX(-12px); }
        }
        @keyframes vsFlash {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes clashPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes badgeFan {
          0% { transform: rotate(var(--r, 0deg)) translateY(var(--y, 0px)) scale(1); }
          100% { transform: rotate(var(--r, 0deg)) translateY(var(--y, 0px)) scale(1.04); }
        }
        @keyframes fadeSlideUp {
          0% { opacity: 0; transform: translateX(-50%) translateY(12px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes slideContent {
          0% { opacity: 0; transform: translateX(30px); }
          100% { opacity: 1; transform: translateX(0); }
        }
      `}</style>

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
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto" key={animKey}>
        {/* Animated illustration */}
        <div
          className="mb-10"
          style={{ animation: "slideContent 0.5s ease-out both" }}
        >
          <Illustration />
        </div>

        {/* Title */}
        <h1
          className="font-display text-3xl sm:text-4xl font-black tracking-tight mb-4"
          style={{ animation: "slideContent 0.5s ease-out 0.1s both" }}
        >
          {slide.title}
        </h1>

        {/* Description */}
        <p
          className="text-muted-foreground text-base leading-relaxed"
          style={{ animation: "slideContent 0.5s ease-out 0.2s both" }}
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
              onClick={() => goTo(i)}
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
          variant="ember"
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
