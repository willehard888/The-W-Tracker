import { Flame, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEffectiveStreak, getStreakDeadlineState } from "@/lib/streak";

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

/**
 * Compact streak — designed for the Command Deck side-by-side layout.
 * Fits next to Lock-Your-Day CTA without overflow, keeps the cinematic
 * flame + tier accent + single next-milestone bar.
 */
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
    ? "0.85s"
    : isDiamond
    ? "1.05s"
    : isBlazing
    ? "1.3s"
    : isOnFire
    ? "1.6s"
    : isWarm
    ? "2.0s"
    : isHot
    ? "2.4s"
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

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden p-4 border flex flex-col justify-between gap-3 isolate",
        className,
      )}
      style={{
        borderColor: isHot ? `${accent.replace(")", " / 0.45)")}` : "hsl(var(--border))",
        background: isHot
          ? "radial-gradient(120% 90% at 0% 0%, hsl(255 14% 11%), hsl(255 14% 6%))"
          : "linear-gradient(135deg, hsl(255 14% 8%), hsl(255 14% 6%))",
        boxShadow: isHot
          ? `0 10px 32px -16px ${accent.replace(")", " / 0.45)")}, inset 0 1px 0 hsl(0 0% 100% / 0.04)`
          : "inset 0 1px 0 hsl(0 0% 100% / 0.03)",
      }}
    >
      {/* Tier accent radial */}
      {isHot && (
        <div
          className="absolute -top-12 -right-10 w-40 h-40 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${accent.replace(")", " / 0.22)")} 0%, transparent 65%)`,
          }}
        />
      )}

      {/* Top: label + tier badge */}
      <div className="relative flex items-center justify-between">
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
            className="text-[10px] font-black uppercase tracking-[0.22em]"
            style={{ color: isHot ? accent : "hsl(var(--muted-foreground))" }}
          >
            Streak
          </p>
        </div>
        {tier.index >= 1 && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border",
              isLegendary && "animate-[streak-badge-shimmer_2.8s_ease-in-out_infinite]",
            )}
            style={{
              background: `${accent.replace(")", " / 0.18)")}`,
              color: accent,
              borderColor: `${accent.replace(")", " / 0.5)")}`,
            }}
          >
            {isLegendary && <Sparkles size={9} />}
            {tier.name}
          </span>
        )}
      </div>

      {/* Hero: flame + number */}
      <div className="relative flex items-center gap-3">
        <div
          className="relative flex h-14 w-14 items-center justify-center rounded-xl shrink-0 overflow-hidden"
          style={{
            background: flameBg,
            color: isHot ? "white" : "hsl(var(--muted-foreground))",
            boxShadow: isHot
              ? `0 0 22px ${accent.replace(")", " / 0.5)")}, inset 0 1px 0 hsl(0 0% 100% / 0.18), inset 0 -6px 12px hsl(0 0% 0% / 0.25)`
              : undefined,
          }}
        >
          {isHot && (
            <span
              aria-hidden
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                border: `2px solid ${accent.replace(")", " / 0.45)")}`,
                animation: `ping ${
                  isLegendary ? "1.2s" : isDiamond ? "1.5s" : isBlazing ? "1.8s" : "2.4s"
                } cubic-bezier(0,0,0.2,1) infinite`,
                opacity: 0.55,
              }}
            />
          )}
          <Flame
            size={26}
            strokeWidth={2.5}
            className="relative z-10"
            style={{
              animation: isHot ? `streak-fire ${flameDuration} ease-in-out infinite` : undefined,
              transformOrigin: "center bottom",
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 leading-none">
            <span
              className={cn(
                "font-black font-display tabular-nums tracking-tighter leading-[0.85]",
                displayStreak >= 100 ? "text-[40px]" : "text-[48px]",
                numberClass,
                isHot && "animate-[streak-number-pulse_3s_ease-in-out_infinite]",
              )}
              style={{
                filter: isHot
                  ? `drop-shadow(0 3px 10px ${accent.replace(")", " / 0.45)")})`
                  : undefined,
              }}
            >
              {displayStreak}
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
                <Zap size={8} /> PB
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer: next milestone progress OR deadline warning */}
      <div className="relative">
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
                  boxShadow: `0 0 8px ${accent.replace(")", " / 0.55)")}`,
                }}
              >
                <div
                  className="absolute inset-0 -translate-x-full"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.5), transparent)",
                    animation: "shine 2.4s ease-in-out infinite",
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
