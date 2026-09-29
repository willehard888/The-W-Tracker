import { useState } from "react";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { useCommitPop } from "@/hooks/use-commit-pop";
import { decimalInput, stepReps, stepWeight } from "@/lib/training/runner";
import { fmtInt, fmtUnit, NBSP } from "@/lib/format";

// One set row, for both places a set is locked: the runner (/coach/session)
// and the program page's movement sheet. They used to differ — the page had
// one input triple that wrote set 1 forever — and a member could not record
// set 2 without starting the runner.

/** "62.5 kg" keeps its half; fmtInt would round a plate pair away. */
export const fmtKg = (n: number) => (Number.isInteger(n) ? fmtUnit(n, "kg") : `${n}${NBSP}kg`);
// A set logged without a load (bodyweight, a machine you didn't note) reads
// "6 reps", not "— × 6": the dash looked like a value that failed to save.
export const setLine = (w: string, r: string) =>
  w === ""
    ? (r === "" ? "—" : `${fmtInt(Number(r))} reps`)
    : `${fmtKg(Number(w))} × ${r === "" ? "—" : fmtInt(Number(r))}`;

/** `[−] value [+] unit` — two 44 pt targets around a typed field. */
export const Stepper = ({
  value,
  unit,
  inputMode,
  label,
  stepLabel,
  onChange,
  onStep,
}: {
  value: string;
  unit: string;
  inputMode: "decimal" | "numeric";
  label: string;
  /** e.g. "2.5 kg" → "Add 2.5 kg" / "Remove 2.5 kg". */
  stepLabel: string;
  onChange: (v: string) => void;
  onStep: (dir: 1 | -1) => void;
}) => (
  <div className="flex items-center gap-0.5">
    <Button variant="ghost" size="icon" aria-label={`Remove ${stepLabel}`} onClick={() => onStep(-1)}>
      <Minus size={16} aria-hidden />
    </Button>
    {/* type="text": a number field rejects the comma a Finnish keypad types
        and hands back "", which wiped the digits already entered. */}
    <input
      type="text"
      inputMode={inputMode}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(decimalInput(e.target.value))}
      className="surface-inset w-[4.25rem] min-h-11 rounded-lg px-1 text-center text-copy font-bold tabular-nums outline-none focus:ring-1 focus:ring-gold/50"
    />
    <Button variant="ghost" size="icon" aria-label={`Add ${stepLabel}`} onClick={() => onStep(1)}>
      <Plus size={16} aria-hidden />
    </Button>
    <span className="w-8 text-meta font-semibold text-muted-foreground">{unit}</span>
  </div>
);

/**
 * One prescribed set. Only the set being done right now is open: weight and
 * reps with plate-pair steppers and the Log button. A done set folds to one
 * line (Edit reopens it); a set still ahead is a number and a dash.
 */
export const SetRow = ({
  index,
  done,
  isCurrent,
  weight,
  reps,
  onChange,
  onLog,
  saving,
}: {
  index: number;
  done: boolean;
  isCurrent: boolean;
  weight: string;
  reps: string;
  /** Raised on every keystroke, so the draft outlives this component. */
  onChange: (weight: string, reps: string) => void;
  onLog: (weight: string, reps: string) => Promise<void>;
  saving: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  // The draft lives in the page now. It used to live here, and this component
  // unmounts when the movement changes — survivable while the runner was a
  // one-way cursor, not once an athlete can step away mid-set and come back.
  // setRowSeed still keeps a late history query from overwriting typing.
  const w = weight;
  const r = reps;
  const setW = (v: string) => onChange(v, r);
  const setR = (v: string) => onChange(w, v);
  // Springs once, on the set that just landed — never on rows loaded as done.
  const pop = useCommitPop(done);
  const expanded = (isCurrent && !done) || editing;

  const badge = (
    <span
      className={cn(
        "shrink-0 h-8 w-8 rounded-full text-meta font-black flex items-center justify-center",
        done
          ? "bg-xp-green/15 text-xp-green"
          : isCurrent
            ? "bg-gold/15 text-gold"
            : "border border-border/50 text-muted-foreground",
        pop && "commit-pop",
      )}
    >
      {done ? <Check size={14} aria-hidden /> : index}
    </span>
  );

  if (!expanded) {
    return (
      <div className="flex items-center gap-3 min-h-12 px-1">
        {badge}
        {done ? (
          <>
            <span className="flex-1 min-w-0 text-read font-bold tabular-nums">{setLine(weight, reps)}</span>
            <Button variant="ghost" size="sm" className="min-h-11 text-muted-foreground" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </>
        ) : (
          <span className="text-read font-bold text-muted-foreground/75">—</span>
        )}
      </div>
    );
  }

  const step = (apply: () => void) => { hapticImpact("light"); apply(); };

  return (
    <div
      className={cn(
        "rounded-2xl border px-2.5 py-2",
        done ? "border-border/50 bg-background/30" : "border-gold/45 bg-gold/[0.05]",
      )}
    >
      <div className="flex items-center gap-2">
        {badge}
        <Stepper
          value={w}
          unit="kg"
          inputMode="decimal"
          label={`Set ${index} weight in kilograms`}
          stepLabel="2.5 kg"
          onChange={(v) => setW(v)}
          onStep={(d) => step(() => setW(String(stepWeight(w, d))))}
        />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="w-8 shrink-0" aria-hidden />
        <Stepper
          value={r}
          unit="reps"
          inputMode="numeric"
          label={`Set ${index} reps`}
          stepLabel="1 rep"
          onChange={(v) => setR(v)}
          onStep={(d) => step(() => setR(String(stepReps(r, d))))}
        />
        <Button
          variant="ember"
          size="sm"
          className="ml-auto min-h-11 min-w-16 shrink-0"
          disabled={saving}
          onClick={async () => { await onLog(w, r); setEditing(false); }}
        >
          {saving ? <Loader2 aria-hidden size={13} className="animate-spin" /> : done ? "Save" : "Lock"}
        </Button>
      </div>
    </div>
  );
};
