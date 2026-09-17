import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { localDayIndex, pickDaily } from "@/lib/daily-rotation";
import { DAILY_INSIGHTS } from "@/data/daily-insights";
import { hapticImpact } from "@/lib/haptics";

/**
 * The non-member face of the Vault on Home: an editorial pull-quote that
 * deep-links into its lesson (and so onto the paywall). Its own lazy file
 * because the quote pool is ~21 kB that members and trialists, who get
 * Today's practice instead, never read.
 *
 * Two pools alternate by local day: the Wisdom course one day, Inner Work and
 * Longevity the next.
 */
const WISDOM = DAILY_INSIGHTS.filter((i) => i.id.startsWith("wis-"));
const REST = DAILY_INSIGHTS.filter((i) => !i.id.startsWith("wis-"));

const InsightQuote = () => {
  const navigate = useNavigate();
  const insight = pickDaily(localDayIndex() % 2 === 0 ? WISDOM : REST, "insight");

  return (
    <button
      type="button"
      onClick={() => {
        hapticImpact("light");
        navigate(`/vault?lesson=${insight.lessonSlug}`);
      }}
      className="group relative w-full text-left px-1.5 active:opacity-80 transition-opacity"
    >
      {/* Oversized quote watermark — an editorial premium device, faint gold,
          behind the text. Purely typographic; hidden from screen readers. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-3 left-0 font-display font-black text-[64px] leading-none text-gold/[0.10] select-none"
      >
        &ldquo;
      </span>
      {/* Thin gold rule as the quote's anchor — a hairline, not a slab. */}
      <span aria-hidden className="block h-px w-8 bg-gradient-to-r from-gold/70 to-transparent mb-3" />
      <p className="relative font-display text-subhead leading-[1.35] tracking-tight text-foreground/90">
        {insight.text}
      </p>
      <p className="flex items-center gap-1 text-label font-bold text-muted-foreground mt-3">
        From the Vault{insight.source ? ` · ${insight.source}` : ""}
        <ChevronRight aria-hidden size={12} className="text-gold/70 transition-transform group-active:translate-x-0.5" />
      </p>
    </button>
  );
};

export default InsightQuote;
