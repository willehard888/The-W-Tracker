import RealisticFlame from "@/components/home/RealisticFlame";
import { cn } from "@/lib/utils";
import {
  collectiveStreakTier,
  collectiveTierName,
  collectiveAccent,
} from "@/lib/tribe-streak";

interface TribeCollectiveFlameProps {
  /** Sum of all active members' current streaks. */
  total: number;
  /** Number of active members — shown as small "avg" hint. */
  memberCount?: number;
  /** Optional: how many members checked in today (for the "+X today" chip). */
  todayCount?: number;
  /** Optional tribe name shown UNDER the flame in hero variant. */
  tribeName?: string;
  /**
   * Visual variant.
   *  - `compact` (default): inline panel, flame + stats side-by-side.
   *  - `hero`: full-bleed centerpiece — massive flame, name underneath.
   */
  variant?: "compact" | "hero";
  className?: string;
}

/** Thresholds aligned with collectiveStreakTier(): 0,30,100,300,700,1500,3000,6000 */
const TIER_FLOORS = [0, 30, 100, 300, 700, 1500, 3000, 6000];

const nextTierProgress = (total: number) => {
  let cleared = 0;
  let next = TIER_FLOORS[1];
  for (let i = 0; i < TIER_FLOORS.length - 1; i++) {
    if (total >= TIER_FLOORS[i]) {
      cleared = TIER_FLOORS[i];
      next = TIER_FLOORS[i + 1];
    }
  }
  if (total >= TIER_FLOORS[TIER_FLOORS.length - 1]) {
    return { pct: 100, cleared, next: total, atMax: true };
  }
  const span = Math.max(1, next - cleared);
  const pct = Math.min(100, Math.max(0, ((total - cleared) / span) * 100));
  return { pct, cleared, next, atMax: false };
};

const TribeCollectiveFlame = ({
  total,
  memberCount,
  todayCount,
  tribeName,
  variant = "compact",
  reactor,
  className,
}: TribeCollectiveFlameProps) => {
  const tier = collectiveStreakTier(total);
  const isCold = tier < 0;
  const isFirestorm = tier >= 6;
  const isHero = variant === "hero";

  // Hero scales bigger; compact keeps the inline 56–190px ladder
  const size = isHero
    ? (tier >= 6 ? 260 :
       tier >= 5 ? 230 :
       tier >= 4 ? 210 :
       tier >= 3 ? 190 :
       tier >= 2 ? 170 :
       tier >= 1 ? 150 :
       tier >= 0 ? 132 : 110)
    : (tier >= 6 ? 190 :
       tier === 5 ? 160 :
       tier === 4 ? 138 :
       tier === 3 ? 116 :
       tier === 2 ? 96  :
       tier === 1 ? 80  :
       tier === 0 ? 68  : 56);

  const accent = collectiveAccent(total);
  const tierName = collectiveTierName(total);
  const avg = memberCount && memberCount > 0
    ? Math.round((total / memberCount) * 10) / 10
    : null;

  const { pct, next, atMax } = nextTierProgress(total);

  return (
    <div
      className={cn(
        "relative rounded-3xl overflow-hidden border",
        isHero ? "p-6" : "p-5",
        isCold
          ? "border-border/60 bg-card/50"
          : "border-[hsl(18_95%_58%)]/40 surface-ember shadow-[0_0_40px_hsl(18_95%_58%/0.20)]",
        className,
      )}
      style={
        !isCold
          ? ({
              ["--ember-accent" as string]: accent,
            } as React.CSSProperties)
          : undefined
      }
    >
      {/* Aurora rim — slow pulsing border highlight (hot tribes only) */}
      {!isCold && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{
            background: `linear-gradient(135deg, ${accent.replace(")", " / 0.0)")} 0%, ${accent.replace(")", " / 0.35)")} 50%, ${accent.replace(")", " / 0.0)")} 100%)`,
            padding: 1,
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor" as any,
            maskComposite: "exclude",
            animation: "flame-rim-pulse 4.5s ease-in-out infinite",
            opacity: 0.85,
          }}
        />
      )}

      {/* Stacked radial bloom + ember-drift particles */}
      {!isCold && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at 50% 95%, ${accent.replace(")", " / 0.30)")} 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, ${accent.replace(")", " / 0.10)")} 0%, transparent 70%)`,
            }}
            aria-hidden
          />
          {/* Ember particles drifting up from sides */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 2 + (i % 3),
                  height: 2 + (i % 3),
                  left: `${i % 2 === 0 ? 4 + i * 3 : 92 - i * 3}%`,
                  bottom: -4,
                  background: accent,
                  boxShadow: `0 0 6px ${accent}`,
                  opacity: 0,
                  animation: `ember-drift ${5 + (i % 3) * 0.8}s ease-out infinite`,
                  animationDelay: `${i * 0.7}s`,
                }}
              />
            ))}
          </div>
        </>
      )}

      {isHero ? (
        /* HERO LAYOUT — flame as the centerpiece, name beneath */
        <div className="relative flex flex-col items-center text-center pt-2 pb-1">
          {/* Top label */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/40 backdrop-blur-sm border mb-3"
            style={{
              borderColor: isCold ? "hsl(var(--border))" : accent.replace(")", " / 0.5)"),
              boxShadow: isCold ? undefined : `0 0 18px ${accent.replace(")", " / 0.4)")}`,
            }}
          >
            <span
              className="text-[10px] font-black tracking-widest uppercase"
              style={{ color: isCold ? "hsl(var(--muted-foreground))" : accent }}
            >
              Tribe Fire
            </span>
            {!!todayCount && todayCount > 0 && !isCold && (
              <span
                className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border"
                style={{
                  color: accent,
                  borderColor: accent.replace(")", " / 0.5)"),
                  background: accent.replace(")", " / 0.10)"),
                }}
              >
                +{todayCount} today
              </span>
            )}
          </div>

          {/* The flame — massive */}
          <div
            className="flex items-end justify-center mb-2"
            style={{ width: size, height: size * 1.2 }}
          >
            {isCold ? (
              <div className="text-7xl opacity-40 leading-none animate-pulse">🕯️</div>
            ) : (
              <RealisticFlame tier={tier} accent={accent} size={size} />
            )}
          </div>

          {/* Big number */}
          <div className="flex items-baseline gap-2">
            <span
              className="font-display font-black text-6xl tabular-nums leading-none"
              style={{
                color: isCold ? "hsl(var(--muted-foreground))" : accent,
                textShadow: isCold ? undefined : `0 0 32px ${accent.replace(")", " / 0.6)")}`,
              }}
            >
              {total.toLocaleString()}
            </span>
            <span className="text-sm font-bold text-muted-foreground">days</span>
          </div>

          {/* Tier headline */}
          <p
            className={cn(
              "font-display font-black text-2xl mt-2 uppercase tracking-wider",
              isFirestorm && "bg-clip-text text-transparent",
            )}
            style={
              isFirestorm
                ? {
                    backgroundImage:
                      "linear-gradient(90deg, hsl(195 90% 65%), hsl(265 80% 65%), hsl(310 85% 65%), hsl(195 90% 65%))",
                    backgroundSize: "200% 100%",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    animation: "flame-plasma-hue 4s linear infinite, shimmer-slide 5s linear infinite",
                  }
                : isCold
                ? { color: "hsl(var(--muted-foreground))" }
                : { color: accent, textShadow: `0 0 18px ${accent.replace(")", " / 0.4)")}` }
            }
          >
            {tierName}
          </p>

          {/* Tribe name UNDER the flame */}
          {tribeName && (
            <h1 className="font-display font-black text-xl mt-3 leading-tight">
              {tribeName}
            </h1>
          )}

          {avg !== null && !isCold && (
            <p className="text-[11px] text-muted-foreground/85 mt-1 tabular-nums">
              avg <span className="font-black text-foreground/85">{avg}</span> · {memberCount} member{memberCount === 1 ? "" : "s"}
            </p>
          )}

          {isCold && (
            <p className="text-[11px] text-muted-foreground/80 mt-2 leading-snug max-w-[260px]">
              This fire is cold. Be the first to feed it — <span className="font-black text-foreground/85">30+ combined days</span> to ignite.
            </p>
          )}
        </div>
      ) : (
        <div className="relative flex items-center gap-5">
          {/* The flame itself */}
          <div
            className="shrink-0 flex items-end justify-center"
            style={{ width: size, height: size * 1.15 }}
          >
            {isCold ? (
              <div className="text-4xl opacity-40 leading-none">🕯️</div>
            ) : (
              <RealisticFlame tier={tier} accent={accent} size={size} />
            )}
          </div>

          {/* Stats */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/85">
                Tribe Fire
              </p>
              {!!todayCount && todayCount > 0 && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border"
                  style={{
                    color: accent,
                    borderColor: accent.replace(")", " / 0.5)"),
                    background: accent.replace(")", " / 0.10)"),
                  }}
                >
                  +{todayCount} today
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span
                className="font-display font-black text-4xl tabular-nums leading-none"
                style={{
                  color: isCold ? undefined : accent,
                  textShadow: isCold ? undefined : `0 0 22px ${accent.replace(")", " / 0.5)")}`,
                }}
              >
                {total.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-muted-foreground">days</span>
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded-md border text-[9px] font-black tracking-widest uppercase",
                  isCold && "border-border/60 text-muted-foreground",
                  !isCold && !isFirestorm && "border-[hsl(18_95%_58%)]/40 text-[hsl(18_95%_58%)] bg-[hsl(18_95%_58%)]/10",
                  isFirestorm && "border-transparent text-transparent bg-clip-text",
                )}
                style={isFirestorm ? {
                  backgroundImage: "linear-gradient(90deg, hsl(195 90% 65%), hsl(265 80% 65%), hsl(310 85% 65%), hsl(195 90% 65%))",
                  backgroundSize: "200% 100%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "flame-plasma-hue 4s linear infinite, shimmer-slide 5s linear infinite",
                  borderColor: "hsl(195 90% 65% / 0.5)",
                } : undefined}
              >
                {tierName}
              </span>
              {avg !== null && (
                <span className="text-[10px] text-muted-foreground/85 tabular-nums">
                  avg <span className="font-black text-foreground/85">{avg}</span> · {memberCount} member{memberCount === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {isCold && (
              <p className="text-[10px] text-muted-foreground/70 mt-1.5 leading-snug">
                This fire is cold — <span className="font-black text-foreground/80">30+ combined days</span> to ignite.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Segmented progress bar to next tier */}
      {!isCold && !atMax && (
        <div className="relative mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-widest font-black text-muted-foreground/80">
              Next: {collectiveTierName(next)}
            </span>
            <span className="text-[10px] font-bold tabular-nums text-foreground/70">
              {Math.max(0, next - total).toLocaleString()} to go
            </span>
          </div>
          <div className="relative h-2 rounded-full overflow-hidden bg-secondary/60 flex gap-[2px]">
            {Array.from({ length: 10 }).map((_, i) => {
              const segPct = (i + 1) * 10;
              const filled = pct >= segPct;
              const partial = !filled && pct > i * 10;
              return (
                <span
                  key={i}
                  className="flex-1 transition-all"
                  style={{
                    background: filled
                      ? accent
                      : partial
                      ? `linear-gradient(90deg, ${accent} ${(pct - i * 10) * 10}%, transparent ${(pct - i * 10) * 10}%)`
                      : "transparent",
                    boxShadow: filled ? `0 0 6px ${accent.replace(")", " / 0.7)")}` : undefined,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
      {!isCold && atMax && (
        <p className="mt-3 text-center text-[10px] uppercase tracking-widest font-black"
           style={{ color: accent, textShadow: `0 0 10px ${accent.replace(")", " / 0.5)")}` }}>
          Max tier reached — Legendary fire
        </p>
      )}
    </div>
  );
};

export default TribeCollectiveFlame;
