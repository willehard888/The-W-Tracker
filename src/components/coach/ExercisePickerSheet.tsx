import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import { Input, SEARCH_FIELD } from "@/components/ui/input";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { Thumb } from "@/components/coach/FocusSessionSheet";
import { useEngine, useMuscleBalance, type Engine, type Focus, type SessionBlock } from "@/hooks/use-focus-session";
import { track, FUNNEL } from "@/lib/analytics";

/**
 * Pick a movement by hand: to swap one in a session, to add one to a day, or
 * to build a day from nothing. The list is the athlete's own safe pool (their
 * equipment, their injuries, the novice rules), from the same engine the coach
 * builds with, so a hand-picked session can be drawn, logged and progressed
 * like any other.
 * ponytail: the 137 coachable movements, not all 268 library entries; the rest
 * have no catalog identity for the logs. Widen when they get one.
 */
type PoolItem = ReturnType<Engine["poolFor"]>[number];

const FOCUS_LABEL: Record<Focus, string> = {
  chest: "Chest", back: "Back", shoulders: "Shoulders", biceps: "Biceps",
  triceps: "Triceps", legs: "Legs", glutes: "Glutes", core: "Core",
};
const PATTERN_LABEL: Record<PoolItem["pattern"], string> = {
  squat: "Squat", hinge: "Hinge", lunge: "Lunge",
  horizontal_push: "Press", vertical_push: "Overhead press",
  horizontal_pull: "Row", vertical_pull: "Pull-down",
  arm_biceps: "Curl", arm_triceps: "Triceps", shoulder_iso: "Shoulder isolation",
  chest_iso: "Fly", back_iso: "Back isolation", leg_iso: "Leg isolation", glute_iso: "Glute isolation",
  core: "Core",
};
const BIG_FIRST: Focus[] = ["legs", "back", "chest", "glutes", "shoulders", "core", "biceps", "triceps"];

// Module scope on purpose. Declared inside the sheet they were new component
// types on every render, so React unmounted and remounted all ~137 rows (and
// re-requested every thumbnail) on each keystroke and each chip tap.
type PickFn = (e: PoolItem, surface?: "picker") => void;
const Row = ({ e, surface, onPick }: { e: PoolItem; surface?: "picker"; onPick: PickFn }) => (
  // Off-screen rows are skipped by the engine: each thumbnail carries a
  // five-stage CSS filter, the expensive part of this list in WKWebView.
  <li style={{ contentVisibility: "auto", containIntrinsicSize: "auto 64px" }}>
    <button type="button" onClick={() => onPick(e, surface)} className="press w-full min-h-11 flex items-center gap-3 py-2.5 text-left">
      <Thumb slug={e.slug} name={e.name} />
      <span className="flex-1 min-w-0">
        <span className="block text-note font-bold leading-tight truncate">{e.name}</span>
        <span className="block text-meta text-muted-foreground mt-0.5 truncate">
          {PATTERN_LABEL[e.pattern]} · {e.focus.map((f) => FOCUS_LABEL[f]).join(", ")}
        </span>
      </span>
    </button>
  </li>
);
const Section = ({ label, items, surface, onPick }: { label: string; items: PoolItem[]; surface?: "picker"; onPick: PickFn }) =>
  items.length === 0 ? null : (
    <section>
      <h3 className="text-label font-bold text-muted-foreground mb-1">{label}</h3>
      <ul className="divide-y divide-border/35 border-y border-border/35">
        {items.map((e) => <Row key={e.slug} e={e} surface={surface} onPick={onPick} />)}
      </ul>
    </section>
  );

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Swapping: the same movement's siblings lead the list. */
  current?: { slug: string; name: string } | null;
  /** Movements already in the day. */
  exclude: string[];
  onPick: (block: SessionBlock, info: { sameKind: boolean; focus: Focus[] }) => void;
}

const ExercisePickerSheet = ({ open, onClose, title, current, exclude, onPick }: Props) => {
  const { engine, input, isLoading } = useEngine(open);
  const neglected = useMuscleBalance(open && !current);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [query, setQuery] = useState("");

  const { same, balance, all } = useMemo(() => {
    if (!engine) return { same: [] as PoolItem[], balance: [] as PoolItem[], all: [] as PoolItem[] };
    const taken = new Set([...exclude, current?.slug ?? ""]);
    const pool = engine.poolFor({ ...input, focus: engine.FOCUSES }).filter((e) => !taken.has(e.slug));
    const cur = current ? engine.SESSION_POOL[current.slug] : undefined;
    const ranked = current ? engine.swapCandidates({ ...input, focus: engine.FOCUSES, current: current.slug, exclude }) : [];
    return {
      same: cur ? ranked.filter((e) => e.pattern === cur.pattern) : [],
      // Two solid movements per neglected muscle, compounds before isolation.
      balance: current ? [] : neglected.flatMap((f) => pool.filter((e) => e.focus[0] === f).sort((a, b) => a.tier - b.tier).slice(0, 2)).slice(0, 4),
      all: [...pool].sort((a, b) => BIG_FIRST.indexOf(a.focus[0]) - BIG_FIRST.indexOf(b.focus[0]) || a.tier - b.tier || a.name.localeCompare(b.name)),
    };
  }, [engine, input.seed, input.experience, exclude.join("|"), current?.slug, neglected.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => all.filter((e) => (!focus || e.focus.includes(focus)) && (!q || e.name.toLowerCase().includes(q))),
    [all, focus, q],
  );
  const browsing = !focus && !q;

  const pick = (e: PoolItem, surface?: "picker") => {
    if (!engine) return;
    hapticImpact("light");
    const cur = current ? engine.SESSION_POOL[current.slug] : undefined;
    if (surface) void track(FUNNEL.balanceSuggestionUsed, { focus: e.focus[0], surface });
    onPick(engine.prescribe(e, input), { sameKind: !!cur && (cur.tier < 3) === (e.tier < 3), focus: e.focus });
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={title}
      title={title}
      subtitle={current ? `Instead of ${current.name}` : "From your equipment, around your injuries"}
      height="tall"
      headerExtra={
        <div className="px-4 pb-3 space-y-2.5">
          <div className="relative">
            <Search aria-hidden size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movements" {...SEARCH_FIELD}
              aria-label="Search movements"
              className="pl-9 text-copy"
            />
          </div>
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
            <Button type="button" size="pill" variant={focus === null ? "gold-outline" : "outline"} aria-pressed={focus === null} onClick={() => { hapticSelection(); setFocus(null); }}>
              All
            </Button>
            {BIG_FIRST.map((f) => (
              <Button key={f} type="button" size="pill" variant={focus === f ? "gold-outline" : "outline"} aria-pressed={focus === f} onClick={() => { hapticSelection(); setFocus(focus === f ? null : f); }}>
                {FOCUS_LABEL[f]}
              </Button>
            ))}
          </div>
        </div>
      }
    >
      {isLoading || !engine ? (
        <div className="py-16 flex justify-center text-muted-foreground" role="status" aria-label="Loading movements">
          <Loader2 aria-hidden size={18} className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-5 pb-2">
          {browsing && <Section label="Same movement" items={same} onPick={pick} />}
          {browsing && <Section label={`For balance: ${neglected.map((f) => FOCUS_LABEL[f].toLowerCase()).join(", ")}`} items={balance} surface="picker" onPick={pick} />}
          <Section label={browsing ? "All movements" : `${filtered.length} movement${filtered.length === 1 ? "" : "s"}`} items={filtered} onPick={pick} />
          {filtered.length === 0 && (
            <p className="py-10 text-center text-note text-muted-foreground">
              Nothing fits that. Clear the search, or add equipment in your profile.
            </p>
          )}
        </div>
      )}
    </BottomSheet>
  );
};

export default ExercisePickerSheet;
