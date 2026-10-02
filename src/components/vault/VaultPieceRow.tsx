import type { ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVIDENCE_LABEL } from "./EvidenceChip";
import type { VaultArticleSummary } from "@/hooks/use-vault-articles";

/** The meta line every piece row carries: the tier and the length, or that it is practised. */
export const pieceMeta = (a: Pick<VaultArticleSummary, "evidence_tier" | "read_time_min">, practised: boolean, extra?: string) =>
  `${practised ? "Practised" : `${EVIDENCE_LABEL[a.evidence_tier]} · ${a.read_time_min} min`}${extra ? ` · ${extra}` : ""}`;

/**
 * One piece, one row: on the shelf, on a path and under a master. A lead (the
 * lesson number or the step), an optional line above the title (the path's
 * beat), the title, a subtitle, the meta line, and where the reader stands.
 * The DoorRow silhouette (src/components/coach/rows.tsx) with a third line:
 * same title rung, same 16 px chevron at /75, same rhythm.
 */
const VaultPieceRow = ({
  lead,
  kicker,
  title,
  subtitle,
  meta,
  done,
  accent,
  dimmed,
  disabled,
  className,
  onClick,
}: {
  lead?: ReactNode;
  kicker?: ReactNode;
  title: string;
  subtitle?: string | null;
  meta?: string;
  /** Read or practised: the meta line and the mark take the accent. */
  done: boolean;
  accent: string;
  /** A step still ahead on a path. */
  dimmed?: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={cn("press-row w-full min-h-11 flex items-start gap-3 py-3 text-left disabled:opacity-50", className)}
  >
    {lead}
    <span className="flex-1 min-w-0">
      {kicker}
      <span className={cn("block text-note font-semibold leading-tight", kicker && "mt-0.5", dimmed && "text-foreground/85")}>
        {title}
      </span>
      {subtitle && <span className="block text-meta text-muted-foreground leading-snug mt-0.5 truncate">{subtitle}</span>}
      {meta && (
        <span className={cn("block text-label font-bold mt-1.5", !done && "text-muted-foreground")} style={done ? { color: accent } : undefined}>
          {meta}
        </span>
      )}
    </span>
    {done ? (
      <Check size={16} className="shrink-0 mt-0.5" style={{ color: accent }} aria-hidden />
    ) : (
      <ChevronRight size={16} className="text-muted-foreground/75 shrink-0 mt-0.5" aria-hidden />
    )}
  </button>
);

export default VaultPieceRow;
