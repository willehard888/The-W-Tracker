import { useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VaultQuizQ } from "@/hooks/use-vault-articles";

/**
 * The check inside the Understand stage: two or three questions, answered,
 * then marked with the reason. Optional; it never gates the loop. The pick
 * wears the shelf's accent; right and wrong wear the app's own tokens, so a
 * green shelf can never be mistaken for a correct answer.
 */
const LessonQuiz = ({ quiz, accent, onScore }: { quiz: VaultQuizQ[]; accent: string; onScore: (score: number) => void }) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = quiz.every((_, i) => answers[i] !== undefined);
  const score = useMemo(() => quiz.reduce((acc, q, i) => (answers[i] === q.correct ? acc + 1 : acc), 0), [answers, quiz]);

  if (!quiz?.length) return null;

  return (
    <div>
      <div className="space-y-5">
        {quiz.map((q, qi) => {
          const picked = answers[qi];
          return (
            <fieldset key={qi} disabled={submitted}>
              <legend className="text-dense font-semibold leading-snug mb-2">
                {qi + 1}. {q.q}
              </legend>
              <div className="space-y-2">
                {q.choices.map((choice, ci) => {
                  const isPicked = picked === ci;
                  const isCorrect = q.correct === ci;
                  const marked = submitted && (isPicked || isCorrect);
                  return (
                    <button
                      key={ci}
                      type="button"
                      aria-pressed={isPicked}
                      onClick={() => setAnswers((p) => ({ ...p, [qi]: ci }))}
                      className={cn(
                        "press w-full min-h-11 text-left rounded-xl border px-3 py-2.5 text-dense flex items-start gap-2.5 transition-colors",
                        marked
                          ? isCorrect
                            ? "border-xp-green/55 bg-xp-green/10"
                            : "border-destructive/45 bg-destructive/10"
                          : !isPicked && "border-border/50 bg-background/40",
                      )}
                      style={!marked && isPicked ? { background: `${accent}18`, borderColor: `${accent}66` } : undefined}
                    >
                      {marked ? (
                        isCorrect ? (
                          <CheckCircle2 aria-hidden size={16} className="mt-0.5 shrink-0 text-xp-green" />
                        ) : (
                          <XCircle aria-hidden size={16} className="mt-0.5 shrink-0 text-destructive" />
                        )
                      ) : (
                        <span
                          aria-hidden
                          className="mt-0.5 h-4 w-4 rounded-full border shrink-0"
                          style={isPicked ? { borderColor: accent, background: accent } : { borderColor: "hsl(var(--border))" }}
                        />
                      )}
                      <span className="text-foreground/95 leading-snug">{choice}</span>
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <p className="mt-2 text-meta text-muted-foreground leading-snug">
                  <span className="font-black text-foreground/85">Why:</span> {q.explain}
                </p>
              )}
            </fieldset>
          );
        })}
      </div>

      {!submitted ? (
        <Button
          variant="outline"
          className="mt-4 w-full min-h-11"
          disabled={!allAnswered}
          onClick={() => {
            setSubmitted(true);
            onScore(score);
          }}
        >
          Check answers
        </Button>
      ) : (
        <p className="mt-4 text-dense font-black tabular-nums" aria-live="polite">
          {score} of {quiz.length} right.
        </p>
      )}
    </div>
  );
};

export default LessonQuiz;
