import { useMemo, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEGMENT_ACTIVE, SEGMENT_IDLE, SEGMENT_TRACK } from "@/components/ui/segment";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";
import ServingPicker, { type PortionState } from "@/components/nutrition/ServingPicker";
import NutrientPreview from "@/components/nutrition/NutrientPreview";
import { MEAL_SLOTS } from "@/lib/nutrition/slots";
import { parseQty, resolveGrams } from "@/lib/nutrition/resolve-grams";
import { scale } from "@/lib/nutrition/scale";
import { macroSummary } from "@/lib/nutrition/totals";
import type { Food, MealSlot } from "@/lib/nutrition/types";

export interface PortionCommit {
  portion: PortionState;
  grams: number;
  servingQty: number | null;
  approx: boolean;
}

const RESOLVE_COPY: Record<string, string> = {
  invalid_qty: "Enter an amount",
  too_large: "That's more than the engine will take",
  no_serving: "This serving has no weight — use grams",
  unit_unavailable: "That unit doesn't apply to this food",
  unknown_food: "Food not loaded",
};

/**
 * Amount → live nutrition → commit. Grams are resolved by the engine on every
 * keystroke and the preview is scaled from the food's per-100 g record, so
 * what the user sees is exactly what `log_meal` will snapshot. The commit
 * button is disabled while the amount cannot be resolved, with the reason
 * inline; nothing is ever saved with a guessed quantity.
 */
const PortionPanel = ({
  food,
  mode,
  slot,
  onSlotChange,
  initial,
  onCommit,
  onDelete,
  onDuplicate,
  busy,
}: {
  food: Food;
  mode: "add" | "edit";
  slot: MealSlot;
  onSlotChange: (slot: MealSlot) => void;
  initial?: PortionState;
  onCommit: (c: PortionCommit) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  busy?: boolean;
}) => {
  const defaultServing = food.servings.find((s) => s.id === food.defaultServingId) ?? food.servings.find((s) => s.grams != null) ?? null;
  const [portion, setPortion] = useState<PortionState>(
    initial ?? (defaultServing ? { qty: "1", unit: defaultServing.unit, servingId: defaultServing.id, customGrams: "" } : { qty: "100", unit: "g", servingId: null, customGrams: "" }),
  );

  const resolved = useMemo(
    () => resolveGrams(food, portion.qty, portion.unit, portion.servingId ?? undefined, portion.unit === "custom" ? (parseQty(portion.customGrams) ?? undefined) : undefined),
    [food, portion],
  );
  const grams = resolved.ok ? resolved.grams : 0;
  const preview = useMemo(() => macroSummary(scale(food.per100g, grams)), [food, grams]);
  const note = resolved.ok && resolved.approx ? "≈ millilitres counted as grams — this food has no density on record" : null;
  const reason = resolved.ok ? null : RESOLVE_COPY[resolved.error] ?? "Check the amount";
  const servingQty = portion.unit === "g" || portion.unit === "ml" || portion.unit === "custom" ? null : (parseQty(portion.qty) ?? null);
  const slotLabel = MEAL_SLOTS.find((s) => s.key === slot)?.label ?? "meal";

  return (
    <div className="space-y-5">
      <div>
        <p className="font-display text-[20px] font-black tracking-tight leading-tight">{food.name}</p>
        {food.brand && <p className="text-[13px] text-muted-foreground mt-0.5">{food.brand}</p>}
      </div>

      <ServingPicker food={food} value={portion} onChange={setPortion} />

      <NutrientPreview nutrition={preview} note={note} dim={!resolved.ok} />
      {reason && (
        <p role="status" className="text-[12px] text-[hsl(var(--ember))] -mt-3">
          {reason}
        </p>
      )}

      <div>
        <p className="eyebrow text-muted-foreground/80 mb-1.5">Meal</p>
        <div className={SEGMENT_TRACK} role="group" aria-label="Meal slot">
          {MEAL_SLOTS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={slot === s.key}
              onClick={() => {
                hapticSelection();
                onSlotChange(s.key);
              }}
              className={cn("press flex-1 h-11 rounded-lg text-[12px] font-black transition-all ", slot === s.key ? SEGMENT_ACTIVE : SEGMENT_IDLE)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        {mode === "edit" && onDelete && (
          <Button variant="ghost" size="icon" aria-label="Delete item" className="min-h-11 min-w-11 text-muted-foreground" onClick={onDelete} disabled={busy}>
            <Trash2 size={18} />
          </Button>
        )}
        {mode === "edit" && onDuplicate && (
          <Button variant="ghost" size="icon" aria-label="Duplicate item" className="min-h-11 min-w-11 text-muted-foreground" onClick={onDuplicate} disabled={busy}>
            <Copy size={18} />
          </Button>
        )}
        <Button
          size="lg"
          className="flex-1"
          disabled={!resolved.ok || busy}
          loading={busy}
          onClick={() => resolved.ok && onCommit({ portion, grams: resolved.grams, servingQty, approx: resolved.approx })}
        >
          {mode === "add" ? `Add to ${slotLabel}` : "Save"}
        </Button>
      </div>
    </div>
  );
};

export default PortionPanel;
