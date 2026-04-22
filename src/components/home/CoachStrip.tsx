import { Sparkles, FileText, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CoachNudgeCard from "@/components/CoachNudgeCard";
import { cn } from "@/lib/utils";

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
  latestNudge?: LatestNudge | null;
  latestBriefing?: LatestBriefing | null;
  className?: string;
}

const CoachStrip = ({ latestNudge, latestBriefing, className }: CoachStripProps) => {
  const navigate = useNavigate();

  const cardBase =
    "snap-start shrink-0 w-[80%] sm:w-[60%] md:w-[44%] rounded-2xl glass-card-gold p-4 text-left active:scale-[0.99] transition-transform overflow-hidden relative";

  return (
    <div className={cn("relative", className)}>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/80 mb-2 px-1">
        Your Coach
      </p>
      <div className="snap-x-strip flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 snap-x snap-mandatory">
        {/* AI Coach */}
        <button
          type="button"
          onClick={() => navigate("/coach")}
          className={cardBase}
          style={{
            border: "1px solid hsl(42 78% 54% / 0.35)",
            background:
              "radial-gradient(120% 80% at 0% 0%, hsl(42 78% 54% / 0.18), transparent 60%), hsl(255 14% 7%)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl gradient-gold flex items-center justify-center shrink-0 shadow-[0_0_20px_hsl(42_78%_54%/0.5)]">
              <Sparkles size={20} className="text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="text-[10px] uppercase tracking-widest text-gold font-black">
                  AI Coach
                </p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold font-bold border border-gold/30">
                  GPT-5
                </span>
              </div>
              <p className="font-bold text-sm leading-tight">Ask your coach anything</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                Training, sleep, discipline.
              </p>
            </div>
            <ChevronRight size={18} className="text-gold/70 shrink-0" />
          </div>
        </button>

        {/* Latest Nudge (Elite, unseen) */}
        {latestNudge && (
          <div className={cardBase}>
            <CoachNudgeCard
              nudgeId={latestNudge.id}
              headline={latestNudge.headline}
              content={latestNudge.content}
            />
          </div>
        )}

        {/* Latest Briefing */}
        {latestBriefing && (
          <button
            type="button"
            onClick={() => navigate(`/briefing/${latestBriefing.id}`)}
            className={cn(cardBase, "border border-gold/25")}
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg gradient-gold flex items-center justify-center shrink-0">
                <FileText size={16} className="text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-gold/80 font-bold mb-0.5">
                  {latestBriefing.viewed_at ? "Weekly Briefing" : "New Weekly Briefing"}
                </p>
                <p className="font-bold text-sm leading-tight line-clamp-2">
                  {latestBriefing.headline}
                </p>
              </div>
              <ChevronRight size={18} className="text-gold/60 shrink-0 mt-1" />
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

export default CoachStrip;
