import { Crown, TrendingUp, CalendarCheck, Flame, Check } from "lucide-react";
import { motion } from "framer-motion";
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
              ? "bg-gold/15 border-gold/40 text-gold"
              : "bg-secondary/40 border-border text-muted-foreground",
          )}
        >
          {met ? <Check aria-hidden size={14} /> : <Icon size={14} />}
        </div>
        <span
          className={cn(
            "text-xs font-semibold tracking-tight",
            met ? "text-gold" : "text-foreground/85",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "ml-auto text-[12px] tabular-nums font-bold",
            met ? "text-gold" : "text-muted-foreground",
          )}
        >
          {display}
          <span className="text-muted-foreground/75"> / {target} {unit}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(2, pct)}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className={cn(
            "h-full rounded-full",
            met ? "gradient-gold" : "bg-gold/40",
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
const NextTierProgress = ({ className }: { className?: string }) => {
  const r = useNextTierProgress();

  if (r.loading || !r.hasData || !r.next) return null;

  const req = r.next.requirements;

  return (
    <div
      className={cn(
        "rounded-2xl glass-card-gold p-5 gradient-border-animated relative overflow-hidden",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-50"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--gold) / 0.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg gradient-gold flex items-center justify-center glow-gold">
              <Crown aria-hidden size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display font-black text-base tracking-tight leading-none">
                Road to {r.next.label}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                {r.pathCount === 2 ? "Either path earns it" : "Every line has to land"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display font-black text-2xl text-gold leading-none tabular-nums">
              {r.overallPercent}
              <span className="text-sm text-muted-foreground">%</span>
            </p>
            <p className="text-[10px] font-bold text-muted-foreground mt-1">
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
        <div className="mt-4 pt-3 border-t border-gold/15">
          <p className="text-[12px] text-center text-muted-foreground italic font-medium">
            {tierRequirementSentence(r.next.key)}.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NextTierProgress;
