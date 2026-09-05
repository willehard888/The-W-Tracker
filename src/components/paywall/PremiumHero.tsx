import { useState } from "react";
import {
  Loader2,
  Sparkles,
  Flame,
  Trophy,
  Brain,
  Utensils,
  Dumbbell,
  Moon,
  Check,
  ShieldCheck,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BillingPlan = "monthly" | "yearly";

interface PremiumHeroProps {
  monthlyPriceLabel: string;
  yearlyPriceLabel: string;
  loading?: boolean;
  status?: "idle" | "purchasing" | "verifying" | "error";
  errorMessage?: string | null;
  onCta: (plan: BillingPlan) => void;
  onDismissError?: () => void;
  yearlyDiscountPct?: number;
  /** When false, the yearly toggle is hidden and only monthly is offered. */
  yearlyAvailable?: boolean;
}

const PILLARS = [
  {
    icon: Utensils,
    title: "Fuel",
    text: "Real-food recipes, macros & meal-prep templates — fast, high-protein.",
  },
  {
    icon: Dumbbell,
    title: "Train",
    text: "Strength & conditioning programs — exact sets, reps and progression.",
  },
  {
    icon: Moon,
    title: "Recover",
    text: "Sleep protocols, recovery stacks & deload guides — bounce back faster.",
  },
  {
    icon: Brain,
    title: "Regulate",
    text: "Breathwork, CBT, EFT tapping & bilateral tools for stress.",
  },
  {
    icon: Sparkles,
    title: "Reset",
    text: "Self-hypnosis, NSDR & nervous-system downshifts. Calm, on demand.",
  },
  {
    icon: Trophy,
    title: "Compete",
    text: "The full app: check-ins, streaks, battles, leaderboard, AI Coach.",
  },
] as const;

// "Cancel anytime" lives ONLY in the CTA footnote — it used to appear four
// times on this screen, which reads anxious rather than confident.
const TRUST_POINTS = [
  "Keep your streak & data forever",
  "Secure Apple in-app purchase",
  "New content drops weekly",
] as const;

// Honest, typical standalone market prices for the categories this membership
// covers — used as a price anchor, not a fabricated testimonial.
const VALUE_STACK = [
  { label: "Recipes & meal planning", price: "~10 €/mo" },
  { label: "Training programs", price: "~13 €/mo" },
  { label: "Recovery & sleep", price: "~9 €/mo" },
  { label: "Mind & stress tools", price: "~12 €/mo" },
] as const;

const PremiumHero = ({
  monthlyPriceLabel,
  yearlyPriceLabel,
  loading,
  status = "idle",
  errorMessage,
  onCta,
  onDismissError,
  // Real discount: 89,99/yr vs 12×8,99 = 107,88 → ~17% (was a hardcoded, inflated 20).
  yearlyDiscountPct = 17,
  yearlyAvailable = true,
}: PremiumHeroProps) => {
  // Monthly-first: the product is 8,99 €/mo (14-day in-app trial happens
  // BEFORE this screen). Yearly is an optional savings toggle, not the default.
  const [plan, setPlan] = useState<BillingPlan>("monthly");
  // If the store can't fulfill a yearly plan, never let the toggle sit on it.
  const isYearly = yearlyAvailable && plan === "yearly";
  const activePrice = isYearly ? yearlyPriceLabel : monthlyPriceLabel;
  const cadence = isYearly ? "/yr" : "/mo";

  const busy = loading || status === "purchasing" || status === "verifying";
  const ctaLabel =
    status === "purchasing"
      ? "Opening Apple…"
      : status === "verifying"
      ? "Confirming access…"
      : "Unlock full access";

  // No "free trial" language here: the 14-day trial is in-app and already
  // running (or spent) by the time this screen shows, and the store product
  // has no introductory offer — claiming a store trial risks App Review.
  const footnote = isYearly
    ? `${yearlyPriceLabel}/yr · price locked while subscribed · Cancel anytime`
    : `${monthlyPriceLabel}/mo · price locked while subscribed · Cancel anytime`;

  return (
    <div
      className={cn(
        "relative rounded-3xl overflow-hidden",
        "border border-gold/40",
        "bg-gradient-to-b from-gold/[0.14] via-card/95 to-card",
        "shadow-[0_30px_80px_-20px_hsl(var(--gold)/0.45),0_0_60px_hsl(var(--gold)/0.18),inset_0_1px_0_hsl(var(--gold)/0.55)]",
      )}
    >
      {/* Layered gold ambience */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-4 h-56"
        style={{
          background:
            "radial-gradient(ellipse 65% 85% at 50% 100%, hsl(var(--gold) / 0.55) 0%, hsl(var(--gold) / 0.18) 40%, transparent 75%)",
        }}
      />
      {/* Card-sized clipping wrapper: the wide glow must not create
          scrollABLE overflow (Chrome counts even transformed bounds) — a
          focus scroll-into-view (tap/tab/VoiceOver) was dragging the whole
          card content 49px left inside the card's own overflow-hidden. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <div
          className="absolute -top-28 inset-x-0 scale-x-[1.3] h-64 rounded-full blur-3xl opacity-70"
          style={{
            background:
              "radial-gradient(ellipse, hsl(var(--gold) / 0.55) 0%, transparent 70%)",
          }}
        />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-gold/70 via-gold/10 to-transparent"
      />
      {/* Subtle film grain via dual radial dots */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(hsl(var(--gold)) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />

      <div className="relative pt-12 px-5 pb-5">
        {/* Crown crest */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full blur-xl opacity-80"
              style={{
                background:
                  "radial-gradient(circle, hsl(var(--gold)/0.55) 0%, transparent 70%)",
              }}
            />
            <div className="relative h-14 w-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[hsl(var(--gold-light))] via-gold to-[hsl(var(--gold-dark))] shadow-[0_8px_24px_hsl(var(--gold)/0.45),inset_0_1px_0_hsl(0_0%_100%/0.4)]">
              <Crown size={26} className="text-background" strokeWidth={2.6} />
            </div>
          </div>
        </div>

        {/* Tag */}
        <div className="flex justify-center mb-3">
          {/* No pulsing dot (state-less decoration), no restating the brand
              the crest above already carries. One word, said once. */}
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-background/70 backdrop-blur border border-gold/40 shadow-[0_0_16px_hsl(var(--gold)/0.4)]">
            <span className="eyebrow text-gold">Premium</span>
          </div>
        </div>

        {/* Title */}
        <h2 className="font-display text-center text-[36px] leading-[0.95] font-black tracking-tight mb-3 bg-gradient-to-b from-[hsl(var(--gold-light))] via-gold to-[hsl(var(--gold))] bg-clip-text text-transparent drop-shadow-[0_0_18px_hsl(var(--gold)/0.5)]">
          Your edge,<br />unlocked.
        </h2>
        <p className="text-center text-[12px] text-muted-foreground mb-5 max-w-[300px] mx-auto leading-relaxed">
          One membership. Everything you need to{" "}
          <span className="text-foreground font-semibold">train hard</span>,{" "}
          <span className="text-foreground font-semibold">eat clean</span> and{" "}
          <span className="text-foreground font-semibold">recover deep</span>.
        </p>

        {/* Billing toggle — only when an annual plan can actually be sold */}
        {yearlyAvailable && (
        <div className="flex justify-center mb-5">
          {/* radiogroup, not tablist: there are no tabpanels here, and a SR
              announcing "tab 1 of 2" over a billing choice is wrong. Same
              pattern as the check-in honesty control. */}
          <div
            role="radiogroup"
            aria-label="Billing period"
            className="relative inline-flex items-center rounded-full p-1 bg-background/60 border border-gold/30 backdrop-blur shadow-[inset_0_1px_0_hsl(var(--gold)/0.15)]"
          >
            <button
              type="button"
              role="radio"
              aria-checked={!isYearly}
              disabled={busy}
              onClick={() => setPlan("monthly")}
              className={cn(
                "eyebrow relative px-4 py-1.5 rounded-full transition-all duration-200",
                !isYearly
                  ? "bg-gold text-background shadow-[0_0_12px_hsl(var(--gold)/0.5)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={isYearly}
              disabled={busy}
              onClick={() => setPlan("yearly")}
              className={cn(
                "eyebrow relative px-4 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5",
                isYearly
                  ? "bg-gold text-background shadow-[0_0_12px_hsl(var(--gold)/0.5)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Yearly
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-black tracking-wider",
                  isYearly
                    ? "bg-background/25 text-background"
                    : "bg-gold/15 text-gold border border-gold/30",
                )}
              >
                BEST · −{yearlyDiscountPct}%
              </span>
            </button>
          </div>
        </div>
        )}

        {/* Price */}
        <div className="text-center mb-5">
          <p className="font-display font-black leading-none text-[56px] text-gold drop-shadow-[0_2px_14px_hsl(var(--gold)/0.55)]">
            {/* keyed on plan: the blur-bridge crossfade masks the hard swap of
                a 56px number at the exact decision moment */}
            <span key={plan} className="price-swap inline-block">
              {activePrice}
              <span className="text-lg font-bold text-muted-foreground/80">
                {cadence}
              </span>
            </span>
          </p>
          {isYearly ? (
            <p className="text-[11px] text-muted-foreground/90 mt-2 tracking-wide">
              <span className="line-through opacity-60">
                {monthlyPriceLabel}/mo × 12
              </span>{" "}
              · <span className="text-gold font-bold">Save {yearlyDiscountPct}%</span> · ~2 months free
            </p>
          ) : yearlyAvailable ? (
            <p className="eyebrow text-muted-foreground/80 mt-2">
              Switch to yearly anytime · Save {yearlyDiscountPct}%
            </p>
          ) : (
            <p className="eyebrow text-muted-foreground/80 mt-2">
              Full access · Cancel anytime
            </p>
          )}
        </div>

        {/* Pillars grid (2 columns on small screens, premium look) */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {PILLARS.map(({ icon: Icon, title, text }) => (
            // Quiet tiles: the per-tile corner glow + glowing icon chips made
            // six simultaneous mini-spectacles under the crest and headline.
            // The crest IS the spectacle; the tiles just inform.
            <div
              key={title}
              className="relative rounded-xl p-3 bg-background/40 border border-gold/15 overflow-hidden"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="h-5 w-5 rounded-md flex items-center justify-center bg-gradient-to-br from-gold/35 to-gold/10 border border-gold/55">
                  <Icon size={11} className="text-gold" strokeWidth={2.8} />
                </span>
                <p className="eyebrow text-gold">
                  {title}
                </p>
              </div>
              <p className="text-[12px] leading-snug text-foreground/85 font-medium">
                {text}
              </p>
            </div>
          ))}
        </div>

        {/* Inline error */}
        {status === "error" && errorMessage && (
          <div
            role="alert"
            className="mb-3 rounded-xl border border-destructive/50 bg-destructive/10 px-3.5 py-2.5 animate-reveal"
          >
            <p className="eyebrow text-destructive mb-0.5">
              Purchase failed
            </p>
            <p className="text-[12px] text-foreground/90 leading-snug mb-2">
              {errorMessage}
            </p>
            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                className="text-[12px] font-bold text-destructive underline underline-offset-2"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* CTA — the glow lives on a wrapper: the button clips its overflow */}
        <div className={cn("rounded-lg", !busy && "breathing-glow")}>
          <Button
            size="xl"
            variant="ember"
            className="w-full font-black text-base tracking-wide h-14"
            disabled={busy}
            onClick={() => onCta(plan)}
          >
            {busy ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <ShieldCheck size={20} strokeWidth={2.8} />
            )}
            {ctaLabel}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground/85 text-center mt-2.5 tracking-wide">
          {footnote}
        </p>

        {/* Trust strip */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          {TRUST_POINTS.map((t) => (
            <div
              key={t}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/90"
            >
              <Check size={12} className="text-gold" strokeWidth={3} />
              <span>{t}</span>
            </div>
          ))}
        </div>

        {/* Value anchor — what one membership replaces (honest market prices) */}
        <div className="mt-4 rounded-xl border border-gold/20 bg-background/40 p-3 backdrop-blur-sm">
          <p className="eyebrow text-gold mb-2">
            Replaces a stack of apps
          </p>
          <div className="space-y-1">
            {VALUE_STACK.map(({ label, price }) => (
              <div key={label} className="flex items-center justify-between text-[12px]">
                <span className="text-foreground/80">{label}</span>
                <span className="text-muted-foreground/80 line-through">{price}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gold/15 flex items-center justify-between">
            <span className="text-[12px] font-bold text-foreground">All-in-one, one price</span>
            <span className="text-[12px] font-black text-gold">{activePrice}{cadence}</span>
          </div>
        </div>

        {/* (Lock-in micro-row removed — its one unique claim now lives in the
            CTA footnote, cutting the third stacked reassurance block.) */}
      </div>
    </div>
  );
};

export default PremiumHero;
