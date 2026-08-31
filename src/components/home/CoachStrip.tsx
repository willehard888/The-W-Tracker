import { Sparkles, ChevronRight, Target } from "lucide-react";
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
 * the chat), so they could never have led anywhere different. Merged: when a
 * plan exists this card leads with what's actually open — readiness and
 * mission progress — and otherwise keeps the conversational invitation.
 *
 * All plan data comes from useCoachObservation, which already calls
 * useDailyPlan internally. Calling useDailyPlan here as well would mount it
 * twice and open a second realtime channel for the same rows.
 */
const readinessTone = (score: number) =>
  score >= 70 ? "text-gold" : score >= 40 ? "text-foreground" : "text-[hsl(var(--ember))]";

const CoachStrip = (_props: CoachStripProps) => {
  const navigate = useNavigate();
  const {
    text: coachLine,
    readiness,
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

  const title = hasPlan
    ? headline ?? "Your session is ready"
    : "Ask your AI Coach anything";
  const subtitle = hasPlan
    ? planDone
      ? "All missions done. That's the day."
      : `${missionsDone} of ${missionsTotal} missions done`
    : line;

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
        {/* Readiness replaces the sparkle once there's a plan — the number is
            the most useful thing this card can show at a glance. */}
        {readiness != null && hasPlan ? (
          <div className="h-10 w-10 rounded-xl border border-gold/35 bg-gold/10 flex flex-col items-center justify-center shrink-0">
            <span className={cn("font-display font-black text-[15px] leading-none tabular-nums", readinessTone(readiness))}>
              {readiness}
            </span>
            <span className="text-[7px] font-black uppercase tracking-[0.12em] text-muted-foreground mt-0.5">
              Ready
            </span>
          </div>
        ) : (
          <div className="h-10 w-10 rounded-xl gradient-gold flex items-center justify-center shrink-0 glow-gold">
            <Sparkles aria-hidden size={18} className="text-primary-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-[11px] uppercase tracking-widest text-gold/80 font-bold">
              AI Coach
            </p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold font-bold border border-gold/30">
              GPT-5
            </span>
          </div>
          <p className="font-bold text-sm leading-tight line-clamp-1">{title}</p>
          <p
            className={cn(
              "text-[12px] text-muted-foreground mt-0.5 leading-snug line-clamp-2",
              !hasPlan && "italic",
            )}
          >
            {subtitle}
          </p>
        </div>

        {/* Progress is stated in the subtitle too — never shape or colour alone. */}
        {hasPlan && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
            <Target aria-hidden size={11} className={planDone ? "text-gold" : "text-muted-foreground"} strokeWidth={2.6} />
            <span className="font-display font-black text-[12px] tabular-nums leading-none">
              {missionsDone}/{missionsTotal}
            </span>
          </span>
        )}
        <ChevronRight aria-hidden size={18} className="text-gold/60 shrink-0" />
      </div>
    </button>
  );
};

export default CoachStrip;
