import { Sparkles, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useCoachObservation } from "@/hooks/use-coach-observation";
import { useCoachBrief } from "@/hooks/use-coach-brief";
import { useWhealthSnapshots } from "@/hooks/use-whealth-snapshots";
import { briefPreview } from "@/lib/coach-signoff";

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
  const {
    text: coachLine,
    headline,
    missionsDone,
    missionsTotal,
  } = useCoachObservation({ context: "home" });
  const { brief } = useCoachBrief();
  const { data: snapshots } = useWhealthSnapshots(1);

  const hasPlan = missionsTotal > 0;
  const planDone = hasPlan && missionsDone >= missionsTotal;

  // Voice priority: today's AI brief → the nightly Whealth focus (grounded in
  // ALL the user's computed data) → the deterministic template line.
  const line =
    briefPreview(brief?.brief_md) ||
    snapshots?.[0]?.focus ||
    coachLine?.trim() ||
    "Training, sleep, mind — anything on your mind.";

  return (
    // A whisper, not a card. The coach's own line is the point and leads at
    // reading size; the big gold glow-tile is gone (accent discipline — gold
    // belongs to the hero, not to a second stacked card). A quiet ground and a
    // small gold mark keep the identity without shouting.
    // No aria-label: it would REPLACE the inner text for screen readers,
    // hiding the coach's actual line. The content reads itself in order.
    <button
      onClick={() => navigate("/coach")}
      className="w-full surface-card surface-card-quiet px-4 py-3.5 text-left transition-transform overflow-hidden group"
    >
      <div className="relative">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles aria-hidden size={13} className="text-gold shrink-0" strokeWidth={2.4} />
          <p className="eyebrow text-gold/85">AI Coach</p>
          {/* Mission progress rides the eyebrow row — no extra height. */}
          {hasPlan && (
            <span
              className={cn(
                "ml-auto text-[11px] font-black tabular-nums leading-none shrink-0",
                planDone ? "text-gold" : "text-muted-foreground",
              )}
            >
              {missionsDone}/{missionsTotal}
            </span>
          )}
        </div>

        {/* The voice — the coach speaking, at reading size. */}
        <p className="text-[15px] italic text-foreground/90 leading-snug line-clamp-2">
          {line}
        </p>

        {/* Context + the tap, quiet: the plan name (or the open invitation)
            with an inline chevron, so nothing looks like a second CTA. */}
        <p className="flex items-center gap-1 text-[12px] text-muted-foreground mt-1.5">
          {hasPlan
            ? headline
              ? shortHeadline(headline)
              : "Your session is ready"
            : "Ask your AI Coach anything"}
          <ChevronRight aria-hidden size={13} className="text-gold/60 shrink-0 transition-transform group-active:translate-x-0.5" />
        </p>
      </div>
    </button>
  );
};

export default CoachStrip;
