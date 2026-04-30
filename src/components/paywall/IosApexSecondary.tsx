import { useState } from "react";
import { Zap, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import RealisticFlame from "@/components/home/RealisticFlame";

export type ApexBillingPlan = "monthly" | "yearly";

interface IosApexSecondaryProps {
  monthlyPriceLabel: string;
  yearlyPriceLabel: string;
  loading?: boolean;
  onClick: (plan: ApexBillingPlan) => void;
  yearlyDiscountPct?: number;
}

/**
 * Compact secondary "skip the grind" CTA used under the iOS hero Member card.
 * Includes a tiny Monthly/Yearly toggle so users can pick a billing cadence
 * without leaving the paywall. Yearly is the highlighted default.
 */
const IosApexSecondary = ({
  monthlyPriceLabel,
  yearlyPriceLabel,
  loading,
  onClick,
  yearlyDiscountPct = 20,
}: IosApexSecondaryProps) => {
  const [plan, setPlan] = useState<ApexBillingPlan>("yearly");
  const isYearly = plan === "yearly";
  const activePrice = isYearly ? yearlyPriceLabel : monthlyPriceLabel;
  const cadence = isYearly ? "/yr" : "/mo";

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden",
        "border border-[hsl(18_95%_58%)]/35 bg-gradient-to-r from-[hsl(18_95%_58%)]/10 via-card/80 to-card",
        "px-4 py-3.5",
        "transition-all duration-200",
        "hover:border-[hsl(18_95%_58%)]/60 hover:shadow-[0_0_24px_hsl(18_95%_58%/0.25)]",
      )}
    >
      {/* Ambient flame aura — realistic */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-2 -top-6 bottom-0 w-20 flex items-end justify-center opacity-90"
      >
        <RealisticFlame tier={5} accent="hsl(18 95% 58%)" size={68} interactive={false} />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 w-32 h-32 rounded-full blur-2xl opacity-50"
        style={{
          background:
            "radial-gradient(circle, hsl(18 95% 58% / 0.4) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-12 -bottom-10 w-32 h-28 rounded-full blur-3xl opacity-55"
        style={{
          background:
            "radial-gradient(ellipse, hsl(18 95% 58% / 0.45) 0%, transparent 70%)",
        }}
      />

      <div className="relative pl-16">
        {/* Header row */}
        <div className="flex items-center gap-3 mb-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black tracking-[0.18em] uppercase text-[hsl(18_95%_58%)] flex items-center gap-1.5">
              {loading && <Loader2 size={10} className="animate-spin" />}
              Skip the grind
            </p>
            <p className="font-display text-[15px] font-black leading-tight bg-gradient-to-r from-[hsl(18_95%_58%)] via-gold to-[hsl(18_95%_58%)] bg-clip-text text-transparent">
              Apex Instant · {activePrice}{cadence}
            </p>
            <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-tight">
              Top 10% tier · Create Tribes · Tier-protected
            </p>
          </div>
        </div>

        {/* Billing toggle + CTA row */}
        <div className="flex items-center gap-2">
          <div
            role="tablist"
            className="inline-flex items-center rounded-full p-0.5 bg-background/60 border border-[hsl(18_95%_58%)]/30 backdrop-blur"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isYearly}
              onClick={() => setPlan("monthly")}
              className={cn(
                "px-2.5 py-1 rounded-full text-[9.5px] font-black tracking-wider uppercase transition-all duration-200",
                !isYearly
                  ? "bg-[hsl(18_95%_58%)] text-background shadow-[0_0_10px_hsl(18_95%_58%/0.5)]"
                  : "text-muted-foreground",
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
                "px-2.5 py-1 rounded-full text-[9.5px] font-black tracking-wider uppercase transition-all duration-200 flex items-center gap-1",
                isYearly
                  ? "bg-[hsl(18_95%_58%)] text-background shadow-[0_0_10px_hsl(18_95%_58%/0.5)]"
                  : "text-muted-foreground",
              )}
            >
              Yearly
              <span
                className={cn(
                  "px-1 py-px rounded-full text-[7.5px] font-black tracking-wider",
                  isYearly
                    ? "bg-background/25 text-background"
                    : "text-[hsl(18_95%_58%)] border border-[hsl(18_95%_58%)]/40",
                )}
              >
                −{yearlyDiscountPct}%
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onClick(plan)}
            disabled={loading}
            className={cn(
              "group flex-1 inline-flex items-center justify-center gap-1.5 rounded-full",
              "h-8 px-3 text-[11px] font-black tracking-wider uppercase",
              "bg-gradient-to-r from-[hsl(18_95%_58%)] to-[hsl(var(--gold))] text-background",
              "shadow-[0_0_18px_hsl(18_95%_58%/0.45)] active:scale-[0.98] transition-all",
              "disabled:opacity-60",
            )}
          >
            Get Apex
            <ArrowRight
              size={13}
              strokeWidth={3}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IosApexSecondary;
