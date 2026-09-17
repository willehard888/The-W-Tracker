import { Children, isValidElement, useEffect, type ReactElement, type ReactNode } from "react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { ErrorState } from "@/components/ui/error-state";
import ReactMarkdown from "react-markdown";
import { Clock, CheckCircle2, AlertTriangle, BookMarked, Target, Lightbulb, ListChecks, Library } from "lucide-react";
import EvidenceChip, { VaultChip } from "./EvidenceChip";
import SectionHeader from "./SectionHeader";
import PracticeLoop from "./PracticeLoop";
import { useVaultArticle, useVaultArticles, type VaultArticle, type VaultArticleSummary } from "@/hooks/use-vault-articles";
import { useVaultProgress } from "@/hooks/use-vault-progress";
import type { PracticeResult } from "@/hooks/use-vault-practice";
import { MASTER_BY_SLUG } from "@/data/vault-masters";
import { pathOfArticle } from "@/data/vault-paths";
import { track, FUNNEL } from "@/lib/analytics";

/**
 * One piece, top to bottom: what it is (hero), why it matters, the dose (the
 * one card), the reading, what to keep, what it gives and where it stops, then
 * the loop that turns it into a practice, and the sources. The shelf's accent
 * marks identity (chip, subtitle, section marks); every action is one of the
 * app's buttons, the same on every shelf.
 */

const EMPTY_FULL: Omit<VaultArticle, keyof VaultArticleSummary> = {
  protocol: {},
  benefits: [],
  risks: [],
  body_md: "",
  references_json: [],
  why_it_matters: null,
  try_today: [],
  key_takeaways: [],
  quiz: [],
  integrate_prompt: null,
};

/**
 * Bodies are written as a bold line, a newline, then the paragraph
 * (docs/VAULT_VOICE.md). That bold line is a section heading, so it renders as
 * one; a bold term inside a sentence stays inline.
 */
export const BodyParagraph = ({ children }: { children?: ReactNode }) => {
  const [first, second, ...rest] = Children.toArray(children);
  const heading =
    isValidElement(first) &&
    first.type === "strong" &&
    (second === undefined || (typeof second === "string" && second.startsWith("\n")));
  if (!heading) return <p>{children}</p>;
  return (
    <>
      <h4 className="font-display text-read font-black tracking-tight text-foreground mt-6 mb-1 first:mt-0">
        {(first as ReactElement<{ children?: ReactNode }>).props.children}
      </h4>
      {second !== undefined && (
        <p>
          {(second as string).replace(/^\n/, "")}
          {rest}
        </p>
      )}
    </>
  );
};

const VaultArticleSheet = ({
  article: summary,
  accent,
  open,
  onClose,
  onOpenSlug,
  onPracticed,
}: {
  article: VaultArticleSummary | null;
  accent: string;
  open: boolean;
  onClose: () => void;
  /** Open another piece from inside this one (the next step on a path). */
  onOpenSlug?: (slug: string) => void;
  onPracticed?: (r: PracticeResult) => void;
}) => {
  // The index carries titles and summaries only; the body, protocol, quiz and
  // references arrive by id when a piece opens (see use-vault-articles.ts).
  // Until they land the header paints from the summary and the body shows a
  // skeleton.
  const { data: full, isLoading: bodyLoading, isError: bodyFailed, refetch } = useVaultArticle(summary?.id);
  const article: VaultArticle | null = summary
    ? full && full.id === summary.id
      ? full
      : { ...summary, ...EMPTY_FULL }
    : null;
  const { data: progress } = useVaultProgress();

  // Course length for the "Lesson N of M" chip, counted from the cached library.
  const { data: allArticles } = useVaultArticles();
  const courseTotal = article
    ? (allArticles ?? []).filter((a) => a.category_id === article.category_id && a.lesson_number != null).length
    : 0;

  const progressRow = progress?.find((p) => p.article_id === article?.id);
  const master = article?.master_slug ? MASTER_BY_SLUG[article.master_slug] : undefined;
  const path = article ? pathOfArticle(article.slug) : undefined;
  const isIdea = article?.category_id === "wisdom" || article?.category_id === "inner-work";
  const loaded = !!full && full.id === summary?.id;
  const protocol = article?.protocol;
  const hasProtocol = !!(protocol?.duration || protocol?.intensity || protocol?.frequency || protocol?.prerequisites);

  // One open event per piece.
  useEffect(() => {
    if (open && summary) {
      void track(FUNNEL.lessonOpened, { slug: summary.slug, master: summary.master_slug ?? null, path: pathOfArticle(summary.slug)?.slug ?? null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.id, open]);

  return (
    <BottomSheet open={open && !!article} onClose={onClose} label={article?.title ?? "Article"} height="tall">
      {article && (
        <>
          {/* Hero */}
          <header
            className="relative -mx-4 px-4 pt-3 pb-5 border-b border-border/40"
            style={{ background: `linear-gradient(180deg, ${accent}22 0%, transparent 100%)` }}
          >
            <div className="flex items-center gap-1.5 flex-wrap mb-2.5 pr-10">
              {article.lesson_number && (
                <VaultChip style={{ background: `${accent}22`, color: accent, borderColor: `${accent}55` }}>
                  {`Lesson ${article.lesson_number}${courseTotal ? ` of ${courseTotal}` : ""}${
                    article.course_role === "foundations" ? " · Foundations" : ""
                  }`}
                </VaultChip>
              )}
              <EvidenceChip tier={article.evidence_tier} />
              <VaultChip className="border-border/50 bg-card/80 text-muted-foreground tabular-nums">
                <Clock aria-hidden size={10} strokeWidth={3} />
                {article.read_time_min} min
              </VaultChip>
            </div>

            <h2 className="font-display text-title leading-[1.08] font-black tracking-tight pr-8 text-balance">{article.title}</h2>
            {article.subtitle && (
              <p className="text-dense mt-1.5 font-medium leading-snug" style={{ color: accent }}>
                {article.subtitle}
              </p>
            )}
            <p className="text-note text-muted-foreground mt-2.5 leading-relaxed">{article.summary}</p>
            {(master || path) && (
              <p className="text-label font-bold text-muted-foreground mt-2.5">
                {[master ? `${master.name} · ${master.tradition}` : "", path?.title ?? ""].filter(Boolean).join(" · ")}
              </p>
            )}
          </header>

          <div className="pt-6 pb-2 space-y-7">
            {article.why_it_matters && (
              <section>
                <SectionHeader Icon={Lightbulb} label="Why it matters" color={accent} />
                <p className="text-note text-foreground/90 leading-relaxed">{article.why_it_matters}</p>
              </section>
            )}

            {/* The dose: the one card on the sheet. */}
            {hasProtocol && protocol && (
              <section className="rounded-2xl border border-border/50 bg-card/40 p-4">
                <SectionHeader Icon={Target} label="Protocol" color={accent} />
                <dl className="space-y-2.5">
                  {protocol.duration && <ProtocolRow label="Duration" value={protocol.duration} />}
                  {protocol.intensity && <ProtocolRow label="Intensity / dose" value={protocol.intensity} />}
                  {protocol.frequency && <ProtocolRow label="Frequency" value={protocol.frequency} />}
                  {protocol.prerequisites && <ProtocolRow label="Prerequisites" value={protocol.prerequisites} />}
                </dl>
              </section>
            )}

            <section>
              <SectionHeader Icon={BookMarked} label={isIdea ? "The idea" : "The science"} color={accent} />
              {bodyFailed && !article.body_md ? (
                <ErrorState size="compact" title="Couldn't load this piece" onRetry={refetch} />
              ) : bodyLoading && !article.body_md ? (
                <div className="space-y-2.5" aria-hidden>
                  {[92, 100, 84, 96, 60].map((w, i) => (
                    <div key={i} className="h-4 rounded skeleton-block bg-card/40" style={{ width: `${w}%` }} />
                  ))}
                </div>
              ) : (
                <article className="vault-body text-read leading-relaxed text-foreground/90">
                  <ReactMarkdown components={{ p: BodyParagraph }}>{article.body_md}</ReactMarkdown>
                </article>
              )}
            </section>

            {article.key_takeaways?.length > 0 && (
              <section>
                <SectionHeader Icon={ListChecks} label="Key takeaways" color={accent} />
                <ul className="space-y-2">
                  {article.key_takeaways.map((k, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-dense">
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: accent }} />
                      <span className="text-foreground/90 leading-snug">{k}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {article.benefits.length > 0 && (
              <section>
                <SectionHeader Icon={CheckCircle2} label={isIdea ? "What it gives you" : "Expected benefits"} />
                <ul className="space-y-2">
                  {article.benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-dense">
                      <CheckCircle2 aria-hidden size={13} className="mt-0.5 shrink-0 text-xp-green" strokeWidth={2.6} />
                      <span className="text-foreground/90 leading-snug">{b}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {article.risks.length > 0 && (
              <section>
                <SectionHeader Icon={AlertTriangle} label={isIdea ? "Where it is honest about its limits" : "Risks and limits"} />
                <ul className="space-y-2">
                  {article.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-dense">
                      <AlertTriangle aria-hidden size={13} className="mt-0.5 shrink-0 text-amber-light" strokeWidth={2.6} />
                      <span className="text-foreground/90 leading-snug">{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {loaded && (
              <div className="pt-6 border-t border-border/30">
                <PracticeLoop
                  key={article.id}
                  article={article}
                  accent={accent}
                  progress={progressRow}
                  onPracticed={onPracticed}
                  onOpenSlug={onOpenSlug}
                />
              </div>
            )}

            {article.references_json?.length > 0 && (
              <section className="pt-6 border-t border-border/30">
                <SectionHeader Icon={Library} label="References" />
                <ol className="space-y-1.5 text-meta text-muted-foreground list-decimal list-inside">
                  {article.references_json.map((r, i) => (
                    <li key={i} className="leading-snug">
                      <span className="text-foreground/85 font-semibold">{r.author}</span>
                      {r.year ? ` (${r.year < 0 ? `${-r.year} BC` : r.year})` : ""}
                      {": "}
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noreferrer" className="text-gold underline-offset-2 hover:underline">
                          {r.title}
                        </a>
                      ) : (
                        <span className="italic">{r.title}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <p className="text-label text-muted-foreground/75 text-center">Educational content, not a substitute for medical advice.</p>
          </div>
        </>
      )}
    </BottomSheet>
  );
};

const ProtocolRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5">
    <dt className="text-label font-bold text-muted-foreground">{label}</dt>
    <dd className="text-dense text-foreground/95 leading-snug">{value}</dd>
  </div>
);

export default VaultArticleSheet;
