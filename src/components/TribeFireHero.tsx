import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserTotalTribeHeat, collectiveStreakTier, collectiveTierName, collectiveAccent } from "@/lib/tribe-streak";
// Lightweight tribe-specific flame — pure CSS keyframes, no RAF loop,
// no device listeners. Cuts ~95% of frame cost vs the original
// StylizedStreakFlame which made the whole app stutter on mobile.
import TribeFireLite from "@/components/TribeFireLite";
import { cn } from "@/lib/utils";
import { Flame, Sparkles, Users } from "lucide-react";

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

interface TribeFireHeroProps {
  /** Number of tribes the user belongs to (drives subtitle line). */
  tribeCount: number;
}

/**
 * The hero of the /tribes page. The user's combined fire across every tribe
 * they belong to — sized massive (220–260px flame). When the user has no
 * tribe, shows a cold candle with a "Find a fire to feed" prompt.
 */
const TribeFireHero = ({ tribeCount }: TribeFireHeroProps) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!profile?.user_id) {
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchUserTotalTribeHeat(profile.user_id)
      .then((t) => {
        if (alive) setTotal(t);
      })
      .catch(() => {
        if (alive) setTotal(0);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [profile?.user_id, tribeCount]);

  const tier = collectiveStreakTier(total);
  const isCold = tier < 0 || tribeCount === 0;
  const accent = collectiveAccent(total);
  const tierName = collectiveTierName(total);
  const { pct, next, atMax } = nextTierProgress(total);

  // Hero flame — scales with viewport but capped
  const size = isCold ? 120 : tier >= 6 ? 240 : tier >= 5 ? 220 : tier >= 4 ? 200 : tier >= 3 ? 180 : tier >= 2 ? 160 : tier >= 1 ? 140 : 130;

  return (
    <div
      className={cn(
        "relative rounded-3xl mb-5 overflow-hidden border",
        isCold
          ? "border-border/50 bg-card/40"
          : "border-[hsl(18_95%_58%)]/40 surface-ember shadow-[0_0_50px_hsl(18_95%_58%/0.25)]",
      )}
      style={!isCold ? ({ ["--ember-accent" as string]: accent } as React.CSSProperties) : undefined}
    >
      {/* Aurora rim */}
      {!isCold && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{
            background: `linear-gradient(135deg, ${accent.replace(")", " / 0.0)")} 0%, ${accent.replace(")", " / 0.4)")} 50%, ${accent.replace(")", " / 0.0)")} 100%)`,
            padding: 1,
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor" as any,
            maskComposite: "exclude",
            animation: "flame-rim-pulse 4.5s ease-in-out infinite",
            opacity: 0.9,
          }}
        />
      )}

      {/* Radial bloom */}
      {!isCold && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 95%, ${accent.replace(")", " / 0.35)")} 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, ${accent.replace(")", " / 0.10)")} 0%, transparent 75%)`,
          }}
        />
      )}

      <div className="relative px-5 pt-6 pb-5 flex flex-col items-center text-center">
        {/* Top label — solid background so the flame can't swallow it.
            Higher z-index keeps it above the flame's bloom. */}
        <div
          className="relative z-20 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border mb-2 shadow-[0_4px_18px_rgba(0,0,0,0.45)]"
          style={{
            background: "hsl(0 0% 6% / 0.92)",
            borderColor: !isCold ? accent.replace(")", " / 0.7)") : "hsl(var(--border))",
          }}
        >
          <Sparkles size={11} className="text-[hsl(18_95%_58%)]" />
          <span
            className="text-[10px] font-black tracking-widest uppercase"
            style={!isCold ? { color: accent } : { color: "hsl(var(--muted-foreground))" }}
          >
            Tribe Collective Fire
          </span>
        </div>

        {/* Sub-explainer — ONE LINE, makes ownership unmistakable */}
        <p
          className="relative z-20 text-[11px] font-bold tracking-wide text-foreground/80 mb-3 px-3 py-0.5 rounded-full"
          style={{ background: "hsl(0 0% 4% / 0.65)" }}
        >
          <Users size={11} className="inline -mt-0.5 mr-1 opacity-80" />
          The combined fire of <span className="text-foreground font-black">{tribeCount}</span>{" "}
          {tribeCount === 1 ? "tribe" : "tribes"} you belong to
        </p>

        {/* The flame itself — the centerpiece */}
        <div
          className="relative z-10 flex items-end justify-center mb-3"
          style={{ width: size, height: size * 1.2 }}
        >
          {isCold ? (
            <div className="text-7xl opacity-40 leading-none animate-pulse">🕯️</div>
          ) : (
            <TribeFireLite tier={tier} accent={accent} size={size} />
          )}
        </div>

        {/* The big number */}
        <div className="flex items-baseline gap-2">
          <span
            className="font-display font-black text-6xl tabular-nums leading-none"
            style={
              isCold
                ? { color: "hsl(var(--muted-foreground))" }
                : {
                    color: accent,
                    textShadow: `0 0 32px ${accent.replace(")", " / 0.6)")}`,
                  }
            }
          >
            {loading ? "—" : total.toLocaleString()}
          </span>
          <span className="text-sm font-bold text-muted-foreground">days</span>
        </div>

        {/* Tier name — dominant headline */}
        <p
          className="font-display font-black text-2xl mt-2 uppercase tracking-wider"
          style={
            isCold
              ? { color: "hsl(var(--muted-foreground))" }
              : { color: accent, textShadow: `0 0 18px ${accent.replace(")", " / 0.4)")}` }
          }
        >
          {isCold ? "Cold" : tierName}
        </p>

        {/* Subtitle */}
        {isCold ? (
          <button
            onClick={() => {
              const browse = document.getElementById("tribes-browse-anchor");
              browse?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[hsl(18_95%_58%)]/40 bg-[hsl(18_95%_58%)]/5 text-[11px] font-black tracking-wide text-[hsl(18_95%_58%)] hover:bg-[hsl(18_95%_58%)]/10 transition-colors"
          >
            <Flame size={12} /> Find a fire to feed
          </button>
        ) : null}

        {/* Progress to next tier */}
        {!isCold && !atMax && (
          <div className="w-full mt-5">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/80">
                Next: {collectiveTierName(next)}
              </span>
              <span className="text-[11px] font-bold tabular-nums text-foreground/75">
                {Math.max(0, next - total).toLocaleString()} to go
              </span>
            </div>
            <div className="relative h-2.5 rounded-full overflow-hidden bg-secondary/60 flex gap-[2px]">
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
                      boxShadow: filled ? `0 0 8px ${accent.replace(")", " / 0.7)")}` : undefined,
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Tagline */}
        <p className="mt-4 text-[11px] uppercase tracking-[0.2em] font-black text-muted-foreground/70">
          Every check-in feeds the fire
        </p>
      </div>
    </div>
  );
};

export default TribeFireHero;
