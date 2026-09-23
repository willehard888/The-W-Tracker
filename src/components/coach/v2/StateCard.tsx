import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTodayReflection } from "@/hooks/use-coach-reflection";
import { useRecentCheckins } from "@/hooks/use-recent-checkins";
import { useHealthWorkouts } from "@/hooks/use-health-workouts";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { localDateKey } from "@/lib/date";
import { PILLARS } from "@/lib/wellness-framework";
import { findWeakestPillarSmart } from "@/lib/coach/pick-free-move";

/**
 * Your read: where you are right now, from the last 7 days of check-ins.
 * One headline (the weakest signal), the signals inline, and the weakest
 * pillar as a hairline row that opens the chat with a concrete ask.
 */
const StateCard = ({ onAsk }: { onAsk?: (prompt: string) => void }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { reflection } = useTodayReflection();
  const { data: recent } = useRecentCheckins(7);
  // Training days = the check-in's tick, a session finished in the runner,
  // OR a session the watch recorded (a Polar tennis match on a day without a
  // check-in); the tick alone said "no training" minutes after a logged session.
  const { logs } = useCoachProgram();
  const health = useHealthWorkouts(7);
  const trainedDays = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    return new Set<string>([
      ...(recent ?? []).filter((r) => r.workout).map((r) => localDateKey(new Date(r.checked_in_at))),
      ...logs.filter((l) => l.completed && new Date(l.logged_at).getTime() >= weekAgo).map((l) => localDateKey(new Date(l.logged_at))),
      ...health.workoutDays,
    ]).size;
  }, [recent, logs, health.workoutDays]);

  const signal = useMemo(() => {
    if (!recent || recent.length === 0) {
      return {
        headline: "No check-ins yet — your first one starts the read",
        clean: false,
        detail: "Lock today from the Today tab.",
        sleepAvg: null as number | null,
        hydrationAvg: null as number | null,
      };
    }
    const sleepAvg = recent.reduce((s, r) => s + r.sleep_hours, 0) / recent.length;
    const hydroAvg = recent.reduce((s, r) => s + r.hydration_liters, 0) / recent.length;
    const workoutDays = trainedDays;
    const meditationDays = recent.filter((r) => r.meditation_morning || r.meditation_evening).length;

    // The headline names the SAME gap as the row under it. It used to run its
    // own ladder (sleep → water → mindfulness) while the row's picker also
    // checks training days, so a light week read "Mindfulness barely
    // registered" over "Movement is the gap". One picker, thresholds mirrored.
    const weakest = findWeakestPillarSmart([], { sleepAvg, hydrationAvg: hydroAvg, workoutDays, meditationDays });
    const headline =
      weakest === "sleep" && sleepAvg < 7 ? `Slept ${sleepAvg.toFixed(1)}h avg — sleep is dragging recovery down`
      : weakest === "nutrition" && hydroAvg < 2 ? `${hydroAvg.toFixed(1)}L water avg — hydration is light`
      : weakest === "movement" && workoutDays < 3
        ? (workoutDays === 0 ? "No training logged this week — movement is light" : `${workoutDays} training day${workoutDays === 1 ? "" : "s"} this week — movement is light`)
      : weakest === "stress" && meditationDays < 2 ? "Mindfulness barely registered this week — easy win"
      : null;
    return { headline: headline ?? "Foundation looks clean. Stack the next lever.", clean: headline === null, detail: null, sleepAvg, hydrationAvg: hydroAvg };
  }, [recent, trainedDays]);

  const weakestPillar = useMemo(() => {
    // Build signals from recent check-ins so the picker uses real behaviour,
    // not just "which pillar do you have fewest habits in." A first-time
    // user with sub-7h sleep should see Sleep as weakest — not whatever the
    // canonical-first pillar happens to be.
    const signals = recent && recent.length > 0 ? {
      sleepAvg: recent.reduce((s, r) => s + r.sleep_hours, 0) / recent.length,
      hydrationAvg: recent.reduce((s, r) => s + r.hydration_liters, 0) / recent.length,
      workoutDays: trainedDays,
      meditationDays: recent.filter((r) => r.meditation_morning || r.meditation_evening).length,
    } : undefined;
    // Protocol-habit adoption no longer exists (habits live in the check-in),
    // so the pillar read comes purely from the last 7 days of signals.
    return findWeakestPillarSmart([], signals);
  }, [recent, trainedDays]);
  const pillarMeta = PILLARS[weakestPillar];

  return (
    <div className="surface-card surface-card-quiet p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-note font-bold leading-snug text-foreground">{signal.headline}</p>
        {profile?.streak && profile.streak > 0 ? (
          <span className="shrink-0 text-meta text-muted-foreground tabular-nums">{profile.streak}d streak</span>
        ) : null}
      </div>
      {signal.detail && (
        <p className="text-meta text-muted-foreground mt-1 leading-snug">{signal.detail}</p>
      )}

      {/* Signals inline: one quiet line, no tiles. */}
      {(signal.sleepAvg !== null || signal.hydrationAvg !== null) && (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-meta text-muted-foreground tabular-nums">
          <span>Sleep <b className={cn("font-black", signal.sleepAvg !== null && signal.sleepAvg >= 7.5 ? "text-foreground" : "text-foreground/75")}>{signal.sleepAvg !== null ? `${signal.sleepAvg.toFixed(1)}h` : "—"}</b></span>
          <span>Water <b className={cn("font-black", signal.hydrationAvg !== null && signal.hydrationAvg >= 2.5 ? "text-foreground" : "text-foreground/75")}>{signal.hydrationAvg !== null ? `${signal.hydrationAvg.toFixed(1)}L` : "—"}</b></span>
          <span>Reflection <b className={cn("font-black", reflection ? "text-foreground" : "text-foreground/75")}>{reflection ? "logged" : "not yet"}</b></span>
        </p>
      )}

      {/* Weakest pillar: a hairline row that opens the chat with a concrete ask. */}
      <button
        type="button"
        onClick={() => onAsk ? onAsk(`Help me improve my ${pillarMeta.name.toLowerCase()} this week — one concrete change.`) : navigate("/coach")}
        className="press mt-3 pt-3 w-full min-h-11 border-t border-border/35 flex items-center gap-3 text-left"
      >
        <span className="text-lg shrink-0" aria-hidden>{pillarMeta.emoji}</span>
        <span className="flex-1 min-w-0">
          <span className={cn("block text-dense font-bold leading-tight", pillarMeta.tint.text)}>{signal.clean ? `Next lever · ${pillarMeta.name}` : `${pillarMeta.name} is the gap`}</span>
          <span className="block text-label text-muted-foreground leading-snug mt-0.5 line-clamp-1">{pillarMeta.blurb}</span>
        </span>
        <ChevronRight size={16} className="text-muted-foreground/75 shrink-0" aria-hidden />
      </button>
    </div>
  );
};

export default StateCard;
