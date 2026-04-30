import { useNavigate } from "react-router-dom";
import { Zap, Crown, Shield, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TierUnlockPaywallCardProps {
  className?: string;
}

const PERKS = [
  { icon: Crown, text: "The Vault — recipes, training, recovery" },
  { icon: Users, text: "Mind & nervous-system tools" },
  { icon: Shield, text: "Full app access included" },
] as const;

/**
 * Compact Apex paywall card used inside TierLadder dialog.
 * Reuses the same gold→flame gradient as PaywallTierCard for brand consistency.
 * CTA navigates to /paywall where the real RevenueCat/Stripe flow lives.
 */
const TierUnlockPaywallCard = ({ className }: TierUnlockPaywallCardProps) => {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "relative rounded-xl p-3.5 overflow-hidden border-2 border-[hsl(18_95%_58%)]/50",
        "bg-gradient-to-br from-[hsl(18_95%_58%)]/12 via-card/80 to-[hsl(var(--gold))]/10",
        "shadow-[0_0_24px_hsl(18_95%_58%/0.20)]",
        className,
      )}
    >
      {/* Flame backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-60"
        style={{
          background:
            "radial-gradient(circle, hsl(18 95% 58% / 0.45) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -left-10 w-28 h-28 rounded-full blur-2xl opacity-50"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--gold) / 0.35) 0%, transparent 70%)",
        }}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gold/15 border border-gold/40">
            <Zap size={10} className="text-gold" strokeWidth={3} />
            <span className="text-[9px] font-black tracking-widest uppercase text-gold">
              Unlock the Vault
            </span>
          </div>
          <p className="font-display font-black text-base leading-none bg-gradient-to-r from-gold via-[hsl(var(--gold-light))] to-gold bg-clip-text text-transparent">
            €17.99
            <span className="text-[10px] font-bold text-muted-foreground ml-0.5">
              /mo
            </span>
          </p>
        </div>

        <p className="font-display text-sm font-black mb-2 bg-gradient-to-r from-gold via-[hsl(var(--gold-light))] to-gold bg-clip-text text-transparent">
          Premium
        </p>

        <ul className="space-y-1 mb-3">
          {PERKS.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-1.5 text-[11px] font-medium"
            >
              <span className="h-4 w-4 rounded-md flex items-center justify-center shrink-0 bg-gold/12 border border-gold/30">
                <Icon
                  size={9}
                  className="text-gold"
                  strokeWidth={2.6}
                />
              </span>
              <span className="flex-1">{text}</span>
            </li>
          ))}
        </ul>

        <Button
          size="sm"
          variant="gold"
          className="w-full text-xs"
          onClick={() => navigate("/paywall")}
        >
          <Zap size={13} strokeWidth={3} />
          Become Premium
          <ArrowRight size={12} strokeWidth={3} />
        </Button>

        <p className="text-[9px] text-muted-foreground/80 text-center mt-1.5">
          Cancel anytime · Vault unlocks instantly
        </p>
      </div>
    </div>
  );
};

export default TierUnlockPaywallCard;
