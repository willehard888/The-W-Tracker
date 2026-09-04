/**
 * Protein leads, the rest recede — the macro grammar shared by the curated
 * recipe detail, the diary's nutrient previews and user recipes. One gold tile
 * (protein) and three quiet figures; callers pass plain per-serving or
 * per-portion numbers so the component knows nothing about foods or scaling.
 */
export interface MacroSummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const fmt = (n: number) => (Number.isFinite(n) ? Math.round(n).toString() : "—");

const MacroRow = ({ nutrition, className }: { nutrition: MacroSummary; className?: string }) => (
  <div className={["flex items-stretch gap-3", className].filter(Boolean).join(" ")}>
    <div className="rounded-2xl border border-gold/30 bg-gold/[0.07] px-4 py-3 shrink-0">
      <p className="font-display text-[30px] font-black leading-none text-gold tabular-nums">
        {fmt(nutrition.protein)}<span className="text-[17px]">g</span>
      </p>
      <p className="eyebrow text-muted-foreground mt-1.5">Protein</p>
    </div>
    <div className="flex-1 grid grid-cols-3 gap-x-3 gap-y-2 content-center">
      {[
        { v: fmt(nutrition.calories), l: "kcal" },
        { v: `${fmt(nutrition.carbs)}g`, l: "carbs" },
        { v: `${fmt(nutrition.fat)}g`, l: "fat" },
      ].map((m) => (
        <div key={m.l}>
          <p className="text-[15px] font-black leading-none tabular-nums">{m.v}</p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-1">{m.l}</p>
        </div>
      ))}
    </div>
  </div>
);

export default MacroRow;
