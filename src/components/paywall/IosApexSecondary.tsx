import { Zap, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface IosApexSecondaryProps {
  priceLabel: string;
  loading?: boolean;
  onClick: () => void;
}

/**
 * Compact secondary "skip the grind" CTA used under the iOS hero Member card.
 * Intentionally smaller than the Member hero — Member is the main entry point,
 * Apex is the optional shortcut.
 */
const IosApexSecondary = ({ priceLabel, loading, onClick }: IosApexSecondaryProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "group relative w-full rounded-2xl overflow-hidden text-left",
        "border border-[hsl(18_95%_58%)]/35 bg-gradient-to-r from-[hsl(18_95%_58%)]/10 via-card/80 to-card",
        "px-4 py-3.5 transition-all duration-200",
        "hover:border-[hsl(18_95%_58%)]/60 hover:shadow-[0_0_24px_hsl(18_95%_58%/0.25)]",
        "active:scale-[0.99] disabled:opacity-60",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 w-32 h-32 rounded-full blur-2xl opacity-50"
        style={{
          background:
            "radial-gradient(circle, hsl(18 95% 58% / 0.4) 0%, transparent 70%)",
        }}
      />
      <div className="relative flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-[hsl(18_95%_58%)] to-[hsl(var(--gold))] shadow-[0_0_18px_hsl(18_95%_58%/0.5)]">
          {loading ? (
            <Loader2 size={18} className="text-background animate-spin" />
          ) : (
            <Zap size={18} className="text-background" strokeWidth={2.8} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black tracking-[0.18em] uppercase text-[hsl(18_95%_58%)]">
            Skip the grind
          </p>
          <p className="font-display text-[15px] font-black leading-tight bg-gradient-to-r from-[hsl(18_95%_58%)] via-gold to-[hsl(18_95%_58%)] bg-clip-text text-transparent">
            Apex Instant · {priceLabel}/mo
          </p>
          <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-tight">
            Top 1% tier instantly · Create Tribes · Tier-protected
          </p>
        </div>
        <ArrowRight
          size={18}
          className="text-[hsl(18_95%_58%)] shrink-0 transition-transform group-hover:translate-x-0.5"
          strokeWidth={2.8}
        />
      </div>
    </button>
  );
};

export default IosApexSecondary;
