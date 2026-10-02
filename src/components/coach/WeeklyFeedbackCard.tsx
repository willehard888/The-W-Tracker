import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { QuestionRow } from "@/components/coach/rows";
import { reviewQuestions, useAutoWeeklyReview, weekStartsOnKey } from "@/hooks/use-performance-snapshots";

/**
 * The week's verdict on the Coach page, Monday to Wednesday: the driver, the
 * focus, the lifts line and the three questions the review wrote for itself.
 * The review generates itself on the first visit of the week (see
 * useAutoWeeklyReview); the full card with the lifts lives on Progress.
 */
const WeeklyFeedbackCard = ({ onAsk }: { onAsk: (question: string, index: number) => void }) => {
  const navigate = useNavigate();
  const { data: review } = useAutoWeeklyReview();
  const weekday = (new Date().getDay() + 6) % 7; // Mon = 0
  if (!review || weekday > 2 || review.week_starts_on !== weekStartsOnKey()) return null;
  const questions = reviewQuestions(review.suggested_questions);

  return (
    <section className="surface-card surface-card-quiet p-4" aria-label="Week in review">
      <p className="eyebrow-sm text-gold">Week in review</p>
      {review.driver_of_week && <p className="mt-1 text-note font-bold leading-snug">{review.driver_of_week}</p>}
      {review.next_week_focus && <p className="mt-1 text-meta text-muted-foreground leading-relaxed">{review.next_week_focus}</p>}
      {review.lifts_note && <p className="mt-1 text-meta text-foreground/85 leading-snug">{review.lifts_note}</p>}
      {questions.length > 0 && (
        <div className="mt-3 divide-y divide-border/35 border-t border-border/35" aria-label="Ask about this week">
          {questions.map((q, i) => (
            <QuestionRow key={q} question={q} onClick={() => onAsk(q, i)} />
          ))}
        </div>
      )}
      <Button variant="link" className="mt-1 px-0" onClick={() => navigate("/coach/progress")}>
        Open review
      </Button>
    </section>
  );
};

export default WeeklyFeedbackCard;
