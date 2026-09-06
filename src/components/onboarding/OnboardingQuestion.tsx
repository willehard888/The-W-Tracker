import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { hapticSelection } from "@/lib/haptics";
import type { OnboardingOption } from "@/lib/onboarding";

interface SingleProps {
  mode: "single";
  options: OnboardingOption[];
  value?: string;
  /** Called once, ~250ms after the tap so the gold state lands first. */
  onAnswer: (v: string) => void;
}

interface MultiProps {
  mode: "multi";
  options: OnboardingOption[];
  value?: string[];
  onAnswer: (v: string[]) => void;
  continueLabel?: string;
  /** Multi allows an empty pick ("or none") when true. */
  allowEmpty?: boolean;
}

type Props = (SingleProps | MultiProps) & {
  title: string;
  sub?: string;
  /** Compact chip grid instead of full-width rows (used for sports). */
  dense?: boolean;
};

/**
 * One onboarding question — the waitlist-quiz interaction model rebuilt in
 * the app's design language: single-select auto-advances after a beat so the
 * gold selection state registers; multi-select gates a Continue button.
 */
const OnboardingQuestion = (props: Props) => {
  const { title, sub, options, dense } = props;
  const [picked, setPicked] = useState<string | null>(
    props.mode === "single" ? props.value ?? null : null,
  );
  const [multi, setMulti] = useState<string[]>(
    props.mode === "multi" ? props.value ?? [] : [],
  );
  const advanced = useRef(false);

  const pickSingle = (v: string) => {
    if (props.mode !== "single" || advanced.current) return;
    hapticSelection();
    setPicked(v);
    advanced.current = true;
    setTimeout(() => props.onAnswer(v), 250);
  };

  const toggleMulti = (v: string) => {
    if (props.mode !== "multi") return;
    hapticSelection();
    setMulti((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  };

  const selected = (v: string) =>
    props.mode === "single" ? picked === v : multi.includes(v);

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col min-h-0 flex-1">
      <h1 className="font-display text-[26px] leading-tight font-black tracking-tight text-center mb-1.5">
        {title}
      </h1>
      {sub && <p className="text-sm text-muted-foreground text-center mb-5">{sub}</p>}
      {!sub && <div className="mb-5" />}

      <div
        className={cn(
          "min-h-0 overflow-y-auto pb-2",
          dense ? "flex flex-wrap justify-center gap-2 content-start" : "space-y-2.5",
        )}
      >
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => (props.mode === "single" ? pickSingle(o.v) : toggleMulti(o.v))}
            className={cn(
              "press text-left transition-all ",
              dense
                ? "rounded-full px-3.5 py-2 text-[13px] font-bold border inline-flex items-center gap-1.5"
                : "w-full rounded-2xl border p-4 flex items-start gap-3",
              selected(o.v)
                ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.08)] shadow-[0_0_24px_-8px_hsl(var(--gold)/0.6)]"
                : "border-border/40 bg-card/40",
            )}
          >
            {o.emoji && <span className={dense ? "text-sm" : "text-xl leading-none mt-0.5"}>{o.emoji}</span>}
            <span className="min-w-0">
              <span className={cn("block font-bold text-foreground", dense ? "text-[13px]" : "text-[15px]")}>
                {o.label}
              </span>
              {!dense && o.desc && (
                <span className="block text-xs text-muted-foreground leading-snug mt-0.5">{o.desc}</span>
              )}
            </span>
            {!dense && (
              <span
                aria-hidden
                className={cn(
                  "ml-auto mt-1 h-[18px] w-[18px] shrink-0 rounded-full border-2 transition-colors",
                  selected(o.v)
                    ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold))] shadow-[0_0_8px_hsl(var(--gold)/0.6)]"
                    : "border-border",
                )}
              />
            )}
          </button>
        ))}
      </div>

      {props.mode === "multi" && (
        <div className="pt-4 mt-auto">
          <Button
            variant="ember"
            size="xl"
            className="w-full"
            disabled={!props.allowEmpty && multi.length === 0}
            onClick={() => props.onAnswer(multi)}
          >
            {props.continueLabel ?? "Continue"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default OnboardingQuestion;
