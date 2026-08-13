import { Sparkles, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCoachObservation } from "@/hooks/use-coach-observation";
import { useCoachBrief } from "@/hooks/use-coach-brief";
import { useWhealthSnapshots } from "@/hooks/use-whealth-snapshots";

// First readable sentence of the AI brief, markdown stripped, for the inline line.
const briefLine = (md?: string | null): string | null => {
  if (!md) return null;
  const clean = md.replace(/[*_#>`]/g, "").replace(/—\s*W Coach\.?$/i, "").trim();
  const firstSentence = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  return firstSentence.slice(0, 170).trim() || null;
};

interface LatestNudge {
  id: string;
  headline: string | null;
  content: string;
}

interface LatestBriefing {
  id: string;
  headline: string;
  viewed_at: string | null;
}

interface CoachStripProps {
  // Kept for call-site compatibility; the home card is now a single clean
  // full-width entry (nudges/briefings live inside /coach).
  latestNudge?: LatestNudge | null;
  latestBriefing?: LatestBriefing | null;
  className?: string;
}

/**
 * Home AI Coach entry — a single full-width card that visually matches the
 * other home cards (Vault, Invite). Shows the live coach line as the subtitle
 * and taps through to the full Coach.
 */
const CoachStrip = (_props: CoachStripProps) => {
  const navigate = useNavigate();
  const { text: coachLine } = useCoachObservation({ context: "home" });
  const { brief } = useCoachBrief();
  const { data: snapshots } = useWhealthSnapshots(1);
  // Voice priority: today's AI brief → the nightly Whealth focus (grounded in
  // ALL the user's computed data) → the deterministic template line.
  const line =
    briefLine(brief?.brief_md) ||
    snapshots?.[0]?.focus ||
    coachLine?.trim() ||
    "Training, sleep, mind — anything on your mind.";

  return (
    <button
      onClick={() => navigate("/coach")}
      className="w-full rounded-2xl glass-card-gold p-4 text-left active:scale-[0.99] transition-transform border border-gold/30 relative overflow-hidden"
    >
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, hsl(42 78% 54% / 0.18) 0%, transparent 70%)",
        }}
      />
      <div className="relative flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl gradient-gold flex items-center justify-center shrink-0 glow-gold">
          <Sparkles size={18} className="text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-[10px] uppercase tracking-widest text-gold/80 font-bold">
              AI Coach
            </p>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold font-bold border border-gold/30">
              GPT-5
            </span>
          </div>
          <p className="font-bold text-sm leading-tight">Ask your coach anything</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2 italic">
            {line}
          </p>
        </div>
        <ChevronRight size={18} className="text-gold/60 shrink-0" />
      </div>
    </button>
  );
};

export default CoachStrip;
