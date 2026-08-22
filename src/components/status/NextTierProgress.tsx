import { Check, Target, CalendarCheck, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RequirementProgress, NextTierProgressData } from "@/hooks/use-next-tier-progress";

const ICON = { percentile: Target, activeDays: CalendarCheck, streak: Flame } as const;

const Row = ({ r }: { r: RequirementProgress }) => {
  const Icon = ICON[r.key];
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className={cn(
          "h-6 w-6 rounded-md flex items-center justify-center shrink-0 border",
          r.met ? "bg-gold/15 border-gold/40 text-gold" : "bg-secondary/40 border-border text-muted-foreground",
        )}>
          {r.met ? <Check size={12} /> : <Icon size={12} />}
        </span>
        <span className={cn("text-xs font-semibold", r.met ? "text-gold" : "text-foreground/85")}>{r.label}</span>
        <span className={cn("ml-auto text-[11px] tabular-nums font-bold", r.met ? "text-gold" : "text-muted-foreground")}>
          {Math.min(r.current, r.target)}<span className="text-muted-foreground/70"> / {r.target}</span>
        </span>
      </div>
      <div className="h-1 rounded-full bg-secondary/70 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", r.met ? "bg-gold" : "bg-gold/50")} style={{ width: `${Math.round(r.progress * 100)}%` }} />
      </div>
    </div>
  );
};

/**
 * "What it takes to reach the next tier" — thresholds from TIER_CONFIG.
 * Two groups when the tier is earned by EITHER rank OR the grind path.
 */
const NextTierProgress = ({ data, className }: { data: NextTierProgressData; className?: string }) => {
  if (!data.next) {
    return <p className={cn("text-xs text-muted-foreground", className)}>Top of the ladder — Legend is held, not owned.</p>;
  }
  return (
    <div className={cn("space-y-3", className)}>
      <p className="eyebrow">Next: {data.next.label}</p>
      <div className="space-y-2">
        {data.rankPath.map((r) => <Row key={r.key} r={r} />)}
      </div>
      {data.either && data.grindPath.length > 0 && (
        <>
          <p className="eyebrow/60 text-center">— or —</p>
          <div className="space-y-2">
            {data.grindPath.map((r) => <Row key={r.key} r={r} />)}
          </div>
        </>
      )}
      {!data.either && data.grindPath.length > 0 && (
        <div className="space-y-2">
          {data.grindPath.map((r) => <Row key={r.key} r={r} />)}
        </div>
      )}
    </div>
  );
};

export default NextTierProgress;
