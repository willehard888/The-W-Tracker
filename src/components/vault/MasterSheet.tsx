import { BookOpen } from "lucide-react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import EmptyState from "@/components/ui/empty-state";
import { MASTER_KIND_LABEL, type VaultMaster } from "@/data/vault-masters";
import { accentOf } from "./categories";
import { pathOfArticle } from "@/data/vault-paths";
import type { VaultArticleSummary } from "@/hooks/use-vault-articles";
import VaultPieceRow, { pieceMeta } from "./VaultPieceRow";
import SectionHeader from "./SectionHeader";

/**
 * One thinker: the lens in the display face, what kind of claim their work
 * makes (so philosophy is never mistaken for evidence), the works, and the
 * ideas in the Vault that carry their name.
 */
const MasterSheet = ({
  master,
  open,
  onClose,
  articles,
  practiced,
  onOpenSlug,
}: {
  master: VaultMaster | null;
  open: boolean;
  onClose: () => void;
  articles: VaultArticleSummary[];
  practiced: ReadonlySet<string>;
  onOpenSlug: (slug: string) => void;
}) => {
  if (!master) return null;
  const ideas = articles.filter((a) => a.master_slug === master.slug);

  return (
    <BottomSheet open={open} onClose={onClose} label={master.name} title={master.name} subtitle={`${master.lived} · ${master.tradition}`}>
      {/* The lens voice — the same line Today in the Vault speaks in. */}
      <p className="font-display text-subhead leading-snug tracking-tight text-foreground pt-1">{master.lens}</p>
      <p className="mt-3 text-note text-muted-foreground leading-relaxed">
        {MASTER_KIND_LABEL[master.kind]}. Read for the practice you can run this week; the evidence chip on each piece rates that practice, not the worldview.
      </p>

      <SectionHeader label="Ideas in the Vault" className="mt-6" />
      {ideas.length === 0 ? (
        <EmptyState size="compact" icon={BookOpen} title="No pieces yet" />
      ) : (
      <ol className="divide-y divide-border/35">
        {ideas.map((a) => {
          const done = practiced.has(a.slug);
          const path = pathOfArticle(a.slug);
          return (
            <li key={a.id}>
              <VaultPieceRow
                title={a.title}
                subtitle={a.subtitle}
                meta={pieceMeta(a, done, path?.title)}
                done={done}
                accent={accentOf(a.category_id)}
                onClick={() => onOpenSlug(a.slug)}
              />
            </li>
          );
        })}
      </ol>
      )}

      <SectionHeader label="Works" className="mt-6" />
      <ul className="space-y-1">
        {master.works.map((w) => (
          <li key={w.title} className="text-meta text-foreground/85 leading-snug">
            <span className="italic">{w.title}</span>
            <span className="text-muted-foreground"> · {w.year < 0 ? `${-w.year} BC` : w.year}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-label text-muted-foreground/75 leading-snug">
        Original lessons on published ideas. Not affiliated with the author, estate or publisher.
      </p>
    </BottomSheet>
  );
};

export default MasterSheet;
