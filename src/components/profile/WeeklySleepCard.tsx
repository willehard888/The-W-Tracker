import { Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WeeklySleepData {
  avg: number;
  days: number;
  multiplier: number;
  isChronicOversleep: boolean;
  oversleepCount: number;
}

// Desaturated semantic accents (real & restrained — no neon traffic-light borders).
const accent = (m: number) =>
  m >= 1
    ? "text-[hsl(152_45%_55%)]"
    : m >= 0.85
      ? "text-[hsl(42_75%_60%)]"
      : "text-[hsl(0_60%_62%)]";

/**
 * Weekly sleep recovery summary + XP multiplier. Extracted from Profile.tsx.
 * The old card used heavy colored 2px borders + colored shadows + ✓/⚠️ emoji;
 * calmed to a neutral card with a single desaturated accent on the icon/number.
 */
const WeeklySleepCard = ({ data }: { data: WeeklySleepData }) => (
  <div className="rounded-2xl border border-border/60 bg-card p-5">
    <div className="flex items-center gap-2 mb-3">
      <Moon size={20} className={accent(data.multiplier)} />
      <h2 className="font-display font-black text-lg tracking-tight">Weekly Sleep</h2>
      <span className="ml-auto text-base font-bold tabular-nums">
        {data.avg}h avg ({data.days} days)
      </span>
    </div>
    <div className="flex items-center justify-between text-base">
      <span className="text-muted-foreground font-semibold">XP Multiplier</span>
      <span className={cn("font-display font-black text-2xl", accent(data.multiplier))}>
        {data.multiplier >= 1 ? "100%" : `${Math.round(data.multiplier * 100)}%`}
      </span>
    </div>
  </div>
);

export default WeeklySleepCard;
