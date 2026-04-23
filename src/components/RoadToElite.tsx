import { Crown, TrendingUp, CalendarCheck, Flame, Check, Zap, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useRoadToElite, ELITE_REQUIREMENTS } from "@/hooks/use-road-to-elite";

interface RoadToEliteProps {
  /** Compact variant — shows a single overall progress bar instead of three */
  compact?: boolean;
  className?: string;
}

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
          {met ? <Check size={14} /> : <Icon size={14} />}
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
            "ml-auto text-[11px] tabular-nums font-bold",
            met ? "text-gold" : "text-muted-foreground",
          )}
        >
          {display}
          <span className="text-muted-foreground/70"> / {target} {unit}</span>
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
 * "Road to Elite" — a live progress card that shows the 3 requirements
 * needed to *earn* the Elite status tier (the in-app status, not subscription).
 */
const RoadToElite = ({ compact = false, className }: RoadToEliteProps) => {
  const r = useRoadToElite();
  const navigate = useNavigate();

  if (r.loading || !r.hasData) return null;
  if (r.isElite) return null; // already Elite — no need to show

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-xl border border-gold/25 bg-gold/5 p-3 flex items-center gap-3",
          className,
        )}
      >
        <div className="h-8 w-8 rounded-lg gradient-gold flex items-center justify-center shrink-0">
          <Crown size={14} className="text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-black text-gold tracking-widest uppercase">
              Road to Elite
            </p>
            <span className="text-[11px] font-bold text-gold tabular-nums">
              {r.overallPercent}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(2, r.overallPercent)}%` }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="h-full rounded-full gradient-gold"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {r.metCount}/3 requirements met • Earn Elite, don't buy it
          </p>
        </div>
      </div>
    );
  }

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
            "radial-gradient(circle, hsl(42 78% 54% / 0.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg gradient-gold flex items-center justify-center glow-gold">
              <Crown size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display font-black text-base tracking-tight leading-none">
                Road to Elite
              </h3>
                <p className="text-[10px] text-muted-foreground mt-1 tracking-wider uppercase font-semibold">
                  Top 20% or 20 days + 21 streak
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display font-black text-2xl text-gold leading-none tabular-nums">
              {r.overallPercent}
              <span className="text-sm text-muted-foreground">%</span>
            </p>
            <p className="text-[9px] text-muted-foreground mt-1 tracking-wider uppercase">
              {r.metCount}/2 paths met
            </p>
          </div>
        </div>

        {/* Requirements */}
        <div className="space-y-3">
          <RequirementRow
            icon={TrendingUp}
            label="Top 20% rank"
            current={Math.round(r.percentile)}
            target={ELITE_REQUIREMENTS.PERCENTILE}
            unit="%ile"
            progress={r.percentileProgress}
          />
          <RequirementRow
            icon={CalendarCheck}
            label="Active 20 of last 30 days"
            current={r.activityDays}
            target={ELITE_REQUIREMENTS.ACTIVITY_DAYS}
            unit="days"
            progress={r.activityProgress}
          />
          <RequirementRow
            icon={Flame}
            label="21-day streak"
            current={r.streak}
            target={ELITE_REQUIREMENTS.STREAK}
            unit="days"
            progress={r.streakProgress}
          />
        </div>

        {/* Footer message */}
        <div className="mt-4 pt-3 border-t border-gold/15">
          <p className="text-[11px] text-center text-muted-foreground italic font-medium">
            Reach <span className="text-gold/90 font-semibold">top 20%</span> or prove consistency with <span className="text-gold/90 font-semibold">20 active days + 21 streak</span>.
          </p>
        </div>

        {/* Apex Instant shortcut — uses unified ember CTA for fire-theme cohesion */}
        <button
          onClick={() => navigate("/paywall")}
          className="mt-3 w-full group relative overflow-hidden rounded-xl p-[1.5px] active:scale-[0.985] transition-transform [animation:ember-halo-pulse_3.6s_ease-in-out_infinite]"
          style={{
            background: "linear-gradient(180deg, hsl(48 100%75% / 0.85) 0%, hsl(26 100% 58%) 35%, hsl(14 92% 44%) 80%, hsl(10 85% 30%) 100%)",
          }}
        >
          <div className="rounded-[10px] bg-background/0 backdrop-blur-0 p-3 flex items-center gap-3 relative isolate overflow-hidden"
            style={{
              background: "linear-gradient(180deg, hsl(28 92% 8% / 0.55) 0%, hsl(14 70% 10% / 0.65) 100%)",
            }}
          >
            {/* Heat bloom from below */}
            <div aria-hidden className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(140% 90% at 50% 130%, hsl(20 100% 62% / 0.45) 0%, transparent 65%)" }}
            />
            <div className="relative h-9 w-9 rounded-lg bg-gradient-to-br from-[hsl(48_100%_75%)] via-[hsl(26_100%_58%)] to-[hsl(14_92%_44%)] flex items-center justify-center shrink-0 shadow-[0_0_14px_hsl(18_95%_58%/0.7),inset_0_1px_0_hsl(48_100%_94%/0.6),inset_0_-1px_0_hsl(10_82%_18%/0.8)]">
              <Zap size={16} className="text-[hsl(28_92%_8%)]" strokeWidth={2.8} />
            </div>
            <div className="flex-1 min-w-0 text-left relative">
              <p className="text-xs font-black uppercase tracking-wider bg-gradient-to-r from-[hsl(48_100%_88%)] via-[hsl(26_100%_70%)] to-[hsl(48_100%_88%)] bg-clip-text text-transparent leading-tight">
                Skip the grind — go Apex now
              </p>
              <p className="text-[10px] text-[hsl(48_60%_75%)]/85 mt-0.5">
                Apex Instant • €17.99/mo
              </p>
            </div>
            <ChevronRight size={16} className="text-[hsl(48_100%_82%)] shrink-0 group-active:translate-x-0.5 transition-transform relative" />
          </div>
        </button>
      </div>
    </div>
  );
};

export default RoadToElite;
