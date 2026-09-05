import { BottomSheet } from "@/components/ui/sheet-bottom";
import { useNavigate } from "react-router-dom";
import { Target, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { pickLevers } from "@/lib/whealth-levers";
import type { PillarPart, PillarScores } from "@/lib/whealth-index";

const PILLAR_LABEL: Record<keyof PillarScores, string> = {
  sleep: "Sleep",
  recovery: "Recovery",
  movement: "Movement",
  nutrition: "Nutrition",
  mind: "Mind",
  inner: "Inner",
};

const partColor = (v: number) =>
  v >= 75 ? "bg-gold" : v >= 50 ? "bg-gold/70" : v >= 25 ? "bg-[hsl(var(--ember)/0.8)]" : "bg-destructive/70";

interface PillarSheetProps {
  pillar: keyof PillarScores;
  score: number | null;
  parts: PillarPart[];
  onClose: () => void;
}

/**
 * Pillar drill-down — the sub-signals behind a pillar score and the concrete
 * levers that move the weakest ones. Every number stays honest ("no data
 * yet" instead of fake zeros) and every lever deep-links into the app.
 */
const PillarSheet = ({ pillar, score, parts, onClose }: PillarSheetProps) => {
  const navigate = useNavigate();
  const levers = pickLevers(pillar, parts);

  return (
    <BottomSheet
      open
      onClose={onClose}
      label={`${PILLAR_LABEL[pillar]} pillar`}
      title={`${PILLAR_LABEL[pillar]} pillar`}
      subtitle={score == null ? "No data yet" : `${score}/100`}
    >
      <div className="pt-2 pb-2">
        {/* Sub-signals */}
        <p className="eyebrow text-foreground/60 mb-2">
          What drives it
        </p>
        <div className="space-y-2.5 mb-5">
          {parts.map((p) => (
            <div key={p.key} className="flex items-center gap-2.5">
              <p className="w-[128px] shrink-0 text-[12px] font-bold text-foreground/85 leading-tight">
                {p.label}
                <span className="block text-[10px] font-medium text-muted-foreground/60">
                  weight {p.weight}%
                </span>
              </p>
              <div className="flex-1 h-2 rounded-full bg-secondary/50 overflow-hidden">
                {p.score != null && (
                  <div className={cn("h-full rounded-full", partColor(p.score))} style={{ width: `${p.score}%` }} />
                )}
              </div>
              <p className="w-14 shrink-0 text-right text-[12px] font-black tabular-nums">
                {p.score == null
                  ? <span className="text-[10px] font-bold text-muted-foreground/50 normal-case">no data yet</span>
                  : p.score}
              </p>
            </div>
          ))}
        </div>

        {/* Levers */}
        <p className="eyebrow text-foreground/60 mb-2">
          Your biggest levers
        </p>
        <div className="space-y-2.5">
          {levers.map((l) => (
            <div key={l.partKey + l.title} className="rounded-xl border border-gold/25 bg-gold/[0.05] p-3">
              <div className="flex items-start gap-2">
                <Target size={13} className="text-gold shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold leading-tight">{l.title}</p>
                  <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{l.detail}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { hapticImpact("light"); onClose(); navigate(l.action.path); }}
                className="press mt-2 inline-flex items-center gap-1 rounded-lg bg-gold/10 border border-gold/30 px-2.5 py-1.5 text-[12px] font-bold text-gold transition"
              >
                {l.action.label} <ChevronRight size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
};

export default PillarSheet;
