import { Flame, Zap, TrendingUp, Bell, Check, Sparkles, Bot, BookOpen, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/BrandLogo";
import { TIER_CONFIG, TIER_ORDER, getTierConfig } from "@/lib/status-tiers";
import { strugglePromise, GOAL_OPTIONS } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

/* The flame hero's keyframes (onboarding-float, pulseRing, flameDance,
   fadeSlideUp) live at the end of src/index.css under "Auth". */
const FloatingOrb = ({ color, size, delay, x, y }: { color: string; size: number; delay: number; x: string; y: string }) => (
  <div
    className="absolute rounded-full blur-sm opacity-60"
    style={{ width: size, height: size, background: color, left: x, top: y, animation: `onboarding-float ${3 + delay}s ease-in-out ${delay}s infinite alternate` }}
  />
);

const FlameHero = ({ size = 40, box = "w-36 h-36" }: { size?: number; box?: string }) => (
  <div className={cn("relative", box)}>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="absolute inset-0 rounded-full border-2 border-[hsl(var(--streak-orange))]"
        style={{ animation: `pulseRing 2.5s ease-out ${i * 0.6}s infinite`, opacity: 0 }}
      />
    ))}
    <div className="absolute inset-0 flex items-center justify-center">
      <div style={{ animation: "flameDance 1.5s ease-in-out infinite" }}>
        <Flame size={size} className="text-[hsl(var(--streak-orange))] drop-shadow-[0_0_20px_hsl(var(--streak-orange))]" />
      </div>
    </div>
    <FloatingOrb color="hsl(var(--streak-orange))" size={7} delay={0} x="20%" y="28%" />
    <FloatingOrb color="hsl(var(--gold))" size={5} delay={0.5} x="72%" y="20%" />
    <FloatingOrb color="hsl(var(--gold-light))" size={5} delay={1.2} x="18%" y="70%" />
  </div>
);

/* ── 0. Welcome ── */
export const WelcomeSlide = ({ onNext }: { onNext: () => void }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto w-full">
    <div className="relative mb-8">
      <div className="absolute inset-0 -m-6 rounded-full bg-gold/15 blur-3xl" aria-hidden />
      <BrandLogo size={88} className="relative rounded-2xl shadow-[0_8px_32px_hsl(var(--gold)/0.45)]" priority />
    </div>
    <h1 className="font-display text-4xl font-black tracking-tight mb-3">Welcome to The W.</h1>
    <p className="text-muted-foreground text-base leading-relaxed mb-10 max-w-[280px]">
      The game where showing up wins. 60 seconds to build your setup.
    </p>
    <Button variant="ember" size="xl" className="w-full max-w-xs group" onClick={onNext}>
      Build my setup
      <ArrowRight size={18} className="transition-transform group-hover:translate-x-1 group-active:translate-x-1" />
    </Button>
  </div>
);

/* ── 5. Teach: the daily loop ── */
export const CoreLoopSlide = ({ struggle, onNext }: { struggle?: string; onNext: () => void }) => {
  const promise = strugglePromise(struggle);
  const beats = [
    { icon: Flame, label: "Check in daily", sub: "60 seconds. Every day counts once." },
    { icon: Zap, label: "Earn XP & grow your streak", sub: "Miss a day, the flame resets." },
    { icon: TrendingUp, label: "Consistency becomes rank", sub: "The ladder only counts showing up." },
  ];
  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
      <FlameHero />
      <h1 className="font-display text-[26px] leading-tight font-black tracking-tight text-center mt-5 mb-1.5">
        {promise.title}
      </h1>
      <p className="text-sm text-muted-foreground text-center mb-7 max-w-[300px]">{promise.sub}</p>

      <div className="w-full space-y-2.5 mb-9">
        {beats.map((b, i) => (
          <div
            key={b.label}
            className="surface-card flex items-center gap-3 p-3.5"
            style={{ animation: `fadeSlideUp 0.5s ease-out ${0.15 + i * 0.12}s both` }}
          >
            <span className="h-9 w-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
              <b.icon size={16} className="text-gold" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-foreground">{b.label}</span>
              <span className="block text-xs text-muted-foreground">{b.sub}</span>
            </span>
            <span className="ml-auto text-muted-foreground/40 font-black text-xs">{i + 1}</span>
          </div>
        ))}
      </div>

      <Button variant="ember" size="xl" className="w-full max-w-xs" onClick={onNext}>
        Show me the climb
      </Button>
    </div>
  );
};

/* ── 6. Teach: the climb ── */
const LADDER_PREVIEW = ["recruit", "performer", "elite", "legend"] as const;

export const ClimbSlide = ({ onNext }: { onNext: () => void }) => (
  <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
    <h1 className="font-display text-[26px] leading-tight font-black tracking-tight text-center mb-1.5">
      Every check-in climbs the ladder.
    </h1>
    <p className="text-sm text-muted-foreground text-center mb-6 max-w-[300px]">
      {TIER_ORDER.length} tiers from {getTierConfig("recruit").label} to {getTierConfig("legend").label}. Rank is earned — never bought.
    </p>

    <div className="w-full space-y-2 mb-6">
      {LADDER_PREVIEW.map((t, i) => {
        const cfg = TIER_CONFIG[t];
        const top = i === LADDER_PREVIEW.length - 1;
        return (
          <div
            key={t}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-3",
              top ? "border-gold/40 bg-gold/5" : "border-border/40 bg-card/40",
            )}
            style={{ animation: `fadeSlideUp 0.5s ease-out ${0.1 + i * 0.1}s both` }}
          >
            <span className={cn("flex h-5 w-5 items-center justify-center", cfg.textClass)} aria-hidden><span className="h-2.5 w-2.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" /></span>
            <span className={cn("text-sm font-black", cfg.textClass)}>{cfg.label}</span>
            <span className="eyebrow ml-auto text-muted-foreground/70">
              {cfg.percentile}
            </span>
          </div>
        );
      })}
    </div>

    <div className="w-full flex items-center justify-center gap-4 text-muted-foreground mb-8">
      {[{ icon: Bot, label: "AI Coach" }, { icon: BookOpen, label: "Library" }, { icon: Users, label: "Tribes" }].map((f) => (
        <span key={f.label} className="flex items-center gap-1.5 text-[12px] font-bold">
          <f.icon size={13} className="text-gold/80" />
          {f.label}
        </span>
      ))}
    </div>

    <Button variant="ember" size="xl" className="w-full max-w-xs" onClick={onNext}>
      What do I get?
    </Button>
  </div>
);

/* ── 7. Commitment: free trial ── */
export const TrialSlide = ({ onNext }: { onNext: () => void }) => (
  <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
    <p className="eyebrow mb-2">Your free trial</p>
    <h1 className="font-display text-[28px] leading-tight font-black tracking-tight text-center mb-1.5">
      Everything unlocked.
    </h1>
    <p className="text-sm text-muted-foreground text-center mb-7">
      No payment. No card. Just show up.
    </p>

    <div className="w-full surface-card p-4 space-y-3 mb-9">
      {[
        "Your AI coach — briefs, programs, answers",
        "The Library — courses, recipes, exercises",
        "Tribes & 1v1 battles",
        "Full stats, streaks & rank ladder",
      ].map((line, i) => (
        <div key={line} className="flex items-center gap-2.5" style={{ animation: `fadeSlideUp 0.4s ease-out ${0.1 + i * 0.08}s both` }}>
          <span className="h-5 w-5 rounded-full bg-[hsl(var(--xp-green))]/15 border border-[hsl(var(--xp-green))]/40 flex items-center justify-center shrink-0">
            <Check size={11} className="text-[hsl(var(--xp-green))]" />
          </span>
          <span className="text-sm font-semibold text-foreground/90">{line}</span>
        </div>
      ))}
      <p className="text-xs text-muted-foreground pt-1 border-t border-border/40">
        The deal: one check-in a day. That's the whole game.
      </p>
    </div>

    <Button variant="ember" size="xl" className="w-full max-w-xs" onClick={onNext}>
      <Sparkles size={16} />
      I'm in
    </Button>
  </div>
);

/* ── 8. Push priming (native only) ── */
export const PushSlide = ({ onEnable, onSkip, busy }: { onEnable: () => void; onSkip: () => void; busy?: boolean }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto w-full">
    <div className="relative mb-7">
      <div className="absolute inset-0 -m-4 rounded-full bg-gold/15 blur-2xl" aria-hidden />
      <div className="relative h-20 w-20 rounded-3xl gradient-gold glow-gold flex items-center justify-center">
        <Bell size={34} className="text-primary-foreground" />
      </div>
    </div>
    <h1 className="font-display text-[26px] leading-tight font-black tracking-tight mb-1.5">
      Guard your streak?
    </h1>
    <p className="text-sm text-muted-foreground mb-9 max-w-[280px]">
      One reminder before your streak breaks. That's it — no spam, ever.
    </p>
    <Button variant="ember" size="xl" className="w-full max-w-xs" onClick={onEnable} loading={busy}>
      Enable reminders
    </Button>
    <button
      type="button"
      onClick={onSkip}
      className="mt-4 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1"
    >
      Not now
    </button>
  </div>
);

/* ── 9. Finale → first check-in ── */
export const FinaleSlide = ({ goal, onNext }: { goal?: string; onNext: () => void }) => {
  const goalOpt = GOAL_OPTIONS.find((g) => g.v === goal);
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto w-full">
      <FlameHero size={56} box="w-44 h-44" />
      <h1 className="font-display text-[28px] leading-tight font-black tracking-tight mt-4 mb-1.5">
        Setup done. Time for your first W.
      </h1>
      {goalOpt && (
        <p className="text-sm text-muted-foreground mb-2">
          Goal: <span className="text-gold font-bold">{goalOpt.emoji} {goalOpt.label}</span> · locked in
        </p>
      )}
      <p className="text-sm text-muted-foreground mb-9 max-w-[280px]">
        Your first check-in takes 60 seconds — and starts the streak.
      </p>
      <Button variant="ember" size="xl" className="w-full max-w-xs group" onClick={onNext}>
        Log my first W
        <ArrowRight size={18} className="transition-transform group-hover:translate-x-1 group-active:translate-x-1" />
      </Button>
    </div>
  );
};
