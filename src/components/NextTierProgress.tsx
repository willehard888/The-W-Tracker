import { Crown, TrendingUp, CalendarCheck, Flame, Check } from "lucide-react";
import { m } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useNextTierProgress } from "@/hooks/use-next-tier-progress";
import { tierBandLabel, tierRequirementSentence } from "@/lib/status-tiers";

interface RequirementRowProps {
  icon: React.ElementType;
  label: string;
  current: number;
  target: number;
  unit: string;
  progress: number;
}

const RequirementRow = ({
  icon: Icon,
  label,
  current,
  target,
  unit,
  progress,
}: RequirementRowProps) => {
  const met = progress >= 1;
  const pct = Math.round(progress * 100);
  const display = Math.min(current, target);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border transition-colors",
            met
              ? "bg-xp-green/15 border-xp-green/40 text-xp-green"
              : "bg-secondary/40 border-border text-muted-foreground",
          )}
        >
          {met ? <Check aria-hidden size={14} /> : <Icon size={14} />}
        </div>
        <span
          className={cn(
            "text-xs font-semibold tracking-tight",
            met ? "text-xp-green" : "text-foreground/85",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "ml-auto text-meta tabular-nums font-bold",
            met ? "text-xp-green" : "text-muted-foreground",
          )}
        >
          {display}
          <span className="text-muted-foreground/75"> / {target} {unit}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
        <m.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(2, pct)}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className={cn(
            "h-full rounded-full",
            met ? "bg-xp-green/70" : "bg-gold/60",
          )}
        />
      </div>
    </div>
  );
};

/**
 * Live progress towards the next earned status tier (the in-app status, not
 * the subscription). Every number and every sentence here is derived from the
 * rung's own requirements in status-tiers — the card used to carry its own
 * copy of them and promised Elite at a 21-day streak while the ladder beside
 * it, and the server, both said 30.
 */
/**
 * `ladder` renders as the card's last row (the door into the tier sheet), so
 * the next tier is one card on Profile instead of three. `fallback` is what
 * to show when there is no road to draw (no data, top of the ladder).
 */
const NextTierProgress = ({ className, ladder, fallback }: { className?: string; ladder?: ReactNode; fallback?: ReactNode }) => {
  const r = useNextTierProgress();

  if (r.loading || !r.hasData || !r.next) return fallback ?? null;

  const req = r.next.requirements;

  return (
    <div
      className={cn("surface-card surface-card-quiet relative overflow-hidden", className)}
    >
      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center">
              <Crown aria-hidden size={16} className="text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-display font-black text-base tracking-tight leading-none">
                Road to {r.next.label}
              </h3>
              <p className="text-label text-muted-foreground mt-1">
                {r.pathCount === 2 ? "Either path earns it" : "Every line has to land"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display font-black text-2xl leading-none tabular-nums">
              {r.overallPercent}
              <span className="text-sm text-muted-foreground">%</span>
            </p>
            <p className="text-micro font-bold text-muted-foreground mt-1">
              {r.metCount}/{r.pathCount} {r.pathCount === 1 ? "path" : "paths"} met
            </p>
          </div>
        </div>

        {/* Requirements — only the ones this rung actually asks for. */}
        <div className="space-y-3">
          <RequirementRow
            icon={TrendingUp}
            label={`${tierBandLabel(r.next.key)} rank`}
            current={Math.round(r.percentile)}
            target={req.percentile}
            unit="%ile"
            progress={r.percentileProgress}
          />
          {req.activeDays > 0 && (
            <RequirementRow
              icon={CalendarCheck}
              label={`Active ${req.activeDays} of last 30 days`}
              current={r.activityDays}
              target={req.activeDays}
              unit="days"
              progress={r.activityProgress}
            />
          )}
          {req.streak > 0 && (
            <RequirementRow
              icon={Flame}
              label={`${req.streak}-day streak`}
              current={r.streak}
              target={req.streak}
              unit="days"
              progress={r.streakProgress}
            />
          )}
        </div>

        {/* Footer — the rule in the ladder's own words. */}
        <div className="mt-4 pt-3 border-t border-border/35">
          <p className="text-meta text-center text-muted-foreground italic font-medium">
            {tierRequirementSentence(r.next.key)}.
          </p>
        </div>
      </div>
      {ladder && <div className="border-t border-border/35">{ladder}</div>}
    </div>
  );
};

export default NextTierProgress;
