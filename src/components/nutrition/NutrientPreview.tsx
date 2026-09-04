import MacroRow, { type MacroSummary } from "@/components/nutrition/MacroRow";
import { cn } from "@/lib/utils";

/**
 * Live nutrition for the quantity being typed. Dims (instead of vanishing)
 * while the amount is invalid so the layout never jumps; carries the one
 * honesty note the engine can raise ("≈ ml counted as grams").
 */
const NutrientPreview = ({
  nutrition,
  note,
  dim,
  className,
}: {
  nutrition: MacroSummary;
  note?: string | null;
  dim?: boolean;
  className?: string;
}) => (
  <div className={cn("transition-opacity", dim && "opacity-40", className)} aria-live="polite">
    <MacroRow nutrition={nutrition} />
    {note && <p className="text-[11px] text-muted-foreground/80 mt-2 leading-snug">{note}</p>}
  </div>
);

export default NutrientPreview;
