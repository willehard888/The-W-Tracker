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
    return <div className="skeleton-block h-24 rounded-2xl" />;
  }

  const empty = !data || data.setsThisWeek === 0;

  return (
    <button
      type="button"
      onClick={() => navigate("/coach/program")}
      className="w-full text-left surface-card surface-card-quiet p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp size={13} className="text-muted-foreground" />
        <p className="eyebrow">Strength progress</p>
        <span className="ml-auto text-[11px] font-bold text-muted-foreground">This week</span>
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
            <Stat icon={<Trophy size={13} className="text-xp-green" />} value={data!.prCount} label={data!.prCount === 1 ? "PR" : "PRs"} highlight={data!.prCount > 0} />
          </div>

          {data!.movers.length > 0 ? (
            <div className="space-y-1">
              {data!.movers.map((m) => (
                <div key={m.name} className="flex items-center gap-2 text-[12px]">
                  <span className="flex-1 truncate font-bold text-foreground/90">{m.name}</span>
                  <span className="tabular-nums text-muted-foreground">{m.latestWeight}kg</span>
                  <span className="tabular-nums font-black text-xp-green">+{Math.round(m.deltaKg * 10) / 10}kg</span>
                  {m.isPR ? <Trophy size={11} className="text-xp-green" /> : <TrendingUp size={11} className="text-xp-green" />}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground">Keep logging — your climbers show up here.</p>
          )}
        </>
      )}

      <div className="eyebrow flex items-center justify-end mt-2">
        Open program <ChevronRight size={12} />
      </div>
    </button>
  );
};

const Stat = ({ icon, value, label, highlight }: { icon: React.ReactNode; value: number; label: string; highlight?: boolean }) => (
  <div className="flex items-center gap-1.5">
    {icon}
    <span className={highlight ? "font-black tabular-nums text-xp-green" : "font-black tabular-nums text-foreground"}>{value}</span>
    <span className="text-[12px] text-muted-foreground">{label}</span>
  </div>
);

export default ProgressionSummaryCard;
