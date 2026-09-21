// The Recover half of the Exercise & Recovery library.
//
// Three ways in, in the order people reach for them: a session built from what
// you trained, a routine picked by name (mobility, body care, breath, sleep,
// meditation), and every single movement to look up. A movement is a page of
// its own with the drawing or the pacer on it; a routine opens the runner.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Search, X } from "lucide-react";
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
  routineArt,
  routineMovements,
  routinesWith,
  type Routine,
} from "@/data/recovery-routines";
import { IllustrationPlayer, IllustrationThumb } from "@/components/coach/ExerciseIllustration";
import { BreathFigure, BreathPacer, ORB_PACE } from "@/components/recovery/StepVisual";

/**
 * The four shelves the founder asked for, by name: stretches, rolling,
 * breathing, meditation. A routine sits where its practice does, not where
 * its habit does — "4-7-8 in bed" ticks the sleep habit but is a breathing
 * exercise, and the sleep wind-downs are guided rest, so they file under
 * meditation. Guided sessions are listed as routines only: each one IS its
 * routine, and a second row for the same session would be a duplicate.
 */
type Section = {
  key: string;
  label: string;
  /** What the collapsed movement list is called. */
  noun: string;
  routine: (r: Routine) => boolean;
  item: (m: RecoveryMovement) => boolean;
};
const SECTIONS: Section[] = [
  { key: "stretch", label: "Stretching", noun: "stretches", routine: (r) => r.shelf === "mobility", item: (m) => itemShelf(m) === "mobility" },
  { key: "roll", label: "Rolling", noun: "rolling movements", routine: (r) => r.shelf === "body", item: (m) => itemShelf(m) === "body" },
  {
    key: "breath",
    label: "Breathing",
    noun: "patterns",
    routine: (r) => r.shelf === "breath" || r.id === "four-seven-eight-sleep",
    item: (m) => m.type === "breathing",
  },
  {
    key: "mind",
    label: "Meditation and sleep",
    noun: "sessions",
    routine: (r) => r.shelf === "mind" || (r.shelf === "sleep" && r.id !== "four-seven-eight-sleep"),
    item: () => false,
  },
];

/** The session a member is handed when they have not picked anything: the
 *  general opener the builder itself starts with. */
const BUILT_FOR_YOU_ART = { idNum: "0301", title: "Cat-cow" };

const routineSec = (r: Routine) => routineMovements(r).reduce((s, m) => s + movementSeconds(m), 0);

/**
 * The row picture. Every item is drawn — breathing and the guided sessions too,
 * where the two frames are the same body breathing out and in — so there is no
 * fallback here any more. A row that showed the shelf's glyph instead showed
 * the same picture as five other rows, which is not a picture.
 */
const ItemThumb = ({ m, size = 48 }: { m: RecoveryMovement; size?: number }) =>
  m.art ? <IllustrationThumb ex={{ idNum: m.art, title: m.name }} size={size} /> : null;

/** "45 s each side", "60 s", "10 min" — how long it runs. */
const holdLabel = (m: RecoveryMovement) =>
  m.type === "guided" ? describeLength(m.holdSec) : m.sides === 2 ? `${m.holdSec} s each side` : `${m.holdSec} s`;

/** Where it works, capitalised as a list; the time after it stays lower-case. */
const ItemMeta = ({ m }: { m: RecoveryMovement }) => (
  <>
    <span className="capitalize">
      {m.areas.length ? m.areas.join(", ") : m.type === "guided" ? "guided" : m.type === "breathing" ? "breathing" : "whole body"}
    </span>
    {` · ${holdLabel(m)}`}
  </>
);

const haystack = (m: RecoveryMovement) =>
  [m.name, m.type, m.equipment, ...m.areas, ...m.steps].join(" ").toLowerCase();

const RoutineRow = ({ r, onOpen }: { r: Routine; onOpen: () => void }) => {
  // A routine's picture is one of its own movements, drawn — never a shelf
  // glyph that six other routines would also show.
  const art = routineArt(r);
  return (
    <li>
      <button type="button" onClick={onOpen} className="press w-full min-h-11 flex items-center gap-3 py-2.5 text-left">
        {art && <IllustrationThumb ex={{ idNum: art, title: r.name }} size={48} />}
        <span className="flex-1 min-w-0">
          <span className="block text-note font-semibold leading-tight truncate">{r.name}</span>
          <span className="block text-meta text-muted-foreground leading-snug mt-0.5 truncate">{r.blurb}</span>
        </span>
        <span className="text-label font-bold text-muted-foreground tabular-nums shrink-0">{describeLength(routineSec(r))}</span>
      </button>
    </li>
  );
};

const ItemRow = ({ m, onOpen, lazy }: { m: RecoveryMovement; onOpen: () => void; lazy?: boolean }) => (
  <li style={lazy ? { contentVisibility: "auto", containIntrinsicSize: "auto 65px" } : undefined}>
    <button type="button" onClick={onOpen} className="press w-full min-h-11 flex items-center gap-3 py-2 text-left">
      <ItemThumb m={m} />
      <span className="flex-1 min-w-0">
        <span className="block text-note font-semibold leading-tight truncate">{m.name}</span>
        <span className="block text-meta text-muted-foreground leading-snug mt-0.5 truncate"><ItemMeta m={m} /></span>
      </span>
      <ChevronRight size={16} className="text-muted-foreground/75 shrink-0" aria-hidden />
    </button>
  </li>
);

/** Long lists start folded; a short one (the five breathing patterns) is shown outright. */
const FOLD_ABOVE = 12;

const ShelfSection = ({ section, onOpen }: { section: Section; onOpen: (id: string) => void }) => {
  const navigate = useNavigate();
  const routines = ROUTINES.filter(section.routine);
  const items = LIBRARY_ITEMS.filter(section.item);
  const [open, setOpen] = useState(items.length <= FOLD_ABOVE);
  return (
    <section aria-labelledby={`sec-${section.key}`} className="mb-7">
      <h2 id={`sec-${section.key}`} className="text-label font-bold text-muted-foreground mb-2">
        {section.label}
      </h2>
      <ul className="divide-y divide-border/35 border-y border-border/35">
        {routines.map((r) => (
          <RoutineRow key={r.id} r={r} onOpen={() => { hapticImpact("light"); navigate(`/recovery?routine=${r.id}`); }} />
        ))}
      </ul>
      {items.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => { hapticSelection(); setOpen((o) => !o); }}
            className="press mt-2 min-h-11 flex items-center gap-1 text-meta font-bold text-muted-foreground"
          >
            {open ? "Hide" : "All"} {items.length} {section.noun}
            <ChevronRight aria-hidden size={13} className={cn("transition-transform", open && "rotate-90")} />
          </button>
          {open && (
            <ul className="divide-y divide-border/35 border-t border-border/35">
              {items.map((m, i) => (
                <ItemRow key={m.id} m={m} onOpen={() => onOpen(m.id)} lazy={i >= 8} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};

export function RecoverList({ onOpen }: { onOpen: (id: string) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const hits = useMemo(() => (q ? LIBRARY_ITEMS.filter((m) => haystack(m).includes(q)) : []), [q]);
  const routineHits = useMemo(
    () => (q ? ROUTINES.filter((r) => `${r.name} ${r.blurb}`.toLowerCase().includes(q)) : []),
    [q],
  );

  const go = (path: string) => { hapticImpact("light"); navigate(path); };

  return (
    <>
      {/* Built for you: the session made from the last two days of training. */}
      <button
        type="button"
        onClick={() => go("/recovery?src=manual")}
        className="press w-full surface-card surface-card-quiet flex items-center gap-3 px-4 py-3.5 text-left mb-5"
      >
        <IllustrationThumb ex={BUILT_FOR_YOU_ART} size={44} />
        <span className="flex-1 min-w-0">
          <span className="block text-note font-bold leading-tight">Built for you</span>
          <span className="block text-meta text-muted-foreground leading-snug mt-0.5">
            A session from what you trained in the last two days
          </span>
        </span>
        <ChevronRight size={16} className="text-muted-foreground/75 shrink-0" aria-hidden />
      </button>

      <div className="relative mb-6">
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

      {q ? (
        <>
          <ul className="divide-y divide-border/35 border-y border-border/35">
            {routineHits.map((r) => (
              <RoutineRow key={r.id} r={r} onOpen={() => go(`/recovery?routine=${r.id}`)} />
            ))}
            {hits.map((m, i) => (
              <ItemRow key={m.id} m={m} onOpen={() => onOpen(m.id)} lazy={i >= 8} />
            ))}
          </ul>
          {hits.length + routineHits.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">Nothing matches. Try another word.</p>
          )}
        </>
      ) : (
        SECTIONS.map((section) => <ShelfSection key={section.key} section={section} onOpen={onOpen} />)
      )}

      <p className="mt-8 text-center text-label text-muted-foreground/75">
        Recovery drawings after Everkinetic · CC BY-SA 4.0
      </p>
    </>
  );
}

/**
 * A breathing pattern or a guided session on its own page: the drawing
 * breathing at the pattern's pace, with the ring under it for a pattern the
 * athlete follows. Its own clock, no session.
 */
const BreathPreview = ({ m }: { m: RecoveryMovement }) => {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const pace = m.pace ?? ORB_PACE;
  const elapsedMs = now - start;
  return (
    <div className="surface-card surface-card-quiet flex flex-col items-center px-4 pt-4 pb-6">
      {m.art && <BreathFigure art={m.art} title={m.name} pace={pace} elapsedMs={elapsedMs} running className="h-44 w-full mb-5" />}
      {m.pace && <BreathPacer pace={m.pace} elapsedMs={elapsedMs} running quiet={false} />}
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
          <p className="mt-1.5 text-dense text-muted-foreground">
            {[SHELF_LABEL[itemShelf(m)], m.equipment !== "none" ? m.equipment : null, holdLabel(m)].filter(Boolean).join(" · ")}
          </p>
          {m.areas.length > 0 && (
            <p className="text-dense text-muted-foreground">
              Where you feel it: <span className="capitalize">{m.areas.join(", ")}</span>
            </p>
          )}
        </header>

        <div className="home-rise home-rise-1 mt-4">
          {m.pace || m.cues ? (
            <BreathPreview m={m} />
          ) : m.art ? (
            <IllustrationPlayer ex={{ idNum: m.art, title: m.name }} playingLabel="Into position" />
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
