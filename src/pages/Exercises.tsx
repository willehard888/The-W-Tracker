import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Dumbbell, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import {
  useExerciseLibrary,
  getAllExercises,
  exerciseImg,
  type ExerciseEntry,
} from "@/lib/exercise-library";

const GROUPS: { label: string; muscles: string[] }[] = [
  { label: "Chest", muscles: ["chest"] },
  { label: "Back", muscles: ["lats", "middle back", "lower back", "traps", "neck"] },
  { label: "Shoulders", muscles: ["shoulders"] },
  { label: "Arms", muscles: ["biceps", "triceps", "forearms"] },
  { label: "Legs", muscles: ["quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors"] },
  { label: "Core", muscles: ["abdominals"] },
];

const CAP = 80;

const ExerciseThumb = ({ ex, size = 96 }: { ex: ExerciseEntry; size?: number }) => {
  const raw = ex.images?.[0];
  const src = exerciseImg(raw, size);
  if (!src) return <Dumbbell size={18} className="text-[hsl(260_18%_4%)]" strokeWidth={2.4} />;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
      onError={(e) => {
        const img = e.currentTarget;
        if (!img.dataset.fb && raw) { img.dataset.fb = "1"; img.src = raw; }
      }}
    />
  );
};

const ExerciseDetail = ({ ex, onBack }: { ex: ExerciseEntry; onBack: () => void }) => {
  const hero = exerciseImg(ex.images?.[ex.images.length - 1], 720);
  return (
    <div className="px-4 pt-3 pb-28">
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground active:scale-95 transition-transform"
      >
        <ArrowLeft size={15} /> All exercises
      </button>

      {hero && (
        <div className="rounded-2xl overflow-hidden border border-border/50 bg-secondary/30 mb-3">
          <img
            src={hero}
            alt={ex.name}
            loading="lazy"
            decoding="async"
            className="w-full h-auto max-h-72 object-contain bg-black/20"
            onError={(e) => {
              const img = e.currentTarget;
              const raw = ex.images?.[ex.images.length - 1];
              if (!img.dataset.fb && raw) { img.dataset.fb = "1"; img.src = raw; }
            }}
          />
        </div>
      )}

      <h1 className="font-display text-xl font-black tracking-tight leading-tight">{ex.name}</h1>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {[ex.equipment, ex.level, ex.mechanic].filter(Boolean).map((t) => (
          <span key={t as string} className="text-[10px] font-black uppercase tracking-wider text-gold bg-gold/10 border border-gold/25 rounded-full px-2 py-0.5">
            {t}
          </span>
        ))}
      </div>
      {(ex.primary.length > 0 || ex.secondary.length > 0) && (
        <p className="text-[11px] text-muted-foreground mt-2">
          <span className="font-bold text-foreground/80">Muscles:</span>{" "}
          {[...ex.primary, ...ex.secondary].join(", ")}
        </p>
      )}

      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85 mt-5 mb-2">How to perform</p>
      <ol className="space-y-2.5">
        {ex.instructions.map((step, i) => (
          <li key={i} className="flex gap-2.5 text-[13px] text-foreground/85 leading-snug">
            <span className="shrink-0 h-5 w-5 rounded-full bg-gold/15 text-gold text-[10px] font-black flex items-center justify-center mt-px">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

/** /exercises — browse the full illustrated exercise library with instructions. */
const Exercises = () => {
  const navigate = useNavigate();
  const ready = useExerciseLibrary();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [selected, setSelected] = useState<ExerciseEntry | null>(null);

  const all = useMemo(() => (ready ? getAllExercises() : []), [ready]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const g = GROUPS.find((x) => x.label === group);
    let list = all;
    if (g) list = list.filter((e) => e.primary.some((m) => g.muscles.includes(m)));
    if (q) list = list.filter((e) => e.name.toLowerCase().includes(q) || e.primary.some((m) => m.includes(q)));
    list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [all, query, group]);

  const capped = query || group ? filtered : filtered.slice(0, CAP);

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
            placeholder="Search 500+ exercises…"
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
                    "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black border transition-all active:scale-95",
                    active ? "bg-gold text-primary-foreground border-transparent" : "bg-secondary/40 border-border/50 text-muted-foreground",
                  )}
                >
                  {g ?? "All"}
                </button>
              );
            })}
          </div>
        </div>

        {!ready ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[72px] rounded-2xl bg-card/40 border border-border/40 skeleton-block" />
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {capped.map((ex) => (
                <button
                  key={ex.slug}
                  onClick={() => { hapticImpact("light"); setSelected(ex); }}
                  className="cv-row w-full text-left rounded-2xl border border-gold/20 bg-gradient-to-b from-gold/[0.04] via-card/95 to-card p-3 active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-xl overflow-hidden bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shrink-0">
                      <ExerciseThumb ex={ex} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-[14px] font-black leading-tight truncate">{ex.name}</p>
                      <p className="text-[11px] text-muted-foreground capitalize mt-0.5 truncate">
                        {ex.primary.join(", ")}{ex.equipment ? ` · ${ex.equipment}` : ""}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-gold/60 shrink-0" />
                  </div>
                </button>
              ))}
            </div>
            {capped.length === 0 && (
              <div className="text-center py-10">
                <p className="text-[12px] text-muted-foreground mb-3">
                  No exercises match{group ? " that search in this muscle group" : " that search"}.
                </p>
                <button
                  type="button"
                  onClick={() => { setQuery(""); setGroup(null); }}
                  className="inline-flex items-center rounded-lg border border-gold/30 bg-gold/[0.06] px-3 py-1.5 text-[11px] font-bold text-gold active:scale-95 transition"
                >
                  Clear search & filters
                </button>
              </div>
            )}
            {!query && !group && filtered.length > CAP && (
              <p className="text-center text-[11px] text-muted-foreground py-4">
                Showing {CAP} of {filtered.length}. Search or pick a muscle group to find more.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Exercises;
