import { useEffect, useState } from "react";
import { Crown, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import TierUsername from "@/components/TierUsername";
import ApexBadge from "@/components/ApexBadge";
import { getTierConfig } from "@/lib/status-tiers";

interface HeroHeaderProps {
  username: string;
  tier: string;
  rank?: number | null;
  totalUsers?: number;
  percentile?: number;
  hasRank?: boolean;
  rankDelta?: number;
  className?: string;
}

const greetingFor = (h: number) => {
  if (h < 5) return "Late grind";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Late night";
};

const HeroHeader = ({
  username,
  tier,
  rank,
  totalUsers,
  percentile,
  hasRank = true,
  rankDelta = 0,
  className,
}: HeroHeaderProps) => {
  const config = getTierConfig(tier);
  const isLegend = tier === "legend";
  const isApex = tier === "apex";
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const greeting = greetingFor(now.getHours());
  const DeltaIcon = rankDelta > 0 ? TrendingUp : rankDelta < 0 ? TrendingDown : Minus;
  const deltaTone =
    rankDelta > 0
      ? "text-emerald-400"
      : rankDelta < 0
      ? "text-destructive"
      : "text-muted-foreground";

  const accent = isLegend
    ? "hsl(280 70% 60%)"
    : isApex
    ? "hsl(18 95% 58%)"
    : "hsl(var(--gold))";

  const pctLabel =
    hasRank && typeof percentile === "number"
      ? percentile >= 99
        ? `Top ${(100 - percentile).toFixed(1)}%`
        : `Top ${Math.max(1, Math.round(100 - percentile))}%`
      : null;

  return (
    <header className={cn("relative", className)}>
      {/* Drifting tier-themed aura */}
      <div
        className="absolute -top-6 left-1/2 -translate-x-1/2 w-[640px] h-[260px] pointer-events-none -z-0"
        style={{
          background: isLegend
            ? "radial-gradient(ellipse at center, hsl(280 70% 60% / 0.22) 0%, hsl(42 78% 54% / 0.1) 45%, transparent 75%)"
            : isApex
            ? "radial-gradient(ellipse at center, hsl(18 95% 58% / 0.2) 0%, hsl(42 78% 54% / 0.08) 45%, transparent 75%)"
            : `radial-gradient(ellipse at center, ${accent.replace(")", " / 0.18)")} 0%, transparent 70%)`,
          animation: "hero-aura-drift 9s ease-in-out infinite",
        }}
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/80 mb-1">
            {greeting}
          </p>
          <h1 className="font-display font-black text-[26px] leading-tight tracking-tight truncate">
            <TierUsername
              username={username}
              tier={tier}
              showAt
              className="font-display font-black"
            />
          </h1>

          {/* Live rank pulse line */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {hasRank && rank ? (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-black tabular-nums px-2 py-0.5 rounded-md border"
                style={{
                  color: accent,
                  borderColor: `${accent.replace(")", " / 0.45)")}`,
                  background: `${accent.replace(")", " / 0.1)")}`,
                }}
              >
                #{rank.toLocaleString()}
                {totalUsers ? (
                  <span className="text-muted-foreground/70 font-bold">
                    /{totalUsers.toLocaleString()}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Unranked
              </span>
            )}
            {pctLabel && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                · {pctLabel}
              </span>
            )}
            {hasRank && (
              <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-black", deltaTone)}>
                <DeltaIcon size={11} strokeWidth={2.75} />
                {rankDelta === 0 ? "hold" : `${rankDelta > 0 ? "+" : ""}${rankDelta}`}
              </span>
            )}
          </div>
        </div>

        {/* Tier crest */}
        <div className="shrink-0 relative">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center relative overflow-hidden float-subtle"
            style={{
              background: isLegend
                ? "linear-gradient(135deg, hsl(280 70% 50%), hsl(42 78% 54%), hsl(350 80% 55%))"
                : isApex
                ? "linear-gradient(135deg, hsl(18 95% 58%), hsl(42 90% 65%))"
                : "linear-gradient(135deg, hsl(42 60% 40%), hsl(42 90% 65%))",
              boxShadow: `0 0 28px ${accent.replace(")", " / 0.5)")}, inset 0 1px 0 hsl(0 0% 100% / 0.2)`,
            }}
          >
            <Crown size={26} strokeWidth={2.4} className="text-primary-foreground drop-shadow" />
          </div>
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
            {(isLegend || isApex) ? (
              <ApexBadge tier={isLegend ? "legend" : "apex"} size="xs" />
            ) : (
              <span
                className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border bg-card/80"
                style={{ color: accent, borderColor: `${accent.replace(")", " / 0.4)")}` }}
              >
                {config.shortLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default HeroHeader;
