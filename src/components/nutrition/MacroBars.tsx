import { cn } from "@/lib/utils";
import type { MacroSummary } from "@/components/nutrition/MacroRow";

/**
 * Three quiet meters under the diary's opening line. Protein carries the page's
 * one gold fill; carbs and fat stay neutral. Without targets the bars are
 * omitted and only the consumed figures render — a bar against nothing is a
 * lie. Each row is a real meter for screen readers.
 */
const ROWS: Array<{ key: keyof MacroSummary; label: string; gold?: boolean }> = [
  { key: "protein", label: "Protein", gold: true },
  { key: "carbs", label: "Carbs" },
  { key: "fat", label: "Fat" },
];

const fmt = (n: number) => (Number.isFinite(n) ? Math.round(n).toString() : "—");

const MacroBars = ({
  consumed,
  targets,
  className,
}: {
  consumed: MacroSummary;
  targets: MacroSummary | null;
  className?: string;
}) => (
  <div className={cn("space-y-2.5", className)}>
    {ROWS.map((r) => {
      const value = consumed[r.key];
      const target = targets?.[r.key] ?? null;
      const pct = target && target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : null;
      return (
        <div key={r.key}>
          <div className="flex items-baseline justify-between text-[12px]">
            <span className="font-bold">{r.label}</span>
            <span className="tabular-nums text-muted-foreground">
              <span className={cn("font-black text-foreground", r.gold && "text-gold")}>{fmt(value)}</span>
              {target != null && target > 0 ? ` / ${fmt(target)} g` : " g"}
            </span>
          </div>
          {pct != null && (
            <div
              role="meter"
              aria-label={`${r.label} ${fmt(value)} of ${fmt(target ?? 0)} grams`}
              aria-valuemin={0}
              aria-valuemax={target ?? 0}
              aria-valuenow={Math.min(value, target ?? 0)}
              className="mt-1 h-1.5 rounded-full surface-inset overflow-hidden"
            >
              <div
                className={cn("h-full rounded-full transition-[width] duration-500 ease-out", r.gold ? "bg-gold" : "bg-foreground/45")}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export default MacroBars;
