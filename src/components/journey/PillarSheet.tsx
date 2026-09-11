import { BottomSheet } from "@/components/ui/sheet-bottom";
import { useNavigate } from "react-router-dom";
import { DoorRow } from "@/components/coach/rows";
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

interface PillarSheetProps {
  pillar: keyof PillarScores;
  score: number | null;
  parts: PillarPart[];
  onClose: () => void;
}

/**
 * Pillar drill-down — the sub-signals behind a pillar score and the concrete
 * levers that move the weakest ones. Every number stays honest ("no data
 * yet" instead of fake zeros) and every lever is a door into the app.
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
      subtitle={score == null ? "No data yet" : `${score} of 100`}
    >
      <div className="pt-2 pb-2">
        <p className="text-[11px] font-bold text-muted-foreground mb-2">What drives it</p>
        <div className="space-y-2.5 mb-5">
          {parts.map((p) => (
            <div key={p.key} className="flex items-center gap-2.5">
              <p className="w-[128px] shrink-0 text-[12px] font-bold text-foreground/85 leading-tight">
                {p.label}
                <span className="block text-[10px] font-medium text-muted-foreground/75">
                  weight {p.weight}%
                </span>
              </p>
              <div className="flex-1 h-2 rounded-full bg-secondary/50 overflow-hidden">
                {p.score != null && (
                  <div className="h-full rounded-full bg-gold/70" style={{ width: `${p.score}%` }} />
                )}
              </div>
              <p className="w-14 shrink-0 text-right text-[12px] font-black tabular-nums">
                {p.score == null
                  ? <span className="text-[10px] font-bold text-muted-foreground/75">no data yet</span>
                  : p.score}
              </p>
            </div>
          ))}
        </div>

        <p className="text-[11px] font-bold text-muted-foreground">Your biggest levers</p>
        <div className="divide-y divide-border/35 border-t border-border/35 mt-1">
          {levers.map((l) => (
            <DoorRow
              key={l.partKey + l.title}
              label={l.title}
              sub={l.detail}
              onClick={() => { hapticImpact("light"); onClose(); navigate(l.action.path); }}
            />
          ))}
        </div>
      </div>
    </BottomSheet>
  );
};

export default PillarSheet;
