import { useNavigate } from "react-router-dom";
import { ChevronRight, Utensils } from "lucide-react";
import VaultThumb from "@/components/vault/VaultThumb";
import { recipeSquare, recipeThumb } from "@/lib/recipe-images";
import { RECIPE_COUNT } from "@/data/library-counts";
import { hapticImpact } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * LibraryHub — ONE card for everything the membership unlocks.
 * Replaces three stacked full-width buttons (Recipes, Exercise Library,
 * The Vault) that gave the home screen five same-weight cards in a row —
 * founder feedback: "liian paljon nappeja, yhdistä selkeästi ja arvokkaasti".
 *
 * Content only: the Fuel diary row lived here too and was a second door to
 * /nutrition on a screen that already has the Fuel card — one screen, two rows
 * saying Fuel, same destination.
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
    // One pinned literal (tested against RECIPES.length) instead of importing
    // the whole catalog onto Home's boot path.
    chip: String(RECIPE_COUNT),
    /** Gold marks what's gated, not what's counted. */
    chipGold: false,
  },
  {
    // One library for training and recovery (founder: "yhdistä se exercise
    // and recover library"). Recovery is named in the title because it had
    // only contextual doors before and could not be found.
    key: "exercises",
    path: "/exercises",
    title: "Exercise & Recovery",
    sub: "Technique, stretching, breathing, sleep",
    chip: "350+",
    chipGold: false,
  },
  {
    key: "vault",
    path: "/vault",
    title: "The Vault",
    // Fits the row: eight shelves in a line that truncates after four read
    // "…recovery, tra…" on every phone.
    sub: "Wisdom, inner work, longevity and mind",
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
    // treatment the library itself uses. Literal path (= illustrationThumb
    // ("0042")): importing that helper dragged the 170 KB catalog into the
    // entry chunk.
    return (
      <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 bg-black border border-gold/25 flex items-center justify-center">
        <img
          src="/illustrations/gold/0042.webp"
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain p-0.5"
        />
      </div>
    );
  }
  // The Vault's own mark, drawn for this size: a cut gem in the app's gold,
  // so it holds its place next to a photo and a drawing.
  return (
    <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 border border-gold/25">
      <VaultThumb className="h-full w-full" />
    </div>
  );
};

const LibraryHub = () => {
  const navigate = useNavigate();

  return (
    // No card. Three hairline rows on the page — the grammar Messages and the
    // feed already use. The sub-lines went with the box: "High-protein bowls &
    // plates" under "Meal-prep recipes" was the title again in smaller type,
    // and the header restated the tab the rows already name. A menu row owes
    // you its name and its count.
    <div className="divide-y divide-border/35 border-y border-border/35">
      {ROWS.map((row) => (
        <button
          key={row.key}
          type="button"
          onClick={() => { hapticImpact("light"); navigate(row.path); }}
          className="w-full min-h-14 flex items-center gap-3 py-2.5 text-left active:opacity-70 transition-opacity"
        >
          <RowThumb id={row.key} />
          <p className="flex-1 min-w-0 text-note font-bold leading-tight truncate">{row.title}</p>
          <span
            className={cn(
              "text-label font-black rounded-full px-1.5 py-0.5 tabular-nums shrink-0 border",
              row.chipGold
                ? "text-gold bg-gold/10 border-gold/30"
                : "text-muted-foreground bg-secondary/60 border-border",
            )}
          >
            {row.chip}
          </span>
          <ChevronRight aria-hidden size={16} className="text-muted-foreground shrink-0" />
        </button>
      ))}
    </div>
  );
};

export default LibraryHub;
