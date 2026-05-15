import { useAuth } from "@/contexts/AuthContext";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Crown, ArrowLeft, Loader2, ShieldCheck, Sparkles,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/platform";
import BrandLogo from "@/components/BrandLogo";
import PremiumHero from "@/components/paywall/PremiumHero";
import { hapticImpact, hapticNotification } from "@/lib/haptics";

const PREMIUM_YEARLY_FALLBACK = "172,99 €";
const PREMIUM_MONTHLY_FALLBACK = "17,99 €";

type PurchaseStatus = "idle" | "purchasing" | "verifying" | "error";

const Paywall = () => {
  const { isElite, isPremium, checkSubscription, profile, subscriptionLoading } = useAuth();
  const {
    purchasePremiumPlan, restorePurchases,
    rcLoading, rcReady,
    premiumPriceLabel, premiumYearlyPriceLabel,
    apexPriceLabel, apexYearlyPriceLabel,
  } = useRevenueCat();
  const navigate = useNavigate();
  const isNative = isNativePlatform();

  // Single state machine for the whole purchase flow
  const [status, setStatus] = useState<PurchaseStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wasMemberRef = useRef(isElite);

  // Live prices — prefer Premium product price, fallback to Apex (same €17.99)
  const monthlyLabel =
    (isNative && (premiumPriceLabel ?? apexPriceLabel)) || PREMIUM_MONTHLY_FALLBACK;
  const yearlyLabel =
    (isNative && (premiumYearlyPriceLabel ?? apexYearlyPriceLabel)) || PREMIUM_YEARLY_FALLBACK;

  // Welcome toast on transition into membership (once per session)
  useEffect(() => {
    if (isElite && !wasMemberRef.current) {
      if (!sessionStorage.getItem("w_welcome_toast_shown")) {
        sessionStorage.setItem("w_welcome_toast_shown", "1");
        toast.success("Welcome to Premium. The Vault is unlocked.");
      }
    }
    wasMemberRef.current = isElite;
  }, [isElite]);

  // Once Premium is active, leave the paywall behind
  useEffect(() => {
    if (!isPremium) return;
    navigate("/vault", { replace: true });
  }, [isPremium, navigate]);

  // Web: re-check on focus / visibility
  useEffect(() => {
    if (isNative) return;
    const sync = () => { void checkSubscription(); };
    const onVis = () => { if (document.visibilityState === "visible") sync(); };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [checkSubscription, isNative]);

  // ─── Verify membership by polling checkSubscription ──────────
  // NOTE: this useCallback MUST sit above the `if (isElite) return ...`
  // early-return below. Previously it lived after the early return, which
  // caused React's "Rendered fewer hooks than expected" error the moment a
  // user's membership flipped on (the hook count differed across renders).
  const pollVerification = useCallback(async (timeoutMs = 8000): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        await checkSubscription();
        // checkSubscription updates AuthContext; we read isElite via closure.
        // Re-read from supabase as a safety net so we don't rely on async state.
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("is_elite, is_premium")
            .eq("user_id", user.id)
            .maybeSingle();
          if (data?.is_premium || data?.is_elite) return true;
        }
      } catch {
        /* swallow & retry */
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }, [checkSubscription]);

  // ─── Already a member ────────────────────────────────────────
  if (isElite) {
    return (
      <div className="min-h-screen pb-4 px-4 pt-6 flex flex-col items-center justify-center text-center safe-top">
        <div className="h-20 w-20 rounded-full flex items-center justify-center mb-4 gradient-gold glow-gold">
          <Sparkles size={36} className="text-primary-foreground" strokeWidth={2.4} />
        </div>
        <h1 className="font-display text-2xl font-black mb-2">You're Premium.</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          The Vault is unlocked. New drops every week — your price stays locked.
        </p>
        <div className="flex gap-2 mt-2 flex-wrap justify-center">
          <Button variant="gold-outline" onClick={() => navigate("/profile")}>
            <ArrowLeft size={14} /> Profile
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              if (isNativePlatform()) {
                window.open("https://apps.apple.com/account/subscriptions", "_blank");
                return;
              }
              const { data, error } = await supabase.functions.invoke("customer-portal");
              if (error || !data?.url) {
                toast.error("Could not open subscription management.");
                return;
              }
              window.open(data.url, "_blank");
            }}
          >
            <ShieldCheck size={14} /> Manage subscription
          </Button>
          <Button variant="ember" onClick={() => navigate("/vault")}>
            <Crown size={14} /> Open the Vault
          </Button>
        </div>
      </div>
    );
  }

  const creditsUntilRaw: string | null = (profile as any)?.membership_credits_until ?? null;
  const creditsActive = creditsUntilRaw && new Date(creditsUntilRaw).getTime() > Date.now();
  const creditsUntilLabel = creditsActive
    ? new Date(creditsUntilRaw as string).toLocaleDateString(undefined, {
        day: "numeric", month: "short", year: "numeric",
      })
    : null;

  // ─── Native purchase handler ─────────────────────────────────
  const handleNativePurchase = async (plan: "monthly" | "yearly") => {
    if (!rcReady) {
      setStatus("error");
      setErrorMessage("Store not ready yet — please try again in a moment.");
      return;
    }
    setErrorMessage(null);
    hapticImpact("medium");
    setStatus("purchasing");

    try {
      await purchasePremiumPlan(plan);
      setStatus("verifying");
      const ok = await pollVerification(8000);
      if (ok) {
        hapticNotification("success");
        // Effect above will navigate to /vault when isPremium flips true
      } else {
        setStatus("error");
        setErrorMessage(
          "Payment confirmed but we couldn't verify access yet. Pull to refresh in a moment, or tap Restore.",
        );
        hapticNotification("warning");
      }
    } catch (e: any) {
      // User cancellation — silently return to idle
      if (e?.userCancelled || e?.code === "1" || e?.code === 1) {
        setStatus("idle");
        return;
      }
      hapticNotification("error");
      setStatus("error");
      setErrorMessage(
        e?.message?.toString().slice(0, 200) || "Purchase failed. Please try again.",
      );
    }
  };

  // ─── Web (Stripe) purchase handler ───────────────────────────
  const handleWebPurchase = async (plan: "monthly" | "yearly") => {
    setErrorMessage(null);
    setStatus("purchasing");
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { tier: "elite", plan }, // server treats elite as Premium
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL received");
      window.open(data.url, "_blank");
      setStatus("verifying");
      const ok = await pollVerification(180_000);
      if (!ok) {
        setStatus("idle");
      }
    } catch (e: any) {
      setStatus("error");
      setErrorMessage(e?.message || "Could not start checkout.");
    }
  };

  const handleRestore = async () => {
    hapticImpact("light");
    setErrorMessage(null);
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

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-8 px-4 pt-6 safe-top">
      {subscriptionLoading && !isElite && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/80 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          Verifying membership…
        </div>
      )}

      {creditsActive && (
        <div className="animate-reveal mb-4 rounded-xl border border-gold/40 bg-gold/10 p-4 text-center">
          <p className="text-xs font-bold text-gold tracking-wide">
            🎁 Free membership until {creditsUntilLabel}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Earned from referral milestones — next payment auto-skipped.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-4 mt-2 animate-reveal">
        <BrandLogo size={isNative ? 56 : 64} priority className="mx-auto rounded-2xl glow-gold" />
      </div>

      {isNative && rcLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-gold" />
        </div>
      ) : (
        <div className="animate-reveal animate-reveal-delay-1">
          <PremiumHero
            monthlyPriceLabel={monthlyLabel}
            yearlyPriceLabel={yearlyLabel}
            status={status}
            errorMessage={errorMessage}
            onDismissError={() => {
              setStatus("idle");
              setErrorMessage(null);
            }}
            onCta={isNative ? handleNativePurchase : handleWebPurchase}
          />

          {/* Earned-Apex disclaimer */}
          <div className="mt-3 rounded-xl border border-gold/15 bg-gold/[0.03] p-3.5 text-center">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="text-gold font-semibold">Apex status</span> (top
              10% by rank, activity & streak) can't be bought — only earned.
              <br className="hidden sm:block" />
              Premium unlocks <span className="text-foreground font-semibold">The Vault</span> and the full app.
            </p>
          </div>
        </div>
      )}

      {/* Restore */}
      <div className="text-center mt-6 animate-reveal animate-reveal-delay-3">
        <button
          onClick={() => navigate("/ios-debug")}
          className="mr-3 text-xs text-muted-foreground hover:text-gold transition-colors underline underline-offset-2"
        >
          iOS Debug
        </button>
        <button
          onClick={handleRestore}
          className="text-xs text-muted-foreground hover:text-gold transition-colors underline underline-offset-2"
        >
          Restore purchases
        </button>
      </div>

      <div className="text-center mt-4">
        <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
          {isNative ? "Secure in-app purchase • Cancel anytime" : "Secure payment via Stripe • Cancel anytime"}
        </p>
      </div>

      <div className="flex items-center justify-center gap-4 mt-4 mb-6">
        <button
          onClick={() => navigate("/privacy")}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Privacy Policy
        </button>
        <span className="text-[10px] text-muted-foreground">•</span>
        <button
          onClick={() => navigate("/terms")}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Terms of Use
        </button>
      </div>
    </div>
  );
};

export default Paywall;
