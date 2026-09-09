import { Target } from "lucide-react";
import type { WhealthSnapshot } from "@/hooks/use-whealth-snapshots";
import { fmtDate } from "@/lib/format";

/**
 * "What your coach sees" — the nightly engine's phrased observations + the
 * one focus for the next 7 days. Every line is grounded in computed numbers
 * (the LLM only phrases them), plus the measured patterns with sample sizes.
 * A quiet card: the Whealth Index above it holds the page's gold.
 */
const CoachSeesCard = ({ snapshot }: { snapshot: WhealthSnapshot }) => {
  if (!snapshot.observations.length && !snapshot.focus && !snapshot.patterns.length) return null;

  return (
    <div className="surface-card surface-card-quiet p-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-[13px] font-bold">What your coach sees</p>
        <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{fmtDate(snapshot.snapshotDate + "T00:00:00")}</span>
      </div>

      {snapshot.observations.length > 0 && (
        <ul className="space-y-1.5">
          {snapshot.observations.map((o, i) => (
            <li key={i} className="flex gap-2 text-[13px] text-foreground/90 leading-snug">
              <span className="h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0 mt-2" aria-hidden />
              {o}
            </li>
          ))}
        </ul>
      )}

      {snapshot.patterns.length > 0 && (
        <div className="mt-2.5 space-y-1">
          {snapshot.patterns.slice(0, 2).map((p) => (
            <p key={p.key} className="text-[12px] text-muted-foreground leading-snug">
              <span className="text-foreground/85 font-semibold">Your pattern:</span>{" "}
              {p.metric} {p.avgA}{p.unit} {p.aLabel} vs {p.avgB}{p.unit} {p.bLabel}
              <span className="text-muted-foreground/60"> (n={p.nA}/{p.nB})</span>
            </p>
          ))}
        </div>
      )}

      {snapshot.focus && (
        <div className="flex items-start gap-2 mt-3 pt-2.5 border-t border-border/35">
          <Target size={13} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden />
          <p className="text-[13px] font-semibold text-foreground/95 leading-snug">{snapshot.focus}</p>
        </div>
      )}
    </div>
  );
};

export default CoachSeesCard;
