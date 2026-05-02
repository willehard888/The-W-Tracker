import ReactMarkdown from "react-markdown";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Clock, CheckCircle2, AlertTriangle, BookMarked, Target, X } from "lucide-react";
import EvidenceChip from "./EvidenceChip";
import type { VaultArticle } from "@/hooks/use-vault-articles";

const VaultArticleSheet = ({
  article,
  accent,
  open,
  onClose,
}: {
  article: VaultArticle | null;
  accent: string;
  open: boolean;
  onClose: () => void;
}) => {
  if (!article) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[90dvh] p-0 border-t border-border/40 bg-background overflow-hidden flex flex-col"
      >
        {/* Hero */}
        <div
          className="relative px-5 pt-5 pb-4 shrink-0 border-b border-border/40"
          style={{
            background: `linear-gradient(180deg, ${accent}22 0%, transparent 100%)`,
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center bg-card/80 border border-border/60 active:scale-95 transition"
            aria-label="Close"
          >
            <X size={14} />
          </button>

          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <EvidenceChip tier={article.evidence_tier} />
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-card/80 border border-border/50 text-[8.5px] font-black tracking-[0.16em] uppercase text-muted-foreground">
              <Clock size={8} strokeWidth={3} />
              {article.read_time_min} min
            </span>
          </div>

          <h2 className="font-display text-[22px] leading-[1.05] font-black tracking-tight pr-8">
            {article.title}
          </h2>
          {article.subtitle && (
            <p className="text-[12px] mt-1.5 font-medium" style={{ color: accent }}>
              {article.subtitle}
            </p>
          )}
          <p className="text-[12.5px] text-muted-foreground mt-2 leading-relaxed">
            {article.summary}
          </p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Protocol box */}
          {(article.protocol?.duration ||
            article.protocol?.intensity ||
            article.protocol?.frequency ||
            article.protocol?.prerequisites) && (
            <section
              className="rounded-2xl border p-4"
              style={{
                background: `linear-gradient(135deg, ${accent}18, hsl(var(--card)) 80%)`,
                borderColor: `${accent}55`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Target size={13} style={{ color: accent }} strokeWidth={2.6} />
                <p
                  className="text-[10px] font-black tracking-[0.18em] uppercase"
                  style={{ color: accent }}
                >
                  Protocol
                </p>
              </div>
              <dl className="space-y-2 text-[12.5px]">
                {article.protocol.duration && (
                  <ProtocolRow label="Duration" value={article.protocol.duration} />
                )}
                {article.protocol.intensity && (
                  <ProtocolRow label="Intensity / dose" value={article.protocol.intensity} />
                )}
                {article.protocol.frequency && (
                  <ProtocolRow label="Frequency" value={article.protocol.frequency} />
                )}
                {article.protocol.prerequisites && (
                  <ProtocolRow label="Prerequisites" value={article.protocol.prerequisites} />
                )}
              </dl>
            </section>
          )}

          {/* Benefits */}
          {article.benefits.length > 0 && (
            <section>
              <SectionHeader Icon={CheckCircle2} label="Expected benefits" color="hsl(142 70% 50%)" />
              <ul className="space-y-1.5">
                {article.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px]">
                    <CheckCircle2
                      size={13}
                      className="mt-[3px] shrink-0 text-emerald-400"
                      strokeWidth={2.6}
                    />
                    <span className="text-foreground/90">{b}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Risks */}
          {article.risks.length > 0 && (
            <section>
              <SectionHeader Icon={AlertTriangle} label="Risks & limits" color="hsl(35 90% 60%)" />
              <ul className="space-y-1.5">
                {article.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px]">
                    <AlertTriangle
                      size={13}
                      className="mt-[3px] shrink-0 text-amber-400"
                      strokeWidth={2.6}
                    />
                    <span className="text-foreground/90">{r}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Body */}
          <section>
            <SectionHeader Icon={BookMarked} label="The science" color={accent} />
            <article className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:tracking-tight prose-h2:text-[16px] prose-h2:mt-5 prose-h2:mb-2 prose-h3:text-[14px] prose-p:my-2 prose-p:leading-relaxed prose-li:my-0.5 prose-strong:text-foreground prose-table:text-[11.5px] prose-th:font-black prose-th:text-foreground prose-th:bg-card/60 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-td:border-border/40">
              <ReactMarkdown>{article.body_md}</ReactMarkdown>
            </article>
          </section>

          {/* References */}
          {article.references_json?.length > 0 && (
            <section className="pt-2 border-t border-border/30">
              <p className="text-[10px] font-black tracking-[0.18em] uppercase text-muted-foreground mb-2">
                References
              </p>
              <ol className="space-y-1.5 text-[11px] text-muted-foreground/90 list-decimal list-inside">
                {article.references_json.map((r, i) => (
                  <li key={i} className="leading-snug">
                    <span className="text-foreground/85 font-semibold">{r.author}</span>
                    {r.year ? ` (${r.year})` : ""} — {" "}
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gold underline-offset-2 hover:underline"
                      >
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

          <p className="text-[10px] text-muted-foreground/70 text-center pt-3 pb-4">
            Educational content — not a substitute for medical advice.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const ProtocolRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col">
    <dt className="text-[9.5px] font-black tracking-[0.16em] uppercase text-muted-foreground/80">
      {label}
    </dt>
    <dd className="text-foreground/95 leading-snug">{value}</dd>
  </div>
);

const SectionHeader = ({
  Icon,
  label,
  color,
}: {
  Icon: typeof CheckCircle2;
  label: string;
  color: string;
}) => (
  <div className="flex items-center gap-2 mb-2">
    <Icon size={13} style={{ color }} strokeWidth={2.6} />
    <p className="text-[10px] font-black tracking-[0.18em] uppercase" style={{ color }}>
      {label}
    </p>
  </div>
);

export default VaultArticleSheet;
