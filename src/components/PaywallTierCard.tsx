import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Zap, Check } from "lucide-react";
import { ReactNode } from "react";

interface PaywallTierCardProps {
  variant: "elite" | "apex";
  title: string;
  priceLabel: string;
  cadence?: string;
  tagline: string;
  badgeLabel: string;
  features: ReadonlyArray<{ icon: any; text: string }>;
  ctaLabel: string;
  ctaIcon?: ReactNode;
  onCta: () => void;
  loading?: boolean;
  highlighted?: boolean;
  footnote?: string;
}

const PaywallTierCard = ({
  variant,
  title,
  priceLabel,
  cadence = "/mo",
  tagline,
  badgeLabel,
  features,
  ctaLabel,
  ctaIcon,
  onCta,
  loading,
  highlighted,
  footnote,
}: PaywallTierCardProps) => {
  const isApex = variant === "apex";

  return (
    <div
      className={cn(
        "relative rounded-2xl p-5 overflow-hidden",
        isApex
          ? "border-2 border-[hsl(18_95%_58%)]/50 bg-gradient-to-br from-[hsl(18_95%_58%)]/10 via-card/80 to-[hsl(var(--gold))]/8"
          : "border-2 border-gold/60 bg-gradient-to-br from-gold/20 via-gold/[0.08] to-gold/15 shadow-[0_0_36px_hsl(var(--gold)/0.28),inset_0_1px_0_hsl(var(--gold)/0.4)]",
        highlighted && "shadow-[0_0_40px_hsl(18_95%_58%/0.25)]",
      )}
    >
      {isApex && (
        <>
          {/* Animated flame backdrop */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-12 -right-12 w-44 h-44 rounded-full blur-2xl opacity-60"
            style={{
              background:
                "radial-gradient(circle, hsl(18 95% 58% / 0.4) 0%, transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -left-16 w-40 h-40 rounded-full blur-2xl opacity-50"
            style={{
              background:
                "radial-gradient(circle, hsl(var(--gold) / 0.35) 0%, transparent 70%)",
            }}
          />
        </>
      )}

      {!isApex && (
        <>
          {/* Golden ambient glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-14 -right-14 w-48 h-48 rounded-full blur-3xl opacity-70"
            style={{
              background:
                "radial-gradient(circle, hsl(var(--gold) / 0.55) 0%, transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-16 w-44 h-44 rounded-full blur-3xl opacity-55"
            style={{
              background:
                "radial-gradient(circle, hsl(var(--gold-soft) / 0.45) 0%, transparent 70%)",
            }}
          />
          {/* Top inner highlight */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/80 to-transparent"
          />
        </>
      )}

      <div className="relative">
        {/* Badge tag */}
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3",
            isApex
              ? "bg-[hsl(18_95%_58%)]/15 border border-[hsl(18_95%_58%)]/40"
              : "bg-gold/15 border border-gold/30",
          )}
        >
          {isApex ? (
            <Zap size={11} className="text-[hsl(18_95%_58%)]" />
          ) : (
            <ShieldCheck size={11} className="text-gold" />
          )}
          <span
            className={cn(
              "text-[10px] font-black tracking-widest uppercase",
              isApex ? "text-[hsl(18_95%_58%)]" : "text-gold",
            )}
          >
            {badgeLabel}
          </span>
        </div>

        {/* Title */}
        <h3
          className={cn(
            "font-display text-xl font-black tracking-tight mb-1",
            isApex
              ? "bg-gradient-to-r from-[hsl(18_95%_58%)] via-gold to-[hsl(18_95%_58%)] bg-clip-text text-transparent"
              : "bg-gradient-to-r from-[hsl(var(--gold-light))] via-gold to-[hsl(var(--gold-light))] bg-clip-text text-transparent drop-shadow-[0_0_12px_hsl(var(--gold)/0.5)]",
          )}
        >
          {title}
        </h3>
        <p className="text-[11px] text-muted-foreground mb-3">{tagline}</p>

        {/* Price */}
        <p
          className={cn(
            "font-display font-black leading-none mb-3 text-3xl",
            isApex
              ? "text-[hsl(18_95%_58%)]"
              : "text-gold drop-shadow-[0_2px_8px_hsl(var(--gold)/0.45)]",
          )}
        >
          {priceLabel}
          <span className="text-base font-semibold text-muted-foreground">
            {cadence}
          </span>
        </p>

        {/* Features */}
        <ul className="space-y-2 mb-4">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "h-5 w-5 rounded-md flex items-center justify-center shrink-0 border",
                  isApex
                    ? "bg-[hsl(18_95%_58%)]/12 border-[hsl(18_95%_58%)]/30"
                    : "bg-gradient-to-br from-gold/30 to-gold/10 border-gold/50 shadow-[0_0_8px_hsl(var(--gold)/0.3)]",
                )}
              >
                <Icon
                  size={11}
                  className={isApex ? "text-[hsl(18_95%_58%)]" : "text-gold"}
                />
              </span>
              <span className="font-medium flex-1">{text}</span>
              <Check
                size={11}
                className={isApex ? "text-[hsl(18_95%_58%)]" : "text-gold"}
              />
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Button
          size="xl"
          variant={isApex ? "ember" : "gold"}
          className={cn(
            "w-full font-black",
            !loading && "breathing-glow",
          )}
          disabled={loading}
          onClick={onCta}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : ctaIcon}
          {ctaLabel}
        </Button>

        {footnote && (
          <p className="text-[10px] text-muted-foreground/80 text-center mt-2">
            {footnote}
          </p>
        )}
      </div>
    </div>
  );
};

export default PaywallTierCard;
