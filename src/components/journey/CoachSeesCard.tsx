import { Sparkles, Target } from "lucide-react";
import type { WhealthSnapshot } from "@/hooks/use-whealth-snapshots";

/**
 * "What your coach sees" — the nightly engine's phrased observations + the
 * one focus for the next 7 days. Every line is grounded in computed numbers
 * (the LLM only phrases them), plus the measured patterns with sample sizes.
 */
const CoachSeesCard = ({ snapshot }: { snapshot: WhealthSnapshot }) => {
  if (!snapshot.observations.length && !snapshot.focus && !snapshot.patterns.length) return null;

  return (
    <div className="surface-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={13} className="text-gold" />
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-foreground/70">
          What your coach sees
        </p>
        <span className="ml-auto text-[9px] font-bold text-muted-foreground/60 tabular-nums">
          {snapshot.snapshotDate}
        </span>
      </div>

      {snapshot.observations.length > 0 && (
        <ul className="space-y-2 mb-3">
          {snapshot.observations.map((o, i) => (
            <li key={i} className="flex gap-2 text-[12px] text-foreground/90 leading-snug">
              <span className="h-1 w-1 rounded-full bg-gold/60 shrink-0 mt-1.5" />
              {o}
            </li>
          ))}
        </ul>
      )}

      {snapshot.patterns.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {snapshot.patterns.slice(0, 2).map((p) => (
            <p key={p.key} className="text-[11px] text-muted-foreground leading-snug">
              <span className="text-foreground/85 font-semibold">Your pattern:</span>{" "}
              {p.metric} {p.avgA}{p.unit} {p.aLabel} vs {p.avgB}{p.unit} {p.bLabel}
              <span className="text-muted-foreground/60"> (n={p.nA}/{p.nB})</span>
            </p>
          ))}
        </div>
      )}

      {snapshot.focus && (
        <div className="flex items-start gap-2 rounded-xl bg-gold/[0.07] border border-gold/25 px-3 py-2">
          <Target size={13} className="text-gold shrink-0 mt-0.5" />
          <p className="text-[12px] font-semibold text-foreground/95 leading-snug">{snapshot.focus}</p>
        </div>
      )}
    </div>
  );
};

export default CoachSeesCard;
