import { useMemo, useState } from "react";
import { Zap, ArrowRight } from "lucide-react";
import { type Protocol } from "@/lib/wellness-framework";
import { pickFreeTierMove } from "@/lib/coach/pick-free-move";
import EvidenceChip from "@/components/coach/EvidenceChip";
import ProtocolSheet from "@/components/coach/ProtocolSheet";

/**
 * Card 2 — Liike (Move).
 *
 * Surfaces the single highest-leverage protocol to learn and apply today,
 * picked from PROTOCOLS by weakest pillar + time of day (rule-based, no AI,
 * never a failure mode).
 *
 * Deliberately has NO separate habit tracker. The daily check-in is the ONE
 * place habits are logged (sleep, workout, hydration, etc.); a second
 * Coach-side habit list duplicated and competed with it, which confused the
 * whole app. The Coach now teaches and recommends; the check-in records.
 */
const MoveCard = () => {
  const [openProtocol, setOpenProtocol] = useState<Protocol | null>(null);

  const picked = useMemo(
    () => pickFreeTierMove({ activeProtocolIds: [], now: new Date() }),
    [],
  );

  return (
    <div className="rounded-3xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] via-card/95 to-card p-5 shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.45)]">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={12} className="text-gold" />
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85">
          Today's move
        </p>
      </div>

      {/* Suggested protocol — picked from PROTOCOLS by pillar + time of day */}
      {picked && (
        <button
          type="button"
          onClick={() => setOpenProtocol(picked.protocol)}
          className="w-full text-left rounded-2xl border border-gold/35 bg-gold/[0.05] p-4 hover:bg-gold/[0.08] transition-colors active:scale-[0.99]"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <EvidenceChip evidence={picked.protocol.evidence} />
            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
              {picked.protocol.pillar}
            </span>
          </div>
          <p className="text-[15px] font-bold leading-tight text-foreground mb-1">
            {picked.protocol.title}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {picked.protocol.dose.summary}
          </p>
          <p className="text-[10.5px] text-gold/85 leading-snug mt-2 italic">
            {picked.reason}
          </p>
          <div className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-gold">
            Read & apply <ArrowRight size={10} />
          </div>
        </button>
      )}

      <p className="mt-3 text-[10.5px] text-muted-foreground leading-snug">
        Log what you actually did in your daily <span className="text-gold/80 font-semibold">check-in</span> — that's where streaks and XP come from.
      </p>

      <ProtocolSheet
        protocol={openProtocol}
        open={!!openProtocol}
        onOpenChange={(v) => !v && setOpenProtocol(null)}
      />
    </div>
  );
};

export default MoveCard;
