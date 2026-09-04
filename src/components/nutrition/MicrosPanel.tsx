import { cn } from "@/lib/utils";

export interface MicroRow {
  key: string;
  label: string;
  unit: string;
  /** null = no logged item carried this nutrient — rendered "—", never 0. */
  value: number | null;
  target?: number | null;
  /** How many of today's items lacked this nutrient (data-coverage hint). */
  missingCount?: number;
}

const fmtValue = (v: number, unit: string) => {
  if (!Number.isFinite(v)) return "—";
  const digits = unit === "ug" || v < 10 ? 1 : 0;
  return `${v.toFixed(digits)} ${unit === "ug" ? "µg" : unit}`;
};

/**
 * Every nutrient beyond the macro trio, one hairline row each. A bar appears
 * only where a target exists; an unknown value is shown as "—" because the
 * matched records simply did not carry it — showing 0 would claim a fact.
 */
const MicrosPanel = ({ rows, className }: { rows: MicroRow[]; className?: string }) => {
  if (rows.length === 0) {
    return <p className="text-[12px] text-muted-foreground px-1 py-3">Log a meal to see micronutrients.</p>;
  }
  return (
    <div className={cn("divide-y divide-border/35", className)}>
      {rows.map((r) => {
        const pct = r.target && r.target > 0 && r.value != null ? Math.min(100, (r.value / r.target) * 100) : null;
        return (
          <div key={r.key} className="py-2.5">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium truncate">{r.label}</span>
              <span className="tabular-nums text-muted-foreground shrink-0">
                <span className={cn("font-bold", r.value != null && "text-foreground")}>
                  {r.value == null ? "—" : fmtValue(r.value, r.unit)}
                </span>
                {r.target != null && r.target > 0 && ` / ${fmtValue(r.target, r.unit)}`}
              </span>
            </div>
            {pct != null && (
              <div
                role="meter"
                aria-label={`${r.label} ${Math.round(pct)} percent of target`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
                className="mt-1 h-1 rounded-full surface-inset overflow-hidden"
              >
                <div className="h-full rounded-full bg-foreground/45" style={{ width: `${pct}%` }} />
              </div>
            )}
            {r.value != null && (r.missingCount ?? 0) > 0 && (
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                {r.missingCount} item{r.missingCount === 1 ? "" : "s"} without {r.label.toLowerCase()} data
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MicrosPanel;
