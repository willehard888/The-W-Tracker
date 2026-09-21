import { useEffect, useRef, useState } from "react";
import { Check, Lock, Play, Square } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import LessonQuiz from "./LessonQuiz";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { track, FUNNEL } from "@/lib/analytics";
import { toast } from "sonner";
import type { VaultArticle } from "@/hooks/use-vault-articles";
import type { VaultProgressRow } from "@/hooks/use-vault-progress";
import { useCompleteLesson } from "@/hooks/use-vault-progress";
import { useSaveReflection, useVaultReflections } from "@/hooks/use-vault-reflections";
import { useMarkIntegrated, useRecordPractice, type PracticeResult } from "@/hooks/use-vault-practice";
import { loopState, practiceLength, PRACTICE_XP, type LoopStage } from "@/lib/vault-loop";
import { pathOfArticle } from "@/data/vault-paths";
import { MASTER_BY_SLUG } from "@/data/vault-masters";

/**
 * The loop under an idea: Understand → Reflect → Practise → Integrate.
 * Each stage is a section of the same sheet. The stage the reader is on is
 * open; done stages fold to a line; the ones ahead show their name and wait.
 * Answers are private (own rows only); the practice is the one act that
 * earns progress, recorded server-side.
 */
const STAGES: { key: LoopStage; label: string }[] = [
  { key: "understand", label: "Understand" },
  { key: "reflect", label: "Reflect" },
  { key: "practice", label: "Practise" },
  { key: "integrate", label: "Integrate" },
];

const PracticeLoop = ({
  article,
  accent,
  progress,
  onPracticed,
  onOpenSlug,
}: {
  article: VaultArticle;
  accent: string;
  progress: VaultProgressRow | undefined;
  /** The practice landed: XP, and maybe a badge for the page to show once the sheet closes. */
  onPracticed?: (r: PracticeResult) => void;
  onOpenSlug?: (slug: string) => void;
}) => {
  const { data: reflections } = useVaultReflections(article.id);
  const reflectSaved = reflections?.find((r) => r.stage === "reflect")?.answer ?? "";
  const integrateSaved = reflections?.find((r) => r.stage === "integrate")?.answer ?? "";
  const state = loopState(progress, !!reflectSaved, !!integrateSaved);
  const path = pathOfArticle(article.slug);
  const master = article.master_slug ? MASTER_BY_SLUG[article.master_slug] : undefined;
  const props = { slug: article.slug, master: article.master_slug ?? null, path: path?.slug ?? null };

  // The check lives inside Understand: optional, and its score rides along
  // with the completion when it was taken.
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [checkOpen, setCheckOpen] = useState(false);

  const complete = useCompleteLesson();
  const save = useSaveReflection(article.id);
  const record = useRecordPractice();
  const markIntegrated = useMarkIntegrated();

  const understand = async () => {
    hapticImpact("medium");
    try {
      await complete.mutateAsync({ articleId: article.id, quizScore });
      void track(FUNNEL.lessonCompleted, { ...props, quiz: quizScore });
    } catch (e: unknown) {
      toast.error("Couldn't save progress", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const practise = async () => {
    hapticImpact("medium");
    try {
      const r = await record.mutateAsync({ articleId: article.id, ...props });
      if (r.xp_awarded > 0) {
        hapticNotification("success");
        toast.success(`Practice recorded · +${r.xp_awarded} XP`, {
          description: r.newBadge ? `Badge unlocked: ${r.newBadge.name}` : undefined,
        });
      } else if (!r.already) {
        toast.success("Practice recorded", { description: "Today's XP was already earned. The loop still counts." });
      }
      onPracticed?.(r);
    } catch (e: unknown) {
      toast.error("Couldn't record the practice", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const nextSlug = path ? path.steps[path.steps.indexOf(article.slug) + 1] : undefined;

  return (
    <section aria-label="The practice loop" className="pt-1">
      {/* The rail: four stops, the one you are on lit. */}
      <ol className="flex items-center gap-1.5 mb-4" aria-label="Loop progress">
        {STAGES.map((s, i) => {
          const done = i < state.done;
          const current = s.key === state.stage;
          return (
            <li key={s.key} className="flex items-center gap-1.5 min-w-0">
              <span
                className={cn(
                  "text-label font-bold tracking-tight transition-colors",
                  done || current ? "" : "text-muted-foreground/75",
                )}
                style={done || current ? { color: accent } : undefined}
                aria-current={current ? "step" : undefined}
              >
                {done ? <Check size={11} strokeWidth={3} className="inline -mt-0.5 mr-0.5" aria-hidden /> : null}
                {s.label}
              </span>
              {i < STAGES.length - 1 && <span aria-hidden className="h-px w-3 bg-border/60 shrink-0" />}
            </li>
          );
        })}
      </ol>

      <div className="divide-y divide-border/35">
        {/* 1 · Understand */}
        <Stage
          label="Understand"
          state={state.understood ? "done" : state.stage === "understand" ? "current" : "ahead"}
          accent={accent}
          doneLine="Understood."
        >
          <p className="text-note text-muted-foreground leading-relaxed">
            The idea is above. Take the check if you want it, then say you have it.
          </p>
          {article.quiz?.length > 0 &&
            (checkOpen ? (
              <div className="mt-4">
                <LessonQuiz quiz={article.quiz} accent={accent} onScore={setQuizScore} />
              </div>
            ) : (
              <Button variant="outline" className="mt-3 min-h-11" onClick={() => setCheckOpen(true)}>
                Take the check · {article.quiz.length} questions
              </Button>
            ))}
          <Button variant="ember" size="lg" className="mt-4 w-full" onClick={understand} disabled={complete.isPending}>
            {complete.isPending ? "Saving…" : "I understand this"}
          </Button>
        </Stage>

        {/* 2 · Reflect */}
        <Stage
          label="Reflect"
          state={state.reflected ? "done" : state.stage === "reflect" ? "current" : "ahead"}
          accent={accent}
          doneLine={reflectSaved}
          editable
        >
          <AnswerBox
            prompt={article.reflect_prompt ?? ""}
            initial={reflectSaved}
            accent={accent}
            saving={save.isPending}
            cta="Save answer"
            onSave={async (text) => {
              await save.mutateAsync({ stage: "reflect", answer: text });
              if (text.trim()) void track(FUNNEL.vaultReflected, props);
            }}
          />
        </Stage>

        {/* 3 · Practise */}
        <Stage
          label="Practise"
          state={state.practiced ? "done" : state.stage === "practice" ? "current" : "ahead"}
          accent={accent}
          doneLine={`Practised${progress?.practiced_at ? " · " + new Date(progress.practiced_at).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : ""}.`}
        >
          <PracticeBox
            steps={article.try_today}
            minutes={article.practice_minutes}
            accent={accent}
            pending={record.isPending}
            onDone={practise}
          />
        </Stage>

        {/* 4 · Integrate */}
        <Stage
          label="Integrate"
          state={state.integrated ? "done" : state.stage === "integrate" ? "current" : "ahead"}
          accent={accent}
          doneLine={integrateSaved || "Integrated."}
          editable
        >
          {!state.practiced && (
            <p className="text-label text-muted-foreground/75 mb-2">Best answered after you have run the practice.</p>
          )}
          <AnswerBox
            prompt={article.integrate_prompt ?? ""}
            initial={integrateSaved}
            accent={accent}
            saving={save.isPending || markIntegrated.isPending}
            cta="Close the loop"
            onSave={async (text) => {
              await save.mutateAsync({ stage: "integrate", answer: text });
              if (text.trim()) {
                await markIntegrated.mutateAsync({ articleId: article.id });
                hapticNotification("success");
                void track(FUNNEL.vaultIntegrated, props);
              }
            }}
          />
        </Stage>
      </div>

      {state.stage === "done" && (
        <div className="pt-4">
          <p className="font-display text-subhead font-black tracking-tight leading-tight">Loop closed.</p>
          <p className="text-note text-muted-foreground mt-1 leading-relaxed">
            {master ? `${master.name}'s lens is yours to use now. ` : ""}
            {nextSlug && path ? `Next on ${path.title}:` : "Pick the next piece on the map."}
          </p>
          {nextSlug && onOpenSlug && (
            <Button variant="ember-outline" size="lg" className="mt-3 w-full" onClick={() => onOpenSlug(nextSlug)}>
              Open the next piece
            </Button>
          )}
        </div>
      )}

      <p className="flex items-center justify-center gap-1 text-label text-muted-foreground/75 pt-4">
        <Lock size={10} aria-hidden /> Your answers are private. Only the practice becomes progress.
      </p>
    </section>
  );
};

/** One stage: folded to a line when done or ahead, open when current. */
const Stage = ({
  label,
  state,
  accent,
  doneLine,
  editable,
  children,
}: {
  label: string;
  state: "done" | "current" | "ahead";
  accent: string;
  doneLine: string;
  editable?: boolean;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const expanded = state === "current" || open;
  return (
    <div className="py-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 h-4 w-4 rounded-full shrink-0 flex items-center justify-center border"
          style={
            state === "done"
              ? { background: accent, borderColor: accent, color: "hsl(var(--background))" }
              : state === "current"
                ? { borderColor: accent }
                : { borderColor: "hsl(var(--border) / 0.6)" }
          }
        >
          {state === "done" && <Check size={10} strokeWidth={3.5} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p
              className={cn("font-display text-read font-black tracking-tight", state === "ahead" && "text-muted-foreground/75")}
            >
              {label}
            </p>
            {state === "done" && editable && !open && (
              <button type="button" onClick={() => setOpen(true)} className="text-label font-bold text-muted-foreground min-h-11 -my-3 px-2">
                Edit
              </button>
            )}
            {state === "done" && editable && open && (
              <button type="button" onClick={() => setOpen(false)} className="text-label font-bold text-muted-foreground min-h-11 -my-3 px-2">
                Done
              </button>
            )}
          </div>
          {state === "done" && !open && (
            <p className="text-meta text-muted-foreground leading-snug mt-0.5 line-clamp-2">{doneLine}</p>
          )}
          {expanded && state !== "ahead" && <div className="mt-2">{children}</div>}
        </div>
      </div>
    </div>
  );
};

/** A question and a private answer. Saves on the button, not on every keystroke. */
const AnswerBox = ({
  prompt,
  initial,
  accent,
  saving,
  cta,
  onSave,
}: {
  prompt: string;
  initial: string;
  accent: string;
  saving: boolean;
  cta: string;
  onSave: (text: string) => Promise<void>;
}) => {
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [initial]);
  const dirty = text.trim() !== initial.trim();
  return (
    <div>
      <p className="font-display text-lead font-black tracking-tight leading-[1.25]">{prompt}</p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 1200))}
        rows={4}
        placeholder="In your own words. Nobody else reads this."
        aria-label={prompt}
        className="mt-3 text-copy leading-relaxed bg-card/50 border-border/50 rounded-xl min-h-[96px] resize-y focus-visible:ring-1"
        style={{ caretColor: accent }}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-label text-muted-foreground/75 tabular-nums">{text.length > 900 ? `${1200 - text.length} left` : ""}</span>
        <Button
          variant="ember"
          className="min-h-11 px-5"
          disabled={!dirty || saving || !text.trim()}
          onClick={async () => {
            hapticImpact("light");
            try {
              await onSave(text);
            } catch (e: unknown) {
              toast.error("Couldn't save", { description: e instanceof Error ? e.message : undefined });
            }
          }}
        >
          {saving ? "Saving…" : cta}
        </Button>
      </div>
    </div>
  );
};

/** The exercise, its steps, an optional timer, and the one button that counts. */
const PracticeBox = ({
  steps,
  minutes,
  accent,
  pending,
  onDone,
}: {
  steps: string[];
  minutes: number | null;
  accent: string;
  pending: boolean;
  onDone: () => void;
}) => {
  const timed = !!minutes && minutes <= 15;
  const [left, setLeft] = useState<number | null>(null);
  const tick = useRef<number | null>(null);
  useEffect(() => () => { if (tick.current) window.clearInterval(tick.current); }, []);

  const start = () => {
    hapticImpact("light");
    setLeft(minutes! * 60);
    tick.current = window.setInterval(() => {
      setLeft((s) => {
        if (s == null || s <= 1) {
          if (tick.current) window.clearInterval(tick.current);
          if (s === 1) hapticNotification("success");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };
  const stop = () => {
    if (tick.current) window.clearInterval(tick.current);
    setLeft(null);
  };
  const mmss = left != null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : null;

  return (
    <div>
      <p className="text-label font-bold text-muted-foreground">{practiceLength(minutes)}</p>
      <ol className="mt-2 space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2.5 text-dense">
            <span
              className="mt-px h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-label font-black"
              style={{ background: `${accent}25`, color: accent, border: `1px solid ${accent}55` }}
            >
              {i + 1}
            </span>
            <span className="text-foreground/95 leading-snug">{step}</span>
          </li>
        ))}
      </ol>

      {timed && (
        <div className="mt-4 flex items-center gap-3">
          {left == null ? (
            <Button variant="outline" size="pill" className="min-h-11" onClick={start}>
              <Play size={12} aria-hidden /> Start {minutes} min
            </Button>
          ) : (
            <>
              <span
                className="font-display text-major font-black tabular-nums tracking-tight"
                style={{ color: left === 0 ? accent : undefined }}
                aria-live="polite"
              >
                {left === 0 ? "Time." : mmss}
              </span>
              {left > 0 && (
                <button type="button" onClick={stop} aria-label="Stop timer" className="press rounded-full border border-border/60 p-2 text-muted-foreground min-h-11 min-w-11 flex items-center justify-center">
                  <Square size={12} aria-hidden />
                </button>
              )}
            </>
          )}
        </div>
      )}

      <Button variant="ember" size="lg" className="mt-4 w-full" onClick={onDone} disabled={pending}>
        {pending ? "Recording…" : `I ran the practice · +${PRACTICE_XP} XP`}
      </Button>
    </div>
  );
};

export default PracticeLoop;
