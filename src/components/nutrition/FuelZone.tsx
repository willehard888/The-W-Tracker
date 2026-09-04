import { useRef, type ReactNode } from "react";
import { Camera, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import AnimatedNumber from "@/components/AnimatedNumber";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import type { MacroSummary } from "@/components/nutrition/MacroRow";
import type { DayState } from "@/lib/nutrition/totals";

export interface FuelZoneProps {
  loading: boolean;
  /** Today's consumed macros; null while loading or on error. */
  totals: MacroSummary | null;
  /** Targets in force; null when the user has none yet. */
  targets: MacroSummary | null;
  state: DayState;
  /** Query failed and there is no cached day — the zone renders nothing. */
  unavailable?: boolean;
  onOpenDiary: () => void;
  onOpenTargets: () => void;
  onLog: () => void;
  onPhoto: (file: File) => void;
}

const kcalOf = (m: MacroSummary | null) => Math.max(0, Math.round(m?.calories ?? 0));

/**
 * Home's "Fuel" row: today's kcal and protein against target, and the two
 * ways in — log, or point the camera at a plate. A quiet standing-style row
 * with no gold of its own; Home's gold budget is spent on the check-in hero
 * and the W-Index, and this must never compete with either. The layout is
 * identical across every state so the cascade never shifts.
 */
const FuelZone = ({ loading, totals, targets, state, unavailable, onOpenDiary, onOpenTargets, onLog, onPhoto }: FuelZoneProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  if (unavailable) return null;

  const kcal = kcalOf(totals);
  const targetKcal = targets ? Math.round(targets.calories) : null;
  const protein = Math.round(totals?.protein ?? 0);
  const targetProtein = targets ? Math.round(targets.protein) : null;

  let line: ReactNode;
  if (loading) {
    line = <span className="text-[15px] font-black text-muted-foreground/60">—</span>;
  } else if (state === "no_targets") {
    line = (
      <span className="text-[13px] text-muted-foreground">
        <span className="font-black text-foreground tabular-nums">{kcal}</span> kcal logged ·{" "}
        <span className="font-bold text-foreground underline-offset-2 underline">Set targets</span>
      </span>
    );
  } else if (state === "empty") {
    line = (
      <span className="text-[13px] text-muted-foreground">
        Nothing logged yet · <span className="tabular-nums">{targetKcal}</span> kcal to go
      </span>
    );
  } else if (state === "complete") {
    line = (
      <span className="text-[13px] text-muted-foreground inline-flex items-center gap-1.5">
        <Check size={13} aria-hidden className="text-foreground" />
        <span className="font-black text-foreground">Fueled.</span>
        <span className="tabular-nums">{kcal} kcal · {protein} g protein</span>
      </span>
    );
  } else {
    line = (
      <span className="flex items-baseline gap-x-3 flex-wrap text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          <span className="font-display font-black text-[17px] text-foreground">
            <AnimatedNumber value={kcal} />
          </span>
          {targetKcal != null && ` / ${targetKcal}`} kcal
        </span>
        <span className="tabular-nums">
          <span className="font-display font-black text-[17px] text-foreground">
            <AnimatedNumber value={protein} />
          </span>
          {targetProtein != null && ` / ${targetProtein}`} g protein
        </span>
      </span>
    );
  }

  return (
    <div className="surface-card surface-card-quiet flex items-center">
      {/* No nested buttons: without targets the whole row is the "set targets" act. */}
      <button
        type="button"
        onClick={state === "no_targets" ? onOpenTargets : onOpenDiary}
        aria-label={state === "no_targets" ? "Set your nutrition targets" : "Open your food diary"}
        className="flex-1 min-w-0 min-h-14 px-4 py-3 text-left active:opacity-70 transition-opacity"
      >
        <p className="eyebrow text-muted-foreground/75 mb-0.5">Fuel</p>
        {line}
      </button>
      <div className="flex items-center gap-1 pr-2 shrink-0">
        <Button variant="outline" size="sm" className="min-h-11" onClick={onLog}>
          Log
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Scan a meal photo"
          className={cn("min-h-11 min-w-11")}
          onClick={() => {
            hapticImpact("light");
            fileRef.current?.click();
          }}
        >
          <Camera size={18} />
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onPhoto(f);
          }}
        />
      </div>
    </div>
  );
};

export default FuelZone;
