import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";

export interface FoodResultView {
  id: string;
  name: string;
  brand?: string | null;
  /** Per 100 g, from the search row — may be missing for sparse records. */
  kcal?: number | null;
  protein?: number | null;
  /** Source code for the small provenance tag (fineli, usda_*, off, user, recipe). */
  source?: string;
  isFavorite?: boolean;
  isRecipe?: boolean;
}

const SOURCE_TAG: Record<string, string> = {
  fineli: "Fineli",
  usda_foundation: "USDA",
  usda_sr_legacy: "USDA",
  usda_branded: "USDA",
  off: "OFF",
  user: "Mine",
  recipe: "Recipe",
};

/**
 * One search hit: name, brand, the per-100 g kcal/protein pair and a
 * favourite star. The row itself is the pick target (≥ 44 pt); the star is a
 * separate 44 pt control so favouriting never accidentally logs.
 */
const FoodResultRow = ({
  food,
  onPick,
  onToggleFavorite,
}: {
  food: FoodResultView;
  onPick: (food: FoodResultView) => void;
  onToggleFavorite?: (food: FoodResultView) => void;
}) => {
  const tag = food.source ? SOURCE_TAG[food.source] : undefined;
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => onPick(food)}
        className="flex-1 min-w-0 min-h-11 py-2.5 text-left active:opacity-70 transition-opacity"
      >
        <p className="text-[15px] font-bold leading-tight truncate">{food.name}</p>
        <p className="text-[12px] text-muted-foreground leading-snug truncate">
          {food.brand ? `${food.brand} · ` : ""}
          {food.isRecipe ? "per serving" : "per 100 g"}
          {food.kcal != null && ` · ${Math.round(food.kcal)} kcal`}
          {food.protein != null && ` · P ${Math.round(food.protein)}`}
          {tag && <span className="eyebrow-sm ml-1.5 text-muted-foreground/70">{tag}</span>}
        </p>
      </button>
      {onToggleFavorite && (
        <button
          type="button"
          aria-label={food.isFavorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={!!food.isFavorite}
          onClick={() => {
            hapticSelection();
            onToggleFavorite(food);
          }}
          className={cn(
            "shrink-0 min-h-11 min-w-11 flex items-center justify-center active:scale-95 transition-transform",
            food.isFavorite ? "text-gold" : "text-muted-foreground/50",
          )}
        >
          <Star size={16} fill={food.isFavorite ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
};

export default FoodResultRow;
