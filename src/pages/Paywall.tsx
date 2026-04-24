import { useAuth } from "@/contexts/AuthContext";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Crown, Flame, Trophy, Swords, Sparkles, Zap, Users, ArrowLeft, Loader2, ShieldCheck, Star,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/platform";
import BrandLogo from "@/components/BrandLogo";
import PaywallTierCard from "@/components/PaywallTierCard";
import IosEntryHero from "@/components/paywall/IosEntryHero";
import IosApexSecondary from "@/components/paywall/IosApexSecondary";
import { hapticImpact, hapticNotification } from "@/lib/haptics";

const ELITE_PRODUCT_IDS = ["elitemonthly499", "com.app.elitemonthly499"];
const PRIMARY_ELITE_PRODUCT_ID = ELITE_PRODUCT_IDS[0];

const MEMBER_FEATURES = [
  { icon: Flame, text: "Daily check-ins, XP, streaks" },
  { icon: Trophy, text: "Global leaderboard & seasons" },
  { icon: Swords, text: "1v1 battles" },
  { icon: Sparkles, text: "AI Coach" },
  { icon: Crown, text: "Compete for earned Elite tier" },
] as const;

const APEX_FEATURES = [
  { icon: Zap, text: "Instant Apex status — top 1% tier" },
  { icon: Users, text: "Create Tribes (Communities) — up to 3" },
  { icon: Star, text: "Apex visual effects — flame aura everywhere" },
  { icon: Crown, text: "Tier protected — never drops while subscribed" },
  { icon: Sparkles, text: "All Member features included" },
] as const;

/** Compute a -20% yearly fallback price from a monthly EUR string like "4,99 €". */
const estimateYearlyFromMonthly = (monthly: string, discountPct = 20): string => {
  const match = monthly.match(/(\d+[.,]\d+|\d+)/);
  if (!match) return monthly;
  const num = parseFloat(match[0].replace(",", "."));
  if (!isFinite(num)) return monthly;
  const yearly = num * 12 * (1 - discountPct / 100);
  // Try to detect EUR symbol position
  const hasEuroSuffix = /\d\s*€/.test(monthly);
  const hasEuroPrefix = /€\s*\d/.test(monthly);
  const formatted = yearly.toFixed(2).replace(".", ",");
  if (hasEuroPrefix) return `€${formatted}`;
  if (hasEuroSuffix) return `${formatted} €`;
  return `${formatted} €`;
};

const Paywall = () => {
  const { isElite, isApexSubscriber, checkSubscription, profile } = useAuth();
  const {
    packages, purchase, purchaseProduct, purchaseElitePlan, purchaseApexPlan, restorePurchases,
    rcLoading, rcReady, monthlyPriceLabel, apexPriceLabel,
    eliteYearlyPriceLabel, apexYearlyPriceLabel,
  } = useRevenueCat();
  const navigate = useNavigate();

  const [purchasingTier, setPurchasingTier] = useState<"elite" | "apex" | null>(null);
  const wasMemberRef = useRef(isElite);
  const isNative = isNativePlatform();

  const elitePrice = isNative ? (monthlyPriceLabel ?? "4,99 €") : "4,99 €";
  const apexPrice = isNative ? (apexPriceLabel ?? "17,99 €") : "17,99 €";
  const eliteYearlyPrice = isNative
    ? (eliteYearlyPriceLabel ?? estimateYearlyFromMonthly(elitePrice))
    : estimateYearlyFromMonthly(elitePrice);
  const apexYearlyPrice = isNative
    ? (apexYearlyPriceLabel ?? estimateYearlyFromMonthly(apexPrice))
    : estimateYearlyFromMonthly(apexPrice);

  useEffect(() => {
    if (isElite && !wasMemberRef.current) {
      toast.success("Welcome aboard. Membership active.");
    }
    wasMemberRef.current = isElite;
  }, [isElite]);

  // Already a member
  if (isElite) {
    return (
      <div className="min-h-screen pb-4 px-4 pt-6 flex flex-col items-center justify-center text-center safe-top">
        <div
          className={`h-20 w-20 rounded-full flex items-center justify-center mb-4 ${
            isApexSubscriber ? "" : "gradient-gold glow-gold"
          }`}
          style={
            isApexSubscriber
              ? {
                  background:
                    "linear-gradient(135deg, hsl(18 95% 58%), hsl(var(--gold)))",
                  boxShadow:
                    "0 0 32px hsl(18 95% 58% / 0.5), 0 0 64px hsl(var(--gold) / 0.3)",
                }
              : undefined
          }
        >
          {isApexSubscriber ? (
            <Zap size={36} className="text-background" strokeWidth={2.6} />
          ) : (
            <ShieldCheck size={36} className="text-primary-foreground" />
          )}
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">
          {isApexSubscriber ? "Apex Instant Active" : "Membership Active"}
        </h1>
        <p className="text-sm text-muted-foreground mb-2 max-w-xs">
          {isApexSubscriber
            ? "You have Apex tier instantly. Build a Tribe, lead the community."
            : "You have full access to the app. Now earn your Elite status — it's not bought, it's built."}
        </p>
        {!isApexSubscriber && (
          <p className="text-[11px] text-muted-foreground/70 mb-6 tracking-wide">
            Top 20% rank or 20 active days + 21-day streak
          </p>
        )}
        <div className="flex gap-2 mt-4">
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
            <ShieldCheck size={14} /> Manage my subscription
          </Button>
          {isApexSubscriber ? (
            <Button variant="ember" onClick={() => navigate("/tribes")}>
              <Users size={14} /> Tribes
            </Button>
          ) : (
            <Button variant="ember" onClick={() => navigate("/")}>
              <Crown size={14} /> Road to Elite
            </Button>
          )}
        </div>
      </div>
    );
  }

  const creditsUntilRaw: string | null = (profile as any)?.membership_credits_until ?? null;
  const creditsActive = creditsUntilRaw && new Date(creditsUntilRaw).getTime() > Date.now();
  const creditsUntilLabel = creditsActive
    ? new Date(creditsUntilRaw as string).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : null;

  // ─── Handlers ───────────────────────────────────────
  const handleStripeCheckout = async (
    tier: "elite" | "apex",
    plan: "monthly" | "yearly" = "monthly",
  ) => {
    setPurchasingTier(tier);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { tier, plan },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL received");
      window.open(data.url, "_blank");
      const poll = setInterval(() => checkSubscription(), 4000);
      setTimeout(() => clearInterval(poll), 180_000);
    } catch (e: any) {
      toast.error(e?.message || "Could not start checkout.");
    } finally {
      setPurchasingTier(null);
    }
  };

  const handleNativeElite = async (plan: "monthly" | "yearly" = "monthly") => {
    if (!rcReady) { toast.info("Loading store… please wait."); return; }
    hapticImpact("medium");
    setPurchasingTier("elite");
    try {
      await purchaseElitePlan(plan);
      await checkSubscription();
      hapticNotification("success");
    } catch (e: any) {
      if (e?.userCancelled || e?.code === "1") return;
      hapticNotification("error");
      toast.error(e?.message || "Purchase failed.");
    } finally {
      setPurchasingTier(null);
    }
  };

  const handleNativeApex = async (plan: "monthly" | "yearly" = "monthly") => {
    if (!rcReady) { toast.info("Loading store… please wait."); return; }
    hapticImpact("heavy");
    setPurchasingTier("apex");
    try {
      await purchaseApexPlan(plan);
      await checkSubscription();
      hapticNotification("success");
    } catch (e: any) {
      if (e?.userCancelled || e?.code === "1") return;
      hapticNotification("error");
      toast.error(e?.message || "Apex purchase failed.");
    } finally {
      setPurchasingTier(null);
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
    <div className="min-h-screen pb-8 px-4 pt-6 safe-top">
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

      {/* Hero — softer header on native (the IosEntryHero is the real hero) */}
      {isNative ? (
        <div className="text-center mb-4 mt-2 animate-reveal">
          <BrandLogo size={56} priority className="mx-auto rounded-2xl glow-gold" />
        </div>
      ) : (
        <div className="text-center mb-6 mt-4 animate-reveal">
          <BrandLogo size={72} priority className="mx-auto rounded-2xl glow-gold mb-3" />
          <h1 className="font-display text-2xl font-black tracking-tight mb-1">
            Choose your <span className="text-gold glow-gold-text">level</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Start with Member or skip the grind with Apex Instant. Cancel anytime.
          </p>
        </div>
      )}

      {isNative && rcLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-gold" />
        </div>
      ) : isNative ? (
        // ─── iOS hard entry: dominant Member hero + small Apex secondary ───
        <div className="space-y-3 animate-reveal animate-reveal-delay-1">
          <IosEntryHero
            monthlyPriceLabel={elitePrice}
            yearlyPriceLabel={eliteYearlyPrice}
            loading={purchasingTier === "elite"}
            onCta={handleNativeElite}
          />

          {/* Subtle divider */}
          <div className="flex items-center gap-3 px-2 pt-1">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <span className="text-[9px] font-black tracking-[0.25em] uppercase text-muted-foreground/60">
              Or
            </span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-border to-transparent" />
          </div>

          <IosApexSecondary
            monthlyPriceLabel={apexPrice}
            yearlyPriceLabel={apexYearlyPrice}
            loading={purchasingTier === "apex"}
            onClick={handleNativeApex}
          />

          <p className="text-center text-[10.5px] text-muted-foreground/80 leading-relaxed pt-2 px-2">
            <span className="text-gold font-semibold">Earned Apex</span> (top 1%
            by rank, activity & streak) stays possible at{" "}
            <span className="text-gold font-semibold">{elitePrice}/mo</span> —
            the grind respects those who do it.
          </p>
        </div>
      ) : (
        <div className="space-y-4 animate-reveal animate-reveal-delay-1">
          {/* Member tier */}
          <PaywallTierCard
            variant="elite"
            title="Member"
            badgeLabel="7-day free trial"
            tagline="Full access, then earn your status."
            priceLabel={elitePrice}
            ctaLabel="Start 7-Day Trial"
            ctaIcon={<ShieldCheck size={18} />}
            features={MEMBER_FEATURES}
            loading={purchasingTier === "elite"}
            onCta={() => handleStripeCheckout("elite")}
            footnote={`Free for 7 days, then ${elitePrice}/mo.`}
          />

          {/* Apex Instant tier */}
          <PaywallTierCard
            variant="apex"
            title="Apex Instant"
            badgeLabel="Skip the grind"
            tagline="Instant top 1% status. Lead a Tribe."
            priceLabel={apexPrice}
            ctaLabel="Become Apex Now"
            ctaIcon={<Zap size={18} strokeWidth={2.6} />}
            features={APEX_FEATURES}
            highlighted
            loading={purchasingTier === "apex"}
            onCta={() => handleStripeCheckout("apex")}
            footnote="No trial. Charged immediately. Cancel anytime."
          />

          {/* Earned-vs-bought disclaimer */}
          <div className="rounded-xl border border-gold/15 bg-gold/[0.03] p-3.5 text-center">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="text-gold font-semibold">Earned Apex</span> (top
              1% by rank, activity & streak) is still possible at{" "}
              <span className="text-gold font-semibold">{elitePrice}/mo</span>{" "}
              — the grind respects those who do it.
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
        <button onClick={handleRestore} className="text-xs text-muted-foreground hover:text-gold transition-colors underline underline-offset-2">
          Restore purchases
        </button>
      </div>

      <div className="text-center mt-4">
        <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
          {isNative ? "Secure in-app purchase • Cancel anytime" : "Secure payment via Stripe • Cancel anytime"}
        </p>
      </div>

      <div className="flex items-center justify-center gap-4 mt-4 mb-6">
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
