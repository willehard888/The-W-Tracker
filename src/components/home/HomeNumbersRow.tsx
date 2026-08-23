import { ArrowUp, ChevronRight, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getTierConfig, topShareLabel } from "@/lib/status-tiers";
import { useStatusExplainer } from "@/components/status/StatusExplainerProvider";
import { hapticSelection } from "@/lib/haptics";
import type { MyRankData } from "@/hooks/use-my-rank";

interface HomeNumbersRowProps {
  tier: string;
  rankData?: MyRankData | null;
  /** Rank places climbed today (from the daily pulse snapshot). */
  rankDelta?: number;
  whealthIndex?: number | null;
}

/**
 * Home's two numbers, each labeled, each a door:
 *   Standing      — tier · #N of M · Top X%  → Ranks   ((i) → how status works)
 *   Whealth Index — health quality, 0–100     → Journey
 * Replaces the old rank strip (tier + #N + Lv + XP-to-next + unlabeled
 * W-Index chip) — status and health were one unlabeled blur.
 */
const HomeNumbersRow = ({ tier, rankData, rankDelta = 0, whealthIndex }: HomeNumbersRowProps) => {
  const navigate = useNavigate();
  const explainer = useStatusExplainer();
  const cfg = getTierConfig(tier);
  const ranked =
    rankData?.hasRank === true &&
    (rankData.rank ?? 0) > 0 &&
    (rankData.totalUsers ?? 0) > 0 &&
    rankData.rank! <= rankData.totalUsers!;

  return (
    <div className="surface-card grid grid-cols-2 divide-x divide-border/40 overflow-hidden">
      {/* Standing */}
      <button
        type="button"
        onClick={() => { hapticSelection(); navigate("/leaderboard"); }}
        className="text-left px-3.5 py-3 active:bg-gold/[0.04] transition-colors min-w-0"
      >
        <div className="flex items-center gap-1.5">
          <p className="eyebrow">Standing</p>
          <span
            role="button"
            tabIndex={0}
            aria-label="How status works"
            onClick={(e) => { e.stopPropagation(); explainer?.open(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); explainer?.open(); } }}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground"
          >
            <Info size={11} />
          </span>
        </div>
        <p className={cn("font-display font-black text-[15px] leading-tight mt-1 truncate", cfg.textClass)}>
          {cfg.label}
        </p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate tabular-nums">
          {ranked
            ? `#${rankData!.rank!.toLocaleString()} of ${rankData!.totalUsers!.toLocaleString()} · ${topShareLabel(tier, rankData)}`
            : "Unranked · check in to enter"}
        </p>
        {ranked && rankDelta > 0 && (
          <p className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-black text-teal">
            <ArrowUp size={10} strokeWidth={3} /> {rankDelta} today
          </p>
        )}
      </button>

      {/* Whealth Index */}
      <button
        type="button"
        onClick={() => { hapticSelection(); navigate("/journey"); }}
        className="text-left px-3.5 py-3 active:bg-gold/[0.04] transition-colors min-w-0 flex items-start justify-between gap-2"
      >
        <div className="min-w-0">
          <p className="eyebrow">Whealth Index</p>
          <p className="font-display font-black text-[22px] leading-none mt-1 text-gold tabular-nums">
            {whealthIndex != null ? Math.round(whealthIndex) : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-1 truncate">
            {whealthIndex != null ? "Health quality · 0–100" : "Builds from your check-ins"}
          </p>
        </div>
        <ChevronRight size={14} className="text-muted-foreground/60 shrink-0 mt-0.5" />
      </button>
    </div>
  );
};

export default HomeNumbersRow;
