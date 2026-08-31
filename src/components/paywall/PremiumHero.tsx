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
  Lock,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Kept as a union even though only one member ships today: the purchase
// plumbing (purchasePremiumPlan, the funnel events) is written in these terms,
// and narrowing it to a literal would spread a rename through the store layer
// for no gain.
export type BillingPlan = "monthly" | "yearly";

interface PremiumHeroProps {
  monthlyPriceLabel: string;
  loading?: boolean;
  status?: "idle" | "purchasing" | "verifying" | "error";
  errorMessage?: string | null;
  onCta: (plan: BillingPlan) => void;
  onDismissError?: () => void;
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

const TRUST_POINTS = [
  "Cancel anytime in one tap",
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
  loading,
  status = "idle",
  errorMessage,
  onCta,
  onDismissError,
}: PremiumHeroProps) => {
  // One plan, one price, 14-day free trial for everyone. The yearly toggle and
  // its savings badge were removed with the move to a single pricing model.
  const busy = loading || status === "purchasing" || status === "verifying";
  const ctaLabel =
    status === "purchasing"
      ? "Opening Apple…"
      : status === "verifying"
      ? "Confirming access…"
      : "Start your free trial";

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
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-[130%] h-64 rounded-full blur-3xl opacity-70"
        style={{
          background:
            "radial-gradient(ellipse, hsl(var(--gold) / 0.55) 0%, transparent 70%)",
        }}
      />
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/70 backdrop-blur border border-gold/40 shadow-[0_0_16px_hsl(var(--gold)/0.4)]">
            <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
            <span className="text-[11px] font-black tracking-[0.22em] uppercase text-gold">
              Whealth Factory · Premium Subscription
            </span>
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
          <span className="text-foreground font-semibold">recover deep</span> — without 5 different apps.
        </p>

        {/* Price */}
        <div className="text-center mb-5">
          <p className="font-display font-black leading-none text-[56px] text-gold drop-shadow-[0_2px_14px_hsl(var(--gold)/0.55)]">
            {monthlyPriceLabel}
            <span className="text-lg font-bold text-muted-foreground/80">
              /mo
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground/80 mt-2 tracking-widest uppercase">
            14 days free · Cancel anytime
          </p>
        </div>

        {/* Pillars grid (2 columns on small screens, premium look) */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {PILLARS.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="relative rounded-xl p-3 bg-background/40 border border-gold/15 backdrop-blur-sm overflow-hidden"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -top-6 -right-6 w-16 h-16 rounded-full blur-xl opacity-60"
                style={{
                  background:
                    "radial-gradient(circle, hsl(var(--gold)/0.25) 0%, transparent 70%)",
                }}
              />
              <div className="relative">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="h-5 w-5 rounded-md flex items-center justify-center bg-gradient-to-br from-gold/35 to-gold/10 border border-gold/55 shadow-[0_0_8px_hsl(var(--gold)/0.35)]">
                    <Icon size={11} className="text-gold" strokeWidth={2.8} />
                  </span>
                  <p className="text-[11px] font-black tracking-[0.22em] uppercase text-gold">
                    {title}
                  </p>
                </div>
                <p className="text-[12px] leading-snug text-foreground/85 font-medium">
                  {text}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Inline error */}
        {status === "error" && errorMessage && (
          <div
            role="alert"
            className="mb-3 rounded-xl border border-destructive/50 bg-destructive/10 px-3.5 py-2.5 animate-reveal"
          >
            <p className="text-[12px] font-black tracking-wider uppercase text-destructive mb-0.5">
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

        {/* CTA */}
        <Button
          size="xl"
          variant="ember"
          className={cn(
            "w-full font-black text-base tracking-wide h-14",
            !busy && "breathing-glow",
          )}
          disabled={busy}
          onClick={() => onCta("monthly")}
        >
          {busy ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <ShieldCheck size={20} strokeWidth={2.8} />
          )}
          {ctaLabel}
        </Button>

        <p className="text-[11px] text-muted-foreground/85 text-center mt-2.5 tracking-wide">
          {`14 days free, then ${monthlyPriceLabel}/mo · Cancel anytime`}
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
          <p className="text-[11px] font-black tracking-[0.22em] uppercase text-gold mb-2">
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
            <span className="text-[12px] font-black text-gold">{monthlyPriceLabel}/mo</span>
          </div>
        </div>

        {/* Lock-in micro-row */}
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/80">
          <Lock size={12} className="text-gold/80" strokeWidth={2.6} />
          <span>Locked at {monthlyPriceLabel}/mo as long as you stay subscribed.</span>
        </div>
      </div>
    </div>
  );
};

export default PremiumHero;
