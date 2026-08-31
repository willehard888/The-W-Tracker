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
    <button
      onClick={() => navigate("/coach")}
      aria-label={
        hasPlan
          ? `AI Coach. Today's plan, ${missionsDone} of ${missionsTotal} missions done.`
          : "AI Coach. Ask anything."
      }
      className="w-full surface-card p-4 text-left active:scale-[0.99] transition-transform overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--gold) / 0.18) 0%, transparent 70%)",
        }}
      />
      <div className="relative flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl gradient-gold flex items-center justify-center shrink-0 glow-gold">
          <Sparkles aria-hidden size={18} className="text-primary-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-[11px] uppercase tracking-widest text-gold/80 font-bold">
              AI Coach
            </p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold font-bold border border-gold/30">
              GPT-5
            </span>
            {/* Mission progress lives here rather than as its own chip beside
                the chevron: same information, no extra row, and the headline
                keeps the full width it needs. */}
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

          <p className="font-bold text-sm leading-tight line-clamp-1">
            {hasPlan
              ? headline
                ? shortHeadline(headline)
                : "Your session is ready"
              : "Ask your AI Coach anything"}
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug line-clamp-2 italic">
            {line}
          </p>
        </div>

        <ChevronRight aria-hidden size={18} className="text-gold/60 shrink-0" />
      </div>
    </button>
  );
};

export default CoachStrip;
