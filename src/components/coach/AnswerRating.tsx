import { ThumbsUp, ThumbsDown } from "lucide-react";

/**
 * Was that answer any good?
 *
 * The pilot asks whether AI answers are useful and trustworthy, and nothing in
 * the app could answer it: the coach thread lives in localStorage and fires no
 * events, so "the model said something" and "the model helped" were the same
 * unmeasured fact. This is the cheapest honest read — one tap, no sheet, no
 * follow-up question. A rating that costs a sentence is a rating nobody gives.
 *
 * `rated` is carried on the message itself, so the verdict saves with the
 * thread and the same answer is never asked about twice. Once rated the
 * buttons are gone, not disabled: a tap that does nothing is worse than no
 * button.
 *
 * Implicit, not intrusive — the same shape meal_scan_reviews already uses for
 * the scanner. It interrupts nothing and can be ignored forever.
 */
interface Props {
  rated?: "up" | "down";
  onRate: (useful: boolean) => void;
}

const AnswerRating = ({ rated, onRate }: Props) => {
  if (rated) {
    return <span className="min-h-11 inline-flex items-center text-meta text-muted-foreground">Noted — thanks.</span>;
  }
  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        aria-label="This answer helped"
        onClick={() => onRate(true)}
        className="press min-h-11 min-w-11 inline-flex items-center justify-center text-muted-foreground"
      >
        <ThumbsUp size={13} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="This answer did not help"
        onClick={() => onRate(false)}
        className="press min-h-11 min-w-11 inline-flex items-center justify-center text-muted-foreground"
      >
        <ThumbsDown size={13} aria-hidden />
      </button>
    </span>
  );
};

export default AnswerRating;
