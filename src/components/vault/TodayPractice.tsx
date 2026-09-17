import { ChevronRight } from "lucide-react";
import { useTodaysPractice } from "@/hooks/use-todays-practice";
import { hapticImpact } from "@/lib/haptics";
import { practiceLength, PRACTICE_XP } from "@/lib/vault-loop";
import { DIMENSION_LABEL } from "@/data/vault-paths";
import { cn } from "@/lib/utils";

/**
 * Today in the Vault: one thinker's lens, one piece, one question, one
 * practice. Type-only, like the pull-quote it replaces on Home: a hairline,
 * the lens in the display face, the question, and one door. The reason is a
 * number the member logged themselves; done-for-today reads as a settled
 * line, not a badge.
 */
const TodayPractice = ({ onOpen, className }: { onOpen: (slug: string) => void; className?: string }) => {
  const { pick, loading } = useTodaysPractice();

  if (loading && !pick) {
    return (
      <div className={cn("px-1.5", className)} aria-hidden>
        <span className="block h-px w-8 bg-gradient-to-r from-gold/70 to-transparent mb-3" />
        <div className="h-6 w-4/5 rounded-lg bg-card/40 skeleton-block" />
        <div className="h-4 w-3/5 rounded-lg bg-card/40 skeleton-block mt-2" />
      </div>
    );
  }
  if (!pick) return null;

  const { article, path, master, reason, doneToday, progress } = pick;
  const lens = master?.lens ?? article.summary.split(". ")[0] + ".";

  return (
    <button
      type="button"
      onClick={() => {
        hapticImpact("light");
        onOpen(article.slug);
      }}
      className={cn("group relative block w-full text-left px-1.5 active:opacity-80 transition-opacity", className)}
    >
      <span aria-hidden className="block h-px w-8 bg-gradient-to-r from-gold/70 to-transparent mb-3" />
      <p className="text-label font-bold text-muted-foreground">
        {doneToday ? "Today's practice is run" : "Today in the Vault"}
        {path ? ` · ${path.title}` : ""}
        {progress.total > 0 ? ` · ${progress.done} of ${progress.total}` : ""}
      </p>
      <p className="mt-2 font-display text-subhead leading-[1.3] tracking-tight text-foreground/90">{lens}</p>
      <p className="mt-2 text-meta text-muted-foreground leading-relaxed">
        <span className="text-foreground/85 font-semibold">{article.title}</span>
        {master ? ` · ${master.name}` : ""}
      </p>
      {article.reflect_prompt && !doneToday && (
        <p className="mt-2 text-dense text-foreground/80 leading-snug">{article.reflect_prompt}</p>
      )}
      <p className="flex items-center gap-1 whitespace-nowrap text-label font-bold text-muted-foreground mt-3">
        {doneToday
          ? "Open the next piece"
          : `Open · ${practiceLength(article.practice_minutes)} · +${PRACTICE_XP} XP`}
        <ChevronRight aria-hidden size={12} className="text-gold/70 transition-transform group-active:translate-x-0.5" />
      </p>
      <p className="mt-1 text-label text-muted-foreground/75 leading-snug">{reason}</p>
      {path && <span className="sr-only">{DIMENSION_LABEL[path.dimension]}</span>}
    </button>
  );
};

export default TodayPractice;
