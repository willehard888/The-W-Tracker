import { CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MealItemView {
  id: string;
  name: string;
  brand?: string | null;
  /** "150 g" · "1½ servings · 45 g" — already formatted by the caller. */
  qtyLabel: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Queued offline, not yet on the server. */
  pending?: boolean;
  /** Landed on this render — plays the house "your choice landed" pop once. */
  isNew?: boolean;
}

const r = (n: number) => (Number.isFinite(n) ? Math.round(n) : 0);

/**
 * A logged item as a hairline row (feed-entry grammar, no card per item):
 * name and quantity on the left, kcal and the macro trio on the right. The
 * whole row is the tap target; edits open the portion panel.
 */
const MealItemRow = ({ item, onPress }: { item: MealItemView; onPress: (item: MealItemView) => void }) => (
  <button
    type="button"
    onClick={() => onPress(item)}
    className={cn(
      "w-full min-h-11 py-2.5 flex items-center gap-3 text-left active:opacity-70 transition-opacity",
      item.isNew && "commit-pop",
    )}
  >
    <div className="min-w-0 flex-1">
      <p className="text-[15px] font-bold leading-tight truncate">{item.name}</p>
      <p className="text-[12px] text-muted-foreground leading-snug truncate">
        {item.brand ? `${item.brand} · ` : ""}
        {item.qtyLabel}
      </p>
    </div>
    <div className="shrink-0 text-right">
      <p className="text-[15px] font-black tabular-nums leading-tight flex items-center justify-end gap-1.5">
        {item.pending && <CloudOff size={12} aria-label="Waiting to sync" className="text-muted-foreground" />}
        {r(item.kcal)}
        <span className="text-[11px] font-bold text-muted-foreground">kcal</span>
      </p>
      <p className="text-[11px] tabular-nums text-muted-foreground leading-snug">
        P {r(item.protein)} · C {r(item.carbs)} · F {r(item.fat)}
      </p>
    </div>
  </button>
);

export default MealItemRow;
