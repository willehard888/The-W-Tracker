import ReactMarkdown from "react-markdown";
import { Send, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCoachBrief } from "@/hooks/use-coach-brief";
import { stripCoachSignoff } from "@/lib/coach-signoff";

/** The screen's one felt number. Hidden until today's plan exists. */
const Readiness = ({ score }: { score: number | null }) =>
  score == null ? null : (
    <p className="flex items-baseline gap-2">
      <span className="font-display font-black text-[40px] leading-none tabular-nums text-gold glow-gold-text">{score}</span>
      <span className="text-[12px] text-muted-foreground">readiness</span>
    </p>
  );

/**
 * CoachBriefHero: the coach speaks first. Its own words in the screen's one
 * full-weight card, the gold readiness number, tailored questions as hairline
 * rows, and the one CTA into the live chat.
 */
const CoachBriefHero = ({
  readiness,
  onOpenChat,
  onAsk,
}: {
  readiness: number | null;
  onOpenChat: () => void;
  onAsk: (question: string) => void;
}) => {
  const { brief, isLoading } = useCoachBrief();

  if (isLoading) {
    return (
      <div className="surface-card p-5">
        <div className="h-9 w-24 rounded-lg bg-foreground/[0.06] animate-pulse" />
        <div className="mt-4 space-y-2">
          <div className="h-3.5 w-full rounded bg-foreground/[0.06] animate-pulse" />
          <div className="h-3.5 w-[85%] rounded bg-foreground/[0.06] animate-pulse" />
          <div className="h-3.5 w-[60%] rounded bg-foreground/[0.06] animate-pulse" />
        </div>
        <p className="text-[12px] text-muted-foreground mt-3">Coach is reading your week…</p>
      </div>
    );
  }

  return (
    <div className="surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <Readiness score={readiness} />
        {brief?.ribbon && (
          <span className="eyebrow-sm ml-auto pt-1 truncate max-w-[55%]">{brief.ribbon}</span>
        )}
      </div>

      {brief ? (
        <>
          {/* The coach's words: the centrepiece. Sign-off stripped: briefs
              written before the prompt change end with "— W Coach". */}
          <div className={cn("text-[14px] leading-relaxed text-foreground/90 [&_p]:mb-2 [&_strong]:font-black [&_strong]:text-foreground", readiness != null && "mt-3")}>
            <ReactMarkdown>{stripCoachSignoff(brief.brief_md)}</ReactMarkdown>
          </div>

          {brief.prescriptions?.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-muted-foreground">
              {brief.prescriptions.map((p, i) => (
                <span key={i}>{p.label} <b className="font-black text-foreground tabular-nums">{p.value}</b></span>
              ))}
            </p>
          )}

          {brief.suggested_questions?.length > 0 && (
            <div className="mt-4 divide-y divide-border/35 border-t border-border/35">
              {brief.suggested_questions.slice(0, 3).map((q, i) => (
                <button key={i} type="button" onClick={() => onAsk(q)} className="press w-full min-h-11 flex items-center gap-2.5 py-2.5 text-left">
                  <MessageCircle size={13} className="text-muted-foreground shrink-0" aria-hidden />
                  <span className="text-[13px] font-semibold text-foreground/90 leading-snug">{q}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className={cn("text-[14px] font-bold leading-snug", readiness != null && "mt-3")}>
          I'm your coach. Tell me how today's going and I'll build the next move around your data.
        </p>
      )}

      <Button variant="ember" size="lg" className="w-full mt-4" onClick={onOpenChat}>
        <Send size={15} /> Ask your coach
      </Button>
    </div>
  );
};

export default CoachBriefHero;
