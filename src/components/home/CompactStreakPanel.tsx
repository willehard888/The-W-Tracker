import { Zap, Sparkles, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEffectiveStreak, getStreakDeadlineState } from "@/lib/streak";

interface CompactStreakPanelProps {
  streak: number;
  longestStreak: number;
  lastCheckinAt?: string | null;
  className?: string;
}

const MILESTONES = [
  { days: 3, label: "3d" },
  { days: 7, label: "7d" },
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
  { days: 60, label: "60d" },
  { days: 100, label: "100d" },
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
 * CompactStreakPanel — the static, performance-first streak card on the home
 * page.
 *
 * Previous versions rendered the 2,400-line SVG-turbulence flame engine
 * (`StylizedStreakFlame`) plus dozens of layered ember / spark / smoke /
 * pulse-ring animations. Even with perf-class gating that whole flame
 * cinema is now stripped — the panel is purely static markup that still
 * communicates everything the user actually needs:
 *
 *   • Current streak count + "days" suffix
 *   • Tier badge (Ignited / Heating Up / On Fire / Champion / Diamond / Legendary)
 *   • Personal best ("Best Nd" + a PB tag when current == best)
 *   • Loss-aversion microcopy when there's something to protect
 *   • Progress bar to the next milestone (static; pure CSS width)
 *   • Deadline countdown when the streak is at risk
 *
 * No CSS animations, no JS RAF, no useEffect, no lazy import, no
 * IntersectionObserver. The home page should land instantly.
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

  // Tier accent (single source of truth for all of the gold/orange/diamond hues)
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

  const accentDim = accent.replace(")", " / 0.18)");
  const accentBorder = accent.replace(")", " / 0.55)");

  return (
    <div
      className={cn(
        "relative rounded-2xl p-4 border flex flex-col justify-between gap-4 isolate",
        isHot ? "depth-realistic-warm" : "depth-realistic",
        className,
      )}
      style={{
        borderColor: isHot ? `${accent.replace(")", " / 0.35)")}` : "hsl(var(--border))",
        background: "radial-gradient(120% 100% at 50% 0%, hsl(0 0% 5%), hsl(0 0% 1.5%))",
        boxShadow: isHot
          ? "inset 0 0 60px hsl(0 0% 0% / 0.7)"
          : "inset 0 0 40px hsl(0 0% 0% / 0.6)",
      }}
    >
      {/* Top: label + tier badge */}
      <div className="relative flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
            style={{ background: accent }}
          />
          <p
            className="text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: isHot ? accent : "hsl(var(--muted-foreground))" }}
          >
            Streak
          </p>
        </div>
        {tier.index >= 1 && (
          <span
            className="inline-flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border"
            style={{
              background: accentDim,
              color: accent,
              borderColor: accentBorder,
            }}
          >
            {isLegendary && <Sparkles size={9} />}
            {tier.name}
          </span>
        )}
      </div>

      {/* Hero: static flame icon + count */}
      <div className="relative flex items-center gap-4 z-10">
        {/* Static flame medallion (replaces 2400-line StylizedStreakFlame) */}
        <div
          className="relative h-20 w-20 rounded-2xl shrink-0 flex items-center justify-center border"
          style={{
            borderColor: isHot ? accentBorder : "hsl(var(--border))",
            background: isHot
              ? `radial-gradient(ellipse at 50% 65%, ${accent.replace(")", " / 0.22)")} 0%, hsl(0 0% 4%) 70%)`
              : "linear-gradient(180deg, hsl(0 0% 8%), hsl(0 0% 4%))",
            boxShadow: isHot ? `0 0 24px -8px ${accent.replace(")", " / 0.5)")}` : undefined,
          }}
        >
          <Flame
            size={36}
            strokeWidth={1.5}
            className="shrink-0"
            style={{
              color: isHot ? accent : "hsl(var(--muted-foreground))",
              filter: isHot ? `drop-shadow(0 0 8px ${accent.replace(")", " / 0.55)")})` : undefined,
            }}
            fill={isHot ? accent : "transparent"}
            fillOpacity={isHot ? 0.18 : 0}
            aria-hidden
          />
        </div>

        <div className="min-w-0 flex-1 relative z-[50]">
          {isHot && (
            <p
              className="text-[8.5px] font-black uppercase tracking-[0.24em] mb-1.5"
              style={{ color: accent }}
            >
              Burning · {tier.name}
            </p>
          )}
          <div className="flex items-baseline gap-1.5 leading-none">
            <span
              className={cn(
                "font-black font-display tabular-nums tracking-tighter leading-[0.85] inline-block",
                displayStreak >= 100 ? "text-[44px]" : "text-[54px]",
              )}
              style={{
                color: isHot ? "hsl(0 0% 98%)" : "hsl(var(--foreground))",
              }}
            >
              {displayStreak}
            </span>
            <span
              className="font-black font-display text-[11px] uppercase tracking-[0.22em]"
              style={{ color: isHot ? accent : "hsl(var(--muted-foreground) / 0.7)" }}
            >
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
                className="text-[8.5px] font-black uppercase tracking-wider flex items-center gap-0.5 text-background"
                style={{ backgroundColor: accent, padding: "1px 3px", borderRadius: "2px" }}
              >
                <Zap size={8} /> PB
              </span>
            )}
          </div>
          {/* Loss-aversion microcopy — kept; pure text. */}
          {displayStreak >= 3 && !deadline?.expired && (
            <p
              className="mt-1.5 text-[9px] font-black uppercase tracking-[0.18em] flex items-center gap-1 leading-none"
              style={{ color: isHot ? accent : "hsl(var(--muted-foreground))" }}
            >
              <span
                aria-hidden
                className="inline-block h-1 w-1 rounded-full shrink-0"
                style={{ background: accent }}
              />
              {isLegendary ? "Don't let it die" : isDiamond ? "Protect the fire" : "Keep it alive"}
            </p>
          )}
        </div>
      </div>

      {/* Footer: next milestone progress OR deadline warning. Static bar — no
          shine sweep, no pump animation. */}
      <div className="relative z-10">
        {deadline?.expired && displayStreak > 0 ? (
          <p className="text-[10px] font-black text-destructive uppercase tracking-wider">
            ⚠ At risk — check in now
          </p>
        ) : deadline?.urgent && displayStreak > 0 ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-destructive uppercase tracking-wider">
                ⚠ {deadline.hours}h {deadline.mins}m left
              </span>
              {nextMilestone && (
                <span className="text-muted-foreground/80 tabular-nums font-bold">
                  → {nextMilestone.label}
                </span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-secondary/70 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(8, segmentProgress)}%`,
                  background: accent,
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
                {nextMilestone.days - displayStreak}d → {nextMilestone.label}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary/70 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(6, segmentProgress)}%`,
                  background: accent,
                }}
              />
            </div>
          </div>
        ) : (
          <p
            className="text-[10px] font-black uppercase tracking-wider text-center"
            style={{ color: accent }}
          >
            ★ All milestones reached
          </p>
        )}
      </div>
    </div>
  );
};

export default CompactStreakPanel;
