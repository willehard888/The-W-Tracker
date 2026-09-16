import { Check, ChevronRight } from "lucide-react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { pathProgress } from "@/lib/vault-loop";
import { DIMENSION_LABEL, type VaultPath } from "@/data/vault-paths";
import { MASTER_BY_SLUG } from "@/data/vault-masters";
import type { VaultArticleSummary } from "@/hooks/use-vault-articles";

/**
 * One path: its thesis, then the walk. Each step is a beat verb, the piece,
 * its thinker, and where the walker is. The next step is the lit one; the
 * ones behind are ticked; the ones ahead wait in the muted colour.
 */
const PathSheet = ({
  path,
  accent,
  open,
  onClose,
  articles,
  practiced,
  onOpenSlug,
}: {
  path: VaultPath | null;
  accent: string;
  open: boolean;
  onClose: () => void;
  articles: VaultArticleSummary[];
  practiced: ReadonlySet<string>;
  onOpenSlug: (slug: string) => void;
}) => {
  if (!path) return null;
  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  const pp = pathProgress(path.steps, practiced);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={path.title}
      title={path.title}
      subtitle={`${DIMENSION_LABEL[path.dimension]} · ${pp.complete ? "walked" : `${pp.done} of ${pp.total} practised`}`}
    >
      <p className="font-display text-lead font-black tracking-tight leading-[1.25] pt-1">{path.thesis}</p>

      <ol className="mt-5 divide-y divide-border/35" aria-label="Steps">
        {path.steps.map((slug, i) => {
          const a = bySlug.get(slug);
          const done = practiced.has(slug);
          const next = pp.next === slug;
          const master = a?.master_slug ? MASTER_BY_SLUG[a.master_slug] : undefined;
          return (
            <li key={slug}>
              <button
                type="button"
                disabled={!a}
                onClick={() => {
                  hapticImpact("light");
                  onOpenSlug(slug);
                }}
                className="w-full flex items-start gap-3 py-3.5 text-left disabled:opacity-50"
              >
                <span
                  aria-hidden
                  className="mt-0.5 h-5 w-5 rounded-full shrink-0 flex items-center justify-center border text-label font-black"
                  style={
                    done
                      ? { background: accent, borderColor: accent, color: "hsl(var(--background))" }
                      : next
                        ? { borderColor: accent, color: accent }
                        : { borderColor: "hsl(var(--border) / 0.6)", color: "hsl(var(--muted-foreground) / 0.75)" }
                  }
                >
                  {done ? <Check size={11} strokeWidth={3.5} /> : i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={cn("block text-label font-bold", next ? "" : "text-muted-foreground")} style={next ? { color: accent } : undefined}>
                    {path.beats[i]}
                    {next ? " · next" : ""}
                  </span>
                  <span className={cn("block font-display text-dense font-black tracking-tight leading-tight mt-0.5", !done && !next && "text-foreground/80")}>
                    {a?.title ?? slug}
                  </span>
                  {master && <span className="block text-meta text-muted-foreground leading-snug mt-0.5">{master.name}</span>}
                </span>
                <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-1.5" aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>

      {pp.complete && (
        <p className="mt-5 text-meta text-muted-foreground leading-relaxed">
          Walked. A path finished is a week changed; walk it again with a different week behind you, or pick another on the map.
        </p>
      )}
    </BottomSheet>
  );
};

export default PathSheet;
