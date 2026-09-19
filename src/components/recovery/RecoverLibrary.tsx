// The Recover half of the Exercise & Recovery library.
//
// Three ways in, in the order people reach for them: a session built from what
// you trained, a routine picked by name (mobility, body care, breath, sleep,
// meditation), and every single movement to look up. A movement is a page of
// its own with the drawing or the pacer on it; a routine opens the runner.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ChevronRight, CircleDot, Moon, Search, Sparkles, Waves, X, type LucideIcon } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { describeLength } from "@/lib/recovery/build-session";
import { movementSeconds, type RecoveryMovement } from "@/data/recovery";
import {
  LIBRARY_ITEMS,
  ROUTINES,
  SHELF_LABEL,
  itemShelf,
  routineMovements,
  routinesWith,
  type Routine,
  type Shelf,
} from "@/data/recovery-routines";
import { IllustrationPlayer, IllustrationThumb } from "@/components/coach/ExerciseIllustration";
import { BreathPacer } from "@/components/recovery/StepVisual";

const SHELVES: Shelf[] = ["mobility", "body", "breath", "sleep", "mind"];
const SHELF_SHORT: Record<Shelf, string> = {
  mobility: "Mobility",
  body: "Body care",
  breath: "Breath",
  sleep: "Sleep",
  mind: "Meditation",
};
const SHELF_ICON: Record<Shelf, LucideIcon> = {
  mobility: Activity,
  body: CircleDot,
  breath: Waves,
  sleep: Moon,
  mind: Sparkles,
};

const routineSec = (r: Routine) => routineMovements(r).reduce((s, m) => s + movementSeconds(m), 0);

/** The row picture: the drawing when there is one, the shelf's mark otherwise. */
const ItemThumb = ({ m, size = 48 }: { m: RecoveryMovement; size?: number }) => {
  if (m.art) return <IllustrationThumb ex={{ idNum: m.art, title: m.name }} size={size} />;
  const Icon = SHELF_ICON[itemShelf(m)];
  return (
    <div
      aria-hidden
      className="shrink-0 rounded-xl border border-gold/25 bg-black grid place-items-center"
      style={{ width: size, height: size }}
    >
      <Icon size={18} className="text-gold/80" strokeWidth={1.8} />
    </div>
  );
};

/** "45 s each side", "60 s", "10 min" — how long it runs. */
const holdLabel = (m: RecoveryMovement) =>
  m.type === "guided" ? describeLength(m.holdSec) : m.sides === 2 ? `${m.holdSec} s each side` : `${m.holdSec} s`;

const itemMeta = (m: RecoveryMovement) => {
  const where = m.areas.length ? m.areas.join(", ") : m.type === "guided" ? "guided" : m.type === "breathing" ? "breathing" : "whole body";
  return `${where} · ${holdLabel(m)}`;
};

const haystack = (m: RecoveryMovement) =>
  [m.name, m.type, m.equipment, ...m.areas, ...m.steps].join(" ").toLowerCase();

export function RecoverList({ onOpen }: { onOpen: (id: string) => void }) {
  const navigate = useNavigate();
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [query, setQuery] = useState("");

  const routines = useMemo(() => ROUTINES.filter((r) => !shelf || r.shelf === shelf), [shelf]);
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LIBRARY_ITEMS.filter(
      (m) =>
        (!shelf || itemShelf(m) === shelf || (shelf === "sleep" && routinesWith(m.id).some((r) => r.shelf === "sleep"))) &&
        (!q || haystack(m).includes(q)),
    );
  }, [shelf, query]);

  const go = (path: string) => { hapticImpact("light"); navigate(path); };

  return (
    <>
      {/* Built for you: the session made from the last two days of training. */}
      <button
        type="button"
        onClick={() => go("/recovery?src=manual")}
        className="press w-full surface-card surface-card-quiet flex items-center gap-3 px-4 py-3.5 text-left mb-5"
      >
        <div className="h-11 w-11 shrink-0 rounded-xl border border-gold/30 bg-black grid place-items-center" aria-hidden>
          <Waves size={18} className="text-gold" />
        </div>
        <span className="flex-1 min-w-0">
          <span className="block text-note font-bold leading-tight">Built for you</span>
          <span className="block text-meta text-muted-foreground leading-snug mt-0.5">
            A session from what you trained in the last two days
          </span>
        </span>
        <ChevronRight size={16} className="text-muted-foreground/75 shrink-0" aria-hidden />
      </button>

      <div className="-mx-4 px-4 overflow-x-auto no-scrollbar mb-4">
        <div className="flex gap-1.5 w-max">
          {[null, ...SHELVES].map((s) => {
            const active = shelf === s;
            return (
              <button
                key={s ?? "all"}
                type="button"
                aria-pressed={active}
                onClick={(e) => {
                  hapticImpact("light");
                  setShelf(s);
                  // The last pills sit past the edge; the chosen one comes into view.
                  e.currentTarget.scrollIntoView?.({ inline: "nearest", block: "nearest", behavior: "smooth" });
                }}
                className={cn(
                  "press relative shrink-0 rounded-full px-3 py-1.5 text-meta font-black border transition-colors",
                  "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
                  active ? "bg-gold/[0.12] text-gold border-gold/50" : "bg-secondary/40 border-border/50 text-muted-foreground",
                )}
              >
                {s ? SHELF_SHORT[s] : "All"}
              </button>
            );
          })}
        </div>
      </div>

      {!query && (
        <section aria-labelledby="routines-h" className="mb-6">
          <h2 id="routines-h" className="text-label font-bold text-muted-foreground mb-2">Routines</h2>
          <ul className="divide-y divide-border/35 border-y border-border/35">
            {routines.map((r) => {
              const Icon = SHELF_ICON[r.shelf];
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => go(`/recovery?routine=${r.id}`)}
                    className="press w-full min-h-11 flex items-center gap-3 py-2.5 text-left"
                  >
                    <div className="h-12 w-12 shrink-0 rounded-xl border border-gold/25 bg-black grid place-items-center" aria-hidden>
                      <Icon size={18} className="text-gold/80" strokeWidth={1.8} />
                    </div>
                    <span className="flex-1 min-w-0">
                      <span className="block text-note font-semibold leading-tight truncate">{r.name}</span>
                      <span className="block text-meta text-muted-foreground leading-snug mt-0.5 truncate">{r.blurb}</span>
                    </span>
                    <span className="text-label font-bold text-muted-foreground tabular-nums shrink-0">
                      {describeLength(routineSec(r))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <h2 className="text-label font-bold text-muted-foreground mb-2">
        {shelf ? SHELF_LABEL[shelf] : "Every movement"}
      </h2>
      <div className="relative mb-3">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stretches, breathing, sleep…"
          aria-label="Search recovery"
          className="pl-9 pr-11"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-0 top-0 h-10 min-w-11 flex items-center justify-center text-muted-foreground"
          >
            <X size={15} />
          </button>
        )}
      </div>
      <ul className="divide-y divide-border/35 border-t border-border/35">
        {items.map((m, i) => (
          <li key={m.id} style={i < 8 ? undefined : { contentVisibility: "auto", containIntrinsicSize: "auto 65px" }}>
            <button
              type="button"
              onClick={() => onOpen(m.id)}
              className="press w-full min-h-11 flex items-center gap-3 py-2 text-left"
            >
              <ItemThumb m={m} />
              <span className="flex-1 min-w-0">
                <span className="block text-note font-semibold leading-tight truncate">{m.name}</span>
                <span className="block text-meta text-muted-foreground leading-snug mt-0.5 capitalize truncate">{itemMeta(m)}</span>
              </span>
              <ChevronRight size={16} className="text-muted-foreground/75 shrink-0" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-10">Nothing matches. Try another word.</p>
      )}

      <p className="mt-8 text-center text-label text-muted-foreground/75">
        Recovery drawings after Everkinetic · CC BY-SA 4.0
      </p>
    </>
  );
}

/** A breathing pattern, breathing, on its detail page: its own clock, no session. */
const PacerPreview = ({ pace }: { pace: NonNullable<RecoveryMovement["pace"]> }) => {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="surface-card surface-card-quiet flex justify-center py-7">
      <BreathPacer pace={pace} elapsedMs={now - start} running quiet={false} />
    </div>
  );
};

export function RecoverDetail({ m, onBack }: { m: RecoveryMovement; onBack: () => void }) {
  const navigate = useNavigate();
  const inRoutines = routinesWith(m.id);
  return (
    <div className="min-h-full">
      <PageBar onBack={onBack} />
      <div className="px-4 pt-4 pb-6">
        <header className="home-rise">
          <h1 className="font-display font-black text-beat leading-[1.04] tracking-tight">{m.name}</h1>
          <p className="mt-1.5 text-dense text-muted-foreground capitalize">
            {[SHELF_LABEL[itemShelf(m)], m.equipment !== "none" ? m.equipment : null, holdLabel(m)].filter(Boolean).join(" · ")}
          </p>
          {m.areas.length > 0 && (
            <p className="text-dense text-muted-foreground">
              Where you feel it: <span className="capitalize">{m.areas.join(", ")}</span>
            </p>
          )}
        </header>

        <div className="home-rise home-rise-1 mt-4">
          {m.art ? (
            <IllustrationPlayer ex={{ idNum: m.art, title: m.name }} playingLabel="Into position" />
          ) : m.pace ? (
            <PacerPreview pace={m.pace} />
          ) : null}
        </div>

        <section className="home-rise home-rise-2 mt-5">
          <p className="text-label font-bold text-muted-foreground mb-2">How to do it</p>
          <ol className="space-y-2.5">
            {m.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-dense text-foreground/85 leading-snug">
                <span className="shrink-0 w-5 text-label font-black text-muted-foreground tabular-nums mt-px">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {m.caution && <p className="mt-3 text-dense text-muted-foreground leading-snug">{m.caution}</p>}
        </section>

        {m.cues && (
          <section className="home-rise home-rise-3 mt-6">
            <p className="text-label font-bold text-muted-foreground mb-2">The script</p>
            <ol className="space-y-2">
              {m.cues.map(([at, text]) => (
                <li key={at} className="flex gap-3 text-dense leading-snug">
                  <span className="shrink-0 w-10 text-label text-muted-foreground tabular-nums mt-px">
                    {Math.floor(at / 60)}:{String(at % 60).padStart(2, "0")}
                  </span>
                  <span className="text-foreground/85">{text}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {inRoutines.length > 0 && (
          <section className="home-rise home-rise-3 mt-6">
            <p className="text-label font-bold text-muted-foreground mb-1">Do it in a routine</p>
            <ul className="divide-y divide-border/35 border-y border-border/35">
              {inRoutines.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => { hapticSelection(); navigate(`/recovery?routine=${r.id}`); }}
                    className="press w-full min-h-11 flex items-center gap-3 py-2.5 text-left"
                  >
                    <span className="flex-1 min-w-0 text-note font-semibold truncate">{r.name}</span>
                    <span className="text-label text-muted-foreground tabular-nums">{describeLength(routineSec(r))}</span>
                    <ChevronRight size={16} className="text-muted-foreground/75 shrink-0" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-7 text-meta text-muted-foreground/80 leading-snug">
          Educational guidance &mdash; not medical advice. Ease off anything that hurts rather than stretches.
        </p>
      </div>
    </div>
  );
}
