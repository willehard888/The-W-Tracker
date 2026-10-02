import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { QuestionRow } from "@/components/coach/rows";
import { cn } from "@/lib/utils";
import { useCoachBrief } from "@/hooks/use-coach-brief";
import { stripCoachSignoff } from "@/lib/coach-signoff";

/** The model titles its labels ("Sleep Target"); the app writes sentence case.
 *  Only Capitalised words are lowered, so "RPE" and "HRV" keep their caps. */
const sentenceLabel = (label: string): string =>
  label.replace(/(?<=\s)[A-Z][a-z]+/g, (w) => w.toLowerCase());

/** The screen's one felt number. Hidden until today's plan exists. */
const Readiness = ({ score }: { score: number | null }) =>
  score == null ? null : (
    <p className="flex items-baseline gap-2">
      <span className="font-display font-black text-[40px] leading-none tabular-nums text-gold glow-gold-text">{score}</span>
      <span className="text-meta text-muted-foreground">readiness</span>
    </p>
  );

/**
 * CoachBriefHero: the coach speaks first. Its own words in the screen's one
 * full-weight card, the gold readiness number, the brief's three questions
 * as the primary rows, and a quiet link for anything else.
 */
const CoachBriefHero = ({
  readiness,
  onOpenChat,
  onAsk,
}: {
  readiness: number | null;
  onOpenChat: () => void;
  onAsk: (question: string, index: number) => void;
}) => {
  const { brief, isLoading, error } = useCoachBrief();

  if (isLoading) {
    return (
      <div className="surface-card p-5">
        <div className="h-9 w-24 rounded-lg skeleton-block" />
        <div className="mt-4 space-y-2">
          <div className="h-3.5 w-full rounded skeleton-block" />
          <div className="h-3.5 w-[85%] rounded skeleton-block" />
          <div className="h-3.5 w-[60%] rounded skeleton-block" />
        </div>
        <p className="text-meta text-muted-foreground mt-3">Coach is reading your week…</p>
      </div>
    );
  }

  return (
    <div className="surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <Readiness score={readiness} />
        {brief?.ribbon && (
          // Two lines, not an ellipsis: the ribbon ends on its one piece of
          // news ("… · on track"), and that was the part being cut.
          <span className="eyebrow-sm ml-auto pt-1 max-w-[58%] text-right leading-snug line-clamp-2">{brief.ribbon}</span>
        )}
      </div>

      {brief ? (
        <>
          {/* The coach's words: the centrepiece. Sign-off stripped: briefs
              written before the prompt change end with "— W Coach". */}
          <div className={cn("text-note leading-relaxed text-foreground [&_p]:mb-2 [&_strong]:font-black [&_strong]:text-foreground", readiness != null && "mt-3")}>
            <ReactMarkdown>{stripCoachSignoff(brief.brief_md)}</ReactMarkdown>
          </div>

          {brief.prescriptions?.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-meta text-muted-foreground">
              {brief.prescriptions.map((p, i) => (
                <span key={i}>{sentenceLabel(p.label)} <b className="font-black text-foreground tabular-nums">{p.value}</b></span>
              ))}
            </p>
          )}

          {brief.suggested_questions?.length > 0 && (
            <div className="mt-4 divide-y divide-border/35 border-t border-border/35" aria-label="Ask about today's brief">
              {brief.suggested_questions.slice(0, 3).map((q, i) => (
                <QuestionRow key={i} question={q} onClick={() => onAsk(q, i)} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <p className={cn("text-note font-bold leading-snug", readiness != null && "mt-3")}>
            I'm your coach. Tell me how today's going and I'll build the next move around your data.
          </p>
          {/* A failed brief used to look identical to a first-ever visit, so a
              member who had hit the daily cap was told nothing at all. */}
          {error && (
            <p role="status" className="mt-2 text-meta text-muted-foreground/75">
              {error instanceof Error ? error.message : "Today's brief is unavailable right now."}
            </p>
          )}
        </>
      )}

      {/* The questions above are the way in; typing is the exception. */}
      <Button variant="link" className="w-full mt-2" onClick={onOpenChat}>
        Something else? Ask
      </Button>
    </div>
  );
};

export default CoachBriefHero;
