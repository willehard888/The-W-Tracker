import { ChevronRight, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEffectiveStreak, getStreakDeadlineState } from "@/lib/streak";
import RealisticFlame from "@/components/home/RealisticFlame";

interface StreakDisplayProps {
  streak: number;
  longestStreak: number;
  className?: string;
  lastCheckinAt?: string | null;
}

const MILESTONES = [
  { days: 3,   label: "3d",   emoji: "🔥" },
  { days: 7,   label: "7d",   emoji: "⚡" },
  { days: 14,  label: "14d",  emoji: "💪" },
  { days: 30,  label: "30d",  emoji: "👑" },
  { days: 60,  label: "60d",  emoji: "💎" },
  { days: 100, label: "100d", emoji: "🏆" },
];

const getStreakTier = (streak: number) => {
  if (streak >= 100) return { name: "Legendary", index: 5 };
  if (streak >= 60)  return { name: "Diamond",   index: 4 };
  if (streak >= 30)  return { name: "Champion",  index: 3 };
  if (streak >= 14)  return { name: "On Fire",   index: 2 };
  if (streak >= 7)   return { name: "Heating Up",index: 1 };
  if (streak >= 3)   return { name: "Ignited",   index: 0 };
  return { name: "Start", index: -1 };
};

/* Floating embers (60d+) */
const StreakParticles = ({ legendary }: { legendary: boolean }) => {
  const count = legendary ? 14 : 8;
  const colors = legendary
    ? ["hsl(42 90% 65%)", "hsl(280 80% 70%)", "hsl(350 85% 65%)", "hsl(200 85% 70%)"]
    : ["hsl(200 85% 70%)", "hsl(42 90% 65%)", "hsl(190 90% 75%)"];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
      {Array.from({ length: count }).map((_, i) => {
        const size = legendary ? 3 + Math.random() * 4 : 2 + Math.random() * 3;
        const left = 5 + Math.random() * 90;
        const delay = Math.random() * 6;
        const duration = 4 + Math.random() * 4;
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              left: `${left}%`,
              bottom: "-6px",
              background: color,
              boxShadow: `0 0 ${size * 3}px ${color}`,
              animation: `streak-particle ${duration}s ease-in-out infinite`,
              animationDelay: `${delay}s`,
              opacity: 0,
            }}
          />
        );
      })}
    </div>
  );
};

/* Heat shimmer waves (Champion+) */
const HeatWaves = () => (
  <div className="absolute inset-x-0 bottom-0 h-3/4 pointer-events-none overflow-hidden rounded-2xl">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="absolute left-0 right-0 h-px"
        style={{
          bottom: 0,
          background: "linear-gradient(90deg, transparent, hsl(42 95% 70% / 0.35), transparent)",
          animation: `streak-heat-wave 3.5s ease-out infinite`,
          animationDelay: `${i * 1.2}s`,
        }}
      />
    ))}
  </div>
);

const StreakDisplay = ({ streak, longestStreak, className, lastCheckinAt }: StreakDisplayProps) => {
  const displayStreak = getEffectiveStreak(streak, lastCheckinAt);
  const deadline = getStreakDeadlineState(streak, lastCheckinAt);
  const tier = getStreakTier(displayStreak);

  const isHot       = tier.index >= 0; // 3d+
  const isWarm      = tier.index >= 1; // 7d+
  const isOnFire    = tier.index >= 2; // 14d+
  const isBlazing   = tier.index >= 3; // 30d+
  const isDiamond   = tier.index >= 4; // 60d+
  const isLegendary = tier.index >= 5; // 100d+

  const currentMilestone = [...MILESTONES].reverse().find((m) => displayStreak >= m.days);
  const nextMilestone    = MILESTONES.find((m) => displayStreak < m.days);
  const prevDays = currentMilestone?.days || 0;
  const nextDays = nextMilestone?.days || 365;
  const segmentProgress = Math.min(100, ((displayStreak - prevDays) / (nextDays - prevDays)) * 100);

  /* Tier-driven dynamic styles */
  const accent =
    isLegendary ? "hsl(280 80% 65%)" :
    isDiamond   ? "hsl(200 85% 65%)" :
    isBlazing   ? "hsl(42 85% 60%)"  :
    isOnFire    ? "hsl(28 95% 60%)"  :
    isWarm      ? "hsl(18 95% 58%)"  :
    isHot       ? "hsl(14 90% 56%)"  : "hsl(var(--muted-foreground))";

  /* Number text class */
  const numberClass =
    isLegendary ? "streak-legendary-text"  :
    isDiamond   ? "streak-diamond-text"    :
    isBlazing   ? "streak-gold-text"       :
    isWarm      ? "streak-orange-text"     :
    isHot       ? "text-[hsl(var(--streak-orange))]" : "text-foreground";

  /* Container glow animation */
  const glowAnim =
    isLegendary ? "streak-pulse-glow-legendary 2.4s ease-in-out infinite" :
    isDiamond   ? "streak-pulse-glow-diamond   2.8s ease-in-out infinite" :
    isBlazing   ? "streak-pulse-glow-gold      3.2s ease-in-out infinite" :
    isOnFire    ? "streak-pulse-glow           2.8s ease-in-out infinite" :
    isWarm      ? "streak-pulse-glow           3.6s ease-in-out infinite" : undefined;

  /* Flame animation speed scales with tier */
  const flameDuration =
    isLegendary ? "0.85s" :
    isDiamond   ? "1.05s" :
    isBlazing   ? "1.3s"  :
    isOnFire    ? "1.6s"  :
    isWarm      ? "2.0s"  :
    isHot       ? "2.4s"  : "0s";

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden transition-all isolate",
        "border-2",
        !isHot && "border-border/70 bg-gradient-to-br from-card via-card to-card/85",
        isHot && "bg-[radial-gradient(circle_at_50%_-10%,hsl(255_14%_10%),hsl(255_14%_6%))]",
        className
      )}
      style={{
        borderColor: isHot ? `${accent.replace(")", " / 0.55)")}` : undefined,
        animation: glowAnim,
        boxShadow: !isHot ? "0 8px 32px -8px hsl(0 0% 0% / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.04)" : undefined,
      }}
    >
      {/* Conic spinning ring (Diamond+) */}
      {isDiamond && (
        <div className={cn("streak-conic-ring", isLegendary && "streak-conic-ring-legendary")} />
      )}

      {/* Top accent bar */}
      <div
        className="absolute top-0 inset-x-0 h-[3px] pointer-events-none z-10"
        style={{
          background: isLegendary
            ? "linear-gradient(90deg, hsl(280 80% 65%), hsl(42 95% 70%), hsl(350 85% 65%), hsl(200 85% 70%), hsl(280 80% 65%))"
            : isDiamond
            ? "linear-gradient(90deg, hsl(200 85% 65%), hsl(42 90% 65%), hsl(200 85% 65%))"
            : isBlazing
            ? "linear-gradient(90deg, transparent, hsl(42 85% 60%), transparent)"
            : isHot
            ? `linear-gradient(90deg, transparent, ${accent}, transparent)`
            : "linear-gradient(90deg, transparent, hsl(var(--border)), transparent)",
          backgroundSize: isLegendary || isDiamond ? "200% 100%" : "100% 100%",
          animation: isLegendary || isDiamond ? "shimmer-slide 5s linear infinite" : undefined,
          opacity: isHot ? 0.95 : 0.5,
        }}
      />

      {/* Ambient radial glow */}
      {isHot && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isLegendary
              ? "radial-gradient(circle at 25% -10%, hsl(280 70% 60% / 0.28), transparent 55%), radial-gradient(circle at 75% 110%, hsl(42 78% 54% / 0.22), transparent 55%), radial-gradient(circle at 50% 50%, hsl(350 80% 60% / 0.08), transparent 70%)"
              : isDiamond
              ? "radial-gradient(circle at 30% -10%, hsl(200 80% 65% / 0.25), transparent 55%), radial-gradient(circle at 70% 110%, hsl(42 78% 54% / 0.18), transparent 55%)"
              : isBlazing
              ? "radial-gradient(circle at 30% -5%, hsl(42 78% 54% / 0.28), transparent 60%), radial-gradient(circle at 75% 100%, hsl(18 95% 58% / 0.12), transparent 60%)"
              : isOnFire
              ? "radial-gradient(circle at 30% -5%, hsl(18 95% 58% / 0.25), transparent 60%)"
              : "radial-gradient(circle at 30% -5%, hsl(18 95% 58% / 0.18), transparent 65%)",
          }}
        />
      )}

      {/* Heat waves (30d+) */}
      {isBlazing && <HeatWaves />}

      {/* Floating embers (60d+) */}
      {isDiamond && <StreakParticles legendary={isLegendary} />}

      {/* Sheen sweep (legendary) */}
      {isLegendary && (
        <div
          className="absolute inset-y-0 w-1/3 pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.08), transparent)",
            animation: "streak-card-sheen 5s ease-in-out infinite",
          }}
        />
      )}

      {/* === CONTENT === */}
      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
              style={{
                background: accent,
                boxShadow: isHot ? `0 0 8px ${accent}` : undefined,
                animation: isHot ? "pulse 1.6s ease-in-out infinite" : undefined,
              }}
            />
            <p
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.24em] whitespace-nowrap",
                !isHot && "text-muted-foreground"
              )}
              style={{ color: isHot ? accent : undefined }}
            >
              Active Streak
            </p>
          </div>

          {tier.index >= 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border backdrop-blur-sm whitespace-nowrap shrink-0",
                isLegendary && "animate-[streak-badge-shimmer_2.8s_ease-in-out_infinite]"
              )}
              style={{
                background: `${accent.replace(")", " / 0.18)")}`,
                color: accent,
                borderColor: `${accent.replace(")", " / 0.5)")}`,
                boxShadow: isHot ? `0 0 12px ${accent.replace(")", " / 0.3)")}` : undefined,
              }}
            >
              {isLegendary && <Sparkles size={10} />}
              {!isLegendary && isDiamond && "💎"}
              {!isDiamond && isBlazing && "👑"}
              {!isBlazing && isOnFire && "⚡"}
              {!isOnFire && isWarm && "🔥"}
              {tier.name}
            </span>
          )}
        </div>

        {/* Hero row — flame + number */}
        <div className="flex items-center gap-4 mb-5">
          {/* Flame badge — deep furnace chamber */}
          <div
            className="relative flex h-[72px] w-[72px] items-center justify-center rounded-2xl shrink-0 overflow-visible"
            style={{
              background: isLegendary
                ? "radial-gradient(ellipse at 50% 110%, hsl(350 85% 35%) 0%, hsl(280 60% 18%) 45%, hsl(255 30% 8%) 100%)"
                : isDiamond
                ? "radial-gradient(ellipse at 50% 110%, hsl(42 78% 38%) 0%, hsl(200 50% 18%) 45%, hsl(220 30% 8%) 100%)"
                : isBlazing
                ? "radial-gradient(ellipse at 50% 110%, hsl(18 95% 38%) 0%, hsl(28 60% 18%) 50%, hsl(20 30% 6%) 100%)"
                : isOnFire
                ? "radial-gradient(ellipse at 50% 110%, hsl(14 90% 32%) 0%, hsl(18 50% 14%) 55%, hsl(12 30% 5%) 100%)"
                : isWarm
                ? "radial-gradient(ellipse at 50% 110%, hsl(14 85% 28%) 0%, hsl(16 45% 12%) 60%, hsl(10 30% 5%) 100%)"
                : isHot
                ? "radial-gradient(ellipse at 50% 110%, hsl(14 70% 22%) 0%, hsl(16 40% 10%) 65%, hsl(10 25% 5%) 100%)"
                : "hsl(var(--secondary))",
              color: isHot ? "white" : "hsl(var(--muted-foreground))",
              boxShadow: isHot
                ? `0 0 32px ${accent.replace(")", " / 0.55)")}, 0 0 64px ${accent.replace(")", " / 0.25)")}, inset 0 2px 0 hsl(0 0% 100% / 0.18), inset 0 -10px 20px hsl(0 0% 0% / 0.55), inset 0 0 24px hsl(0 0% 0% / 0.4)`
                : undefined,
            }}
          >
            {/* Inner glow ring */}
            {isHot && (
              <span
                aria-hidden
                className="absolute inset-1 rounded-xl pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 50% 80%, ${accent.replace(")", " / 0.5)")}, transparent 65%)`,
                }}
              />
            )}

            {/* Pulsing ring */}
            {isHot && (
              <span
                aria-hidden
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  border: `2px solid ${accent.replace(")", " / 0.5)")}`,
                  animation: `ping ${isLegendary ? "1.2s" : isDiamond ? "1.5s" : isBlazing ? "1.8s" : "2.4s"} cubic-bezier(0,0,0.2,1) infinite`,
                  opacity: 0.6,
                }}
              />
            )}

            {/* Ember puff — soft expanding aura (Champion+) */}
            {isBlazing && [0, 1].map((i) => (
              <span
                key={`puff-${i}`}
                aria-hidden
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  border: `1px solid ${accent.replace(")", " / 0.45)")}`,
                  animation: `streak-ember-puff ${isLegendary ? 2.4 : isDiamond ? 2.8 : 3.2}s ease-out infinite`,
                  animationDelay: `${i * (isLegendary ? 1.2 : 1.6)}s`,
                  opacity: 0,
                }}
              />
            ))}

            {/* Sparks above flame (Diamond+) — varied cadence */}
            {isDiamond &&
              [
                { delay: 0,    dur: 1.4, left: 50 },
                { delay: 0.45, dur: 1.7, left: 46 },
                { delay: 0.9,  dur: 1.55, left: 54 },
              ].map((s, i) => (
                <span
                  key={i}
                  className="absolute top-2 w-1 h-1 rounded-full pointer-events-none"
                  style={{
                    left: `${s.left}%`,
                    background: isLegendary ? "hsl(280 80% 75%)" : "hsl(42 95% 75%)",
                    boxShadow: `0 0 6px currentColor`,
                    animation: `streak-spark ${s.dur}s ease-out infinite`,
                    animationDelay: `${s.delay}s`,
                    transform: "translate(-50%, 0)",
                  }}
                />
              ))}

            <Flame
              size={36}
              strokeWidth={2.5}
              className="relative z-10"
              style={{
                animation: isHot ? `streak-fire ${flameDuration} ease-in-out infinite` : undefined,
                transformOrigin: "center bottom",
              }}
            />
          </div>

          {/* Number */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 leading-none">
              <span
                className={cn(
                  "font-black font-display tabular-nums tracking-tighter leading-[0.85]",
                  displayStreak >= 100 ? "text-[64px]" : displayStreak >= 10 ? "text-[72px]" : "text-[80px]",
                  numberClass,
                  isHot && "animate-[streak-number-pulse_3s_ease-in-out_infinite]"
                )}
                style={{
                  filter: isHot ? `drop-shadow(0 4px 12px ${accent.replace(")", " / 0.45)")})` : undefined,
                }}
              >
                {displayStreak}
              </span>
              <span className="font-black text-muted-foreground/70 font-display text-xs uppercase tracking-[0.2em]">
                day{displayStreak === 1 ? "" : "s"}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-[0.18em] whitespace-nowrap">
                Best <span className="text-foreground font-black tabular-nums">{longestStreak}d</span>
              </span>
              {displayStreak === longestStreak && displayStreak > 0 && (
                <span className="text-[9px] font-black uppercase tracking-wider text-gold flex items-center gap-1 whitespace-nowrap">
                  <Zap size={9} /> PB
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Milestone progress track */}
        <div className="flex items-end gap-1.5">
          {MILESTONES.map((m) => {
            const reached = displayStreak >= m.days;
            const isNext  = nextMilestone?.days === m.days;
            const isPast  = currentMilestone && m.days <= currentMilestone.days;

            return (
              <div key={m.days} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className={cn(
                    "w-full h-2 rounded-full overflow-hidden transition-all duration-500 relative",
                    !reached && "bg-secondary/70",
                  )}
                  style={{
                    boxShadow: isNext ? `0 0 8px ${accent.replace(")", " / 0.4)")}, inset 0 1px 2px hsl(0 0% 0% / 0.4)` : "inset 0 1px 2px hsl(0 0% 0% / 0.3)",
                  }}
                >
                  {isPast ? (
                    <div
                      className="w-full h-full rounded-full origin-left"
                      style={{
                        background: isLegendary
                          ? "linear-gradient(90deg, hsl(280 80% 60%), hsl(42 90% 65%), hsl(200 85% 65%))"
                          : isDiamond
                          ? "linear-gradient(90deg, hsl(200 85% 60%), hsl(42 90% 65%))"
                          : isBlazing
                          ? "linear-gradient(90deg, hsl(18 95% 58%), hsl(42 90% 65%))"
                          : `linear-gradient(90deg, ${accent}, ${accent.replace("60%", "70%")})`,
                        boxShadow: `0 0 6px ${accent.replace(")", " / 0.5)")}`,
                        animation: "streak-segment-fill 0.8s cubic-bezier(0.23, 1, 0.32, 1)",
                      }}
                    />
                  ) : isNext ? (
                    <div
                      className="h-full rounded-full transition-all duration-1000 relative"
                      style={{
                        width: `${Math.max(8, segmentProgress)}%`,
                        background: `linear-gradient(90deg, ${accent}, ${accent.replace("60%", "75%")})`,
                        boxShadow: `0 0 8px ${accent.replace(")", " / 0.6)")}`,
                      }}
                    >
                      <div className="absolute inset-0 overflow-hidden rounded-full">
                        <div
                          className="absolute inset-0 -translate-x-full"
                          style={{
                            background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.5), transparent)",
                            animation: "shine 2.4s ease-in-out infinite",
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={cn("text-center transition-all", reached ? "opacity-100" : isNext ? "opacity-95" : "opacity-40")}>
                  <span
                    className={cn("text-[10px] font-black tabular-nums block leading-none tracking-tight")}
                    style={{
                      color: reached || isNext ? accent : undefined,
                    }}
                  >
                    {m.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Next milestone CTA / pressure microcopy */}
        {nextMilestone && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
            <p className="text-xs text-muted-foreground">
              <span
                className="font-black tabular-nums text-sm"
                style={{ color: isHot ? accent : undefined }}
              >
                {nextMilestone.days - displayStreak}d
              </span>{" "}
              to{" "}
              <span className="font-bold text-foreground">
                {nextMilestone.emoji} {nextMilestone.label}
              </span>
            </p>
            <ChevronRight size={14} className="text-muted-foreground/50" />
          </div>
        )}

        {!nextMilestone && (
          <div className="flex items-center justify-center mt-4 pt-3 border-t border-gold/20">
            <span
              className="text-xs font-black uppercase tracking-wider"
              style={{ color: accent }}
            >
              🏆 All milestones reached
            </span>
          </div>
        )}

        {/* Pressure microcopy */}
        {displayStreak >= 3 && (
          <p className="text-[11px] text-muted-foreground/70 font-semibold text-center italic mt-2">
            {displayStreak >= 100 ? "🔱 Legendary. The 0.1%." :
             displayStreak >= 60  ? "💎 Diamond status. Don't blink." :
             displayStreak >= 30  ? "👑 Most never reach this point." :
             displayStreak >= 14  ? "💪 Don't break now. Keep pushing." :
             displayStreak >= 7   ? "⚡ You're heating up. Stay locked in." :
             "🔥 Consistency is everything."}
          </p>
        )}

        {/* Streak deadline warning */}
        {deadline && displayStreak > 0 && (
          <div
            className={cn(
              "flex items-center justify-between mt-3 pt-3 border-t",
              deadline.expired ? "border-destructive/40" : deadline.urgent ? "border-destructive/25" : "border-border/30"
            )}
          >
            {deadline.expired ? (
              <p className="text-xs font-black text-destructive animate-pulse">
                💀 Streak at risk! Check in NOW
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                <span className={cn("font-black tabular-nums", deadline.urgent ? "text-destructive" : "text-foreground")}>
                  {deadline.urgent && "⚠️ "}
                  {deadline.hours}h {deadline.mins}m
                </span>{" "}
                until streak loss
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StreakDisplay;
