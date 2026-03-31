import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Crown, Flame, Trophy, Swords, Shield, Zap, Check, ArrowLeft, Loader2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/platform";
import EliteUnlockCelebration from "@/components/EliteUnlockCelebration";

// ─── Constants ──────────────────────────────────────────
const PRODUCT_ID = "elitemonthly499";

const ELITE_FEATURES = [
  { icon: Trophy, text: "Full global leaderboard access" },
  { icon: Swords, text: "1v1 XP & streak battles" },
  { icon: Flame, text: "Post to the Elite Feed" },
  { icon: Zap, text: "2× XP multiplier on all check-ins" },
  { icon: Shield, text: "Exclusive Elite badges" },
  { icon: Crown, text: "Elite status tier & profile glow" },
] as const;

// ─── Component ──────────────────────────────────────────
const Paywall = () => {
  const { isElite, checkSubscription } = useAuth();
  const {
    packages, purchase, purchaseProduct, restorePurchases,
    rcLoading, rcReady, monthlyPriceLabel,
  } = useRevenueCat();
  const navigate = useNavigate();

  const [purchasing, setPurchasing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const wasEliteRef = useRef(isElite);
  const isNative = isNativePlatform();

  // Dynamic price from store, fallback to static
  const displayPrice = isNative ? (monthlyPriceLabel ?? "4,99 €") : "4,99 €";

  // Detect upgrade → celebration
  useEffect(() => {
    if (isElite && !wasEliteRef.current) setShowCelebration(true);
    wasEliteRef.current = isElite;
  }, [isElite]);

  // ─── Celebration ────────────────────────────────────
  if (showCelebration) {
    return (
      <EliteUnlockCelebration
        onComplete={() => { setShowCelebration(false); navigate("/profile"); }}
      />
    );
  }

  // ─── Already Elite ──────────────────────────────────
  if (isElite) {
    return (
      <div className="min-h-screen pb-4 px-4 pt-6 flex flex-col items-center justify-center text-center safe-top">
        <div className="h-20 w-20 rounded-full gradient-gold flex items-center justify-center glow-gold mb-4">
          <Crown size={36} className="text-primary-foreground" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">You're Elite</h1>
        <p className="text-sm text-muted-foreground mb-6">All premium features are unlocked.</p>
        <Button variant="gold-outline" onClick={() => navigate("/profile")}>
          <ArrowLeft size={14} /> Back to Profile
        </Button>
      </div>
    );
  }

  // ─── Handlers ───────────────────────────────────────

  /** Web: Stripe checkout */
  const handleStripeCheckout = async () => {
    setPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL received");

      window.open(data.url, "_blank");
      // Poll for subscription completion
      const poll = setInterval(() => checkSubscription(), 4000);
      setTimeout(() => clearInterval(poll), 180_000);
    } catch (e: any) {
      toast.error(e?.message || "Could not start checkout.");
    } finally {
      setPurchasing(false);
    }
  };

  /** Native: RevenueCat purchase (package → fallback to product ID) */
  const handleNativePurchase = async () => {
    if (!rcReady) { toast.info("Loading store… please wait."); return; }
    setPurchasing(true);
    try {
      // Find the package whose underlying product matches our ID
      const monthlyPkg = packages.find((pkg: any) => {
        const id = pkg?.product?.identifier ?? pkg?.storeProduct?.identifier;
        return id === PRODUCT_ID;
      });

      if (monthlyPkg) {
        await purchase(monthlyPkg);
      } else {
        console.log("[Paywall] No matching package, purchasing by product ID");
        await purchaseProduct(PRODUCT_ID);
      }
      await checkSubscription();
    } catch (e: any) {
      toast.error(e?.message || "Purchase failed.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      await restorePurchases();
      await checkSubscription();
      if (!isElite) toast.success("Purchases restored.");
    } catch {
      toast.error("Could not restore purchases.");
    }
  };

  // ─── Render ─────────────────────────────────────────
  return (
    <div className="min-h-screen pb-4 px-4 pt-6 safe-top">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Hero */}
      <div className="text-center mb-8 animate-reveal">
        <img src="/app-icon.png" alt="The W Tracker" className="h-20 w-20 mx-auto rounded-2xl glow-gold mb-4" />
        <h1 className="font-display text-3xl font-black tracking-tight mb-2">
          Go <span className="text-gold glow-gold-text">Elite</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Unlock the full experience. Compete, flex, and dominate.
        </p>
      </div>

      {/* Features */}
      <div className="rounded-xl glass-card-gold p-5 mb-6 animate-reveal animate-reveal-delay-1 gradient-border-animated shimmer-overlay">
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
        {isNative && rcLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-gold" />
          </div>
        ) : (
          <div className="rounded-xl glass-card-gold p-6 text-center space-y-4 gradient-border-animated">
            <p className="text-lg font-display font-black text-gold mb-1">
              {displayPrice}
              <span className="text-sm font-semibold text-muted-foreground">/kk</span>
            </p>
            <p className="text-xs text-muted-foreground">Elite Membership</p>

            <Button
              variant="gold"
              size="xl"
              className={cn("w-full", !purchasing && "breathing-glow")}
              disabled={purchasing}
              onClick={isNative ? handleNativePurchase : handleStripeCheckout}
            >
              {purchasing ? <Loader2 size={18} className="animate-spin" /> : <Crown size={18} />}
              Unlock Elite — {displayPrice}/kk
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

      {/* Trust */}
      <div className="text-center mt-4 animate-reveal animate-reveal-delay-3">
        <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
          {isNative ? "Secure in-app purchase • Cancel anytime" : "Secure payment via Stripe • Cancel anytime"}
        </p>
      </div>

      {/* Legal */}
      <div className="flex items-center justify-center gap-4 mt-4 mb-8 animate-reveal animate-reveal-delay-3">
        <button onClick={() => navigate("/privacy")} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
          Privacy Policy
        </button>
        <span className="text-[10px] text-muted-foreground">•</span>
        <button onClick={() => navigate("/terms")} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
          Terms of Use
        </button>
      </div>
    </div>
  );
};

export default Paywall;
