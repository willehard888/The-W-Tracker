import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { localDateKey } from "@/lib/date";
import { fmtInt, NBSP } from "@/lib/format";
import { resolveIllustration } from "@/lib/exercise-match";
import { resolveGroup } from "@/lib/exercise-group";
import { liftsFrom, type LiftRow } from "@/lib/training/lifts";
import { sessionsFor } from "@/lib/training/progression";
import { useExerciseHistory, useRecentWorkoutLogs } from "@/hooks/use-workout-log";
import ExerciseTile from "@/components/coach/ExerciseTile";
import { IllustrationThumb } from "@/components/coach/ExerciseIllustration";
import Sparkline from "@/components/coach/Sparkline";
import { ProgressionChart } from "@/components/coach/ProgressionChart";
import { fmtKg } from "@/components/coach/session/SetRow";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { EmptyState } from "@/components/ui/empty-state";

const daysLabel = (d: number) => (d === 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`);

const lastLabel = (l: LiftRow) =>
  l.last.weight != null
    ? `${fmtKg(l.last.weight)}${l.last.reps != null ? ` × ${fmtInt(l.last.reps)}` : ""}`
    : l.last.reps != null ? `${fmtInt(l.last.reps)} reps` : "—";

/** The full curve for one movement, from every set it has logged. */
const LiftSheet = ({ lift, onClose }: { lift: LiftRow | null; onClose: () => void }) => {
  const history = useExerciseHistory(lift?.slug ?? null);
  const points = useMemo(() => sessionsFor(history.data ?? []), [history.data]);
  const drawn = lift ? resolveIllustration(lift.slug, lift.name) : null;
  return (
    <BottomSheet
      open={!!lift}
      onClose={onClose}
      label={lift?.name ?? "Lift"}
      title={lift?.name}
      subtitle={lift ? `${lift.sessions} ${lift.sessions === 1 ? "session" : "sessions"} · last ${daysLabel(lift.daysSince)}` : undefined}
      leading={drawn ? <IllustrationThumb ex={drawn} size={40} className="rounded-lg" /> : undefined}
      height="tall"
    >
      {lift && (
        history.isLoading ? (
          <div className="skeleton-block h-[280px] rounded-xl" />
        ) : (
          <ProgressionChart points={points} name={lift.name} />
        )
      )}
    </BottomSheet>
  );
};

/**
 * Every movement the athlete has logged, the most recently trained first:
 * the thumb, the last top set, how long ago, a mini curve of top weights and
 * the climb since the first of them. A row opens the movement's full
 * progression — the same chart the program's movement sheet shows.
 */
export const LiftsList = ({ className }: { className?: string }) => {
  const logs = useRecentWorkoutLogs();
  const lifts = useMemo(() => liftsFrom(logs.data ?? [], localDateKey()), [logs.data]);
  const [open, setOpen] = useState<LiftRow | null>(null);

  if (logs.isLoading) return <div className={cn("skeleton-block h-32 rounded-2xl", className)} />;

  return (
    <section className={className} aria-label="Lifts">
      <div className="flex items-baseline justify-between px-1 mb-2">
        <p className="text-label font-bold text-muted-foreground">Lifts</p>
        {lifts.length > 0 && <p className="text-label text-muted-foreground tabular-nums">{lifts.length} {lifts.length === 1 ? "movement" : "movements"}</p>}
      </div>
      {lifts.length === 0 ? (
        <EmptyState
          size="compact"
          title="Lock your first sets"
          description="Every lift you log shows up here with its curve."
        />
      ) : (
        <ul className="surface-card px-4 divide-y divide-border/35">
          {lifts.map((l) => {
            const drawn = resolveIllustration(l.slug, l.name);
            const canOpen = !!l.slug;
            return (
              <li key={l.key}>
                <button
                  type="button"
                  onClick={() => canOpen && setOpen(l)}
                  disabled={!canOpen}
                  aria-label={`${l.name}: ${l.sessions} ${l.sessions === 1 ? "session" : "sessions"}, last ${lastLabel(l)} ${daysLabel(l.daysSince)}${l.delta !== 0 ? `, ${l.delta > 0 ? "up" : "down"} ${Math.abs(l.delta)} ${l.unit}` : ""}`}
                  className="press-row w-full min-h-11 flex items-center gap-3 py-2.5 text-left disabled:cursor-default"
                >
                  {drawn ? <IllustrationThumb ex={drawn} size={40} className="rounded-lg shrink-0" /> : <ExerciseTile group={resolveGroup(l.name)} size={40} />}
                  <span className="flex-1 min-w-0">
                    <span className="block text-note font-bold leading-snug text-foreground truncate">{l.name}</span>
                    <span className="block text-label text-muted-foreground tabular-nums mt-0.5 truncate">
                      {l.sessions} {l.sessions === 1 ? "session" : "sessions"} · Last {lastLabel(l)} · {daysLabel(l.daysSince)}
                    </span>
                  </span>
                  <span className="shrink-0 flex items-center gap-2">
                    {l.series.length >= 2 && (
                      <span className="flex flex-col items-end gap-0.5">
                        <span className={cn("text-label font-black tabular-nums", l.delta > 0 ? "text-xp-green" : l.delta < 0 ? "text-destructive" : "text-muted-foreground")}>
                          {l.delta > 0 ? "+" : l.delta < 0 ? "−" : ""}{l.delta === 0 ? "flat" : `${Math.abs(l.delta)}${NBSP}${l.unit}`}
                        </span>
                        <Sparkline values={l.series} className="w-16 h-5" />
                      </span>
                    )}
                    {canOpen && <ChevronRight aria-hidden size={16} className="text-muted-foreground/75" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <LiftSheet lift={open} onClose={() => setOpen(null)} />
    </section>
  );
};

export default LiftsList;
