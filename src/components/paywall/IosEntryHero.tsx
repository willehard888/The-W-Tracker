import { useState } from "react";
import { Loader2, ShieldCheck, Flame, Trophy, Swords, Sparkles, Crown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import RealisticFlame from "@/components/home/RealisticFlame";
import { cn } from "@/lib/utils";

export type BillingPlan = "monthly" | "yearly";

interface IosEntryHeroProps {
  monthlyPriceLabel: string;
  yearlyPriceLabel: string;
  loading?: boolean;
  onCta: (plan: BillingPlan) => void;
  ctaLabel?: string;
  footnote?: string;
  /** Discount percent shown on the yearly tab (e.g. 20 for -20%). */
  yearlyDiscountPct?: number;
}

const HARD_FEATURES = [
  { icon: Flame, text: "Daily check-ins · XP · streaks" },
  { icon: Trophy, text: "Global leaderboard & seasons" },
  { icon: Swords, text: "1v1 battles" },
  { icon: Sparkles, text: "AI Coach" },
  { icon: Crown, text: "Compete for earned Elite tier" },
] as const;

/**
 * iOS-only "hard" entry paywall hero. Single dominant Member card with
 * urgency copy, flame backdrop, and a giant gold CTA. Includes a Monthly/Yearly
 * billing selector — yearly is highlighted with a -20% savings tag.
 */
const IosEntryHero = ({
  monthlyPriceLabel,
  yearlyPriceLabel,
  loading,
  onCta,
  ctaLabel,
  footnote,
  yearlyDiscountPct = 20,
}: IosEntryHeroProps) => {
  const [plan, setPlan] = useState<BillingPlan>("yearly");
  const isYearly = plan === "yearly";
  const activePrice = isYearly ? yearlyPriceLabel : monthlyPriceLabel;
  const cadence = isYearly ? "/yr" : "/mo";
  const resolvedFootnote =
    footnote ??
    (isYearly
      ? `Billed ${yearlyPriceLabel}/yr · Cancel anytime`
      : `Billed ${monthlyPriceLabel}/mo · Cancel anytime`);
  const resolvedCtaLabel = ctaLabel ?? "Become a Member";

  return (
    <div
      className={cn(
        "relative rounded-3xl overflow-hidden",
        "border-2 border-gold/60",
        "bg-gradient-to-b from-gold/[0.18] via-card/90 to-card",
        "shadow-[0_0_60px_hsl(var(--gold)/0.35),inset_0_1px_0_hsl(var(--gold)/0.55)]",
      )}
    >
      {/* Ambient flame backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-4 h-48 flex items-end justify-center opacity-90"
      >
        <RealisticFlame tier={5} accent="hsl(var(--gold))" size={140} interactive={false} />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[120%] h-56 rounded-full blur-3xl opacity-70"
        style={{
          background:
            "radial-gradient(ellipse, hsl(var(--gold) / 0.55) 0%, transparent 70%)",
        }}
      />
      {/* Vertical light shaft */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-gold/60 via-gold/10 to-transparent"
      />

      <div className="relative pt-44 px-5 pb-5">
        {/* Urgency tag */}
        <div className="flex justify-center mb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/70 backdrop-blur border border-gold/40 shadow-[0_0_16px_hsl(var(--gold)/0.4)]">
            <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-gold">
              Members only. Pay to enter.
            </span>
          </div>
        </div>

        {/* Title */}
        <h2 className="font-display text-center text-[34px] leading-none font-black tracking-tight mb-2 bg-gradient-to-b from-[hsl(var(--gold-light))] via-gold to-[hsl(var(--gold))] bg-clip-text text-transparent drop-shadow-[0_0_18px_hsl(var(--gold)/0.5)]">
          Become a Member
        </h2>
        <p className="text-center text-[12px] text-muted-foreground mb-5 max-w-[260px] mx-auto leading-relaxed">
          One way in. Full access for 7 days — then{" "}
          <span className="text-gold font-semibold">{activePrice}{cadence}</span> if
          you're built for it.
        </p>

        {/* Billing toggle */}
        <div className="flex justify-center mb-5">
          <div
            role="tablist"
            className="relative inline-flex items-center rounded-full p-1 bg-background/60 border border-gold/30 backdrop-blur shadow-[inset_0_1px_0_hsl(var(--gold)/0.15)]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isYearly}
              onClick={() => setPlan("monthly")}
              className={cn(
                "relative px-4 py-1.5 rounded-full text-[11px] font-black tracking-wider uppercase transition-all duration-200",
                !isYearly
                  ? "bg-gold text-background shadow-[0_0_12px_hsl(var(--gold)/0.5)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isYearly}
              onClick={() => setPlan("yearly")}
              className={cn(
                "relative px-4 py-1.5 rounded-full text-[11px] font-black tracking-wider uppercase transition-all duration-200 flex items-center gap-1.5",
                isYearly
                  ? "bg-gold text-background shadow-[0_0_12px_hsl(var(--gold)/0.5)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Yearly
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[8.5px] font-black tracking-wider",
                  isYearly
                    ? "bg-background/25 text-background"
                    : "bg-gold/15 text-gold border border-gold/30",
                )}
              >
                −{yearlyDiscountPct}%
              </span>
            </button>
          </div>
        </div>

        {/* Price block */}
        <div className="text-center mb-5">
          <p className="font-display font-black leading-none text-5xl text-gold drop-shadow-[0_2px_12px_hsl(var(--gold)/0.55)]">
            {activePrice}
            <span className="text-lg font-bold text-muted-foreground/80">
              {cadence}
            </span>
          </p>
          {isYearly ? (
            <p className="text-[10.5px] text-muted-foreground/90 mt-2 tracking-wide">
              <span className="line-through opacity-60">
                {monthlyPriceLabel}/mo × 12
              </span>{" "}
              · <span className="text-gold font-bold">Save {yearlyDiscountPct}%</span>
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground/80 mt-2 tracking-widest uppercase">
              Free for 7 days · No charge until day 8
            </p>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-2.5 mb-6">
          {HARD_FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 text-[13px]">
              <span className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 bg-gradient-to-br from-gold/35 to-gold/10 border border-gold/55 shadow-[0_0_10px_hsl(var(--gold)/0.35)]">
                <Icon size={12} className="text-gold" strokeWidth={2.6} />
              </span>
              <span className="font-semibold flex-1">{text}</span>
              <Check size={13} className="text-gold" strokeWidth={3} />
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Button
          size="xl"
          variant="gold"
          className={cn(
            "w-full font-black text-base tracking-wide h-14",
            !loading && "breathing-glow",
          )}
          disabled={loading}
          onClick={() => onCta(plan)}
        >
          {loading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <ShieldCheck size={20} strokeWidth={2.8} />
          )}
          {resolvedCtaLabel}
        </Button>

        <p className="text-[10px] text-muted-foreground/80 text-center mt-2.5 tracking-wide">
          {resolvedFootnote}
        </p>
      </div>
    </div>
  );
};

export default IosEntryHero;
