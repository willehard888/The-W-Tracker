import { BottomSheet } from "@/components/ui/sheet-bottom";
import { hapticImpact } from "@/lib/haptics";
import { MASTER_KIND_LABEL, type VaultMaster } from "@/data/vault-masters";
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
  accent,
  open,
  onClose,
  articles,
  practiced,
  onOpenSlug,
}: {
  master: VaultMaster | null;
  accent: string;
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
      <p className="font-display text-title font-black tracking-tight leading-[1.15] pt-1">{master.lens}</p>
      <p className="mt-3 text-note text-muted-foreground leading-relaxed">
        {MASTER_KIND_LABEL[master.kind]}. Read for the practice you can run this week; the evidence chip on each piece rates that practice, not the worldview.
      </p>

      <div className="mt-6">
        <SectionHeader label="Ideas in the Vault" />
      </div>
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
                accent={accent}
                onClick={() => {
                  hapticImpact("light");
                  onOpenSlug(a.slug);
                }}
              />
            </li>
          );
        })}
      </ol>

      <div className="mt-6">
        <SectionHeader label="Works" />
      </div>
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
