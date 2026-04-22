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
  className?: string;
}

/**
 * Hero-sized cinematic flame for a tribe's collective streak.
 *
 * Size scales aggressively with the collective total so a 3000+ tribe
 * gets a genuinely huge, dominant flame, while a quiet tribe stays
 * a small ember. Tier palette + animation cadence handled by
 * RealisticFlame.
 */
const TribeCollectiveFlame = ({
  total,
  memberCount,
  className,
}: TribeCollectiveFlameProps) => {
  const tier = collectiveStreakTier(total);
  const isCold = tier < 0;

  // Aggressive size scaling: 56px (warm-up) → 120px (legendary tribe)
  const size =
    tier === 5 ? 120 :
    tier === 4 ? 104 :
    tier === 3 ? 92  :
    tier === 2 ? 80  :
    tier === 1 ? 70  :
    tier === 0 ? 60  : 56;

  const accent = collectiveAccent(total);
  const tierName = collectiveTierName(total);
  const avg = memberCount && memberCount > 0
    ? Math.round((total / memberCount) * 10) / 10
    : null;

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden p-4 border",
        isCold
          ? "border-border/60 bg-card/50"
          : "border-[hsl(18_95%_58%)]/35 bg-gradient-to-br from-[hsl(18_95%_58%)]/[0.10] via-card/70 to-gold/[0.06] shadow-[0_0_28px_hsl(18_95%_58%/0.18)]",
        className,
      )}
    >
      {/* Embers / radial glow */}
      {!isCold && (
        <div
          className="absolute inset-0 pointer-events-none opacity-70"
          style={{
            background: `radial-gradient(ellipse at 50% 90%, ${accent.replace(")", " / 0.22)")} 0%, transparent 65%)`,
          }}
          aria-hidden
        />
      )}

      <div className="relative flex items-center gap-4">
        {/* The flame itself */}
        <div
          className="shrink-0 flex items-end justify-center"
          style={{ width: size, height: size * 1.15 }}
        >
          {isCold ? (
            <div className="text-3xl opacity-40 leading-none">🕯️</div>
          ) : (
            <RealisticFlame tier={tier} accent={accent} size={size} />
          )}
        </div>

        {/* Stats */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] font-black text-muted-foreground/80">
            Tribe Streak
          </p>
          <div className="flex items-baseline gap-1.5">
            <span
              className="font-display font-black text-3xl tabular-nums leading-none"
              style={{
                color: isCold ? undefined : accent,
                textShadow: isCold ? undefined : `0 0 18px ${accent.replace(")", " / 0.45)")}`,
              }}
            >
              {total.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-muted-foreground">days</span>
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded-md border text-[9px] font-black tracking-widest uppercase",
                isCold
                  ? "border-border/60 text-muted-foreground"
                  : "border-[hsl(18_95%_58%)]/35 text-[hsl(18_95%_58%)] bg-[hsl(18_95%_58%)]/8",
              )}
            >
              {tierName}
            </span>
            {avg !== null && (
              <span className="text-[10px] text-muted-foreground/80 tabular-nums">
                avg <span className="font-black text-foreground/80">{avg}</span> · {memberCount} member{memberCount === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {isCold && (
            <p className="text-[10px] text-muted-foreground/70 mt-1.5 leading-snug">
              The tribe needs <span className="font-black text-foreground/80">30+ combined days</span> to ignite.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TribeCollectiveFlame;
