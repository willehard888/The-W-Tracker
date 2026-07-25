import { useNavigate } from "react-router-dom";
import { TrendingUp, Trophy, Dumbbell, ChevronRight } from "lucide-react";
import { useProgressionSummary } from "@/hooks/use-progression-summary";

/**
 * Strength-progress card — makes the logged-set data feel concrete ("3 PRs this
 * week · Bench +5kg") without opening the coach chat. Empty-state nudges logging.
 */
const ProgressionSummaryCard = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useProgressionSummary();

  if (isLoading) {
    return <div className="h-24 rounded-2xl bg-card/40 border border-border/50 animate-pulse" />;
  }

  const empty = !data || data.setsThisWeek === 0;

  return (
    <button
      type="button"
      onClick={() => navigate("/coach/program")}
      className="w-full text-left rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/[0.07] via-card/95 to-card p-4 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp size={13} className="text-gold" />
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85">Strength progress</p>
        <span className="ml-auto text-[10px] font-bold text-muted-foreground">This week</span>
      </div>

      {empty ? (
        <p className="text-[12px] text-muted-foreground leading-snug">
          Log your lifts (weight × reps) in your program to track PRs and progression here.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-2">
            <Stat icon={<Dumbbell size={13} className="text-foreground/70" />} value={data!.liftsThisWeek} label={data!.liftsThisWeek === 1 ? "lift" : "lifts"} />
            <Stat icon={<TrendingUp size={13} className="text-foreground/70" />} value={data!.setsThisWeek} label="sets" />
            <Stat icon={<Trophy size={13} className="text-gold" />} value={data!.prCount} label={data!.prCount === 1 ? "PR" : "PRs"} highlight={data!.prCount > 0} />
          </div>

          {data!.movers.length > 0 ? (
            <div className="space-y-1">
              {data!.movers.map((m) => (
                <div key={m.name} className="flex items-center gap-2 text-[12px]">
                  <span className="flex-1 truncate font-bold text-foreground/90">{m.name}</span>
                  <span className="tabular-nums text-muted-foreground">{m.latestWeight}kg</span>
                  <span className="tabular-nums font-black text-xp-green">+{Math.round(m.deltaKg * 10) / 10}kg</span>
                  {m.isPR ? <Trophy size={11} className="text-gold" /> : <TrendingUp size={11} className="text-xp-green" />}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground">Keep logging — your climbers show up here.</p>
          )}
        </>
      )}

      <div className="flex items-center justify-end mt-2 text-[10px] font-black uppercase tracking-widest text-gold/80">
        Open program <ChevronRight size={12} />
      </div>
    </button>
  );
};

const Stat = ({ icon, value, label, highlight }: { icon: React.ReactNode; value: number; label: string; highlight?: boolean }) => (
  <div className="flex items-center gap-1.5">
    {icon}
    <span className={highlight ? "font-black tabular-nums text-gold" : "font-black tabular-nums text-foreground"}>{value}</span>
    <span className="text-[11px] text-muted-foreground">{label}</span>
  </div>
);

export default ProgressionSummaryCard;
