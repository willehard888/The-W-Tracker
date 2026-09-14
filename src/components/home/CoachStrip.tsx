import { Sparkles, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useCoachObservation } from "@/hooks/use-coach-observation";

interface CoachStripProps {
  className?: string;
}

/**
 * Home's single AI Coach entry.
 *
 * There were briefly two cards here — this one and a separate plan strip —
 * both navigating to /coach. Two adjacent cards with the same destination is
 * just a second button, and /coach has no deep-linking (only `?seed=` to open
 * the chat), so they could never have led anywhere different.
 *
 * The merge is deliberately additive rather than a redesign: the gold icon
 * tile, the eyebrow, the headline and the coach's own line in italics are what
 * make this card read like the rest of Home. A first attempt swapped the gold
 * tile for a readiness readout and added a mission chip — which cost the card
 * its anchor (every sibling card leads with a filled gold tile) and stole
 * enough width to truncate the headline mid-word. Plan progress now rides in
 * the eyebrow row, where it costs no vertical space and competes with nothing.
 * Readiness stays on /coach, where there's room for it.
 *
 * All plan data comes from useCoachObservation, which already calls
 * useDailyPlan internally. Calling useDailyPlan here as well would mount it
 * twice and open a second realtime channel for the same rows.
 */
/**
 * Plan headlines read "Name: what it's for" ("Deload & Recharge: Build
 * consistency, not fatigue"). One line on Home fits the name but not the
 * clause, so a raw clamp cuts mid-thought ("Deload & Recharge: Build…").
 * Prefer the name alone when the whole thing is too long — it's a complete
 * phrase, and the rest is one tap away. Headlines without a colon are left
 * exactly as written.
 */
const HEADLINE_FITS = 34;
const shortHeadline = (h: string): string => {
  if (h.length <= HEADLINE_FITS) return h;
  const name = h.split(":")[0]?.trim();
  return name && name.length >= 4 && name.length < h.length ? name : h;
};

const CoachStrip = (_props: CoachStripProps) => {
  const navigate = useNavigate();
  const { headline, missionsDone, missionsTotal } = useCoachObservation({ context: "home" });

  const hasPlan = missionsTotal > 0;
  const planDone = hasPlan && missionsDone >= missionsTotal;

  return (
    // One line, one door. The coach's two-line voice is the first thing
    // /coach shows; on Home it was the second block of italic text on the
    // screen. What stays is the plan's name (or the open invitation), the
    // mission count, and the one small gold mark that says who is speaking.
    // No aria-label: it would REPLACE the inner text for screen readers.
    <button
      onClick={() => navigate("/coach")}
      className="press w-full surface-card surface-card-quiet min-h-14 px-4 py-3 text-left flex items-center gap-3 overflow-hidden group"
    >
      <Sparkles aria-hidden size={15} className="text-gold shrink-0" strokeWidth={2.4} />
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] font-bold text-muted-foreground leading-none">AI Coach</span>
        <span className="block text-[14px] font-bold leading-tight truncate mt-1">
          {hasPlan
            ? headline
              ? shortHeadline(headline)
              : "Your session is ready"
            : "Ask your AI Coach anything"}
        </span>
      </span>
      {hasPlan && (
        <span
          className={cn(
            "text-[11px] font-black tabular-nums leading-none shrink-0",
            planDone ? "text-gold" : "text-muted-foreground",
          )}
        >
          {missionsDone}/{missionsTotal}
        </span>
      )}
      <ChevronRight aria-hidden size={15} className="text-muted-foreground shrink-0 transition-transform group-active:translate-x-0.5" />
    </button>
  );
};

export default CoachStrip;
