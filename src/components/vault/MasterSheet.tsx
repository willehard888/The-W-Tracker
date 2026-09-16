import { Check, ChevronRight } from "lucide-react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { hapticImpact } from "@/lib/haptics";
import { MASTER_KIND_LABEL, type VaultMaster } from "@/data/vault-masters";
import { pathOfArticle } from "@/data/vault-paths";
import type { VaultArticleSummary } from "@/hooks/use-vault-articles";

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
      <p className="mt-3 text-meta text-muted-foreground leading-relaxed">
        {MASTER_KIND_LABEL[master.kind]}. Read for the practice you can run this week; the evidence chip on each piece rates that practice, not the worldview.
      </p>

      <p className="mt-5 text-label font-bold text-muted-foreground">Ideas in the Vault</p>
      <ol className="mt-1 divide-y divide-border/35">
        {ideas.map((a) => {
          const done = practiced.has(a.slug);
          const path = pathOfArticle(a.slug);
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => {
                  hapticImpact("light");
                  onOpenSlug(a.slug);
                }}
                className="w-full flex items-start gap-3 py-3.5 text-left"
              >
                <span className="flex-1 min-w-0">
                  <span className="block font-display text-dense font-black tracking-tight leading-tight">{a.title}</span>
                  {a.subtitle && <span className="block text-meta text-muted-foreground leading-snug mt-0.5">{a.subtitle}</span>}
                  <span className="block text-label font-bold text-muted-foreground mt-1.5" style={done ? { color: accent } : undefined}>
                    {done ? "Practised" : `${a.read_time_min} min`}
                    {path ? ` · ${path.title}` : ""}
                  </span>
                </span>
                {done ? (
                  <Check size={14} className="shrink-0 mt-0.5" style={{ color: accent }} aria-hidden />
                ) : (
                  <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-label font-bold text-muted-foreground">Works</p>
      <ul className="mt-1 space-y-1">
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
