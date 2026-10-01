import { useState } from "react";
import { FIELD_LABEL } from "@/components/ui/label";
import BottomSheet from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  FREEFORM_COPY,
  FREEFORM_KINDS,
  type PilotPrompt,
} from "@/lib/pilot/prompts";

/**
 * One question, or the always-open door.
 *
 * Presentational only: it owns the draft and nothing else. Whether this person
 * may be asked at all is decided in lib/pilot/eligibility.ts, and where the
 * answer goes is lib/pilot/rpc.ts — so the rule can be tested without a
 * renderer and the copy can be read without either.
 *
 * Built on the app-wide BottomSheet, which tracks visualViewport. That matters
 * here more than anywhere: this is one of the few sheets in the app with a text
 * field in it, and a keyboard that pushes the Send button off-screen is a sheet
 * nobody submits.
 *
 * NOTHING IS REQUIRED. No field blocks the send, and the sheet closes on the
 * backdrop like any other. A tester who wants out gets out, and a dismissal is
 * recorded as an answer so the question never returns. The brief's rule is that
 * feedback must not get in the way of the behaviour we are trying to observe.
 */

export interface FeedbackAnswer {
  rating: number | null;
  choice: string | null;
  comment: string | null;
}

interface Props {
  open: boolean;
  /** null renders the freeform door rather than a catalogue question. */
  prompt: PilotPrompt | null;
  /** Take the sheet away. `sent` separates a send from a dismissal. */
  onDismiss: (sent?: boolean) => void;
  onSubmit: (answer: FeedbackAnswer) => Promise<boolean>;
}

const SCALE = [1, 2, 3, 4, 5];

const FeedbackSheet = ({ open, prompt, onDismiss, onSubmit }: Props) => {
  const [rating, setRating] = useState<number | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const isFreeform = prompt === null;
  const title = isFreeform ? FREEFORM_COPY.title : prompt.title;
  const choiceQuestion = isFreeform ? FREEFORM_COPY.question : prompt?.choice?.question;
  const options = isFreeform ? FREEFORM_KINDS : prompt?.choice?.options;
  const commentLabel = isFreeform ? FREEFORM_COPY.commentLabel : prompt?.comment?.label;
  const placeholder = isFreeform ? FREEFORM_COPY.placeholder : (prompt?.comment?.placeholder ?? "");

  // Nothing said is nothing to store — the server rejects an empty submission
  // anyway, and a Send that returns "empty" reads as a bug.
  const hasAnswer = rating != null || choice != null || comment.trim().length > 0;

  const reset = () => {
    setRating(null);
    setChoice(null);
    setComment("");
    setSending(false);
    setSent(false);
  };

  const close = (wasSent = false) => {
    reset();
    onDismiss(wasSent);
  };

  const send = async () => {
    if (!hasAnswer || sending) return;
    setSending(true);
    const ok = await onSubmit({ rating, choice, comment: comment.trim() || null });
    setSending(false);
    if (!ok) return; // The caller has already said so; the draft stays put.
    setSent(true);
    // Long enough to read the thank-you, short enough not to be in the way.
    //
    // This only became reachable when PilotHost stopped closing the sheet
    // on a successful submit: clearing its state unmounted this component
    // mid-await, so `sent` never painted and the sheet cut out without its
    // exit animation. The sheet owns its own ending.
    window.setTimeout(() => close(true), 1200);
  };

  return (
    <BottomSheet open={open} onClose={close} label={title} title={title}>
      {sent ? (
        <p className="py-8 text-center text-read text-muted-foreground">{FREEFORM_COPY.sent}</p>
      ) : (
        <div className="space-y-6 pb-2">
          {prompt?.scale && (
            <div>
              <p className="text-read mb-3">{prompt.scale.question}</p>
              <div className="flex items-center gap-2">
                {SCALE.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n}`}
                    aria-pressed={rating === n}
                    onClick={() => setRating(n)}
                    className={cn(
                      "press flex-1 min-h-11 rounded-xl border text-read font-semibold transition-colors",
                      rating === n
                        ? "border-gold bg-gold/[0.12] text-gold"
                        : "border-border/40 text-muted-foreground",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-label text-muted-foreground">
                <span>{prompt.scale.low}</span>
                <span>{prompt.scale.high}</span>
              </div>
            </div>
          )}

          {options && (
            <div>
              {choiceQuestion && <p className="text-read mb-3">{choiceQuestion}</p>}
              <div className="space-y-1.5">
                {options.map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    aria-pressed={choice === o.v}
                    // Tapping the chosen option again clears it: every answer
                    // here is optional, including one already given.
                    onClick={() => setChoice((c) => (c === o.v ? null : o.v))}
                    className={cn(
                      "press-row w-full min-h-11 rounded-xl border px-3.5 py-2.5 text-left text-read transition-colors",
                      choice === o.v
                        ? "border-gold bg-gold/[0.08] text-foreground"
                        : "border-border/40 text-muted-foreground",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {commentLabel && (
            <div>
              <label htmlFor="pilot-comment" className={cn(FIELD_LABEL, "mb-2 block")}>
                {commentLabel}
              </label>
              <Textarea
                id="pilot-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={placeholder}
                rows={4}
                // The column is capped at 2000; stopping here means nobody
                // writes a page and watches the end of it disappear.
                maxLength={2000}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button variant="ember" size="lg" className="w-full" disabled={!hasAnswer || sending} onClick={send}>
              {sending ? "Lähetetään…" : FREEFORM_COPY.submit}
            </Button>
            <Button variant="ghost" size="lg" className="w-full" onClick={() => close()}>
              Ei nyt
            </Button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
};

export default FeedbackSheet;
