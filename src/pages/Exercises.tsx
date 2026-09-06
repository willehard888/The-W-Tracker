import { useMemo, useState } from "react";
// useParams: an exercise is a route (/exercises/:slug), so the coach can link
// straight to a movement and the phone's back gesture closes the detail
// instead of leaving the library entirely.
import { useNavigate, useParams } from "react-router-dom";
import { ChevronRight, Search, X } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import { cn } from "@/lib/utils";
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
    <div className="home-rise px-4 pt-4 pb-6">
    {/* The rep, played. Both states were already being fetched for the old
        side-by-side stills — this shows the movement between them. */}
    <IllustrationPlayer ex={ex} className="mb-4" />

    <h1 className="font-display text-xl font-black tracking-tight leading-tight">{ex.title}</h1>
    <div className="flex flex-wrap gap-1.5 mt-2">
      {[...ex.equipment, ex.type].filter(Boolean).map((t) => (
        <span key={t as string} className="eyebrow text-gold bg-gold/10 border border-gold/25 rounded-full px-2 py-0.5 capitalize">
          {t}
        </span>
      ))}
    </div>
    {(ex.primary.length > 0 || ex.secondary.length > 0) && (
      <p className="text-[12px] text-muted-foreground mt-2 capitalize">
        <span className="font-bold text-foreground/80 normal-case">Muscles:</span>{" "}
        {[...ex.primary, ...ex.secondary].join(", ")}
      </p>
    )}

    <p className="eyebrow text-gold/85 mt-5 mb-2">How to perform</p>
    <ol className="space-y-2.5">
      {ex.steps.map((step, i) => (
        <li key={i} className="flex gap-2.5 text-[13px] text-foreground/85 leading-snug">
          <span className="shrink-0 h-5 w-5 rounded-full bg-gold/15 text-gold text-[11px] font-black flex items-center justify-center mt-px">{i + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>

    {coachingFor(ex.slug) && (
      <>
        <div className="mt-6 h-px bg-gradient-to-r from-transparent via-gold/25 to-transparent" />
        <p className="eyebrow text-gold mt-5 mb-1">Coaching</p>
        <p className="text-[12px] text-muted-foreground mb-4 leading-snug">
          What a still picture can&rsquo;t show: the rhythm, the breathing, and the mistakes that actually happen.
        </p>
        <ExerciseCoachingBlock slug={ex.slug} />
      </>
    )}

    {/* The library now carries beginner technique guidance, so it carries the
        same line the rest of the app uses for it. */}
    <p className="mt-7 rounded-xl border border-border/40 bg-background/30 px-3 py-2.5 text-[11.5px] text-muted-foreground/80 leading-snug">
      Educational guidance &mdash; not medical advice. Start lighter than you think you need to,
      and stop if a movement causes pain.
    </p>
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
  if (selected) return <ExerciseDetail ex={selected} onBack={() => navigate("/exercises")} />;

  return (
    <div className="min-h-full">
      <PageBar title="Exercise library" onBack={() => navigate(-1)} />

      <div className="home-rise px-4 pt-4 pb-6">
        {/* Search */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${ILLUSTRATED_EXERCISES.length} exercises…`}
            className="w-full rounded-xl border border-border/50 bg-background/40 pl-9 pr-9 py-2.5 text-[13px] outline-none focus:border-gold/50 transition-colors"
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
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
                  onClick={() => { hapticImpact("light"); setGroup(g); }}
                  className={cn(
                    "press shrink-0 rounded-full px-3 py-1.5 text-[12px] font-black border transition-all ",
                    active ? "bg-gold text-primary-foreground border-transparent" : "bg-secondary/40 border-border/50 text-muted-foreground",
                  )}
                >
                  {g ?? "All"}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map((ex, i) => (
            <button
              key={ex.slug}
              onClick={() => { hapticImpact("light"); navigate(`/exercises/${ex.slug}`); }}
              style={i < 12 ? undefined : { contentVisibility: "auto", containIntrinsicSize: "auto 80px" }}
              className="press w-full text-left rounded-2xl border border-gold/20 bg-gradient-to-b from-gold/[0.04] via-card/95 to-card p-3 transition-transform"
            >
              <div className="flex items-center gap-3">
                <IllustrationThumb ex={ex} size={56} eager={i < 10} />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[14px] font-black leading-tight truncate">{ex.title}</p>
                  <p className="text-[12px] text-muted-foreground capitalize mt-0.5 truncate">
                    {ex.primary.join(", ")}{ex.equipment.length ? ` · ${ex.equipment.join(", ")}` : ""}
                  </p>
                </div>
                <ChevronRight size={16} className="text-gold/60 shrink-0" />
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">No exercises match — try another search.</p>
          )}
        </div>

        {/* CC BY-SA attribution — required by the illustration license. */}
        <p className="mt-8 text-center text-[11px] text-muted-foreground/50">
          Illustrations © Everkinetic · CC BY-SA 4.0
        </p>
      </div>
    </div>
  );
};

export default Exercises;
