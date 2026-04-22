import { Sparkles } from "lucide-react";
import SegmentedTabs from "@/components/home/SegmentedTabs";
import RoadToElite from "@/components/RoadToElite";
import XpCounter from "@/components/XpCounter";

interface ProgressRailProps {
  level: number;
  xp: number;
  xpToNext: number;
  canCheckin: boolean;
  className?: string;
}

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

const ProgressRail = ({ level, xp, xpToNext, canCheckin, className }: ProgressRailProps) => {
  return (
    <SegmentedTabs
      title="Progress"
      titleAccent="hsl(var(--gold))"
      className={className}
      tabs={[
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
  );
};

export default ProgressRail;
