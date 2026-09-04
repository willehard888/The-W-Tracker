import { Button } from "@/components/ui/button";
import MacroRow from "@/components/nutrition/MacroRow";
import type { TargetResult } from "@/lib/nutrition/targets";

const GOAL_COPY: Record<string, string> = {
  cut: "Fat loss: 15 % below maintenance, protein 2.2 g/kg to keep muscle.",
  gain: "Muscle gain: 10 % above maintenance, protein 2.0 g/kg.",
  maintain: "Maintenance, protein 1.6 g/kg.",
};

const ACTIVITY_COPY: Record<string, string> = {
  sedentary: "desk days",
  light: "light activity",
  moderate: "moderate activity",
  active: "active days",
  very_active: "athlete-level activity",
};

/**
 * The computed target as a PROPOSAL: the numbers, the formula in plain
 * words, and every assumption or safety rail that shaped them. Nothing is
 * saved from here — the caller confirms or adjusts.
 */
const TargetsProposal = ({
  result,
  sexAssumed,
  onUse,
  onAdjust,
  busy,
}: {
  result: TargetResult;
  /** Sex not set on the profile — the BMR used the male/female midpoint. */
  sexAssumed?: boolean;
  onUse: () => void;
  onAdjust: () => void;
  busy?: boolean;
}) => {
  if (!result.ok) {
    return (
      <div className="surface-card surface-card-quiet p-4">
        <p className="text-[15px] font-bold">
          {result.reason === "minor" ? "Calorie targets aren't set for under-18s" : "Add weight, height and age to get a proposal"}
        </p>
        <p className="text-[13px] text-muted-foreground mt-1 leading-snug">
          {result.reason === "minor"
            ? "You can still log meals and see what you eat — the coach will not put numbers on it."
            : "The proposal uses your athlete profile. You can also type targets by hand below."}
        </p>
      </div>
    );
  }

  const notes: string[] = [
    `${result.method === "katch" ? "Katch-McArdle (body-fat based)" : "Mifflin-St Jeor"} · BMR ${result.bmr} kcal · maintenance ${result.tdee} kcal with ${ACTIVITY_COPY[result.activity_level] ?? result.activity_level}.`,
    GOAL_COPY[result.goal] ?? "",
  ];
  if (sexAssumed) notes.push("Sex not set — using the average of the male and female formulas.");
  if (result.floor_applied) notes.push("Raised to the minimum we'll ever suggest — going lower needs a professional, not an app.");
  if (result.protein_capped) notes.push("Protein capped at 40 % of calories so the plan stays eatable.");

  return (
    <div className="surface-card p-4 space-y-4">
      <div>
        <p className="eyebrow text-gold/85 mb-1">Proposed targets</p>
        <p className="font-display text-[30px] font-black tracking-tight leading-none tabular-nums">
          {result.kcal.toLocaleString("en-US").replace(",", " ")}
          <span className="text-[15px] text-muted-foreground font-bold"> kcal / day</span>
        </p>
      </div>
      <MacroRow nutrition={{ calories: result.kcal, protein: result.protein_g, carbs: result.carbs_g, fat: result.fat_g }} />
      <ul className="space-y-1.5">
        {notes.filter(Boolean).map((n) => (
          <li key={n} className="text-[12px] text-muted-foreground leading-snug flex gap-1.5">
            <span className="text-gold/50 shrink-0">•</span>
            {n}
          </li>
        ))}
      </ul>
      <div className="flex gap-2 pt-1">
        <Button size="lg" className="flex-1" onClick={onUse} loading={busy} disabled={busy}>
          Use these targets
        </Button>
        <Button size="lg" variant="outline" onClick={onAdjust} disabled={busy}>
          Adjust
        </Button>
      </div>
    </div>
  );
};

export default TargetsProposal;
