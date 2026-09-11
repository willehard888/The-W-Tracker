import { useState } from "react";
import {
  Loader2, Check, Utensils, Dumbbell, Moon, Brain, Sparkles, Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCommitPop } from "@/hooks/use-commit-pop";
import { cn } from "@/lib/utils";

export type BillingPlan = "monthly" | "yearly";

interface PremiumHeroProps {
  monthlyPriceLabel: string;
  yearlyPriceLabel: string;
  status?: "idle" | "purchasing" | "verifying" | "error";
  errorMessage?: string | null;
  onCta: (plan: BillingPlan) => void;
  onDismissError?: () => void;
  yearlyDiscountPct?: number;
  /** When false, only monthly is offered. */
  yearlyAvailable?: boolean;
  /** Web has no store: the footnote points at the app instead of a price. */
  native?: boolean;
}

/** What the membership unlocks, as hairline rows under the plan card. */
export const PILLARS = [
  { icon: Utensils, title: "Fuel", text: "Real-food recipes, macros and meal-prep templates." },
  { icon: Dumbbell, title: "Train", text: "Strength and conditioning programs with exact sets, reps and progression." },
  { icon: Moon, title: "Recover", text: "Sleep protocols, recovery stacks and deload guides." },
  { icon: Brain, title: "Regulate", text: "Breathwork, CBT, EFT tapping and bilateral tools for stress." },
  { icon: Sparkles, title: "Reset", text: "Self-hypnosis, NSDR and nervous-system downshifts, on demand." },
  { icon: Trophy, title: "Compete", text: "Check-ins, streaks, battles, the leaderboard and the AI Coach." },
] as const;

/**
 * One plan row. The selected row carries the screen's only gold: its border
 * and its price. The check lands with commit-pop.
 */
const PlanRow = ({
  label, sub, price, cadence, selected, disabled, onSelect,
}: {
  label: string;
  sub?: string;
  price: string;
  cadence: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) => {
  const popping = useCommitPop(selected);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "w-full min-h-11 flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
        selected ? "border-gold/70 bg-gold/[0.06]" : "border-border/50",
      )}
    >
      <span
        className={cn(
          "h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center",
          selected ? "border-gold bg-gold text-background" : "border-muted-foreground/35",
          popping && "commit-pop",
        )}
        aria-hidden
      >
        {selected && <Check aria-hidden size={12} strokeWidth={3} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold leading-tight">{label}</span>
        {sub && <span className={cn("block text-[12px] leading-snug mt-0.5", selected ? "text-gold" : "text-muted-foreground")}>{sub}</span>}
      </span>
      <span className="shrink-0 text-right">
        <span className={cn("font-display font-black text-[22px] leading-none tabular-nums", selected && "text-gold glow-gold-text")}>
          {price}
        </span>
        <span className="block text-[11px] text-muted-foreground mt-0.5">{cadence}</span>
      </span>
    </button>
  );
};

const PremiumHero = ({
  monthlyPriceLabel,
  yearlyPriceLabel,
  status = "idle",
  errorMessage,
  onCta,
  onDismissError,
  // Real discount: 89,99/yr vs 12×8,99 = 107,88 → ~17%.
  yearlyDiscountPct = 17,
  yearlyAvailable = true,
  native = true,
}: PremiumHeroProps) => {
  // Monthly-first: the product is 8,99 €/mo (the 14-day in-app trial happens
  // BEFORE this screen). Yearly is the savings option, not the default.
  const [plan, setPlan] = useState<BillingPlan>("monthly");
  // If the store can't fulfill a yearly plan, never let the choice sit on it.
  const isYearly = yearlyAvailable && plan === "yearly";
  const activePrice = isYearly ? yearlyPriceLabel : monthlyPriceLabel;
  const cadence = isYearly ? "/yr" : "/mo";

  const busy = status === "purchasing" || status === "verifying";
  const ctaLabel =
    status === "purchasing" ? "Opening Apple…"
    : status === "verifying" ? "Confirming access…"
    : "Unlock full access";

  // No "free trial" language here: the 14-day trial is in-app and already
  // running (or spent) by the time this screen shows, and the store product
  // has no introductory offer. Claiming a store trial risks App Review.
  // "Cancel anytime" is said once, here.
  const footnote = native
    ? `${activePrice}${cadence} · price locked while subscribed · Cancel anytime`
    : "Subscribe in the iOS app · Cancel anytime";

  return (
    <div>
      {/* HERO: the plan card. */}
      <div className="surface-card p-3">
        <div role="radiogroup" aria-label="Billing period" className="space-y-2">
          <PlanRow
            label="Monthly"
            price={monthlyPriceLabel}
            cadence="per month"
            selected={!isYearly}
            disabled={busy}
            onSelect={() => setPlan("monthly")}
          />
          {yearlyAvailable && (
            <PlanRow
              label="Yearly"
              sub={`Save ${yearlyDiscountPct}% · about 2 months free`}
              price={yearlyPriceLabel}
              cadence="per year"
              selected={isYearly}
              disabled={busy}
              onSelect={() => setPlan("yearly")}
            />
          )}
        </div>

        {status === "error" && errorMessage && (
          <div role="alert" className="mt-3 rounded-xl border border-destructive/50 bg-destructive/10 px-3.5 py-2.5">
            <p className="text-[13px] font-bold text-destructive">Purchase failed</p>
            <p className="text-[12px] text-foreground/90 leading-snug mt-0.5">{errorMessage}</p>
            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                className="min-h-11 text-[12px] font-bold text-destructive underline underline-offset-2"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        <Button
          size="xl"
          variant="ember"
          className="mt-3 w-full font-black text-base tracking-wide"
          disabled={busy}
          onClick={() => onCta(plan)}
        >
          {busy && <Loader2 aria-hidden size={20} className="animate-spin" />}
          {ctaLabel}
        </Button>
        <p className="mt-2.5 text-center text-[11px] text-muted-foreground">{footnote}</p>
      </div>

      {/* WHAT IT UNLOCKS: hairline rows, one icon each. */}
      <ul className="mt-5 divide-y divide-border/35 border-t border-border/35">
        {PILLARS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="py-3 flex gap-3">
            <Icon size={15} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0">
              <span className="block text-[13px] font-bold leading-tight">{title}</span>
              <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5">{text}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-muted-foreground leading-snug">
        Apex status (top 10% by rank, activity and streak) is earned, never bought. Premium unlocks the full app;
        your streak and data stay yours either way.
      </p>
    </div>
  );
};

export default PremiumHero;
