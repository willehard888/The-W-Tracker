import { useNavigate } from "react-router-dom";
import { Crown, Utensils } from "lucide-react";
import { recipeSquare, recipeThumb } from "@/lib/recipe-images";
import { RECIPE_COUNT } from "@/data/library-counts";
import { GOLD_LINES } from "@/components/coach/gold-lines";
import { hapticImpact } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * LibraryHub — what the membership unlocks, as three doors in one strip.
 *
 * It was a card with a header line, a subtitle and a two-line row per door,
 * seventh on Home under the coach card and a pull-quote. Founder feedback,
 * twice: too many buttons and texts, move the Library up. The strip sits
 * directly under the standing row and says only what a door needs: the
 * thumb, the name, the count — and one gold chip for what is gated.
 *
 * Quiet surface tier: it is a content menu, not the day's work.
 */

const DOORS = [
  {
    key: "recipes",
    path: "/recipes",
    title: "Recipes",
    // One pinned literal (tested against RECIPES.length) instead of importing
    // the whole catalog onto Home's boot path.
    chip: String(RECIPE_COUNT),
    chipGold: false,
  },
  { key: "exercises", path: "/exercises", title: "Exercises", chip: "260+", chipGold: false },
  { key: "vault", path: "/vault", title: "Vault", chip: "Premium", chipGold: true },
] as const;

const Thumb = ({ id }: { id: (typeof DOORS)[number]["key"] }) => {
  if (id === "recipes") {
    return (
      <div className="h-9 w-9 rounded-lg overflow-hidden shrink-0 relative bg-secondary flex items-center justify-center">
        <Utensils aria-hidden size={15} className="text-muted-foreground" strokeWidth={2.4} />
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${recipeSquare("greek-chicken-bowl") ?? recipeThumb("greek-chicken-bowl")})` }}
        />
      </div>
    );
  }
  if (id === "exercises") {
    // The illustrated set's bench press (0042) in the gold-line treatment the
    // library itself uses. Literal path (= illustrationThumb("0042")):
    // importing that helper dragged the 170 KB catalog into the entry chunk.
    return (
      <div className="h-9 w-9 rounded-lg overflow-hidden shrink-0 bg-black border border-border flex items-center justify-center">
        <img src="/illustrations/0042.webp" alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-0.5" style={{ filter: GOLD_LINES }} />
      </div>
    );
  }
  return (
    <div className="h-9 w-9 rounded-lg shrink-0 bg-secondary flex items-center justify-center">
      <Crown aria-hidden size={15} className="text-muted-foreground" strokeWidth={2.4} />
    </div>
  );
};

const LibraryHub = () => {
  const navigate = useNavigate();
  return (
    // surface-card-quiet must follow surface-card in the class list — its own
    // CSS comment notes it only wins the shadow in that order.
    <div className="surface-card surface-card-quiet overflow-hidden grid grid-cols-3 divide-x divide-border/35">
      {DOORS.map((d) => (
        <button
          key={d.key}
          type="button"
          onClick={() => { hapticImpact("light"); navigate(d.path); }}
          className="press min-h-[4.5rem] flex flex-col items-center justify-center gap-1.5 px-2 py-3 text-center"
        >
          <Thumb id={d.key} />
          <span className="text-[12px] font-bold leading-none">{d.title}</span>
          <span
            className={cn(
              "text-[10px] font-black rounded-full px-1.5 py-0.5 tabular-nums leading-none border",
              d.chipGold ? "text-gold bg-gold/10 border-gold/30" : "text-muted-foreground bg-secondary/60 border-border",
            )}
          >
            {d.chip}
          </span>
        </button>
      ))}
    </div>
  );
};

export default LibraryHub;
