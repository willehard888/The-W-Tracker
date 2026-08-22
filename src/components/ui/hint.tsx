import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHowItWorks } from "@/components/HowItWorksSheet";
import type { HowBeatKey } from "@/lib/how-it-works";

interface HintProps {
  /** Which beat of "How The W works" the (i) opens. */
  beat: HowBeatKey;
  children: React.ReactNode;
  className?: string;
}

/**
 * One quiet teaching line + (i). The same component under every header that
 * needs a "why": Core 4, Extras, Ranks, empty feeds. Never louder than 11px.
 */
const Hint = ({ beat, children, className }: HintProps) => {
  const how = useHowItWorks();
  return (
    <p className={cn("text-[11px] text-muted-foreground leading-snug flex items-start gap-1.5", className)}>
      <span className="min-w-0">{children}</span>
      {how && (
        <button
          type="button"
          onClick={() => how.open(beat)}
          aria-label="How this works"
          className="shrink-0 mt-px text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <Info size={12} />
        </button>
      )}
    </p>
  );
};

export default Hint;
