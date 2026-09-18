// The recovery session: one movement at a time, on a clock.
//
// It reads where it came from off the URL so every entry point is a link and
// the screen owns the decision:
//
//   /recovery?src=post_workout&p=<program>&w=<week>&d=<dayIndex>
//   /recovery?src=rest_day
//   /recovery                       → general
//
// Nothing about the session is passed in. Two renders of the same URL build
// the same session because `buildSession` is deterministic, which is what lets
// the offer card on the finish screen promise a duration the session keeps.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Pause, Play, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";
import { backOr } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { useDaySets, useRecentWorkoutLogs } from "@/hooks/use-workout-log";
import { areaLoadFromLoggedSets, topAreas } from "@/lib/recovery/exposure";
import { restDayAreas } from "@/lib/recovery/rest-day";
import { buildSession, describeLength, type RecoveryLength } from "@/lib/recovery/build-session";
import { movementSeconds, type RecoveryMovement } from "@/data/recovery";

type Source = "post_workout" | "rest_day" | "manual";

const asSource = (v: string | null): Source =>
  v === "post_workout" || v === "rest_day" ? v : "manual";

const asLength = (v: string | null): RecoveryLength =>
  v === "quick" || v === "deep" ? v : "standard";

/** mm:ss — a stretch is counted, not estimated. */
const clock = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.max(0, sec % 60)).padStart(2, "0")}`;

export default function Recovery() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const source = asSource(params.get("src"));
  const length = asLength(params.get("len"));
  const programId = params.get("p");
  const week = params.get("w") ? Number(params.get("w")) : undefined;
  const day = params.get("d") ? Number(params.get("d")) : undefined;

  const { data: daySets } = useDaySets(
    source === "post_workout" ? programId : null,
    week,
    day,
  );
  const { data: recentLogs } = useRecentWorkoutLogs();

  const areas = useMemo(() => {
    if (source === "post_workout") return topAreas(areaLoadFromLoggedSets(daySets ?? {}));
    if (source === "rest_day") return restDayAreas(recentLogs ?? []);
    return [];
  }, [source, daySets, recentLogs]);

  const session = useMemo(
    () => buildSession(areas, { length, context: source === "rest_day" ? "rest_day" : "post_workout" }),
    [areas, length, source],
  );

  const [index, setIndex] = useState(0);
  const [side, setSide] = useState<0 | 1>(0);
  const [left, setLeft] = useState<number | null>(null);
  const [running, setRunning] = useState(true);
  const [done, setDone] = useState(false);
  const startedAt = useRef(Date.now());
  const announced = useRef(false);

  const movement: RecoveryMovement | undefined = session.movements[index];

  // Fire once per screen, and only once the session is actually built — the
  // first render of a post-workout session has no logged sets yet, so an event
  // sent there would report every session as general.
  const settled = source !== "post_workout" || daySets !== undefined;
  useEffect(() => {
    if (announced.current || !settled || session.movements.length === 0) return;
    announced.current = true;
    void track("recovery_started", {
      source,
      length,
      areas: session.areas,
      movements: session.movements.length,
      general: session.general,
    });
  }, [settled, session, source, length]);

  // The clock. One interval for the whole screen: a timer per movement would
  // leave a stray interval behind on every skip.
  useEffect(() => {
    if (!movement) return;
    setLeft(movement.holdSec);
  }, [movement, side]);

  useEffect(() => {
    if (!running || left === null || done) return;
    if (left <= 0) return;
    const id = window.setInterval(() => setLeft((v) => (v === null ? v : v - 1)), 1000);
    return () => window.clearInterval(id);
  }, [running, left, done]);

  const advance = () => {
    if (!movement) return;
    if (movement.sides === 2 && side === 0) {
      setSide(1);
      return;
    }
    setSide(0);
    if (index + 1 < session.movements.length) {
      setIndex(index + 1);
      return;
    }
    setDone(true);
    hapticNotification("success");
    void track("recovery_completed", {
      source,
      length,
      areas: session.areas,
      movements: session.movements.length,
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
    });
  };

  // The hold ran out on its own.
  useEffect(() => {
    if (left === 0 && running && !done) {
      hapticImpact("light");
      advance();
    }
    // advance closes over index/side, which is the point — it must run for the
    // position that just finished, not a later one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, running, done]);

  const leave = (reason: "skipped" | "left") => {
    if (!done) {
      void track("recovery_skipped", {
        source,
        reason,
        atMovement: index,
        of: session.movements.length,
      });
    }
    backOr(navigate, "/");
  };

  if (session.movements.length === 0) {
    return (
      <div className="min-h-full">
        <PageBar onBack={() => leave("left")} title="Recovery" />
        <div className="px-4 pt-6">
          <p className="text-note text-muted-foreground">Nothing to show here yet.</p>
        </div>
      </div>
    );
  }

  if (done) {
    const mins = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    return (
      <div className="min-h-full">
        <PageBar onBack={() => backOr(navigate, "/")} title="Recovery" />
        <div className="px-4 pt-6 pb-6">
          <div className="home-rise">
            <h2 className="font-display font-black text-beat leading-[1.04] tracking-tight">
              That's the work done.
            </h2>
            <p className="mt-3 text-read font-bold tabular-nums text-foreground/85">
              {session.movements.length} movements · {mins} min
            </p>
          </div>
          <div className="home-rise home-rise-2 mt-6">
            <Button variant="ember" size="lg" className="w-full" onClick={() => backOr(navigate, "/")}>
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!movement) return null;

  const total = session.movements.length;
  const sideLabel = movement.sides === 2 ? (side === 0 ? "First side" : "Second side") : null;
  const elapsed = movement.holdSec - (left ?? movement.holdSec);
  const ring = Math.min(100, Math.round((elapsed / movement.holdSec) * 100));

  return (
    <div className="min-h-full">
      <PageBar onBack={() => leave("left")} title={`Recovery · ${describeLength(session.totalSec)}`} />
      <div className="px-4 pt-4 pb-6">
        {/* Where you are, before anything else moves. */}
        <div className="flex items-center gap-1.5" aria-hidden>
          {session.movements.map((m, i) => (
            <span
              key={m.id}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i < index ? "bg-gold/70" : i === index ? "bg-gold" : "bg-border",
              )}
            />
          ))}
        </div>
        <p className="sr-only">
          Movement {index + 1} of {total}
        </p>

        <div className="home-rise mt-6">
          <p className="eyebrow-sm text-muted-foreground">
            {movement.type === "breathing" ? "Breathe" : movement.areas.join(" · ")}
          </p>
          <h2 className="mt-1 font-display font-black text-major leading-[1.06] tracking-tight text-balance">
            {movement.name}
          </h2>
          {sideLabel && <p className="mt-1 text-meta font-bold text-gold">{sideLabel}</p>}
        </div>

        {/* No illustration exists for any of these — see src/data/recovery.ts.
            The clock is the screen's one felt number, so it carries the frame
            instead of a placeholder drawing pretending to be one. */}
        <div className="home-rise home-rise-1 mt-6">
          <div className="surface-card surface-card-quiet flex flex-col items-center justify-center py-8">
            <div
              className="relative h-32 w-32 rounded-full grid place-items-center"
              style={{
                background: `conic-gradient(hsl(var(--gold)) ${ring}%, hsl(var(--border)) ${ring}%)`,
              }}
            >
              <div className="h-[7.25rem] w-[7.25rem] rounded-full bg-card grid place-items-center">
                <span className="font-display font-black text-beat tabular-nums">
                  {clock(left ?? movement.holdSec)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <ol className="home-rise home-rise-2 mt-5 space-y-2">
          {movement.steps.map((step) => (
            <li key={step} className="flex gap-2.5 text-note leading-snug text-foreground/85">
              <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-gold/70" aria-hidden />
              {step}
            </li>
          ))}
        </ol>

        {movement.caution && (
          <p className="home-rise home-rise-3 mt-4 text-dense leading-snug text-muted-foreground">
            {movement.caution}
          </p>
        )}

        <div className="home-rise home-rise-4 mt-6 flex gap-2">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => {
              hapticImpact("light");
              setRunning((r) => !r);
            }}
          >
            {running ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {running ? "Pause" : "Resume"}
          </Button>
          <Button
            variant="ember"
            size="lg"
            className="flex-1"
            onClick={() => {
              hapticImpact("light");
              advance();
            }}
          >
            {index + 1 === total && (movement.sides === 1 || side === 1) ? (
              <>
                <Check size={16} aria-hidden /> Finish
              </>
            ) : (
              <>
                <SkipForward size={16} aria-hidden /> Next
              </>
            )}
          </Button>
        </div>

        <Button
          variant="ghost"
          size="lg"
          className="w-full mt-2 text-muted-foreground"
          onClick={() => leave("skipped")}
        >
          End session
        </Button>

        <p className="mt-4 text-label text-muted-foreground/75 text-center tabular-nums">
          {index + 1} of {total} · {describeLength(session.movements.reduce((s, m) => s + movementSeconds(m), 0))} total
        </p>
      </div>
    </div>
  );
}
