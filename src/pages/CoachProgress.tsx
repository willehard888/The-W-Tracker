import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, Sparkles, Calendar, Flame, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import PerformanceOSDashboard from "@/components/coach/PerformanceOSDashboard";
import ProgressDashboard from "@/components/coach/ProgressDashboard";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { useRecentCheckins } from "@/hooks/use-recent-checkins";

/**
 * /coach/progress — your last 7-30 days at a glance.
 *
 * Top: high-level summary tiles (check-ins this week, current streak,
 *   habits compounding). Always visible, computed client-side from
 *   data we already have — never blank.
 *
 * Then: optional Performance + Progress dashboards (Elite) which use
 *   the coach-weekly-review edge function. If OPENROUTER_API_KEY isn't
 *   set the dashboards still render their tile UI; the review text
 *   just shows "tap to generate."
 */
const CoachProgress = () => {
  const navigate = useNavigate();
  const { profile, isElite } = useAuth();
  const { program, currentWeek, logs } = useCoachProgram();
  const { data: recent } = useRecentCheckins(7);
  // Core 4 hit-rate from the same rows (habits live in the check-in now).
  const coreHitRate = recent && recent.length > 0
    ? Math.round(
        (recent.reduce((s, r) => s + (r.sleep_hours >= 7.5 && r.sleep_hours <= 9 ? 1 : 0) + (r.workout ? 1 : 0) + (r.hydration_liters >= 3 ? 1 : 0) + ((r.meditation_morning || r.meditation_evening) ? 1 : 0), 0) / (recent.length * 4)) * 100,
      )
    : null;

  const checkinsThisWeek = recent?.length ?? 0;
  const sleepAvg = recent && recent.length > 0
    ? (recent.reduce((s, r) => s + r.sleep_hours, 0) / recent.length).toFixed(1)
    : "—";
  const workoutsThisWeek = recent?.filter((r) => r.workout).length ?? 0;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 page-header-premium px-4 pt-3 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-[hsl(var(--gold)/0.12)] flex items-center justify-center">
            <BarChart3 size={14} className="text-gold" />
          </div>
          <h1 className="font-display text-base font-black">Progress</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8 space-y-4">
        {/* Top summary — never blank, always computed from local data */}
        <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] to-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={12} className="text-gold" />
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold">
              Last 7 days at a glance
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SummaryTile icon={Calendar} label="Check-ins" value={`${checkinsThisWeek}/7`} />
            <SummaryTile icon={Flame} label="Streak" value={profile?.streak ? `${profile.streak}d` : "—"} />
            <SummaryTile icon={BarChart3} label="Sleep avg" value={`${sleepAvg}h`} />
            <SummaryTile icon={Trophy} label="Workouts" value={`${workoutsThisWeek}/7`} />
          </div>
          <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Core 4 hit rate · 7 days</span>
            <span className="text-[12px] font-bold text-gold tabular-nums">{coreHitRate == null ? "—" : `${coreHitRate}%`}</span>
          </div>
        </div>

        {/* Elite-only: AI-generated weekly review + program compliance */}
        {isElite ? (
          <>
            <PerformanceOSDashboard />
            {program && (
              <ProgressDashboard
                program={program}
                currentWeek={currentWeek}
                logs={logs}
              />
            )}
            {!program && (
              <button
                type="button"
                onClick={() => navigate("/coach/program")}
                className="w-full rounded-2xl border border-dashed border-gold/30 bg-card/30 p-4 text-left hover:bg-gold/[0.04] transition-colors active:scale-[0.99]"
              >
                <p className="text-[12px] font-bold mb-0.5">Add a training program</p>
                <p className="text-[10px] text-muted-foreground">
                  Once you have one, week-by-week compliance lands here too.
                </p>
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/paywall")}
            className="w-full text-left rounded-2xl border border-gold/30 bg-gradient-to-b from-gold/[0.06] to-card p-4 active:scale-[0.99] transition-transform"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold mb-1">
              W Coach · Premium
            </p>
            <p className="text-[13px] font-bold mb-1">Unlock AI weekly review</p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Score, trend, components (sleep / recovery / consistency),
              week-driver call-out, and a Coach signature. Premium perk.
            </p>
          </button>
        )}
      </div>
    </div>
  );
};

const SummaryTile = ({
  icon: Icon, label, value,
}: { icon: React.ElementType; label: string; value: string }) => (
  <div className="surface-card surface-card-quiet px-3 py-2.5">
    <div className="flex items-center gap-1 mb-0.5">
      <Icon size={10} className="text-muted-foreground" />
      <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
    <span className="text-base font-display font-black text-foreground tabular-nums">
      {value}
    </span>
  </div>
);

export default CoachProgress;
