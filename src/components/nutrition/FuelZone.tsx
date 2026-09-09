import { useRef, useState } from "react";
import { Camera, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import AnimatedNumber from "@/components/AnimatedNumber";
import NutritionSheet from "@/components/nutrition/NutritionSheet";
import { fmtKcal } from "@/lib/nutrition/format";
import { beatFor, kcalLeft, kcalProgress, subFor } from "@/lib/nutrition/day-copy";
import { fmtInt } from "@/lib/format";
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
  /** Meals logged today — already in the totals payload, free to show. */
  mealCount?: number;
  /** Query failed and there is no cached day — the zone renders nothing. */
  unavailable?: boolean;
  onOpenDiary: () => void;
  onOpenTargets: () => void;
  onLog: () => void;
  onPhoto: (file: File) => void;
}

const kcalOf = (m: MacroSummary | null) => Math.max(0, Math.round(m?.calories ?? 0));

/** One-time framing tip before the first scan; localStorage is a convenience, never a dependency. */
const TIP_KEY = "wf.scan_tip_seen";
const tipSeen = () => {
  try {
    return localStorage.getItem(TIP_KEY) === "1";
  } catch {
    return false;
  }
};
const markTipSeen = () => {
  try {
    localStorage.setItem(TIP_KEY, "1");
  } catch {
    /* private mode — the tip simply shows again */
  }
};

/**
 * Home's Fuel card: what is left of today, and the camera.
 *
 * It used to restate the diary's own opening line in 13 px and offer two
 * buttons that both landed on the diary, while a second door to the same
 * screen sat in the Library below — the founder read all of that as one thing
 * duplicated three ways. It now says what the diary header cannot fit: the
 * remaining number, the shape of the day as a rail, and the macros behind it.
 *
 * ACCENT DISCIPLINE — no gold here. Home's gold is the check-in hero and the
 * W-Index (stated in Index.tsx); the rail is neutral, and only the over-target
 * state borrows the destructive tint, because that one is a warning.
 *
 * The card is one press target (the overlay-button pattern: a card-wide button
 * under `pointer-events-none` content) whose destination is the day's next act
 * — log when nothing is logged, targets when there are none, the diary once
 * the day is under way. The camera is the one visible control.
 */
const FuelZone = ({ loading, totals, targets, state, mealCount = 0, unavailable, onOpenDiary, onOpenTargets, onLog, onPhoto }: FuelZoneProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tipOpen, setTipOpen] = useState(false);
  if (unavailable) return null;

  const kcal = kcalOf(totals);
  const targetKcal = targets ? Math.round(targets.calories) : null;
  const left = kcalLeft(kcal, targetKcal);
  const progress = kcalProgress(kcal, targetKcal);

  const act =
    state === "no_targets" ? { run: onOpenTargets, label: "Set your nutrition targets" }
    : state === "empty" ? { run: onLog, label: "Log your first meal today" }
    : { run: onOpenDiary, label: "Open your food diary" };

  const headline = (() => {
    if (loading) return <span className="text-muted-foreground/60">—</span>;
    if (state === "no_targets" || left === null) {
      return <span className="font-display font-black text-[17px] leading-none">{beatFor(state, kcal, targetKcal)}</span>;
    }
    if (state === "complete") {
      return (
        <span className="inline-flex items-center gap-1.5 font-display font-black text-[22px] leading-none">
          <Check size={18} aria-hidden strokeWidth={3} />
          Fueled.
        </span>
      );
    }
    return (
      <span className={cn("font-display font-black text-[22px] leading-none tabular-nums", left.over && "text-destructive")}>
        <AnimatedNumber value={left.value} format={fmtKcal} />
        <span className="text-[13px] font-bold text-muted-foreground ml-1.5">{left.over ? "kcal over" : "kcal left"}</span>
      </span>
    );
  })();

  return (
    <div className="surface-card surface-card-quiet relative">
      {/* Overlay button: one press target for the whole card, with the content
          above it and inert, so the camera can still be its own control
          without ever nesting a button inside a button. */}
      <button
        type="button"
        onClick={() => { hapticImpact("light"); act.run(); }}
        aria-label={act.label}
        className="absolute inset-0 rounded-2xl active:opacity-70 transition-opacity"
      />

      <div className="relative pointer-events-none px-4 py-3.5">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold text-muted-foreground/75">Fuel</p>
          {mealCount > 0 && (
            <span className="ml-auto text-[11px] font-bold text-muted-foreground/75 tabular-nums">
              {fmtInt(mealCount)} {mealCount === 1 ? "meal" : "meals"}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-3 min-h-11">
          {headline}
          <div className="ml-auto pointer-events-auto shrink-0">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Scan a meal photo"
              className="min-h-11 min-w-11"
              onClick={() => {
                hapticImpact("light");
                if (!tipSeen()) {
                  setTipOpen(true);
                  return;
                }
                fileRef.current?.click();
              }}
            >
              <Camera size={18} />
            </Button>
          </div>
        </div>

        {/* The day as one rail. Omitted without targets — a bar against
            nothing is the same lie MacroBars refuses to tell. */}
        {progress !== null && (
          <div
            role="meter"
            aria-label={`${fmtKcal(kcal)} of ${fmtKcal(targetKcal ?? 0)} kcal`}
            aria-valuemin={0}
            aria-valuemax={targetKcal ?? 0}
            aria-valuenow={Math.min(kcal, targetKcal ?? 0)}
            className="mt-2 h-[3px] rounded-full surface-inset overflow-hidden"
          >
            <div
              className={cn(
                "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 ease-out",
                left?.over ? "bg-destructive/70" : "bg-foreground/45",
              )}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}

        {/* The macros, once there is something to break down. An untouched
            day would read "0/160 · 0/260 · 0/80" — noise where a sentence
            says the same thing better. */}
        <p className="mt-2 text-[11px] text-muted-foreground/75 tabular-nums truncate">
          {targets && !loading && kcal > 0 ? (
            <>
              Protein <span className="font-bold text-foreground">{fmtInt(Math.round(totals?.protein ?? 0))}</span>/{fmtInt(Math.round(targets.protein))} ·{" "}
              Carbs <span className="font-bold text-foreground">{fmtInt(Math.round(totals?.carbs ?? 0))}</span>/{fmtInt(Math.round(targets.carbs))} ·{" "}
              Fat <span className="font-bold text-foreground">{fmtInt(Math.round(totals?.fat ?? 0))}</span>/{fmtInt(Math.round(targets.fat))} g
            </>
          ) : state === "empty" ? (
            beatFor(state, kcal, targetKcal)
          ) : (
            subFor(state, kcal, targetKcal, mealCount)
          )}
        </p>
      </div>

      <NutritionSheet open={tipOpen} onClose={() => setTipOpen(false)} title="Before you shoot" label="Photo tip">
        <p className="text-[15px] leading-snug">Put a fork or your hand next to the plate. Shoot from about 45°.</p>
        <p className="text-[12px] text-muted-foreground mt-2 leading-snug">A size reference is what turns a guess into a portion.</p>
        <Button
          size="lg"
          className="w-full mt-5"
          onClick={() => {
            markTipSeen();
            setTipOpen(false);
            fileRef.current?.click();
          }}
        >
          Got it
        </Button>
      </NutritionSheet>
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
  );
};

export default FuelZone;
