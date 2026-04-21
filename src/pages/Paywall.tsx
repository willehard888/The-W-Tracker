import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Crown, Flame, Trophy, Swords, Sparkles, Zap, Check, ArrowLeft, Loader2, ShieldCheck,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/platform";
import BrandLogo from "@/components/BrandLogo";
import { hapticImpact, hapticNotification } from "@/lib/haptics";

// ─── Constants ──────────────────────────────────────────
const PRODUCT_IDS = ["elitemonthly499", "com.app.elitemonthly499"];
const PRIMARY_PRODUCT_ID = PRODUCT_IDS[0];

/**
 * What a membership gets you. Reframed as "the app experience" — Elite-tier
 * perks (badges, profile glow) are EARNED, not purchased.
 */
const MEMBER_FEATURES = [
  { icon: Flame, text: "Daily check-ins, XP, levels & streaks" },
  { icon: Trophy, text: "Global leaderboard & monthly seasons" },
  { icon: Swords, text: "1v1 battles vs other members" },
  { icon: Sparkles, text: "AI Coach — personal performance assistant" },
  { icon: Zap, text: "Read the Elite Feed — top performers' wins" },
  { icon: Crown, text: "Compete for the earned Elite status tier" },
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
  const wasMemberRef = useRef(isElite);
  const isNative = isNativePlatform();

  const displayPrice = isNative ? (monthlyPriceLabel ?? "4,99 €") : "4,99 €";

  // Toast on upgrade
  useEffect(() => {
    if (isElite && !wasMemberRef.current) {
      toast.success("Welcome aboard. Membership active.");
    }
    wasMemberRef.current = isElite;
  }, [isElite]);

  // ─── Already a member ───────────────────────────────
  if (isElite) {
    return (
      <div className="min-h-screen pb-4 px-4 pt-6 flex flex-col items-center justify-center text-center safe-top">
        <div className="h-20 w-20 rounded-full gradient-gold flex items-center justify-center glow-gold mb-4">
          <ShieldCheck size={36} className="text-primary-foreground" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">Membership Active</h1>
        <p className="text-sm text-muted-foreground mb-2 max-w-xs">
          You have full access to the app. Now earn your Elite status — it's not bought, it's built.
        </p>
        <p className="text-[11px] text-muted-foreground/70 mb-6 tracking-wide">
          Top 5% rank • 14 active days • 30-day streak
        </p>
        <div className="flex gap-2">
          <Button variant="gold-outline" onClick={() => navigate("/profile")}>
            <ArrowLeft size={14} /> Back to Profile
          </Button>
          <Button variant="gold" onClick={() => navigate("/")}>
            <Crown size={14} /> Road to Elite
          </Button>
        </div>
      </div>
    );
  }

  // ─── Handlers ───────────────────────────────────────
  const handleStripeCheckout = async () => {
    setPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL received");

      window.open(data.url, "_blank");
      const poll = setInterval(() => checkSubscription(), 4000);
      setTimeout(() => clearInterval(poll), 180_000);
    } catch (e: any) {
      toast.error(e?.message || "Could not start checkout.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleNativePurchase = async () => {
    if (!rcReady) { toast.info("Loading store… please wait."); return; }
    hapticImpact("medium");
    setPurchasing(true);
    try {
      const monthlyPkg = packages.find((pkg: any) => {
        const id = pkg?.product?.identifier ?? pkg?.storeProduct?.identifier;
        return id === PRIMARY_PRODUCT_ID;
      }) ?? packages.find((pkg: any) => {
        const id = pkg?.product?.identifier ?? pkg?.storeProduct?.identifier;
        return PRODUCT_IDS.includes(id);
      });

      if (monthlyPkg) {
        await purchase(monthlyPkg);
      } else {
        await purchaseProduct(PRIMARY_PRODUCT_ID);
      }

      await checkSubscription();
      hapticNotification("success");
    } catch (e: any) {
      if (e?.userCancelled || e?.code === "1") return;
      hapticNotification("error");
      toast.error(e?.message || "Purchase failed.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    hapticImpact("light");
    try {
      await restorePurchases();
      await checkSubscription();
      toast.success("Purchases restored.");
      hapticNotification("success");
    } catch {
      toast.error("Could not restore purchases.");
      hapticNotification("error");
    }
  };

  // ─── Render ─────────────────────────────────────────
  return (
    <div className="min-h-screen pb-4 px-4 pt-6 safe-top">
      {/* Hero */}
      <div className="text-center mb-6 mt-4 animate-reveal">
        <BrandLogo size={80} priority className="mx-auto rounded-2xl glow-gold mb-4" />
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/10 border border-gold/25 mb-3">
          <ShieldCheck size={12} className="text-gold" />
          <span className="text-[10px] font-bold text-gold tracking-widest uppercase">
            Membership required
          </span>
        </div>
        <h1 className="font-display text-3xl font-black tracking-tight mb-2">
          Become a <span className="text-gold glow-gold-text">Member</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {displayPrice}/month unlocks the full app. Then start your Road to Elite — the in-app status earned by the top 5%.
        </p>
      </div>

      {/* Pricing */}
      <div className="animate-reveal animate-reveal-delay-1 mb-6">
        {isNative && rcLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-gold" />
          </div>
        ) : (
          <div className="rounded-xl glass-card-gold p-6 text-center gradient-border-animated relative overflow-hidden">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/15 border border-gold/30 mb-3">
              <Zap size={12} className="text-gold" />
              <span className="text-[10px] font-bold text-gold tracking-widest uppercase">
                7-day free trial
              </span>
            </div>

            <p className="text-3xl font-display font-black text-gold mb-1 leading-none">
              {displayPrice}
              <span className="text-base font-semibold text-muted-foreground">/mo</span>
            </p>
            <p className="text-xs text-muted-foreground mb-1">App Membership</p>
            <p className="text-[11px] text-muted-foreground/80 mb-4">
              Free for 7 days, then {displayPrice}/mo. Cancel anytime.
            </p>

            <Button
              variant="gold"
              size="xl"
              className={cn("w-full", !purchasing && "breathing-glow")}
              disabled={purchasing}
              onClick={isNative ? handleNativePurchase : handleStripeCheckout}
            >
              {purchasing ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              Start 7-Day Free Trial
            </Button>
          </div>
        )}
      </div>

      {/* What you get */}
      <div className="rounded-xl glass-card-gold p-5 mb-4 animate-reveal animate-reveal-delay-2 gradient-border-animated shimmer-overlay">
        <h2 className="font-display font-bold text-sm mb-4 text-gold">What your membership gives you</h2>
        <div className="space-y-3">
          {MEMBER_FEATURES.map(({ icon: Icon, text }) => (
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

      {/* Earned-status disclaimer */}
      <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 mb-6 animate-reveal animate-reveal-delay-2">
        <div className="flex items-start gap-3">
          <Crown size={16} className="text-gold shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-gold mb-1 tracking-wide">
              Elite status is EARNED, not bought
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Membership unlocks the app. Elite — the gold tier with profile glow, posting rights on the Elite Feed, and top-5% recognition — is earned through real consistency: top 5% rank score, 14 active days in 30, and a 30-day streak.
            </p>
          </div>
        </div>
      </div>

      {/* Restore */}
      <div className="text-center animate-reveal animate-reveal-delay-3">
        <button
          onClick={() => navigate("/ios-debug")}
          className="mr-3 text-xs text-muted-foreground hover:text-gold transition-colors underline underline-offset-2"
        >
          iOS Debug
        </button>
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
