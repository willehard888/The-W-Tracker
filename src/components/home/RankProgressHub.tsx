import { useEffect, useState } from "react";
import { Crown, TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import SegmentedTabs from "@/components/home/SegmentedTabs";
import RankPressureCard from "@/components/RankPressureCard";
import LiveRivals from "@/components/LiveRivals";
import RoadToElite from "@/components/RoadToElite";
import XpCounter from "@/components/XpCounter";
import TierUsername from "@/components/TierUsername";
import ApexBadge from "@/components/ApexBadge";
import { getTierConfig } from "@/lib/status-tiers";
import { cn } from "@/lib/utils";

interface RankProgressHubProps {
  username: string;
  tier: string;
  userId: string;
  rank: number | null;
  totalUsers: number;
  percentile: number;
  hasRank: boolean;
  rankScore?: number;
  daysAtTier?: number;
  rankDelta?: number;
  level: number;
  xp: number;
  xpToNext: number;
  canCheckin: boolean;
  className?: string;
}

const greetingFor = (h: number) => {
  if (h < 5) return "Late grind";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Late night";
};

const LevelPanel = ({ level, xp, xpToNext }: { level: number; xp: number; xpToNext: number }) => {
  const xpPercent = Math.min(100, Math.round((xp / xpToNext) * 100));
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg gradient-gold flex items-center justify-center float-subtle">
            <span className="font-black text-primary-foreground text-base">{level}</span>
          </div>
          <div>
            <p className="font-display font-black tracking-tight text-base leading-tight">
              Level {level}
            </p>
            <p className="text-muted-foreground uppercase tracking-widest text-[10px]">
              Rank Progress
            </p>
          </div>
        </div>
        <div className="text-right">
          <XpCounter
            value={xp}
            className="font-display font-black text-gold text-base tabular-nums glow-gold-text"
          />
          <p className="text-muted-foreground text-[10px]">/ {xpToNext.toLocaleString()} XP</p>
        </div>
      </div>

      <div className="h-3 rounded-full bg-secondary/80 overflow-hidden border border-border/50 surface-inset">
        <div
          className="h-full rounded-full gradient-gold transition-all duration-1000 ease-out relative"
          style={{ width: `${Math.max(4, xpPercent)}%` }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div
              className="absolute inset-0 -translate-x-full animate-[shine_3s_ease-in-out_infinite]"
              style={{
                background:
                  "linear-gradient(90deg, transparent, hsl(42 85% 70% / 0.5), transparent)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <p className="text-muted-foreground text-xs">
          <span className="text-gold font-bold">
            {Math.max(0, xpToNext - xp).toLocaleString()}
          </span>{" "}
          XP to next level
        </p>
        <p className="font-bold text-gold/60 tabular-nums text-xs">{xpPercent}%</p>
      </div>
    </div>
  );
};

const QuestsPanel = ({ canCheckin }: { canCheckin: boolean }) => (
  <div className="relative rounded-xl border border-purple-500/25 p-4 text-center pulse-dot overflow-hidden">
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: "linear-gradient(135deg, hsl(270 60% 58% / 0.08), transparent 60%)",
      }}
    />
    <div className="relative">
      <div className="flex items-center justify-center gap-2 mb-1">
        <Sparkles size={16} className="text-[hsl(var(--purple))] float-subtle" />
        <p className="text-base font-bold text-purple-300">
          {canCheckin ? "Daily Quests Available" : "Quests reset at next check-in"}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {canCheckin
          ? "Complete bonus objectives for extra XP"
          : "Lock today first — bonuses unlock alongside check-in."}
      </p>
    </div>
  </div>
);

const RankProgressHub = ({
  username,
  tier,
  userId,
  rank,
  totalUsers,
  percentile,
  hasRank,
  rankScore,
  daysAtTier,
  rankDelta = 0,
  level,
  xp,
  xpToNext,
  canCheckin,
  className,
}: RankProgressHubProps) => {
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
    <div className={cn("relative", className)}>
      {/* Identity strip — glass surface with subtle corner tint */}
      <div className="relative mb-3 rounded-2xl surface-glass overflow-hidden">
        {/* Soft tier-tinted corner glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isLegend
              ? "radial-gradient(ellipse 60% 50% at 100% 0%, hsl(280 70% 60% / 0.12) 0%, transparent 65%)"
              : isApex
              ? "radial-gradient(ellipse 60% 50% at 100% 0%, hsl(18 95% 58% / 0.12) 0%, transparent 65%)"
              : `radial-gradient(ellipse 60% 50% at 100% 0%, ${accent.replace(")", " / 0.10)")} 0%, transparent 65%)`,
          }}
        />

        <div className="relative z-10 flex items-start justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/80 mb-1">
              {greeting}
            </p>
            <h1 className="font-display font-black text-[22px] leading-tight tracking-tight truncate">
              <TierUsername username={username} tier={tier} showAt className="font-display font-black" />
            </h1>

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

          {/* Tier crest — enameled metal */}
          <div className="shrink-0 relative">
            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center relative overflow-hidden"
              style={{
                background: isLegend
                  ? "linear-gradient(135deg, hsl(280 70% 50%), hsl(42 78% 54%), hsl(350 80% 55%))"
                  : isApex
                  ? "linear-gradient(135deg, hsl(18 95% 58%), hsl(42 90% 65%))"
                  : "linear-gradient(135deg, hsl(42 60% 40%), hsl(42 90% 65%))",
                boxShadow:
                  "inset 0 1px 0 hsl(0 0% 100% / 0.45), inset 0 -1px 0 hsl(0 0% 0% / 0.35), 0 2px 6px hsl(0 0% 0% / 0.35)",
              }}
            >
              <Crown size={22} strokeWidth={2.4} className="text-primary-foreground" />
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
      </div>

      {/* Tabbed hub: Pressure / Rivals / Level / Elite / Quests */}
      <SegmentedTabs
        title="Rank & Progress"
        titleAccent={accent}
        tabs={[
          {
            id: "pressure",
            label: "Pressure",
            content: (
              <RankPressureCard
                tier={tier}
                rank={rank}
                totalUsers={totalUsers}
                percentile={percentile}
                hasRank={hasRank}
                rankScore={rankScore}
                daysAtTier={daysAtTier}
              />
            ),
          },
          {
            id: "rivals",
            label: "Rivals",
            content: <LiveRivals userId={userId} myScore={rankScore ?? 0} />,
          },
          {
            id: "level",
            label: "Level",
            content: <LevelPanel level={level} xp={xp} xpToNext={xpToNext} />,
          },
          {
            id: "elite",
            label: "Elite",
            content: <RoadToElite compact />,
          },
          {
            id: "quests",
            label: "Quests",
            content: <QuestsPanel canCheckin={canCheckin} />,
          },
        ]}
      />
    </div>
  );
};

export default RankProgressHub;
