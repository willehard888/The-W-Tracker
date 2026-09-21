import { backOr } from "@/lib/nav";
import { useNavigate } from "react-router-dom";
import { Dumbbell, Sparkles } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import { ErrorState } from "@/components/ui/error-state";
import { useAuth } from "@/contexts/AuthContext";
import PerformanceOSDashboard from "@/components/coach/PerformanceOSDashboard";
import ProgressDashboard from "@/components/coach/ProgressDashboard";
import { DoorRow } from "@/components/coach/rows";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { useRecentCheckins } from "@/hooks/use-recent-checkins";
import { localDateKey } from "@/lib/date";

/**
 * /coach/progress — your last 7-30 days at a glance.
 *
 * The opening beat and the standing row are computed client-side from
 * data we already have, so the page is never blank. Then the Performance
 * + Progress dashboards (Elite), which use the coach-weekly-review edge
 * function; without OPENROUTER_API_KEY they still render, the review text
 * just says "tap to generate."
 */
const CoachProgress = () => {
  const navigate = useNavigate();
  const { profile, isElite } = useAuth();
  const { program, currentWeek, logs } = useCoachProgram();
  const { data: recent, isError: recentFailed, refetch: refetchRecent } = useRecentCheckins(7);
  // Core 4 hit-rate from the same rows (habits live in the check-in now).
  const coreHitRate = recent && recent.length > 0
    ? Math.round(
        (recent.reduce((s, r) => s + (r.sleep_hours >= 7.5 && r.sleep_hours <= 9 ? 1 : 0) + (r.workout ? 1 : 0) + (r.hydration_liters >= 3 ? 1 : 0) + ((r.meditation_morning || r.meditation_evening) ? 1 : 0), 0) / (recent.length * 4)) * 100,
      )
    : null;

  const checkinsThisWeek = recent?.length ?? 0;
  const sleepAvg = recent && recent.length > 0
    ? `${(recent.reduce((s, r) => s + r.sleep_hours, 0) / recent.length).toFixed(1)}h`
    : "—";
  // A training day is one you ticked in the check-in OR one where a session
  // was finished in the runner: counting only the tick read "Workouts 0/7"
  // right above "1 of 1 planned sessions logged".
  const weekAgo = Date.now() - 7 * 86_400_000;
  const workoutDays = new Set<string>([
    ...(recent ?? []).filter((r) => r.workout).map((r) => localDateKey(new Date(r.checked_in_at))),
    ...logs
      .filter((l) => l.completed && new Date(l.logged_at).getTime() >= weekAgo)
      .map((l) => localDateKey(new Date(l.logged_at))),
  ]);
  const workoutsThisWeek = workoutDays.size;

  return (
    <div className="min-h-full">
      <PageBar title="Progress" onBack={() => backOr(navigate, "/coach")} />

      <div className="px-4 pt-4 pb-6">
        <header className="home-rise">
          <h2 className="font-display font-black text-title leading-[1.06] tracking-tight">
            {recent ? `${checkinsThisWeek} of 7 days locked in.` : "Your last seven days."}
          </h2>
        </header>

        {/* Standing: one quiet row, the Core 4 rate the single gold note. */}
        <div className="home-rise home-rise-1 mt-4 surface-card surface-card-quiet px-4 py-3 flex items-baseline gap-x-4 gap-y-1 flex-wrap tabular-nums">
          <span className="text-meta text-muted-foreground">Streak <b className="text-read font-display font-black text-foreground">{profile?.streak ? `${profile.streak}d` : "—"}</b></span>
          <span className="text-meta text-muted-foreground">Sleep <b className="text-read font-display font-black text-foreground">{sleepAvg}</b></span>
          {/* A dash until the rows are here: "0/7" while loading (or after a
              failed load) was a number nobody measured. */}
          <span className="text-meta text-muted-foreground">Workouts <b className="text-read font-display font-black text-foreground">{recent ? `${workoutsThisWeek}/7` : "—"}</b></span>
          <span className="text-meta text-muted-foreground ml-auto">Core 4 <b className="text-read font-display font-black text-gold glow-gold-text">{coreHitRate == null ? "—" : `${coreHitRate}%`}</b></span>
        </div>

        {recentFailed && !recent && (
          <ErrorState size="compact" className="mt-4" title="Couldn't load your last seven days" onRetry={refetchRecent} />
        )}

        <div className="home-rise home-rise-2 mt-4">
          {isElite ? (
            <div className="space-y-4">
              <PerformanceOSDashboard />
              {program ? (
                <ProgressDashboard program={program} currentWeek={currentWeek} logs={logs} />
              ) : (
                <div className="border-t border-border/35">
                  <DoorRow
                    icon={Dumbbell}
                    label="Add a training program"
                    sub="Once you have one, week-by-week compliance lands here too."
                    onClick={() => navigate("/coach/program")}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="border-t border-border/35">
              <DoorRow
                icon={Sparkles}
                label="Unlock the AI weekly review"
                sub="Score, trend, sleep / recovery / consistency, and the week's driver. Premium."
                onClick={() => navigate("/paywall")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoachProgress;
