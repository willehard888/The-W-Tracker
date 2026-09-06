import { useMemo, useState } from "react";
// useParams: an exercise is a route (/exercises/:slug), so the coach can link
// straight to a movement and the phone's back gesture closes the detail
// instead of leaving the library entirely.
import { useNavigate, useParams } from "react-router-dom";
import { BookOpen, ChevronRight, Search, X } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { fmtInt } from "@/lib/format";
import { hapticImpact } from "@/lib/haptics";
import {
  ILLUSTRATED_EXERCISES,
  type IllustratedExercise,
} from "@/data/exercises-illustrated";
import { IllustrationThumb, IllustrationPlayer } from "@/components/coach/ExerciseIllustration";
import { ExerciseCoachingBlock } from "@/components/coach/ExerciseCoachingBlock";
import { coachingFor } from "@/data/exercise-coaching";

/**
 * /exercises — the curated illustrated library. Every entry ships two
 * consistent hand-drawn technique states (Start → Finish, rendered as gold
 * line art) + step-by-step instructions. Replaces the 542-photo browser whose
 * source photos came from hundreds of different gyms and read cheap no matter
 * the treatment (founder feedback, three rounds).
 *
 * One job: learn one movement. The detail is a beat (the name) over the one
 * hero (the rep, played); everything under it is type on the page.
 */

const GROUPS: Array<{ label: string; match: (m: string) => boolean }> = [
  { label: "Chest", match: (m) => m.includes("chest") },
  { label: "Back", match: (m) => /lats|back|trapezius|neck/.test(m) },
  { label: "Shoulders", match: (m) => /shoulder|deltoid/.test(m) },
  { label: "Arms", match: (m) => /biceps|triceps|arms|forearm/.test(m) },
  { label: "Legs", match: (m) => /quadriceps|hamstring|calves|glut/.test(m) },
  { label: "Core", match: (m) => /abdominal|oblique|core/.test(m) },
];

/**
 * Coaching prose, folded into the search index and memoised per slug.
 * "knees caving" and "hip hinge" are how people describe the problem they came
 * to fix, and neither phrase appears in any title, muscle name or step.
 */
const coachingTextCache = new Map<string, string>();
const coachingText = (slug: string) => {
  const cached = coachingTextCache.get(slug);
  if (cached !== undefined) return cached;
  const c = coachingFor(slug);
  const text = c
    ? [
        ...c.cues,
        ...c.setup,
        c.tempo,
        c.breathing,
        c.feelIt,
        c.easier,
        c.harder,
        ...c.mistakes.flatMap((m) => [m.error, m.fix]),
      ]
        .join(" ")
        .toLowerCase()
    : "";
  coachingTextCache.set(slug, text);
  return text;
};

const ExerciseDetail = ({ ex, onBack }: { ex: IllustratedExercise; onBack: () => void }) => (
  <div className="min-h-full">
    <PageBar onBack={onBack} />
    <div className="px-4 pt-4 pb-6">
      {/* The beat: the movement's name, and what it takes. */}
      <header className="home-rise">
        <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">{ex.title}</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground capitalize">
          {[...ex.equipment, ex.type].filter(Boolean).join(" · ")}
        </p>
        {(ex.primary.length > 0 || ex.secondary.length > 0) && (
          <p className="text-[13px] text-muted-foreground">
            Works <span className="capitalize">{[...ex.primary, ...ex.secondary].join(", ")}</span>
          </p>
        )}
      </header>

      {/* The hero: the rep, played. Both states were already being fetched
          for the old side-by-side stills — this shows the movement between them. */}
      <div className="home-rise home-rise-1 mt-4">
        <IllustrationPlayer ex={ex} />
      </div>

      <section className="home-rise home-rise-2 mt-5">
        <p className="text-[11px] font-bold text-muted-foreground mb-2">How to perform</p>
        <ol className="space-y-2.5">
          {ex.steps.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] text-foreground/85 leading-snug">
              <span className="shrink-0 w-5 text-[11px] font-black text-muted-foreground tabular-nums mt-px">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {coachingFor(ex.slug) && (
        <div className="home-rise home-rise-3 mt-6">
          <ExerciseCoachingBlock slug={ex.slug} />
        </div>
      )}

      {/* The library carries beginner technique guidance, so it carries the
          same line the rest of the app uses for it. */}
      <p className="mt-7 text-[11.5px] text-muted-foreground/80 leading-snug">
        Educational guidance &mdash; not medical advice. Start lighter than you think you need to,
        and stop if a movement causes pain.
      </p>
    </div>
  </div>
);

/** A slug that resolves to nothing: an old link, or a renamed movement. */
const ExerciseMissing = ({ onBack }: { onBack: () => void }) => (
  <div className="min-h-full">
    <PageBar onBack={onBack} />
    <div className="home-rise px-4 pt-4 pb-6">
      <EmptyState
        icon={BookOpen}
        title="This movement isn’t in the library"
        description="The link may be old, or the movement was renamed."
        action={<Button variant="outline" onClick={onBack}>Browse the library</Button>}
      />
    </div>
  </div>
);

const Exercises = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const g = GROUPS.find((x) => x.label === group);
    let list = ILLUSTRATED_EXERCISES;
    if (g) list = list.filter((e) => e.primary.some((m) => g.match(m.toLowerCase())));
    if (q) {
      // Equipment and the step text are searched too. "what can I do with a
      // kettlebell" and "hip hinge" were both dead queries when only the title
      // and the primary muscle were matched.
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.primary.some((m) => m.toLowerCase().includes(q)) ||
          e.secondary.some((m) => m.toLowerCase().includes(q)) ||
          e.equipment.some((it) => it.toLowerCase().includes(q)) ||
          e.steps.some((s) => s.toLowerCase().includes(q)) ||
          coachingText(e.slug).includes(q),
      );
    }
    return list;
  }, [query, group]);

  // An exercise is a route, not local state — so the coach can link straight to
  // a movement, the URL is shareable, and the phone's back gesture closes the
  // detail instead of leaving the library entirely.
  const selected = slug ? ILLUSTRATED_EXERCISES.find((e) => e.slug === slug) : undefined;
  const toList = () => navigate("/exercises");
  if (selected) return <ExerciseDetail ex={selected} onBack={toList} />;
  if (slug) return <ExerciseMissing onBack={toList} />;

  return (
    <div className="min-h-full">
      <PageBar title="Exercise library" onBack={() => navigate(-1)} />

      <div className="home-rise px-4 pt-4 pb-6">
        {/* Search */}
        <div className="relative mb-3">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${fmtInt(ILLUSTRATED_EXERCISES.length)} exercises…`}
            aria-label="Search exercises"
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

        {/* Muscle-group filter */}
        <div className="-mx-4 px-4 overflow-x-auto no-scrollbar mb-4">
          <div className="flex gap-1.5 w-max">
            {[null, ...GROUPS.map((g) => g.label)].map((g) => {
              const active = group === g;
              return (
                <button
                  key={g ?? "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => { hapticImpact("light"); setGroup(g); }}
                  className={cn(
                    // A 32 px pill; the invisible ::before lifts its target to the 44 pt floor.
                    "press relative shrink-0 rounded-full px-3 py-1.5 text-[12px] font-black border transition-colors",
                    "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
                    active ? "bg-gold text-primary-foreground border-transparent" : "bg-secondary/40 border-border/50 text-muted-foreground",
                  )}
                >
                  {g ?? "All"}
                </button>
              );
            })}
          </div>
        </div>

        <ul className="divide-y divide-border/35 border-t border-border/35">
          {filtered.map((ex, i) => (
            <li key={ex.slug} style={i < 12 ? undefined : { contentVisibility: "auto", containIntrinsicSize: "auto 65px" }}>
              <button
                type="button"
                onClick={() => { hapticImpact("light"); navigate(`/exercises/${ex.slug}`); }}
                className="press w-full min-h-11 flex items-center gap-3 py-2 text-left"
              >
                <IllustrationThumb ex={ex} size={48} eager={i < 10} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold leading-tight truncate">{ex.title}</span>
                  <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5 capitalize truncate">
                    {ex.primary.join(", ")}{ex.equipment.length ? ` · ${ex.equipment.join(", ")}` : ""}
                  </span>
                </span>
                <ChevronRight size={16} className="text-muted-foreground/60 shrink-0" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">No exercises match — try another search.</p>
        )}

        {/* CC BY-SA attribution — required by the illustration license. */}
        <p className="mt-8 text-center text-[11px] text-muted-foreground/50">
          Illustrations © Everkinetic · CC BY-SA 4.0
        </p>
      </div>
    </div>
  );
};

export default Exercises;
