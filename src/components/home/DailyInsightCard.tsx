import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { pickDaily } from "@/lib/daily-rotation";
import { DAILY_INSIGHTS } from "@/data/daily-insights";
import { hapticImpact } from "@/lib/haptics";

/**
 * One Inner Work insight per day — rendered as an editorial pull-quote, not a
 * card: the day's thought to read, in the display face at reading size, leading
 * the Library zone below it. Deterministic rotation (salted off the header
 * quote), deep-links into the matching Vault lesson; shown to everyone, so a
 * non-premium tap lands on the paywall and the quote doubles as a teaser.
 *
 * Type-only (no surface, no gold tile) is deliberate: it breaks the stacked-
 * card silhouette and gives the "vault" its own voice above the shelf.
 */
const DailyInsightCard = () => {
  const navigate = useNavigate();
  const insight = pickDaily(DAILY_INSIGHTS, "insight");

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
      <p className="relative font-display text-[18px] leading-[1.35] tracking-tight text-foreground/90">
        {insight.text}
      </p>
      <p className="flex items-center gap-1 eyebrow text-muted-foreground/80 mt-3">
        From the Vault
        <ChevronRight aria-hidden size={12} className="text-gold/70 transition-transform group-active:translate-x-0.5" />
      </p>
    </button>
  );
};

export default DailyInsightCard;
