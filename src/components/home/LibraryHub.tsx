import { useNavigate } from "react-router-dom";
import { Crown, ChevronRight, Utensils } from "lucide-react";
import { recipeSquare, recipeThumb } from "@/lib/recipe-images";
import { illustrationThumb } from "@/data/exercises-illustrated";
import { GOLD_LINES } from "@/components/coach/ExerciseIllustration";
import { hapticImpact } from "@/lib/haptics";

/**
 * LibraryHub — ONE premium card for everything the membership unlocks.
 * Replaces three stacked full-width buttons (Recipes, Exercise Library,
 * The Vault) that gave the home screen five same-weight cards in a row —
 * founder feedback: "liian paljon nappeja, yhdistä selkeästi ja arvokkaasti".
 * Gradient gold hairline frame = the app's flagship-surface language.
 */

const ROWS = [
  {
    key: "recipes",
    path: "/recipes",
    title: "Meal-prep recipes",
    sub: "High-protein bowls & plates",
    chip: "15",
  },
  {
    key: "exercises",
    path: "/exercises",
    title: "Exercise library",
    sub: "Illustrated technique guides, step by step",
    chip: "260+",
  },
  {
    key: "vault",
    path: "/vault",
    title: "The Vault",
    sub: "Courses: training, longevity, recovery, mind & inner work",
    chip: "Premium",
  },
] as const;

const RowThumb = ({ id }: { id: (typeof ROWS)[number]["key"] }) => {
  const base =
    "h-10 w-10 rounded-lg overflow-hidden shrink-0 relative bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center";
  if (id === "recipes") {
    return (
      <div className={base}>
        <Utensils size={16} className="text-[hsl(260_18%_4%)]" strokeWidth={2.6} />
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${recipeSquare("greek-chicken-bowl") ?? recipeThumb("greek-chicken-bowl")})` }}
        />
      </div>
    );
  }
  if (id === "exercises") {
    // The illustrated set's bench press (0042) in the same gold-line
    // treatment the library itself uses.
    return (
      <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 bg-black border border-gold/25 flex items-center justify-center">
        <img
          src={illustrationThumb("0042")}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain p-0.5"
          style={{ filter: GOLD_LINES }}
        />
      </div>
    );
  }
  return (
    <div className={base}>
      <Crown size={16} className="text-[hsl(260_18%_4%)]" strokeWidth={2.6} />
    </div>
  );
};

const LibraryHub = () => {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl p-px bg-gradient-to-br from-gold/50 via-gold/15 to-gold/30">
      <div className="rounded-[15px] bg-card/80 overflow-hidden">
        {/* Header — quiet, no chevron: the value statement, not a button */}
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shrink-0 shadow-[0_0_16px_-4px_hsl(var(--gold)/0.5)]">
            <Crown size={16} className="text-[hsl(260_18%_4%)]" strokeWidth={2.6} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85">
              The Library
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              Everything your membership unlocks
            </p>
          </div>
        </div>

        {ROWS.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={() => { hapticImpact("light"); navigate(row.path); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 border-t border-border/40 text-left active:bg-gold/[0.05] transition-colors"
          >
            <RowThumb id={row.key} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-bold leading-tight truncate">{row.title}</p>
                <span className="text-[9px] font-black text-gold bg-gold/10 border border-gold/30 rounded-full px-1.5 py-0.5 tabular-nums shrink-0">
                  {row.chip}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug truncate mt-0.5">{row.sub}</p>
            </div>
            <ChevronRight size={16} className="text-gold/60 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default LibraryHub;
