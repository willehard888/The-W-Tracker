import { cn } from "@/lib/utils";
import { SEGMENT_ACTIVE, SEGMENT_IDLE, SEGMENT_TRACK } from "@/components/ui/segment";
import { hapticSelection } from "@/lib/haptics";
import { availableUnits, parseQty } from "@/lib/nutrition/resolve-grams";
import { fmtQty } from "@/lib/nutrition/format";
import type { Food, Unit } from "@/lib/nutrition/types";

export interface PortionState {
  /** Raw text as typed — parsed with `parseQty` ("1,5", "1/2", "1 1/2" all work). */
  qty: string;
  unit: Unit;
  servingId: string | null;
  /** Grams per unit for the `custom` unit, as typed. */
  customGrams: string;
}

const QUICK_MASS = [50, 100, 150, 200];
const QUICK_SERVINGS = [0.5, 1, 1.5, 2];

/**
 * Unit pills, an amount field and four quick picks. Units come from the
 * engine (`availableUnits`), so a solid never offers "ml" and a food without
 * serving weights never offers a serving — the picker cannot produce an
 * amount the engine cannot resolve. Quick picks live in the house segmented
 * track (the batch scaler's grammar); the text field keeps the native decimal
 * keypad, no custom keypad to maintain.
 */
const ServingPicker = ({ food, value, onChange }: { food: Food; value: PortionState; onChange: (next: PortionState) => void }) => {
  const units = availableUnits(food);
  const massUnit = value.unit === "g" || value.unit === "ml";
  const qtyValid = parseQty(value.qty) !== null;

  type Pill = { key: string; label: string; unit: Unit; servingId: string | null };
  const pills: Pill[] = [
    ...(units.includes("g") ? [{ key: "g", label: "g", unit: "g" as Unit, servingId: null }] : []),
    ...(units.includes("ml") ? [{ key: "ml", label: "ml", unit: "ml" as Unit, servingId: null }] : []),
    ...food.servings
      .filter((s) => s.grams != null && s.unit !== "custom")
      .map((s) => ({ key: s.id, label: s.label, unit: s.unit as Unit, servingId: s.id })),
    ...(units.includes("custom") ? [{ key: "custom", label: "Custom", unit: "custom" as Unit, servingId: null }] : []),
  ];
  const activeKey = value.unit === "g" || value.unit === "ml" || value.unit === "custom" ? value.unit : value.servingId ?? value.unit;

  const isMass = (u: Unit) => u === "g" || u === "ml";
  /** Keep the typed amount within a unit family (g↔ml, serving↔serving); reset it when crossing families. */
  const qtyFor = (next: Pill) => (isMass(next.unit) === massUnit ? value.qty : isMass(next.unit) ? "100" : "1");
  const pick = (p: Pill) => {
    hapticSelection();
    onChange({ ...value, unit: p.unit, servingId: p.servingId, qty: qtyFor(p) });
  };

  const quick = massUnit ? QUICK_MASS : value.unit === "custom" ? [] : QUICK_SERVINGS;
  const qtyNumber = parseQty(value.qty);

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Unit" className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-0.5">
        {pills.map((p) => {
          const active = p.key === activeKey;
          return (
            <button
              key={p.key}
              type="button"
              aria-pressed={active}
              onClick={() => pick(p)}
              className={cn(
                "press shrink-0 min-h-11 px-4 rounded-full border text-[12px] font-bold transition-colors ",
                active ? "border-gold/50 bg-gold/[0.08] text-gold" : "border-border bg-transparent text-foreground",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex-1">
          <span className="sr-only">Amount</span>
          <input
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            value={value.qty}
            aria-invalid={!qtyValid}
            aria-label="Amount"
            onChange={(e) => onChange({ ...value, qty: e.target.value })}
            className={cn(
              "w-full surface-inset rounded-xl h-12 px-4 text-[20px] font-black tabular-nums outline-none focus:border-gold/50 transition-colors",
              !qtyValid && "border-destructive/60",
            )}
          />
        </label>
        <span className="text-[13px] font-bold text-muted-foreground shrink-0 min-w-[3rem]">
          {value.unit === "g" ? "g" : value.unit === "ml" ? "ml" : value.unit === "custom" ? "×" : qtyNumber === 1 ? "serving" : "servings"}
        </span>
      </div>

      {value.unit === "custom" && (
        <label className="flex items-center gap-3">
          <span className="text-[12px] font-bold text-muted-foreground shrink-0">grams per unit</span>
          <input
            type="text"
            inputMode="decimal"
            value={value.customGrams}
            aria-label="Grams per unit"
            onChange={(e) => onChange({ ...value, customGrams: e.target.value })}
            className="flex-1 surface-inset rounded-xl h-11 px-3 text-[15px] font-bold tabular-nums outline-none focus:border-gold/50"
          />
        </label>
      )}

      {quick.length > 0 && (
        <div className={SEGMENT_TRACK} role="group" aria-label="Quick amounts">
          {quick.map((q) => {
            const active = qtyNumber === q;
            return (
              <button
                key={q}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  hapticSelection();
                  onChange({ ...value, qty: String(q) });
                }}
                className={cn("press flex-1 h-11 rounded-lg text-[13px] font-black tabular-nums transition-all ", active ? SEGMENT_ACTIVE : SEGMENT_IDLE)}
              >
                {massUnit ? q : fmtQty(q)}
                {massUnit ? <span className="text-[10px] font-bold ml-0.5">{value.unit}</span> : "×"}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ServingPicker;
