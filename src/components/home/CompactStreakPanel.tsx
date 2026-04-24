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

  // Panel grows with streak so big flames never clip — base raised for 3-flame trio
  const panelMinH = 280 + Math.min(80, Math.round(Math.pow(Math.min(displayStreak, 120), 0.6) * 7));

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden p-4 pt-6 border flex flex-col justify-between gap-3 isolate",
        isHot && "depth-realistic-warm",
        !isHot && "depth-realistic",
        className,
      )}
      style={{
        minHeight: `${panelMinH}px`,
        borderColor: isHot ? `${accent.replace(")", " / 0.55)")}` : "hsl(var(--border))",
        // Pure dark — deep black with a subtle warm ember vignette at the bottom only
        background: isHot
          ? `radial-gradient(ellipse 70% 50% at 22% 100%, hsl(18 95% 50% / 0.10) 0%, transparent 60%),
             radial-gradient(120% 90% at 50% 0%, hsl(0 0% 4%), hsl(0 0% 2%))`
          : "linear-gradient(135deg, hsl(0 0% 5%), hsl(0 0% 2%))",
        boxShadow: isHot
          ? `inset 0 0 60px hsl(0 0% 0% / 0.7), 0 0 32px hsl(18 95% 50% / 0.12)`
          : "inset 0 0 40px hsl(0 0% 0% / 0.6)",
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

      {/* Hero: 3-flame fire-pit + number — flame trio is the FOCAL POINT */}
      <div className="relative flex items-center gap-3.5 z-10">
        <div
          className="relative flex h-44 w-32 items-end justify-center rounded-2xl shrink-0 pb-1"
          style={{
            // Stone fire-pit: deep black chamber with warm ember glow at the very bottom
            background: isHot
              ? `
                radial-gradient(ellipse 85% 35% at 50% 102%, hsl(22 98% 55% / 0.95) 0%, hsl(20 95% 50% / 0.4) 28%, transparent 60%),
                radial-gradient(ellipse at 50% 110%, hsl(18 75% 22%) 0%, hsl(16 35% 9%) 32%, hsl(0 0% 3%) 68%, hsl(0 0% 1%) 100%)
              `
              : "transparent",
            color: isHot ? "white" : "hsl(var(--muted-foreground))",
            boxShadow: isHot
              ? `0 0 38px hsl(22 98% 55% / 0.5), 0 0 80px hsl(18 95% 50% / 0.22), inset 0 2px 0 hsl(0 0% 100% / 0.10), inset 0 -10px 22px hsl(0 0% 0% / 0.7), inset 0 0 26px hsl(0 0% 0% / 0.55)`
              : undefined,
            overflow: "visible",
          }}
        >
          {/* Stone-textured chamber walls — subtle hatching */}
          {isHot && (
            <span
              aria-hidden
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                background:
                  "repeating-linear-gradient(90deg, transparent 0px, hsl(0 0% 100% / 0.025) 6px, transparent 12px), repeating-linear-gradient(0deg, transparent 0px, hsl(0 0% 0% / 0.18) 14px, transparent 28px)",
                mixBlendMode: "overlay",
              }}
            />
          )}

          {/* Top vignette — chimney shadow */}
          {isHot && (
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-5 pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, hsl(0 0% 0% / 0.55), transparent)",
              }}
            />
          )}

          {/* Realistic "fuel pool" pulse beneath flame — ember bed glow */}
          {isHot && (
            <span
              aria-hidden
              className="streak-fx-fuel absolute left-1/2 bottom-[3px] h-[10px] w-[64px] rounded-[50%] pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at center, ${accent} 0%, ${accent.replace(")", " / 0.55)")} 40%, hsl(14 80% 28% / 0.5) 70%, transparent 100%)`,
                transform: "translateX(-50%)",
                filter: "blur(2.5px)",
                animation: "streak-fuel-pulse 2.4s ease-in-out infinite",
                mixBlendMode: "screen",
                zIndex: 2,
              }}
            />
          )}

          {/* Glowing coals — tiny bright pinpoints inside the ember bed */}
          {isHot &&
            [
              { left: "30%", size: 2.5, delay: "0s" },
              { left: "46%", size: 3, delay: "0.6s" },
              { left: "60%", size: 2, delay: "1.2s" },
              { left: "38%", size: 2, delay: "1.8s" },
              { left: "54%", size: 2.5, delay: "0.3s" },
            ].map((c, i) => (
              <span
                key={`coal-${i}`}
                aria-hidden
                className="absolute bottom-[3px] rounded-full pointer-events-none"
                style={{
                  left: c.left,
                  width: c.size,
                  height: c.size,
                  background: accent,
                  boxShadow: `0 0 ${c.size * 3}px ${accent}, 0 0 ${c.size * 6}px ${accent.replace(")", " / 0.6)")}`,
                  animation: `streak-fuel-pulse ${1.4 + i * 0.3}s ease-in-out infinite`,
                  animationDelay: c.delay,
                  zIndex: 3,
                }}
              />
            ))}

          {/* Charred log #1 — left-leaning */}
          {isHot && (
            <span
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                left: "8px",
                bottom: "5px",
                width: "32px",
                height: "7px",
                borderRadius: "3.5px",
                background:
                  "linear-gradient(180deg, hsl(20 18% 14%) 0%, hsl(18 12% 8%) 60%, hsl(0 0% 3%) 100%)",
                boxShadow: `inset 0 1px 0 hsl(0 0% 100% / 0.06), inset 0 -1px 0 hsl(0 0% 0% / 0.5), 0 -1px 5px ${accent.replace(")", " / 0.5)")}`,
                transform: "rotate(-12deg)",
                zIndex: 4,
              }}
            />
          )}

          {/* Charred log #2 — right-leaning, crossing log #1 */}
          {isHot && (
            <span
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                right: "6px",
                bottom: "4px",
                width: "34px",
                height: "7px",
                borderRadius: "3.5px",
                background:
                  "linear-gradient(180deg, hsl(20 16% 13%) 0%, hsl(16 10% 7%) 60%, hsl(0 0% 2%) 100%)",
                boxShadow: `inset 0 1px 0 hsl(0 0% 100% / 0.05), inset 0 -1px 0 hsl(0 0% 0% / 0.55), 0 -1px 6px ${accent.replace(")", " / 0.6)")}`,
                transform: "rotate(10deg)",
                zIndex: 4,
              }}
            />
          )}

          {/* Hot crack on log #2 — glowing fissure where wood is burning through */}
          {isHot && (
            <span
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                right: "10px",
                bottom: "6px",
                width: "24px",
                height: "1.5px",
                background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
                boxShadow: `0 0 6px ${accent}`,
                transform: "rotate(10deg)",
                filter: "blur(0.4px)",
                animation: `streak-fuel-pulse ${isBlazing ? 1.8 : 2.4}s ease-in-out infinite`,
                zIndex: 5,
              }}
            />
          )}

          {/* Inner overflow clip for embers (kept clipped so embers stay within stone walls) */}
          <div className="absolute inset-0 rounded-xl overflow-hidden">
            {isHot && <Embers count={emberCount} color={emberColor} />}
            {/* Inner glow ring */}
            {isHot && (
              <span
                aria-hidden
                className="absolute inset-1 rounded-lg pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 50% 80%, ${accent.replace(")", " / 0.55)")}, transparent 65%)`,
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

          {/* Layered bonfire — 5 flames stacked at different depths/sizes,
              all sharing one ember bed. Center is biggest & frontmost.
              Sizes scale LIVE with streak; intensity layers up via tier. */}
          {(() => {
            const cappedTier = Math.min(Math.max(tier.index, 2), 4);

            // Live streak → master size (true reactivity)
            // 0d: 80px, 7d: 110, 30d: 145, 100d+: 180
            const master = Math.round(
              80 + Math.min(100, Math.pow(Math.min(displayStreak, 120), 0.6) * 9.5),
            );

            const dropShadow = (acc: string, mul: number) =>
              `drop-shadow(0 -4px ${(8 + displayStreak * 0.3) * mul}px ${acc.replace(")", " / 0.85)")}) drop-shadow(0 -12px ${(20 + displayStreak * 0.5) * mul}px ${acc.replace(")", " / 0.45)")})`;

            // 5 layered flames — back-to-front, smallest/coolest to biggest/hottest
            const layers = [
              // Furthest back-left, low & wide, deep red, blurred (hot air mass)
              {
                size: Math.round(master * 0.55),
                accent: "hsl(14 90% 48%)",
                tier: Math.max(cappedTier - 2, 1),
                offsetX: -master * 0.28,
                offsetY: 6,
                z: 1,
                opacity: 0.6,
                scaleX: 1.15,
                scaleY: 0.9,
                blur: 1.5,
                shadowMul: 0.5,
              },
              // Furthest back-right, slightly taller, mirrored
              {
                size: Math.round(master * 0.6),
                accent: "hsl(16 92% 50%)",
                tier: Math.max(cappedTier - 2, 1),
                offsetX: master * 0.26,
                offsetY: 5,
                z: 2,
                opacity: 0.7,
                scaleX: -1.05,
                scaleY: 0.95,
                blur: 1.2,
                shadowMul: 0.55,
              },
              // Mid-left flame, medium height
              {
                size: Math.round(master * 0.72),
                accent: "hsl(18 95% 53%)",
                tier: Math.max(cappedTier - 1, 2),
                offsetX: -master * 0.18,
                offsetY: 3,
                z: 3,
                opacity: 0.88,
                scaleX: 1,
                scaleY: 1,
                blur: 0.4,
                shadowMul: 0.7,
              },
              // Mid-right flame, slightly bigger, mirrored
              {
                size: Math.round(master * 0.78),
                accent: "hsl(20 96% 54%)",
                tier: Math.max(cappedTier - 1, 2),
                offsetX: master * 0.16,
                offsetY: 2,
                z: 4,
                opacity: 0.92,
                scaleX: -1,
                scaleY: 1.02,
                blur: 0.3,
                shadowMul: 0.78,
              },
              // CENTER hero flame — tallest, hottest, frontmost
              {
                size: master,
                accent: "hsl(22 100% 56%)",
                tier: cappedTier,
                offsetX: 0,
                offsetY: 0,
                z: 5,
                opacity: 1,
                scaleX: 1,
                scaleY: 1,
                blur: 0,
                shadowMul: 1,
              },
            ];

            return (
              <div
                className="absolute inset-x-0 bottom-[2px] z-[20] flex items-end justify-center pointer-events-none"
                style={{ overflow: "visible", height: Math.round(master * 1.4) }}
              >
                {layers.map((L, i) => (
                  <span
                    key={i}
                    className="flame-bowl absolute left-1/2 bottom-0 flex items-end justify-center"
                    style={{
                      width: L.size,
                      height: Math.round(L.size * 1.25),
                      transform: `translateX(calc(-50% + ${L.offsetX}px)) translateY(${L.offsetY}px) scale(${L.scaleX}, ${L.scaleY})`,
                      transformOrigin: "center bottom",
                      filter: `${dropShadow(L.accent, L.shadowMul)}${L.blur ? ` blur(${L.blur}px)` : ""}`,
                      opacity: L.opacity,
                      zIndex: L.z,
                      mixBlendMode: i < 4 ? "screen" : "normal",
                    }}
                  >
                    <RealisticFlame
                      tier={L.tier}
                      accent={L.accent}
                      size={L.size}
                      interactive={false}
                    />
                  </span>
                ))}
              </div>
            );
          })()}
          {/* Ground glow — outside the chamber, sells radiated heat */}
          {isHot && (
            <span
              aria-hidden
              className="streak-fx-ground absolute -bottom-1.5 left-1/2 h-2.5 w-16 rounded-[50%] pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at center, ${accent.replace(")", " / 0.8)")}, transparent 70%)`,
                filter: "blur(4px)",
                animation: "streak-ground-pulse 2s ease-in-out infinite",
                transform: "translateX(-50%)",
                zIndex: 7,
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
          {/* Loss-aversion microcopy — shown only when there's something to lose. */}
          {displayStreak >= 3 && !deadline?.expired && (
            <p
              className="mt-1.5 text-[9px] font-black uppercase tracking-[0.18em] flex items-center gap-1 leading-none"
              style={{
                color: isHot ? accent : "hsl(var(--muted-foreground))",
                textShadow: isHot ? `0 0 10px ${accent.replace(")", " / 0.45)")}` : undefined,
              }}
            >
              <span aria-hidden className="inline-block h-1 w-1 rounded-full" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />
              {isLegendary ? "Don't let it die" : isDiamond ? "Protect the fire" : "Keep it alive"}
            </p>
          )}
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
