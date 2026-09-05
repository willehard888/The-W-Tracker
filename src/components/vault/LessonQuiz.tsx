import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import type { VaultQuizQ } from "@/hooks/use-vault-articles";

const LessonQuiz = ({
  quiz,
  accent,
  onScore,
}: {
  quiz: VaultQuizQ[];
  accent: string;
  onScore: (score: number) => void;
}) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = quiz.every((_, i) => answers[i] !== undefined);
  const score = useMemo(
    () => quiz.reduce((acc, q, i) => (answers[i] === q.correct ? acc + 1 : acc), 0),
    [answers, quiz],
  );

  if (!quiz?.length) return null;

  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        background: `linear-gradient(135deg, ${accent}10, hsl(var(--card)) 80%)`,
        borderColor: `${accent}44`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle size={13} style={{ color: accent }} strokeWidth={2.6} />
        <p
          className="eyebrow"
          style={{ color: accent }}
        >
          Comprehension check
        </p>
      </div>

      <div className="space-y-4">
        {quiz.map((q, qi) => {
          const picked = answers[qi];
          return (
            <div key={qi}>
              <p className="text-[12px] font-semibold leading-snug mb-2">
                {qi + 1}. {q.q}
              </p>
              <div className="space-y-1.5">
                {q.choices.map((choice, ci) => {
                  const isPicked = picked === ci;
                  const isCorrect = q.correct === ci;
                  const showState = submitted && (isPicked || isCorrect);
                  return (
                    <button
                      key={ci}
                      type="button"
                      disabled={submitted}
                      onClick={() => setAnswers((p) => ({ ...p, [qi]: ci }))}
                      className="w-full text-left rounded-xl border px-3 py-2 text-[12px] flex items-start gap-2 transition active:scale-[0.99] disabled:active:scale-100"
                      style={{
                        background: showState
                          ? isCorrect
                            ? "hsl(152 68% 50% / 0.12)"
                            : "hsl(0 75% 60% / 0.10)"
                          : isPicked
                            ? `${accent}18`
                            : "hsl(var(--background) / 0.4)",
                        borderColor: showState
                          ? isCorrect
                            ? "hsl(152 68% 50% / 0.55)"
                            : "hsl(0 75% 60% / 0.45)"
                          : isPicked
                            ? `${accent}66`
                            : "hsl(var(--border) / 0.5)",
                      }}
                    >
                      <span
                        className="mt-[2px] h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0"
                        style={{
                          borderColor: isPicked ? accent : "hsl(var(--border))",
                          background: isPicked ? accent : "transparent",
                        }}
                      >
                        {showState && isCorrect && (
                          <CheckCircle2 size={11} className="text-xp-green" />
                        )}
                        {showState && isPicked && !isCorrect && (
                          <XCircle size={11} className="text-rose-300" />
                        )}
                      </span>
                      <span className="text-foreground/95 leading-snug">{choice}</span>
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <p className="mt-2 text-[12px] text-muted-foreground leading-snug pl-1">
                  <span className="font-black text-foreground/85">Why:</span> {q.explain}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!submitted ? (
        <button
          type="button"
          disabled={!allAnswered}
          onClick={() => {
            setSubmitted(true);
            onScore(score);
          }}
          className="eyebrow mt-4 w-full rounded-xl py-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.99]"
          style={{
            background: accent,
            color: "hsl(var(--background))",
          }}
        >
          Check answers
        </button>
      ) : (
        <div
          className="mt-4 rounded-xl px-3 py-2.5 text-center text-[12px] font-black"
          style={{
            background: `${accent}18`,
            border: `1px solid ${accent}55`,
            color: accent,
          }}
        >
          Score: {score} / {quiz.length}
        </div>
      )}
    </section>
  );
};

export default LessonQuiz;
