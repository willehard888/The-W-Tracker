// The recovery session: one movement at a time, on a clock.
//
// It reads where it came from off the URL, so every entry point is a link and
// the screen owns the decision:
//
//   /recovery?src=post_workout&p=<program>&w=<week>&d=<dayIndex>
//   /recovery?src=rest_day
//   /recovery                       → general
//
// Nothing about the session is passed in. Two renders of the same URL build the
// same session, because `buildSession` is deterministic — which is what lets
// the offer card promise a duration the session then keeps.
//
// THREE STATES, AND WHY THERE IS A READY SCREEN
//
// ready → running → done. The ready screen is one tap from starting and exists
// to hold the two things that genuinely change the session: how long, and
// whether the athlete is sore. It is not a configuration form — Start is the
// only prominent control and every default is already chosen. But a session
// whose length cannot be chosen is a session that is wrong for most people most
// of the time, and the first version had `len` as a URL parameter that nothing
// in the app ever set.
//
// THE CLOCK IS A DEADLINE, NOT A COUNTER
//
// The first version decremented a number once a second. `RestTimer` documents
// exactly why that fails, having already been fixed for it: phones lock, and
// WebKit throttles or suspends timers in a hidden tab, so a counter loses time
// whenever the screen goes off — which during a 45-second hold is most of it.
// Here the position is a timestamp and the display is derived from the clock,
// so a session backgrounded for a minute comes back showing the truth.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Pause, Play, SkipForward, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";
import { backOr } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification, hapticSelection } from "@/lib/haptics";
import { track, FUNNEL } from "@/lib/analytics";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { useOnboardingTrigger } from "@/components/onboarding/onboarding-context";
import { useDaySets, useRecentWorkoutLogs } from "@/hooks/use-workout-log";
import { areaLoadFromLoggedSets, topAreas, primaryAreaCount } from "@/lib/recovery/exposure";
import { recentAreaLoad } from "@/lib/recovery/rest-day";
import {
  buildSession,
  describeLength,
  swapMovement,
  type RecoveryLength,
  type Soreness,
} from "@/lib/recovery/build-session";
import { markRecoveryDone, recoveryDaysThisWeek } from "@/lib/recovery/completion";
import { clearDeferredRecovery } from "@/lib/recovery/deferred";
import { preferredLength, rememberLength } from "@/lib/recovery/preferences";
import { whyThis } from "@/lib/recovery/explain";
import { movementSeconds, RECOVERY_BY_ID, type RecoveryMovement } from "@/data/recovery";

type Source = "post_workout" | "rest_day" | "manual";

const asSource = (v: string | null): Source =>
  v === "post_workout" || v === "rest_day" ? v : "manual";

// The minutes on each chip are the minutes that session actually runs, not a
// nominal label: the chip said "6 min" beside a Start button that said "7 min",
// because the budget is a ceiling and the movements that fit under it are
// whole. Two numbers for one thing, three centimetres apart, is the kind of
// small wrongness that reads as the app not knowing its own mind.
const LENGTHS: { id: RecoveryLength; label: string }[] = [
  { id: "quick", label: "Quick" },
  { id: "standard", label: "Standard" },
  { id: "deep", label: "Deep" },
];

const SORENESS: { id: Exclude<Soreness, null>; label: string }[] = [
  { id: "good", label: "Good" },
  { id: "tight", label: "Tight" },
  { id: "sore", label: "Sore" },
];

/** mm:ss — a hold is counted, not estimated. */
const clock = (sec: number) =>
  `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.max(0, sec) % 60).padStart(2, "0")}`;

export default function Recovery() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const source = asSource(params.get("src"));
  const programId = params.get("p");
  const week = params.get("w") ? Number(params.get("w")) : undefined;
  const day = params.get("d") ? Number(params.get("d")) : undefined;

  const { data: daySets, isLoading: daySetsLoading } = useDaySets(
    source === "post_workout" ? programId : null,
    week,
    day,
  );
  const { data: recentLogs, isLoading: recentLoading } = useRecentWorkoutLogs();

  const [length, setLength] = useState<RecoveryLength>(() => preferredLength());
  const [soreness, setSoreness] = useState<Soreness>(null);
  const [phase, setPhase] = useState<"ready" | "running" | "done">("ready");

  // Waiting for the query that decides the areas. Without this the screen
  // renders a general session for a frame and then swaps to the real one,
  // which reads as the app changing its mind about what you just trained.
  const settling =
    source === "post_workout" ? daySetsLoading : source === "rest_day" ? recentLoading : false;

  const load = useMemo(() => {
    if (source === "post_workout") return areaLoadFromLoggedSets(daySets ?? {});
    if (source === "rest_day") return recentAreaLoad(recentLogs ?? []);
    return [];
  }, [source, daySets, recentLogs]);

  // Swaps, by movement id. Held outside the builder so the session stays a pure
  // function of its inputs: what the athlete changed is an overlay on top of it,
  // not a second source of truth about what the session is.
  const [swaps, setSwaps] = useState<Record<string, string>>({});

  const session = useMemo(() => {
    const built = buildSession(topAreas(load), {
      length,
      context: source === "rest_day" ? "rest_day" : "post_workout",
      soreness,
      primaryCount: primaryAreaCount(load),
    });
    if (Object.keys(swaps).length === 0) return built;
    const replace = (m: RecoveryMovement) => {
      const id = swaps[m.id];
      return (id && RECOVERY_BY_ID.get(id)) || m;
    };
    const blocks = built.blocks.map((b) => ({ ...b, movements: b.movements.map(replace) }));
    const movements = blocks.flatMap((b) => b.movements);
    return {
      ...built,
      blocks,
      movements,
      totalSec: movements.reduce((s, m) => s + movementSeconds(m), 0),
    };
  }, [load, length, source, soreness, swaps]);

  const [index, setIndex] = useState(0);
  const [side, setSide] = useState<0 | 1>(0);
  // The clock: a deadline while running, the seconds left while paused.
  const [deadline, setDeadline] = useState<number | null>(null);
  const [heldLeft, setHeldLeft] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const startedAt = useRef(0);
  const announced = useRef(false);

  const movement: RecoveryMovement | undefined = session.movements[index];
  const running = phase === "running" && deadline !== null;
  const left = movement
    ? running && deadline !== null
      ? Math.ceil((deadline - now) / 1000)
      : heldLeft ?? movement.holdSec
    : 0;

  useWakeLock(phase === "running");

  // The rest-day card, once, on the ready screen of a real rest-day session.
  // Not on a general one: "built from your last couple of sessions" over a
  // session built from nothing would teach the wrong thing on the one day it
  // gets to teach anything.
  useOnboardingTrigger(
    "RECOVERY_REST_DAY_INTRO",
    phase === "ready" && source === "rest_day" && !settling && !session.general,
  );

  // One interval for the whole screen, reading the wall clock. Four times a
  // second so a pause lands where the eye expects, not up to a second later.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  // A hidden tab stops painting; coming back must not show a stale number.
  useEffect(() => {
    const onVisible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (announced.current || settling || session.movements.length === 0) return;
    announced.current = true;
    void track(FUNNEL.recoveryOpened, {
      source,
      length,
      areas: session.areas,
      movements: session.movements.length,
      general: session.general,
    });
  }, [settling, session, source, length]);

  const armHold = useCallback((seconds: number) => {
    setHeldLeft(null);
    setDeadline(Date.now() + seconds * 1000);
    setNow(Date.now());
  }, []);

  const finish = useCallback(() => {
    setPhase("done");
    setDeadline(null);
    hapticNotification("success");
    // Before the events: `track` is fire-and-forget by contract, and what earns
    // the athlete their check-in tick must not wait on a network call.
    markRecoveryDone();
    clearDeferredRecovery();
    rememberLength(length);
    void track(FUNNEL.recoveryCompleted, {
      source,
      length,
      soreness,
      areas: session.areas,
      movements: session.movements.length,
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
    });
  }, [length, soreness, source, session]);

  const advance = useCallback(() => {
    const current = session.movements[index];
    if (!current) return;
    if (current.sides === 2 && side === 0) {
      setSide(1);
      armHold(current.holdSec);
      return;
    }
    const next = session.movements[index + 1];
    if (next) {
      setSide(0);
      setIndex(index + 1);
      armHold(next.holdSec);
      return;
    }
    finish();
  }, [session, index, side, armHold, finish]);

  const back = useCallback(() => {
    const current = session.movements[index];
    if (current && current.sides === 2 && side === 1) {
      setSide(0);
      armHold(current.holdSec);
      return;
    }
    const prev = session.movements[index - 1];
    if (!prev) return;
    setIndex(index - 1);
    setSide(prev.sides === 2 ? 1 : 0);
    armHold(prev.holdSec);
  }, [session, index, side, armHold]);

  // The hold ran out on its own. Derived from the clock, so this fires on the
  // first tick after the deadline whether the phone was awake for it or not.
  const rolled = useRef<string>("");
  useEffect(() => {
    if (!running || left > 0) return;
    const key = `${index}:${side}`;
    if (rolled.current === key) return;
    rolled.current = key;
    hapticImpact("light");
    advance();
  }, [running, left, index, side, advance]);

  const start = () => {
    hapticImpact("light");
    startedAt.current = Date.now();
    setPhase("running");
    setIndex(0);
    setSide(0);
    rolled.current = "";
    armHold(session.movements[0]?.holdSec ?? 30);
    void track(FUNNEL.recoveryStarted, {
      source,
      length,
      soreness,
      areas: session.areas,
      movements: session.movements.length,
      general: session.general,
    });
  };

  const leave = () => {
    if (phase === "running") {
      void track(FUNNEL.recoverySkipped, {
        source,
        length,
        atMovement: index,
        of: session.movements.length,
      });
    }
    backOr(navigate, "/");
  };

  // ── Ready ────────────────────────────────────────────────────────────────
  if (phase === "ready") {
    const why = whyThis(source, session, load);
    const context = source === "rest_day" ? "rest_day" : "post_workout";
    const minutesFor = (l: RecoveryLength) =>
      l === length
        ? describeLength(session.totalSec)
        : describeLength(
            buildSession(topAreas(load), {
              length: l,
              context,
              soreness,
              primaryCount: primaryAreaCount(load),
            }).totalSec,
          );
    return (
      <div className="min-h-full">
        <PageBar onBack={() => backOr(navigate, "/")} title="Recovery" />
        <div className="px-4 pt-6 pb-6">
          <div className="home-rise">
            <p className="eyebrow-sm text-muted-foreground">
              {source === "rest_day" ? "Rest day" : source === "post_workout" ? "After the work" : "Recovery"}
            </p>
            <h1 className="mt-1 font-display font-black text-beat leading-[1.04] tracking-tight text-balance">
              {session.general
                ? "Loosen up."
                : source === "rest_day"
                  ? "Move, then loosen off."
                  : "Loosen up what you trained."}
            </h1>
            {session.areas.length > 0 && (
              <p className="mt-3 text-read font-bold capitalize">
                {session.areas.join(" · ")}
              </p>
            )}
            {/* One line, and only one. The point is that the athlete sees this
                was built from their session — not that they read a model. */}
            {why && (
              <p className="mt-2 text-dense text-muted-foreground leading-snug">{why}</p>
            )}
          </div>

          <div className="home-rise home-rise-1 mt-7">
            <p className="text-label font-bold text-muted-foreground/75 mb-2">How long</p>
            <div className="grid grid-cols-3 gap-2">
              {LENGTHS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => { hapticSelection(); setLength(l.id); }}
                  aria-pressed={length === l.id}
                  className={cn(
                    "min-h-14 rounded-xl border px-2 py-2 text-center transition-colors",
                    length === l.id
                      ? "border-gold/60 bg-gold/[0.08]"
                      : "border-border/50 bg-card/40 active:opacity-70",
                  )}
                >
                  <span className="block text-note font-bold">{l.label}</span>
                  <span className="block text-label text-muted-foreground tabular-nums">
                    {minutesFor(l.id)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional, and phrased as an offer rather than a question, so the
              default path is one tap on Start and nothing else. */}
          <div className="home-rise home-rise-2 mt-5">
            <p className="text-label font-bold text-muted-foreground/75 mb-2">Feeling sore? (optional)</p>
            <div className="grid grid-cols-3 gap-2">
              {SORENESS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    hapticSelection();
                    setSoreness((cur) => (cur === s.id ? null : s.id));
                  }}
                  aria-pressed={soreness === s.id}
                  className={cn(
                    "min-h-11 rounded-xl border px-2 text-note font-bold transition-colors",
                    soreness === s.id
                      ? "border-gold/60 bg-gold/[0.08]"
                      : "border-border/50 bg-card/40 active:opacity-70",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {soreness === "sore" && (
              // No claim about what soreness is or what this does about it —
              // only what changes on the screen.
              <p className="mt-2 text-dense text-muted-foreground leading-snug">
                Shorter, and only the gentler positions. If something hurts
                rather than feels tight, leave it out.
              </p>
            )}
          </div>

          <div className="home-rise home-rise-3 mt-7">
            <Button
              variant="ember"
              size="lg"
              className="w-full"
              disabled={settling || session.movements.length === 0}
              onClick={start}
            >
              {settling
                ? "Getting your session…"
                : `Start · ${describeLength(session.totalSec)}`}
            </Button>
            <p className="mt-3 text-label text-muted-foreground/75 text-center tabular-nums">
              {session.movements.length} movements
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  if (phase === "done") {
    const mins = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    // A count, never a target: "3 this week" says the athlete does this; "3 / 5"
    // would say they are behind, about a goal nobody set.
    const daysThisWeek = recoveryDaysThisWeek();
    return (
      <div className="min-h-full">
        <PageBar onBack={() => backOr(navigate, "/")} title="Recovery" />
        <div className="px-4 pt-6 pb-6">
          <div className="home-rise">
            <h2 className="font-display font-black text-beat leading-[1.04] tracking-tight">
              Done. Recovery handled.
            </h2>
            <p className="mt-3 text-read font-bold tabular-nums text-foreground/85">
              {session.movements.length} movements · {mins} min
            </p>
            <p className="mt-3 text-dense text-muted-foreground leading-snug">
              Mobility is ticked on today's check-in.
              {daysThisWeek > 1 && ` That's ${daysThisWeek} days this week.`}
            </p>
          </div>
          <div className="home-rise home-rise-2 mt-7">
            <Button variant="ember" size="lg" className="w-full" onClick={() => backOr(navigate, "/")}>
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!movement) return null;

  // ── Running ──────────────────────────────────────────────────────────────
  const total = session.movements.length;
  const sideLabel = movement.sides === 2 ? (side === 0 ? "Left side" : "Right side") : null;
  const ring = Math.min(100, Math.max(0, Math.round(((movement.holdSec - left) / movement.holdSec) * 100)));
  const blockLabel = session.blocks.find((b) => b.movements.includes(movement))?.label ?? "";
  const isLast = index + 1 === total && (movement.sides === 1 || side === 1);
  const alternative = swapMovement(session, movement, {
    context: source === "rest_day" ? "rest_day" : "post_workout",
    soreness,
  });

  return (
    <div className="min-h-full">
      <PageBar onBack={leave} title={`Recovery · ${describeLength(session.totalSec)}`} />
      <div className="px-4 pt-4 pb-6">
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
        <p className="sr-only" aria-live="polite">
          {blockLabel}. Movement {index + 1} of {total}: {movement.name}
          {sideLabel ? `, ${sideLabel}` : ""}.
        </p>

        <div className="home-rise mt-6">
          <p className="eyebrow-sm text-muted-foreground">
            {blockLabel}
            {movement.areas.length > 0 && ` · ${movement.areas.join(", ")}`}
          </p>
          <h2 className="mt-1 font-display font-black text-major leading-[1.06] tracking-tight text-balance">
            {movement.name}
          </h2>
          {/* Side is the one thing a timed stretch gets silently wrong: 30
              seconds shown, 60 actually required. It is stated, and both sides
              are already counted in the session total. */}
          {sideLabel && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.08] px-2.5 py-1 text-label font-bold text-gold">
              {sideLabel}
            </p>
          )}
        </div>

        <div className="home-rise home-rise-1 mt-6">
          <div className="surface-card surface-card-quiet flex flex-col items-center justify-center py-8">
            <div
              className="relative h-32 w-32 rounded-full grid place-items-center"
              style={{
                background: `conic-gradient(hsl(var(--gold)) ${ring}%, hsl(var(--border)) ${ring}%)`,
              }}
            >
              <div className="h-[7.25rem] w-[7.25rem] rounded-full bg-card grid place-items-center">
                <span className="font-display font-black text-beat tabular-nums">{clock(left)}</span>
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

        {/* Offered only when the library actually has another answer for the
            same areas — a control that sometimes does nothing is worse than no
            control. The target does not change; the route to it does. */}
        {alternative && (
          <button
            type="button"
            className="press mt-4 min-h-11 text-meta font-bold text-muted-foreground"
            onClick={() => {
              hapticSelection();
              void track(FUNNEL.recoverySwapped, {
                source,
                from: movement.id,
                to: alternative.id,
                areas: movement.areas,
              });
              setSwaps((s) => ({ ...s, [movement.id]: alternative.id }));
              setSide(0);
              armHold(alternative.holdSec);
            }}
          >
            Swap for {alternative.name.toLowerCase()}
          </button>
        )}

        <div className="home-rise home-rise-4 mt-6 flex gap-2">
          <Button
            variant="ghost"
            size="lg"
            className="shrink-0 px-4"
            aria-label="Previous movement"
            disabled={index === 0 && side === 0}
            onClick={() => { hapticImpact("light"); back(); }}
          >
            <ChevronLeft size={18} aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => {
              hapticImpact("light");
              if (running) {
                setHeldLeft(left);
                setDeadline(null);
              } else {
                armHold(Math.max(1, heldLeft ?? movement.holdSec));
              }
            }}
          >
            {running ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {running ? "Pause" : "Resume"}
          </Button>
          <Button
            variant="ember"
            size="lg"
            className="flex-1"
            onClick={() => { hapticImpact("light"); advance(); }}
          >
            {isLast ? (
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
          onClick={leave}
        >
          End session
        </Button>

        <p className="mt-4 text-label text-muted-foreground/75 text-center tabular-nums">
          {index + 1} of {total} ·{" "}
          {describeLength(session.movements.reduce((s, m) => s + movementSeconds(m), 0))} total
        </p>
      </div>
    </div>
  );
}
