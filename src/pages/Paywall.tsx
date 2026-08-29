import { useAuth } from "@/contexts/AuthContext";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { useNavigate } from "react-router-dom";
import { friendlyError } from "@/lib/error-copy";
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
import { track, FUNNEL } from "@/lib/analytics";

const PREMIUM_YEARLY_FALLBACK = "49,99 €"; // must match the Stripe yearly price — 47,99 shown vs 49,99 charged eroded trust
const PREMIUM_MONTHLY_FALLBACK = "4,99 €";

type PurchaseStatus = "idle" | "purchasing" | "verifying" | "error";

const Paywall = () => {
  const { isElite, isPremium, checkSubscription, profile, subscriptionLoading } = useAuth();
  const {
    purchasePremiumPlan, restorePurchases,
    rcLoading, rcReady,
    monthlyPriceLabel, yearlyPriceLabel, yearlyAvailable,
  } = useRevenueCat();
  const navigate = useNavigate();
  const isNative = isNativePlatform();

  // Single state machine for the whole purchase flow
  const [status, setStatus] = useState<PurchaseStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wasMemberRef = useRef(isElite);

  // Live prices from the store (native); web uses the configured fallbacks.
  const monthlyLabel = (isNative && monthlyPriceLabel) || PREMIUM_MONTHLY_FALLBACK;
  const yearlyLabel = (isNative && yearlyPriceLabel) || PREMIUM_YEARLY_FALLBACK;
  // On native, only offer the yearly toggle if the store actually has an
  // annual package — otherwise we'd advertise a plan we can't fulfill.
  const showYearly = !isNative || yearlyAvailable;

  // Top of the monetization funnel — record paywall exposure once per mount.
  useEffect(() => {
    track(FUNNEL.paywallViewed, { native: isNative });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Welcome toast on transition into membership (once per session)
  useEffect(() => {
    if (isElite && !wasMemberRef.current) {
      if (!sessionStorage.getItem("w_welcome_toast_shown")) {
        sessionStorage.setItem("w_welcome_toast_shown", "1");
        toast.success("Welcome to Premium. Full access unlocked.");
      }
    }
    wasMemberRef.current = isElite;
  }, [isElite]);

  // Once Premium is active, leave the paywall behind
  useEffect(() => {
    if (!isPremium) return;
    navigate("/", { replace: true });
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
      <div className="min-h-full pb-4 px-4 pt-6 flex flex-col items-center justify-center text-center safe-top">
        <div className="h-20 w-20 rounded-full flex items-center justify-center mb-4 gradient-gold glow-gold">
          <Sparkles size={36} className="text-primary-foreground" strokeWidth={2.4} />
        </div>
        <h1 className="font-display text-2xl font-black mb-2">You're Premium.</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          Full access unlocked. New content every week — your price stays locked.
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
          <Button variant="ember" onClick={() => navigate("/")}>
            <Crown size={14} /> Enter app
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
    track(FUNNEL.purchaseStarted, { plan, platform: "native" });

    try {
      await purchasePremiumPlan(plan);
      setStatus("verifying");
      const ok = await pollVerification(8000);
      if (ok) {
        track(FUNNEL.purchaseCompleted, { plan, platform: "native" });
        hapticNotification("success");
        // Effect above will navigate home when isPremium flips true
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
        track(FUNNEL.purchaseCancelled, { plan, platform: "native" });
        setStatus("idle");
        return;
      }
      track(FUNNEL.purchaseFailed, { plan, platform: "native", reason: e?.message?.toString().slice(0, 120) });
      hapticNotification("error");
      setStatus("error");
      setErrorMessage(friendlyError(e, "Purchase failed. Please try again."));
    }
  };

  // ─── Web (Stripe) purchase handler ───────────────────────────
  const handleWebPurchase = async (plan: "monthly" | "yearly") => {
    setErrorMessage(null);
    setStatus("purchasing");
    track(FUNNEL.purchaseStarted, { plan, platform: "web" });
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { tier: "elite", plan }, // server treats elite as Premium
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL received");
      window.open(data.url, "_blank");
      setStatus("verifying");
      const ok = await pollVerification(180_000);
      if (ok) {
        track(FUNNEL.purchaseCompleted, { plan, platform: "web" });
      } else {
        setStatus("idle");
      }
    } catch (e: any) {
      track(FUNNEL.purchaseFailed, { plan, platform: "web", reason: e?.message?.toString().slice(0, 120) });
      setStatus("error");
      setErrorMessage(friendlyError(e, "Could not start checkout. Please try again."));
    }
  };

  const handleRestore = async () => {
    hapticImpact("light");
    setErrorMessage(null);
    try {
      await restorePurchases();
      await checkSubscription();
      track(FUNNEL.purchaseRestored);
      toast.success("Purchases restored.");
      hapticNotification("success");
    } catch {
      toast.error("Could not restore purchases.");
      hapticNotification("error");
    }
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-full pb-8 px-4 pt-6 safe-top">
      {/* Escape hatch — the bottom nav and header are hidden on /paywall, so
          without this the page is a hard dead end (trial users tapping the
          header pill were stuck). */}
      <button
        onClick={() => navigate(-1)}
        className="mb-2 h-10 w-10 rounded-full flex items-center justify-center bg-card/70 border border-border/60 active:scale-95 transition"
        aria-label="Back"
      >
        <ArrowLeft size={18} />
      </button>

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
          <p className="text-[12px] text-muted-foreground mt-1">
            Earned from referrals — the app stays fully unlocked until then.
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
            yearlyAvailable={showYearly}
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
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              <span className="text-gold font-semibold">Apex status</span> (top
              10% by rank, activity & streak) can't be bought — only earned.{" "}
              Premium unlocks <span className="text-foreground font-semibold">the full app</span>.
            </p>
          </div>
        </div>
      )}

      {/* Restore */}
      <div className="text-center mt-6 animate-reveal animate-reveal-delay-3">
        <button
          onClick={handleRestore}
          className="text-xs text-muted-foreground hover:text-gold transition-colors underline underline-offset-2"
        >
          Restore purchases
        </button>
      </div>

      <div className="text-center mt-4">
        <p className="text-[11px] text-muted-foreground tracking-wider uppercase">
          {isNative ? "Secure in-app purchase • Cancel anytime" : "Secure payment via Stripe • Cancel anytime"}
        </p>
      </div>

      <div className="flex items-center justify-center gap-4 mt-4 mb-6">
        <button
          onClick={() => navigate("/privacy")}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Privacy Policy
        </button>
        <span className="text-[11px] text-muted-foreground">•</span>
        <button
          onClick={() => navigate("/terms")}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Terms of Use
        </button>
      </div>
    </div>
  );
};

export default Paywall;
