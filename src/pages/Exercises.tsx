import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Dumbbell, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import {
  ILLUSTRATED_EXERCISES,
  type IllustratedExercise,
} from "@/data/exercises-illustrated";
import { IllustrationThumb, IllustrationHero } from "@/components/coach/ExerciseIllustration";

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

const ExerciseDetail = ({ ex, onBack }: { ex: IllustratedExercise; onBack: () => void }) => (
  <div className="px-4 pt-3 pb-28">
    <button
      onClick={onBack}
      className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground active:scale-95 transition-transform"
    >
      <ArrowLeft size={15} /> All exercises
    </button>

    <IllustrationHero ex={ex} className="mb-4" />

    <h1 className="font-display text-xl font-black tracking-tight leading-tight">{ex.title}</h1>
    <div className="flex flex-wrap gap-1.5 mt-2">
      {[...ex.equipment, ex.type].filter(Boolean).map((t) => (
        <span key={t as string} className="text-[11px] font-black uppercase tracking-wider text-gold bg-gold/10 border border-gold/25 rounded-full px-2 py-0.5 capitalize">
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
  </div>
);

const Exercises = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [selected, setSelected] = useState<IllustratedExercise | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const g = GROUPS.find((x) => x.label === group);
    let list = ILLUSTRATED_EXERCISES;
    if (g) list = list.filter((e) => e.primary.some((m) => g.match(m.toLowerCase())));
    if (q) {
      list = list.filter(
        (e) => e.title.toLowerCase().includes(q) || e.primary.some((m) => m.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [query, group]);

  if (selected) return <ExerciseDetail ex={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="flex flex-col">
      <div className="page-header-premium px-4 pt-3 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-[hsl(var(--gold)/0.12)] flex items-center justify-center">
            <Dumbbell size={14} className="text-gold" />
          </div>
          <h1 className="font-display text-base font-black">Exercise library</h1>
        </div>
      </div>

      <div className="px-4 pt-3 pb-28">
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
                    "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-black border transition-all active:scale-95",
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
              onClick={() => { hapticImpact("light"); setSelected(ex); }}
              style={i < 12 ? undefined : { contentVisibility: "auto", containIntrinsicSize: "auto 80px" }}
              className="w-full text-left rounded-2xl border border-gold/20 bg-gradient-to-b from-gold/[0.04] via-card/95 to-card p-3 active:scale-[0.99] transition-transform"
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
