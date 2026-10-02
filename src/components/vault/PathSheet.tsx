import { BookOpen } from "lucide-react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import EmptyState from "@/components/ui/empty-state";
import AccentMark from "./AccentMark";
import { cn } from "@/lib/utils";
import { pathProgress } from "@/lib/vault-loop";
import { DIMENSION_LABEL, type VaultPath } from "@/data/vault-paths";
import { MASTER_BY_SLUG } from "@/data/vault-masters";
import type { VaultArticleSummary } from "@/hooks/use-vault-articles";
import VaultPieceRow, { pieceMeta } from "./VaultPieceRow";

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
      {/* The lens voice — the same line Today in the Vault speaks in. */}
      <p className="font-display text-subhead leading-snug tracking-tight text-foreground pt-1">{path.thesis}</p>

      {articles.length === 0 ? (
        <div className="mt-5"><EmptyState size="compact" icon={BookOpen} title="No pieces yet" /></div>
      ) : (
      <ol className="mt-5 divide-y divide-border/35" aria-label="Steps">
        {path.steps.map((slug, i) => {
          const a = bySlug.get(slug);
          const done = practiced.has(slug);
          const next = pp.next === slug;
          const master = a?.master_slug ? MASTER_BY_SLUG[a.master_slug] : undefined;
          return (
            <li key={slug}>
              <VaultPieceRow
                lead={
                  <AccentMark accent={accent} state={done ? "done" : next ? "current" : "idle"} className="mt-0.5">
                    {done ? undefined : i + 1}
                  </AccentMark>
                }
                kicker={
                  <span className={cn("block text-label font-bold", !next && "text-muted-foreground")} style={next ? { color: accent } : undefined}>
                    {path.beats[i]}
                    {next ? " · next" : ""}
                  </span>
                }
                title={a?.title ?? slug}
                meta={a ? pieceMeta(a, done, master?.name) : undefined}
                done={done}
                accent={accent}
                dimmed={!done && !next}
                disabled={!a}
                onClick={() => onOpenSlug(slug)}
              />
            </li>
          );
        })}
      </ol>
      )}

      {pp.complete && (
        <p className="mt-5 text-meta text-muted-foreground leading-relaxed">
          Walked. A path finished is a week changed; walk it again with a different week behind you, or pick another on the map.
        </p>
      )}
    </BottomSheet>
  );
};

export default PathSheet;
