import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X, Target, ChevronRight } from "lucide-react";
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

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-gold/25 bg-background px-4 pt-3 pb-8 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-center pb-2">
          <span className="h-1 w-9 rounded-full bg-foreground/20" aria-hidden />
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="eyebrow text-gold/85">
              {PILLAR_LABEL[pillar]} pillar
            </p>
            <p className="font-display text-2xl font-black tabular-nums leading-tight">
              {score == null ? "—" : `${score}/100`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-10 w-10 rounded-full flex items-center justify-center bg-card/70 border border-border/60 active:scale-95 transition"
          >
            <X size={16} />
          </button>
        </div>

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
                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-gold/10 border border-gold/30 px-2.5 py-1.5 text-[12px] font-bold text-gold active:scale-95 transition"
              >
                {l.action.label} <ChevronRight size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PillarSheet;
