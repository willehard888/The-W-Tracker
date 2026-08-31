import { useNavigate } from "react-router-dom";
import { Crown, ChevronRight, Utensils } from "lucide-react";
import { recipeSquare, recipeThumb } from "@/lib/recipe-images";
import { illustrationThumb } from "@/data/exercises-illustrated";
import { GOLD_LINES } from "@/components/coach/ExerciseIllustration";
import { hapticImpact } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * LibraryHub — ONE card for everything the membership unlocks.
 * Replaces three stacked full-width buttons (Recipes, Exercise Library,
 * The Vault) that gave the home screen five same-weight cards in a row —
 * founder feedback: "liian paljon nappeja, yhdistä selkeästi ja arvokkaasti".
 *
 * Sits on the QUIET surface tier. It's the tallest block on Home and it's a
 * content menu, not the day's work — it should recede behind the check-in and
 * the coach rather than compete with them. Gold here is reserved for the one
 * chip that carries meaning (what's gated), not for every count.
 */

const ROWS = [
  {
    key: "recipes",
    path: "/recipes",
    title: "Meal-prep recipes",
    sub: "High-protein bowls & plates",
    chip: "15",
    /** Gold marks what's gated, not what's counted. */
    chipGold: false,
  },
  {
    key: "exercises",
    path: "/exercises",
    title: "Exercise library",
    sub: "Illustrated technique guides, step by step",
    chip: "260+",
    chipGold: false,
  },
  {
    key: "vault",
    path: "/vault",
    title: "The Vault",
    sub: "Courses: training, longevity, recovery, mind & inner work",
    chip: "Premium",
    chipGold: true,
  },
] as const;

const RowThumb = ({ id }: { id: (typeof ROWS)[number]["key"] }) => {
  const base =
    "h-10 w-10 rounded-lg overflow-hidden shrink-0 relative bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center";
  if (id === "recipes") {
    return (
      <div className={base}>
        <Utensils aria-hidden size={16} className="text-[hsl(260_18%_4%)]" strokeWidth={2.6} />
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
  // Outline rather than gold-filled: this card is on the quiet tier, and a
  // filled tile here was one of five competing for the same accent on Home.
  return (
    <div className="h-10 w-10 rounded-lg shrink-0 bg-gold/10 border border-gold/30 flex items-center justify-center">
      <Crown aria-hidden size={16} className="text-gold" strokeWidth={2.6} />
    </div>
  );
};

const LibraryHub = () => {
  const navigate = useNavigate();

  return (
    // surface-card-quiet must follow surface-card in the class list — its own
    // CSS comment notes it only wins the shadow in that order.
    <div className="surface-card surface-card-quiet overflow-hidden">
      <div className="relative">
        {/* Header — quiet, no chevron: the value statement, not a button */}
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
          <div className="h-9 w-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
            <Crown aria-hidden size={16} className="text-gold" strokeWidth={2.6} />
          </div>
          <div className="min-w-0">
            <p className="eyebrow !text-gold/85">The Library</p>
            <p className="text-[12px] text-muted-foreground leading-tight mt-0.5">
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
                <span
                  className={cn(
                    "text-[11px] font-black rounded-full px-1.5 py-0.5 tabular-nums shrink-0 border",
                    row.chipGold
                      ? "text-gold bg-gold/10 border-gold/30"
                      : "text-muted-foreground bg-secondary/60 border-border",
                  )}
                >
                  {row.chip}
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground leading-snug truncate mt-0.5">{row.sub}</p>
            </div>
            <ChevronRight aria-hidden size={16} className="text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default LibraryHub;
