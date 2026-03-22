import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Crown, Flame, Trophy, Swords, Shield, Zap, Check, ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ELITE_FEATURES = [
  { icon: Trophy, text: "Full global leaderboard access" },
  { icon: Swords, text: "1v1 XP & streak battles" },
  { icon: Flame, text: "Post to the Elite Feed" },
  { icon: Zap, text: "2× XP multiplier on all check-ins" },
  { icon: Shield, text: "Exclusive Elite badges" },
  { icon: Crown, text: "Elite status tier & profile glow" },
];

const Paywall = () => {
  const { isElite, packages, purchase, restorePurchases, loading } = useRevenueCat();
  const navigate = useNavigate();
  const [purchasing, setPurchasing] = useState(false);

  if (isElite) {
    return (
      <div className="min-h-screen pb-24 px-4 pt-6 flex flex-col items-center justify-center text-center">
        <div className="h-20 w-20 rounded-full gradient-gold flex items-center justify-center glow-gold mb-4">
          <Crown size={36} className="text-primary-foreground" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">You're Elite</h1>
        <p className="text-sm text-muted-foreground mb-6">All premium features are unlocked.</p>
        <Button variant="gold-outline" onClick={() => navigate("/profile")}>
          <ArrowLeft size={14} />
          Back to Profile
        </Button>
      </div>
    );
  }

  const handlePurchase = async (pkg: any) => {
    setPurchasing(true);
    try {
      await purchase(pkg);
      toast.success("Welcome to Elite! All features unlocked.");
      navigate("/profile");
    } catch (e: any) {
      toast.error(e?.message || "Purchase failed. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      await restorePurchases();
      toast.success("Purchases restored.");
    } catch {
      toast.error("Could not restore purchases.");
    }
  };

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      {/* Back button */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Hero */}
      <div className="text-center mb-8 animate-reveal">
        <div className="h-20 w-20 mx-auto rounded-full gradient-gold flex items-center justify-center glow-gold mb-4">
          <Crown size={36} className="text-primary-foreground" />
        </div>
        <h1 className="font-display text-3xl font-black tracking-tight mb-2">
          Go <span className="text-gold glow-gold-text">Elite</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Unlock the full experience. Compete, flex, and dominate.
        </p>
      </div>

      {/* Features */}
      <div className="rounded-xl border border-gold/20 bg-card p-5 mb-6 animate-reveal animate-reveal-delay-1">
        <h2 className="font-display font-bold text-sm mb-4 text-gold">What you unlock</h2>
        <div className="space-y-3">
          {ELITE_FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-gold" />
              </div>
              <span className="text-sm font-medium">{text}</span>
              <Check size={14} className="text-gold ml-auto shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div className="animate-reveal animate-reveal-delay-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-gold" />
          </div>
        ) : packages.length > 0 ? (
          <div className="space-y-3">
            {packages.map((pkg) => {
              const product = pkg.webBillingProduct;
              return (
              <Button
                key={pkg.identifier}
                variant="gold"
                size="xl"
                className="w-full"
                disabled={purchasing}
                onClick={() => handlePurchase(pkg)}
              >
                {purchasing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Crown size={18} />
                )}
                {product.title || "Elite"} — {product.currentPrice.formattedPrice || "€49/mo"}
              </Button>
              );
            })}
          </div>
        ) : (
          /* Fallback when no RC packages configured yet */
          <div className="rounded-xl border border-gold/20 bg-card p-6 text-center">
            <p className="text-lg font-display font-black text-gold mb-1">€49<span className="text-sm font-semibold text-muted-foreground">/mo</span></p>
            <p className="text-xs text-muted-foreground mb-4">Elite Membership</p>
            <Button
              variant="gold"
              size="xl"
              className="w-full"
              disabled={purchasing}
              onClick={async () => {
                setPurchasing(true);
                try {
                  // Direct purchase flow when no packages configured
                  toast.info("Subscription packages are being set up. Please try again shortly.");
                } finally {
                  setPurchasing(false);
                }
              }}
            >
              <Crown size={18} />
              Unlock Elite — €49/mo
            </Button>
          </div>
        )}
      </div>

      {/* Restore */}
      <div className="text-center mt-6 animate-reveal animate-reveal-delay-3">
        <button onClick={handleRestore} className="text-xs text-muted-foreground hover:text-gold transition-colors underline underline-offset-2">
          Restore purchases
        </button>
      </div>

      {/* Trust line */}
      <div className="text-center mt-8 animate-reveal animate-reveal-delay-4">
        <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
          Secure payment • Cancel anytime • Powered by RevenueCat
        </p>
      </div>
    </div>
  );
};

export default Paywall;
