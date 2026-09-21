import { backOr } from "@/lib/nav";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Dumbbell, Sparkles } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import { ErrorState } from "@/components/ui/error-state";
import { Progress } from "@/components/ui/progress";
import Sparkline from "@/components/coach/Sparkline";
import { useAuth } from "@/contexts/AuthContext";
import PerformanceOSDashboard from "@/components/coach/PerformanceOSDashboard";
import ProgressDashboard from "@/components/coach/ProgressDashboard";
import { DoorRow } from "@/components/coach/rows";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { useRecentCheckins } from "@/hooks/use-recent-checkins";
import { useWhealthHeadline } from "@/hooks/use-whealth-headline";
import { localDateKey } from "@/lib/date";

/**
 * /coach/progress — your last 7-30 days at a glance.
 *
 * The opening beat and the week's card are computed client-side from data
 * we already have, so the page is never blank. Then the weekly review and
 * the coach's read (Elite), which use edge functions; without
 * OPENROUTER_API_KEY they still render, the review just says "generate".
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

  // Program compliance for the current week (was its own gold card further
  // down the page, a third place to read "how much did I train").
  const weekDays = program?.plan_json?.weeks?.find((w) => w.week === currentWeek)?.days ?? [];
  const plannedSessions = weekDays.filter((d) => d.focus.toLowerCase() !== "rest").length;
  const loggedSessions = logs.filter((l) => l.week === currentWeek && l.completed).length;

  const index = useWhealthHeadline();
  const indexDelta = index.overall != null && index.priorOverall != null ? index.overall - index.priorOverall : 0;

  return (
    <div className="min-h-full">
      <PageBar title="Progress" onBack={() => backOr(navigate, "/coach")} />

      <div className="px-4 pt-4 pb-6">
        <header className="home-rise">
          <h2 className="font-display font-black text-title leading-[1.06] tracking-tight">
            {recent ? `${checkinsThisWeek} of 7 days locked in.` : "Your last seven days."}
          </h2>
        </header>

        {/* THE WEEK, ONCE. The page used to answer "how am I doing" in four
            places with four sources — a strip, a "Performance score" that was
            last night's index under another name, a compliance card and a tile
            row — and they disagreed. One card: the index (the same reader
            Journey uses), the training, then the quiet line. */}
        <div className="home-rise home-rise-1 mt-4 surface-card px-4 divide-y divide-border/35">
          {index.overall != null && (
            <button
              type="button"
              onClick={() => navigate("/journey")}
              className="press w-full min-h-11 flex items-center gap-3 py-3.5 text-left"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-label font-bold text-muted-foreground">
                  Whealth Index{index.live ? " · live" : ""}
                </span>
                <span className="mt-1 flex items-baseline gap-2">
                  <b className="font-display font-black text-major leading-none tabular-nums text-gold glow-gold-text">{index.overall}</b>
                  <span className="text-meta text-muted-foreground tabular-nums truncate">
                    of 100{indexDelta !== 0 && index.priorDate ? ` · ${indexDelta > 0 ? "up" : "down"} ${Math.abs(indexDelta)} since ${index.priorDate}` : ""}
                  </span>
                </span>
              </span>
              {index.history.length >= 2 && (
                <Sparkline values={index.history} domain={[0, 100]} className="w-20 h-8 shrink-0 text-gold" />
              )}
              <ChevronRight size={16} className="text-muted-foreground/75 shrink-0" aria-hidden />
            </button>
          )}

          <div className="py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-label font-bold text-muted-foreground">Training</span>
              <span className="text-dense font-bold tabular-nums">
                {!recent ? "—"
                  : program && plannedSessions > 0 ? `${loggedSessions} of ${plannedSessions} sessions · week ${currentWeek}`
                  : `${workoutsThisWeek} training day${workoutsThisWeek === 1 ? "" : "s"}`}
              </span>
            </div>
            {program && plannedSessions > 0 && (
              <Progress className="mt-2" value={Math.min(100, Math.round((loggedSessions / plannedSessions) * 100))} />
            )}
          </div>

          <div className="py-3 flex items-baseline gap-x-4 gap-y-1 flex-wrap tabular-nums">
            <span className="text-meta text-muted-foreground">Streak <b className="text-read font-display font-black text-foreground">{profile?.streak ? `${profile.streak}d` : "—"}</b></span>
            <span className="text-meta text-muted-foreground">Sleep <b className="text-read font-display font-black text-foreground">{sleepAvg}</b></span>
            <span className="text-meta text-muted-foreground ml-auto">Core 4 <b className="text-read font-display font-black text-foreground">{coreHitRate == null ? "—" : `${coreHitRate}%`}</b></span>
          </div>
        </div>

        {recentFailed && !recent && (
          <ErrorState size="compact" className="mt-4" title="Couldn't load your last seven days" onRetry={refetchRecent} />
        )}

        <div className="home-rise home-rise-2 mt-4">
          {isElite ? (
            <div className="space-y-4">
              <PerformanceOSDashboard />
              {program ? (
                <ProgressDashboard program={program} />
              ) : (
                <div className="border-t border-border/35">
                  <DoorRow
                    icon={Dumbbell}
                    label="Add a training program"
                    sub="Once you have one, your planned sessions count here."
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
                sub="The week's driver, next week's focus and a program tweak. Premium."
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
