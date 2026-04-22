import { Zap, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getEffectiveStreak, getStreakDeadlineState } from "@/lib/streak";
import RealisticFlame from "./RealisticFlame";

interface CompactStreakPanelProps {
  streak: number;
  longestStreak: number;
  lastCheckinAt?: string | null;
  className?: string;
}

const MILESTONES = [
  { days: 3, label: "3d", emoji: "🔥" },
  { days: 7, label: "7d", emoji: "⚡" },
  { days: 14, label: "14d", emoji: "💪" },
  { days: 30, label: "30d", emoji: "👑" },
  { days: 60, label: "60d", emoji: "💎" },
  { days: 100, label: "100d", emoji: "🏆" },
];

const getStreakTier = (streak: number) => {
  if (streak >= 100) return { name: "Legendary", index: 5 };
  if (streak >= 60) return { name: "Diamond", index: 4 };
  if (streak >= 30) return { name: "Champion", index: 3 };
  if (streak >= 14) return { name: "On Fire", index: 2 };
  if (streak >= 7) return { name: "Heating Up", index: 1 };
  if (streak >= 3) return { name: "Ignited", index: 0 };
  return { name: "Start", index: -1 };
};

/* ─── Embers rising from the flame ────────────────────────────────────── */
const Embers = ({ count, color }: { count: number; color: string }) => (
  <>
    {Array.from({ length: count }).map((_, i) => {
      const delay = (i / count) * 2.4;
      const duration = 1.8 + (i % 4) * 0.45;
      const xDrift = (i % 2 === 0 ? -1 : 1) * (4 + (i * 3) % 14);
      const left = 18 + ((i * 17) % 64);
      const size = 2 + (i % 3);
      return (
        <span
          key={i}
          className="streak-fx-ember absolute rounded-full pointer-events-none"
          style={{
            width: size,
            height: size,
            left: `${left}%`,
            bottom: 6,
            background: color,
            boxShadow: `0 0 ${size * 3}px ${color}`,
            opacity: 0,
            // @ts-expect-error CSS custom prop
            "--ember-x": `${xDrift}px`,
            animation: `streak-ember-rise ${duration}s ease-out infinite`,
            animationDelay: `${delay}s`,
          }}
        />
      );
    })}
  </>
);

/* ─── Pulse rings expanding from the flame box ────────────────────────── */
const PulseRings = ({ color, intensity }: { color: string; intensity: number }) => (
  <>
    {Array.from({ length: intensity }).map((_, i) => (
      <span
        key={i}
        className="streak-fx-pulse-ring absolute inset-0 rounded-xl pointer-events-none"
        style={{
          border: `2px solid ${color.replace(")", " / 0.55)")}`,
          animation: `streak-pulse-ring ${2.4 + i * 0.6}s cubic-bezier(0,0,0.2,1) infinite`,
          animationDelay: `${i * 0.8}s`,
        }}
      />
    ))}
  </>
);

/* ─── Sparkle twinkles around tier badge ──────────────────────────────── */
const Twinkles = ({ color }: { color: string }) => (
  <>
    {[
      { top: -2, left: -2, delay: 0 },
      { top: -3, right: -3, delay: 0.6 },
      { bottom: -2, left: -3, delay: 1.2 },
      { bottom: -3, right: -2, delay: 1.8 },
    ].map((pos, i) => (
      <span
        key={i}
        className="streak-fx-twinkle absolute w-1 h-1 rounded-full pointer-events-none"
        style={{
          ...pos,
          background: color,
          boxShadow: `0 0 6px ${color}`,
          animation: `streak-twinkle 2.4s ease-in-out infinite`,
          animationDelay: `${pos.delay}s`,
        }}
      />
    ))}
  </>
);

const CompactStreakPanel = ({
  streak,
  longestStreak,
  lastCheckinAt,
  className,
}: CompactStreakPanelProps) => {
  const displayStreak = getEffectiveStreak(streak, lastCheckinAt);
  const deadline = getStreakDeadlineState(streak, lastCheckinAt);
  const tier = getStreakTier(displayStreak);

  const isHot = tier.index >= 0;
  const isWarm = tier.index >= 1;
  const isOnFire = tier.index >= 2;
  const isBlazing = tier.index >= 3;
  const isDiamond = tier.index >= 4;
  const isLegendary = tier.index >= 5;

  const nextMilestone = MILESTONES.find((m) => displayStreak < m.days);
  const prevMilestone = [...MILESTONES].reverse().find((m) => displayStreak >= m.days);
  const prevDays = prevMilestone?.days || 0;
  const nextDays = nextMilestone?.days || 365;
  const segmentProgress = nextMilestone
    ? Math.min(100, ((displayStreak - prevDays) / (nextDays - prevDays)) * 100)
    : 100;
  const closeToMilestone = nextMilestone && segmentProgress >= 75;

  /* ── Animated count-up + milestone shockwave detection ─────────────── */
  const [countDisplay, setCountDisplay] = useState(displayStreak);
  const [shockwave, setShockwave] = useState(false);
  const prevStreakRef = useRef(displayStreak);
  const numberKey = useRef(0);

  useEffect(() => {
    const prev = prevStreakRef.current;
    if (prev === displayStreak) return;

    // Detect milestone crossing
    const crossedMilestone = MILESTONES.some(
      (m) => prev < m.days && displayStreak >= m.days,
    );
    if (crossedMilestone) {
      setShockwave(true);
      const t = setTimeout(() => setShockwave(false), 900);
      // Stop propagation
    }

    // Count-up animation (300ms)
    const start = performance.now();
    const from = prev;
    const to = displayStreak;
    const duration = 600;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setCountDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    numberKey.current += 1;
    prevStreakRef.current = displayStreak;

    return () => cancelAnimationFrame(raf);
  }, [displayStreak]);

  /* ── Tier-driven styling ───────────────────────────────────────────── */
  const accent = isLegendary
    ? "hsl(280 80% 65%)"
    : isDiamond
    ? "hsl(200 85% 65%)"
    : isBlazing
    ? "hsl(42 85% 60%)"
    : isOnFire
    ? "hsl(28 95% 60%)"
    : isWarm
    ? "hsl(18 95% 58%)"
    : isHot
    ? "hsl(14 90% 56%)"
    : "hsl(var(--muted-foreground))";

  const numberClass = isLegendary
    ? "streak-legendary-text"
    : isDiamond
    ? "streak-diamond-text"
    : isBlazing
    ? "streak-gold-text"
    : isWarm
    ? "streak-orange-text"
    : isHot
    ? "text-[hsl(var(--streak-orange))]"
    : "text-foreground";

  const flameDuration = isLegendary
    ? "0.7s"
    : isDiamond
    ? "0.9s"
    : isBlazing
    ? "1.15s"
    : isOnFire
    ? "1.4s"
    : isWarm
    ? "1.8s"
    : isHot
    ? "2.2s"
    : "0s";

  const flameBg = isLegendary
    ? "linear-gradient(135deg, hsl(280 70% 50%), hsl(42 78% 54%), hsl(350 80% 55%))"
    : isDiamond
    ? "linear-gradient(135deg, hsl(200 80% 50%), hsl(42 78% 54%))"
    : isBlazing
    ? "linear-gradient(135deg, hsl(42 60% 40%), hsl(42 90% 65%))"
    : isOnFire
    ? "linear-gradient(135deg, hsl(18 80% 45%), hsl(28 95% 65%))"
    : isWarm
    ? `linear-gradient(135deg, ${accent.replace(")", " / 0.7)")}, ${accent})`
    : isHot
    ? `${accent.replace(")", " / 0.2)")}`
    : "hsl(var(--secondary))";

  const emberCount = isLegendary ? 14 : isDiamond ? 11 : isBlazing ? 8 : isOnFire ? 6 : isWarm ? 4 : isHot ? 3 : 0;
  const ringCount = isLegendary ? 3 : isDiamond ? 2 : isBlazing ? 2 : isHot ? 1 : 0;
  const emberColor = isLegendary
    ? "hsl(280 90% 75%)"
    : isDiamond
    ? "hsl(200 90% 75%)"
    : isBlazing
    ? "hsl(42 95% 70%)"
    : "hsl(28 95% 65%)";

  // Ember burst rays for milestone crossing — 8 directional sparks
  const burstRays = useMemo(
    () =>
      Array.from({ length: 8 }).map((_, i) => ({
        angle: (i / 8) * 360,
        delay: (i % 4) * 0.04,
      })),
    [],
  );

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden p-4 border flex flex-col justify-between gap-3 isolate min-h-[200px]",
        isHot && "depth-realistic-warm",
        !isHot && "depth-realistic",
        className,
      )}
      style={{
        borderColor: isHot ? `${accent.replace(")", " / 0.5)")}` : "hsl(var(--border))",
        background: isHot
          ? "radial-gradient(120% 90% at 0% 0%, hsl(255 14% 11%), hsl(255 14% 6%))"
          : "linear-gradient(135deg, hsl(255 14% 8%), hsl(255 14% 6%))",
      }}
    >
      {/* Background heat shimmer (Champion+) */}
      {isBlazing && (
        <div
          className="streak-fx-bg-shimmer absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center bottom, ${accent.replace(")", " / 0.18)")} 0%, transparent 70%)`,
            animation: "streak-bg-shimmer 3.5s ease-in-out infinite",
          }}
        />
      )}

      {/* Aurora sweep (Legendary) */}
      {isLegendary && (
        <div
          className="streak-fx-aurora absolute inset-y-0 w-1/2 pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(280 80% 70% / 0.18) 30%, hsl(42 95% 70% / 0.22) 50%, hsl(350 85% 65% / 0.18) 70%, transparent)",
            animation: "streak-aurora-sweep 6s ease-in-out infinite",
          }}
        />
      )}

      {/* Lightning flickers (Legendary) */}
      {isLegendary && (
        <>
          <div
            className="streak-fx-lightning absolute top-2 right-3 w-px h-12 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, transparent, hsl(280 90% 80%), hsl(42 95% 75%), transparent)",
              boxShadow: "0 0 8px hsl(280 90% 80%)",
              animation: "streak-lightning 4.5s ease-in-out infinite",
            }}
          />
          <div
            className="streak-fx-lightning absolute top-6 left-4 w-px h-10 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, transparent, hsl(200 90% 80%), transparent)",
              boxShadow: "0 0 8px hsl(200 90% 80%)",
              animation: "streak-lightning 6s ease-in-out infinite",
              animationDelay: "1.2s",
            }}
          />
        </>
      )}

      {/* Top: label + tier badge */}
      <div className="relative flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: accent,
              boxShadow: isHot ? `0 0 8px ${accent}` : undefined,
              animation: isHot ? "pulse 1.6s ease-in-out infinite" : undefined,
            }}
          />
          <p
            className="text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: isHot ? accent : "hsl(var(--muted-foreground))" }}
          >
            Streak
          </p>
        </div>
        {tier.index >= 1 && (
          <div className="relative">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border relative",
                isLegendary && "animate-[streak-badge-shimmer_2.8s_ease-in-out_infinite]",
              )}
              style={{
                background: `${accent.replace(")", " / 0.18)")}`,
                color: accent,
                borderColor: `${accent.replace(")", " / 0.55)")}`,
                boxShadow: isHot ? `0 0 10px ${accent.replace(")", " / 0.35)")}` : undefined,
              }}
            >
              {isLegendary && <Sparkles size={9} />}
              {tier.name}
            </span>
            {isDiamond && <Twinkles color={accent} />}
          </div>
        )}
      </div>

      {/* Hero: flame + number */}
      <div className="relative flex items-center gap-3 z-10">
        <div
          className="relative flex h-14 w-14 items-center justify-center rounded-xl shrink-0 overflow-visible"
          style={{
            background: flameBg,
            color: isHot ? "white" : "hsl(var(--muted-foreground))",
            boxShadow: isHot
              ? `0 0 26px ${accent.replace(")", " / 0.55)")}, inset 0 1px 0 hsl(0 0% 100% / 0.25), inset 0 -6px 14px hsl(0 0% 0% / 0.35), inset 0 1px 2px hsl(0 0% 0% / 0.15)`
              : "inset 0 1px 0 hsl(0 0% 100% / 0.05), inset 0 -2px 6px hsl(0 0% 0% / 0.25)",
          }}
        >
          {/* Realistic "fuel pool" pulse beneath flame — warm soft glow */}
          {isHot && (
            <span
              aria-hidden
              className="streak-fx-fuel absolute left-1/2 bottom-0 h-3 w-10 rounded-[50%] pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at center, ${accent}, transparent 75%)`,
                animation: "streak-fuel-pulse 2.4s ease-in-out infinite",
                mixBlendMode: "screen",
                zIndex: 1,
              }}
            />
          )}

          {/* Inner overflow clip for embers */}
          <div className="absolute inset-0 rounded-xl overflow-hidden">
            {isHot && <Embers count={emberCount} color={emberColor} />}
            {/* Inner glow ring */}
            {isHot && (
              <span
                aria-hidden
                className="absolute inset-1 rounded-lg pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 50% 80%, ${accent.replace(")", " / 0.5)")}, transparent 65%)`,
                }}
              />
            )}
          </div>

          {/* Pulse rings (outside clip) */}
          {isHot && <PulseRings color={accent} intensity={ringCount} />}

          {/* Conic ring (Diamond+) */}
          {isDiamond && (
            <span
              aria-hidden
              className="absolute -inset-[3px] rounded-xl pointer-events-none"
              style={{
                background: isLegendary
                  ? "conic-gradient(from 0deg, hsl(280 80% 65%), hsl(42 95% 70%), hsl(350 85% 65%), hsl(200 85% 70%), hsl(280 80% 65%))"
                  : "conic-gradient(from 0deg, hsl(200 85% 65%), hsl(42 90% 65%), hsl(200 85% 65%))",
                animation: "streak-conic-spin 6s linear infinite",
                opacity: 0.55,
                WebkitMask:
                  "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                padding: 2,
              }}
            />
          )}

          {/* Double shockwave on milestone cross */}
          {shockwave && (
            <>
              <span
                aria-hidden
                className="streak-fx-shockwave absolute inset-0 rounded-xl pointer-events-none"
                style={{
                  border: `4px solid ${accent}`,
                  animation: "streak-shockwave 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                }}
              />
              <span
                aria-hidden
                className="streak-fx-shockwave absolute inset-0 rounded-xl pointer-events-none"
                style={{
                  border: `2px solid ${accent}`,
                  animation: "streak-shockwave-secondary 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards",
                }}
              />
              {/* Ember burst rays — 8 directional sparks */}
              {burstRays.map((ray, i) => (
                <span
                  key={`burst-${i}`}
                  aria-hidden
                  className="streak-fx-burst absolute top-1/2 left-1/2 w-1 h-3 rounded-full pointer-events-none"
                  style={{
                    background: `linear-gradient(180deg, ${accent}, transparent)`,
                    boxShadow: `0 0 8px ${accent}`,
                    // @ts-expect-error custom prop
                    "--burst-angle": `${ray.angle}deg`,
                    animation: "streak-ember-burst 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                    animationDelay: `${ray.delay}s`,
                  }}
                />
              ))}
            </>
          )}

          <RealisticFlame
            tier={tier.index}
            accent={accent}
            size={42}
            className="relative z-10"
          />

          {/* Ground glow */}
          {isHot && (
            <span
              aria-hidden
              className="streak-fx-ground absolute -bottom-1 left-1/2 h-2 w-12 rounded-[50%] pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at center, ${accent.replace(")", " / 0.7)")}, transparent 70%)`,
                filter: "blur(3px)",
                animation: "streak-ground-pulse 2s ease-in-out infinite",
              }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 leading-none">
            <span
              key={numberKey.current}
              className={cn(
                "font-black font-display tabular-nums tracking-tighter leading-[0.85] inline-block",
                displayStreak >= 100 ? "text-[40px]" : "text-[48px]",
                numberClass,
              )}
              style={{
                filter: isHot
                  ? `drop-shadow(0 3px 12px ${accent.replace(")", " / 0.55)")})`
                  : undefined,
                animation: isHot
                  ? "streak-number-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), streak-number-breathe 3.6s ease-in-out infinite 0.7s"
                  : "streak-number-in 0.5s ease-out",
                transformOrigin: "center bottom",
              }}
            >
              {countDisplay}
            </span>
            <span className="font-black text-muted-foreground/70 font-display text-[10px] uppercase tracking-[0.2em]">
              day{displayStreak === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[9px] text-muted-foreground/70 font-bold uppercase tracking-[0.16em]">
              Best{" "}
              <span className="text-foreground font-black tabular-nums">{longestStreak}d</span>
            </span>
            {displayStreak === longestStreak && displayStreak > 0 && (
              <span
                className="text-[8.5px] font-black uppercase tracking-wider flex items-center gap-0.5"
                style={{ color: accent }}
              >
                <Zap size={8} className="animate-pulse" /> PB
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer: next milestone progress OR deadline warning */}
      <div className="relative z-10">
        {deadline?.expired && displayStreak > 0 ? (
          <p className="text-[10px] font-black text-destructive animate-pulse uppercase tracking-wider">
            💀 At risk — check in NOW
          </p>
        ) : deadline?.urgent && displayStreak > 0 ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-destructive uppercase tracking-wider">
                ⚠️ {deadline.hours}h {deadline.mins}m left
              </span>
              {nextMilestone && (
                <span className="text-muted-foreground/80 tabular-nums font-bold">
                  → {nextMilestone.label}
                </span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-secondary/70 overflow-hidden surface-inset">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(8, segmentProgress)}%`,
                  background: `linear-gradient(90deg, ${accent}, ${accent.replace("60%", "75%")})`,
                  boxShadow: `0 0 6px ${accent.replace(")", " / 0.5)")}`,
                }}
              />
            </div>
          </div>
        ) : nextMilestone ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground/80 font-bold uppercase tracking-wider">
                Next
              </span>
              <span className="font-black tabular-nums" style={{ color: accent }}>
                {nextMilestone.days - displayStreak}d → {nextMilestone.emoji}{" "}
                {nextMilestone.label}
              </span>
            </div>
            <div
              className="h-1.5 rounded-full bg-secondary/70 overflow-hidden surface-inset relative"
              style={{
                boxShadow: isHot
                  ? `0 0 6px ${accent.replace(")", " / 0.3)")}, inset 0 1px 2px hsl(0 0% 0% / 0.4)`
                  : "inset 0 1px 2px hsl(0 0% 0% / 0.3)",
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
                style={{
                  width: `${Math.max(6, segmentProgress)}%`,
                  background: isLegendary
                    ? "linear-gradient(90deg, hsl(280 80% 60%), hsl(42 90% 65%), hsl(200 85% 65%))"
                    : isDiamond
                    ? "linear-gradient(90deg, hsl(200 85% 60%), hsl(42 90% 65%))"
                    : `linear-gradient(90deg, ${accent}, ${accent.replace("60%", "75%")})`,
                  // @ts-expect-error CSS custom prop
                  "--bar-glow": `${accent.replace(")", " / 0.7)")}`,
                  animation: closeToMilestone
                    ? "streak-bar-pump 1.6s ease-in-out infinite"
                    : undefined,
                  boxShadow: `0 0 8px ${accent.replace(")", " / 0.55)")}`,
                }}
              >
                <div
                  className="absolute inset-0 -translate-x-full"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.55), transparent)",
                    animation: "shine 2.2s ease-in-out infinite",
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <p
            className="text-[10px] font-black uppercase tracking-wider text-center"
            style={{ color: accent }}
          >
            🏆 All milestones reached
          </p>
        )}
      </div>
    </div>
  );
};

export default CompactStreakPanel;
